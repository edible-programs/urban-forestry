import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { filterTrees, csv, featureCollection, names, normalize, matchSpecies, seasonalMonths, validDate } from '../src/data.js';

const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const inventory = await readJson('../public/data/trees.json');
const manifest = await readJson('../data/source-manifest.json');
const pruning = await readJson('../data/tree-pruning.json');
const reference = await readJson('../data/species.json');
const index = Object.fromEntries(inventory.columns.map((key, i) => [key, i]));

test('current population is complete, unique, and separate from the inflated legacy archive', () => {
  const current = manifest.sources.find(source => source.id === 'tkzw-k3nq');
  const archive = manifest.sources.find(source => source.id === 'uzd4-f6yf');
  assert.ok(current && archive);
  assert.equal(inventory.rows.length, current.count);
  assert.equal(inventory.meta.totalTrees, current.count);
  assert.notEqual(current.count, archive.count);
  assert.equal(new Set(inventory.rows.map(row => row[index.id])).size, current.count);
  assert.ok(inventory.rows.every(row => row.length === inventory.columns.length));
  assert.ok(inventory.rows.every(row => Number.isInteger(row[index.id]) && row[index.id] > 0));
  assert.equal(inventory.species.reduce((sum, item) => sum + item.count, 0), current.count);
});

test('all mapped records have plausible SF coordinates; missing locations remain in the dataset', () => {
  let mapped = 0, missing = 0;
  for (const row of inventory.rows) {
    const lat = row[index.lat], lng = row[index.lng];
    if (lat == null || lng == null) { missing++; continue; }
    assert.ok(Number.isFinite(lat) && Number.isFinite(lng), `Tree ${row[index.id]} has nonnumeric coordinates`);
    assert.ok(lat >= 37.6 && lat <= 37.85 && lng >= -122.6 && lng <= -122.3, `Tree ${row[index.id]} is outside SF bounds`);
    mapped++;
  }
  assert.equal(mapped, inventory.meta.mappedTrees);
  assert.equal(missing, inventory.meta.coordinatesMissing);
  assert.equal(mapped + missing, inventory.rows.length);
  assert.ok(missing > 0, 'Do not silently discard records without coordinates');
});

test('dates, source quality notes, and removal notices retain their documented coverage', () => {
  assert.equal(inventory.rows.filter(row => row[index.plantedDate] != null).length, inventory.meta.plantingDatesKnown);
  assert.ok(inventory.meta.plantingDatesKnown < inventory.meta.totalTrees);
  assert.ok(inventory.rows.every(row => row[index.plantedDate] == null || validDate(row[index.plantedDate])));
  assert.equal(inventory.rows.filter(row => row[index.archiveRecorded]).length, inventory.meta.legacyMatched);
  assert.equal(inventory.rows.filter(row => row[index.permitNotes]).length, inventory.meta.permitReferences);
  assert.equal(inventory.removals.length, manifest.sources.find(source => source.id === 'qrwx-q4gg').count);
  assert.ok(inventory.removals.every(row => row.length === inventory.removalColumns.length));
  assert.ok(inventory.meta.sourceQuality.placeholderRecords > 0);
  assert.match(inventory.meta.sourceQuality.speciesCountMeaning, /labels/);
});

test('pruning mappings have unique tree IDs and join by ID without inventing coverage', () => {
  assert.equal(pruning.rows.length, pruning.rowCount);
  const treeIdIndex = pruning.columns.indexOf('treeId');
  assert.ok(treeIdIndex >= 0);
  const ids = new Set(pruning.rows.map(row => Number(row[treeIdIndex])));
  assert.equal(ids.size, pruning.rowCount);
  const joined = inventory.rows.filter(row => ids.has(row[index.id])).length;
  assert.ok(joined > inventory.rows.length * 0.8);
  assert.ok(joined < inventory.rows.length, 'Unmatched trees must stay unknown rather than receive an invented pruning zone');
  assert.match(pruning.source, /arcgis/);
});

test('precompressed browser snapshot expands to exactly the served dataset', async () => {
  const [plain, compressed] = await Promise.all([
    readFile(new URL('../public/data/trees.json', import.meta.url)),
    readFile(new URL('../public/data/trees.json.gz', import.meta.url)),
  ]);
  assert.deepEqual(gunzipSync(compressed), plain);
});

test('flagged non-tree source labels stay inspectable without receiving invented botanical traits', () => {
  const declared = inventory.meta.sourceQuality.placeholderLabels;
  assert.equal(declared.reduce((sum,item) => sum + item.count, 0), inventory.meta.sourceQuality.placeholderRecords);
  const labels = new Set(declared.map(item => item.name));
  assert.equal(inventory.rows.filter(row => labels.has(row[index.species])).length, inventory.meta.sourceQuality.placeholderRecords);
  for (const item of declared) {
    assert.equal(inventory.species.find(facet => facet.name === item.name)?.count, item.count);
    assert.equal(matchSpecies(item.name, reference.species), null, `${item.name} must not inherit a living-tree trait record`);
  }
});

function tree(values) {
  const result = { id: 0, species: 'Unidentified', address: '', street: '', neighborhood: '', dbh: null, plantedDate: null, traits: null, legalStatus: 'DPW Maintained', pruneStatus: 'Unknown', lat: null, lng: null, ...values };
  result.search = `${result.id} ${result.species} ${result.address} ${result.street} ${result.neighborhood}`.toLowerCase();
  return result;
}
const trees = [
  tree({ id:1, species:'Quercus agrifolia :: Coast live oak', address:'100 Oak St', street:'Oak St', neighborhood:'Haight Ashbury', dbh:30, plantedDate:'1970-04-01', pruneStatus:'Completed', lat:37.77, lng:-122.44, traits:{californiaNative:true,sanFranciscoNative:true,leafHabit:'Evergreen',waterNeed:'Low',bloomSeasons:['Winter'],bloomMonths:[1,2,12],matureHeightMaxFt:60,family:'Fagaceae',associatedWildlife:['Birds','Butterflies'],bloomColors:['Cream'],rootDamagePotential:'Moderate',utilityFriendly:false} }),
  tree({ id:2, species:'Prunus serrulata :: Flowering cherry', address:'102 Oak St', street:'Oak St', neighborhood:'Haight Ashbury', dbh:8, plantedDate:'2019-01-01', pruneStatus:'Upcoming', lat:37.771, lng:-122.441, traits:{californiaNative:false,sanFranciscoNative:false,leafHabit:'Deciduous',waterNeed:'Medium',bloomSeasons:['Spring'],bloomMonths:[3,4],matureHeightMaxFt:25,family:'Rosaceae',associatedWildlife:['Bees'],bloomColors:['Pink','White'],rootDamagePotential:'Low',utilityFriendly:true} }),
  tree({ id:3, address:'104 Oak St', street:'Oak St', neighborhood:'Haight Ashbury' }),
  tree({ id:4, species:'Magnolia grandiflora :: Southern magnolia', address:'1719 Green St', street:'Green St', neighborhood:'Marina', dbh:28, plantedDate:'1984-03-19', pruneStatus:'Active', lat:37.797, lng:-122.428, traits:{californiaNative:false,leafHabit:'Evergreen',waterNeed:'Moderate',bloomSeasons:['Summer','Autumn'],bloomMonths:[6,7,8,9],matureHeightMaxFt:80} }),
  tree({ id:5, species:'Ceanothus thyrsiflorus :: Blue blossom', address:'200 Mission St', street:'Mission St', neighborhood:'Mission', dbh:6, plantedDate:'2020-02-20', pruneStatus:'Upcoming', lat:37.76, lng:-122.42, traits:{californiaNative:true,sanFranciscoNative:true,leafHabit:'Evergreen',waterNeed:'Low',bloomSeasons:['Spring'],bloomMonths:[3,4,5],matureHeightMaxFt:20,family:'Rhamnaceae',associatedWildlife:['Bees','Butterflies'],bloomColors:['Blue'],rootDamagePotential:'Low',utilityFriendly:true} }),
];
const ids = list => list.map(item => item.id);

test('search and compound location/botanical filters return the intersecting records', () => {
  assert.deepEqual(ids(filterTrees(trees, { query:' OAK ', neighborhood:'Haight Ashbury', native:true, habit:'Evergreen', water:'Low' })), [1]);
  assert.deepEqual(ids(filterTrees(trees, { street:'green', minDbh:24, maxDbh:30, height:'large' })), [4]);
  assert.deepEqual(ids(filterTrees(trees, { query:'1719' })), [4]);
  assert.deepEqual(ids(filterTrees(trees, { species:trees[1].species })), [2]);
  assert.deepEqual(ids(filterTrees(trees, { legal:'DPW Maintained', prune:'Upcoming' })), [2,5]);
});

test('botanical filters exclude unknown traits and flowering respects the selected month', () => {
  assert.deepEqual(ids(filterTrees(trees, { native:true })), [1,5]);
  assert.deepEqual(ids(filterTrees(trees, { bloom:true, currentMonth:4 })), [2,5]);
  assert.deepEqual(ids(filterTrees(trees, { bloom:true, currentMonth:4, native:true })), [5]);
  assert.deepEqual(ids(filterTrees(trees, { season:'Fall' })), [4]);
  assert.deepEqual(seasonalMonths({bloomSeasons:['Winter','Spring']}), [12,1,2,3,4,5]);
  assert.deepEqual(seasonalMonths({bloomMonths:[7],bloomSeasons:['Spring']}), [7]);
});

test('advanced botanical filters intersect documented traits and exclude missing values', () => {
  const cases = [
    [{family:'Fagaceae'}, [1]],
    [{wildlife:'bees'}, [2,5]],
    [{flowerColor:'white'}, [2]],
    [{rootRisk:'Low'}, [2,5]],
    [{utility:true}, [2,5]],
    [{sfNative:true}, [1,5]],
    [{sfNative:true,wildlife:'Butterflies',rootRisk:'Low',utility:true,flowerColor:'Blue',family:'Rhamnaceae'}, [5]],
  ];
  for (const [filters,expected] of cases) {
    const result = ids(filterTrees(trees, filters));
    assert.deepEqual(result, expected, JSON.stringify(filters));
    assert.ok(!result.includes(3), 'Unreported traits must never satisfy a botanical filter');
  }
  assert.deepEqual(ids(filterTrees(trees, {family:'Rosaceae',sfNative:true})), []);
});

test('the Moderate water filter also accepts the source synonym Medium', () => {
  assert.deepEqual(ids(filterTrees(trees, {water:'Moderate'})), [2,4]);
  assert.deepEqual(ids(filterTrees(trees, {water:'Moderate',habit:'Deciduous'})), [2]);
});

test('planting lens treats undated records explicitly and uses recorded cohorts', () => {
  assert.deepEqual(ids(filterTrees(trees, { timeline:true, year:1980, includeUndated:false })), [1]);
  assert.deepEqual(ids(filterTrees(trees, { timeline:true, year:1980, includeUndated:true })), [1,3]);
  assert.deepEqual(ids(filterTrees(trees, { plantedOnly:true })), [1,2,4,5]);
  assert.deepEqual(ids(filterTrees(trees, { minDbh:0 })), [1,2,4,5], 'Unknown DBH is not a zero-inch observation');
});

test('viewport filtering and GeoJSON export exclude missing positions and preserve longitude/latitude order', () => {
  const bounds = { contains:([lng,lat]) => lng >= -122.45 && lng <= -122.43 && lat >= 37.765 && lat <= 37.78 };
  assert.deepEqual(ids(filterTrees(trees, { inBounds:true }, bounds)), [1,2]);
  const output = featureCollection([...trees, tree({id:6,lat:NaN,lng:-122.4}), tree({id:7,lat:37.7,lng:Infinity})]);
  assert.equal(output.type, 'FeatureCollection');
  assert.equal(output.features.length, 4);
  assert.deepEqual(output.features[0].geometry, {type:'Point',coordinates:[-122.44,37.77]});
  assert.equal(output.features[0].id, 1);
  assert.equal(output.features[0].properties.species, trees[0].species);
});

test('GeoJSON preserves field notes, reference traits, schedule context, and source provenance on round trip', () => {
  const selected = {...trees[0],commonName:'Coast live oak',scientificName:'Quercus agrifolia',zone:{keymap:'065'},pruningSchedule:'Upcoming 2026',pruningCompleteDates:['2024-01-01'],californiaNative:true,referenceHeightMaxFt:60,referenceSpreadMaxFt:70,bloomSeasons:['Winter'],permitNotes:'Permit Number 123',archivePlantDate:'1969-11-01',archiveDbh:28,fieldNote:'North branch: "check after rain"\nPhoto on file.',personalCondition:'Needs review',source:'https://data.sfgov.org/d/tkzw-k3nq',snapshot:'2026-10-16'};
  const exported = JSON.parse(JSON.stringify(featureCollection([selected]))).features[0];
  assert.equal(exported.properties.fieldNote, selected.fieldNote);
  assert.equal(exported.properties.personalCondition, 'Needs review');
  assert.equal(exported.properties.source, selected.source);
  assert.equal(exported.properties.snapshot, '2026-10-16');
  assert.equal(exported.properties.pruningZone, '065');
  assert.equal(exported.properties.pruningSchedule, 'Upcoming 2026');
  assert.deepEqual(exported.properties.pruningCompleteDates, ['2024-01-01']);
  assert.equal(exported.properties.archivePlantDate, '1969-11-01');
  assert.equal(exported.properties.plantedDate, '1970-04-01', 'Current and archived dates must stay distinct');
  assert.equal(exported.properties.referenceHeightMaxFt, 60);
  assert.equal(exported.properties.californiaNative, true);
  assert.deepEqual(exported.properties.bloomSeasons, ['Winter']);
});

test('scientific names match documented aliases and multiplication-sign spelling', () => {
  assert.deepEqual(names('Quercus agrifolia :: Coast live oak'), {scientificName:'Quercus agrifolia',commonName:'Coast live oak'});
  assert.equal(normalize('Platanus × hispanica'), normalize('Platanus x hispanica'));
  const trait = { botanicalName:'Platanus × acerifolia', inventoryAliases:['Platanus x hispanica'] };
  assert.equal(matchSpecies('Platanus x hispanica :: London plane', [trait]), trait);
  assert.equal(matchSpecies('Unknown species', [trait]), null);
});

test('CSV escapes quotes, delimiters, and embedded line breaks', () => {
  assert.equal(csv([{name:'Oak, "Grand"\nNorth',note:null}], ['name','note']), '"name","note"\r\n"Oak, ""Grand""\nNorth",""');
});

test('CSV neutralizes spreadsheet formula strings while preserving numeric GIS coordinates', () => {
  for (const value of ['=1+2','+SUM(A1:A2)','-1+2','@SUM(A1:A2)','\t=1+2','\r=1+2','\n=1+2']) {
    assert.ok(csv([{value}], ['value']).split('\r\n').slice(1).join('\r\n').startsWith('"\''), `Unguarded spreadsheet input: ${JSON.stringify(value)}`);
  }
  assert.equal(csv([{lat:37.77,lng:-122.44}], ['lat','lng']), '"lat","lng"\r\n"37.77","-122.44"');
});
