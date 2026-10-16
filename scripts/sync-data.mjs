#!/usr/bin/env node
/**
 * Downloads complete official DataSF records, preserving compressed raw snapshots,
 * and builds a compact browser dataset. No API key, credentials, or dependencies.
 * Usage: node scripts/sync-data.mjs [--offline]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rawDir = path.join(root, 'data/raw');
const outputDir = path.join(root, 'public/data');
const offline = process.argv.includes('--offline');
const sources = [
  { id: 'tkzw-k3nq', key: 'inventory', purpose: 'Current authoritative street-tree population' },
  { id: 'uzd4-f6yf', key: 'archive', purpose: 'Legacy inventory and permit references; contains duplicates and removed trees' },
  { id: 'qrwx-q4gg', key: 'removals', purpose: 'Formal public removal notices; not evidence of completed removals' },
];
await mkdir(rawDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

async function request(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': 'CanopyAtlas/1.0 (public-data research)' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 1_000 * (attempt + 1)));
    }
  }
}

const datasets = {};
const manifests = [];
for (const source of sources) {
  const rawPath = path.join(rawDir, `${source.id}.json.gz`);
  const metadataPath = path.join(rawDir, `${source.id}.metadata.json`);
  let rows, metadata, fetchedAt;
  if (offline) {
    rows = JSON.parse(gunzipSync(await readFile(rawPath)).toString());
    metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    fetchedAt = JSON.parse(await readFile(path.join(root, 'data/source-manifest.json'), 'utf8')).sources.find(item => item.id === source.id)?.fetchedAt;
  } else {
    metadata = await request(`https://data.sfgov.org/api/views/${source.id}.json`);
    const count = Number((await request(`https://data.sfgov.org/resource/${source.id}.json?$select=count(*)`))[0].count);
    rows = [];
    const limit = 50_000;
    for (let offset = 0; offset < count; offset += limit) {
      const page = await request(`https://data.sfgov.org/resource/${source.id}.json?$limit=${limit}&$offset=${offset}&$order=:id`);
      if (!page.length) throw new Error(`Unexpected empty page for ${source.id} at ${offset}`);
      rows.push(...page);
      console.log(`${source.key}: ${rows.length.toLocaleString()} / ${count.toLocaleString()}`);
    }
    if (rows.length !== count) throw new Error(`Row-count mismatch for ${source.id}: ${rows.length} != ${count}`);
    fetchedAt = new Date().toISOString();
    await writeFile(rawPath, gzipSync(Buffer.from(JSON.stringify(rows)), { level: 9 }));
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }
  const digest = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  datasets[source.key] = rows;
  manifests.push({ ...source, name: metadata.name, publisher: 'San Francisco Public Works / DataSF', url: `https://data.sfgov.org/d/${source.id}`, api: `https://data.sfgov.org/resource/${source.id}.json`, metadata: `https://data.sfgov.org/api/views/${source.id}.json`, fetchedAt, rowsUpdatedAt: new Date(metadata.rowsUpdatedAt * 1000).toISOString(), count: rows.length, sha256: digest, license: metadata.license?.name ?? 'DataSF open data; see source terms', description: metadata.description, columns: metadata.columns.filter(column => !column.fieldName.startsWith(':')).map(({ fieldName, name, description, dataTypeName }) => ({ fieldName, name, description, dataTypeName })) });
}

const s = value => value == null || value === '' ? null : String(value).trim() || null;
const n = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const date = value => s(value)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
const speciesParts = value => {
  const [scientificName = 'Unidentified', ...commonParts] = (s(value) ?? 'Unidentified').split(/\s*::\s*/);
  return { scientificName, commonName: commonParts.join(' :: ') || scientificName };
};

// Legacy data is never used as an extra current population or a measurement series.
// Only exact tree ID matches can provide permit text; all fields retain provenance.
const legacyById = new Map();
let archiveDuplicateIds = 0;
for (const row of datasets.archive) {
  const key = s(row.treeid);
  if (legacyById.has(key)) archiveDuplicateIds++;
  if (!legacyById.has(key) || (row.permitnotes && !legacyById.get(key).permitnotes)) legacyById.set(key, row);
}
const speciesCounts = new Map();
const neighborhoodCounts = new Map();
const streetCounts = new Map();
const currentIds = new Set();
const columns = ['id', 'lat', 'lng', 'species', 'address', 'street', 'neighborhood', 'dbh', 'plantedDate', 'legalStatus', 'siteInfo', 'plotSize', 'planter', 'waterResponsibility', 'district', 'updatedAt', 'permitNotes', 'siteOrder', 'crossStreet', 'zipCode', 'dbhText', 'archiveRecorded', 'archivePlantDate', 'archiveDbh'];
let coordinatesMissing = 0, coordinatesOutsideSf = 0, plantingDatesKnown = 0, legacyMatched = 0, permitReferences = 0, duplicateCurrentIds = 0;
const rows = datasets.inventory.map(row => {
  const id = n(row.treeid);
  if (currentIds.has(id)) duplicateCurrentIds++;
  currentIds.add(id);
  const lat = n(row.latitude), lng = n(row.longitude);
  if (lat == null || lng == null) coordinatesMissing++;
  else if (lat < 37.6 || lat > 37.85 || lng < -122.6 || lng > -122.3) coordinatesOutsideSf++;
  const plantedDate = date(row.planteddate);
  if (plantedDate) plantingDatesKnown++;
  const legacy = legacyById.get(String(id));
  if (legacy) legacyMatched++;
  if (legacy?.permitnotes) permitReferences++;
  const species = s(row.species) ?? 'Unidentified';
  speciesCounts.set(species, (speciesCounts.get(species) ?? 0) + 1);
  const neighborhood = s(row.analysis_neighborhood);
  if (neighborhood) neighborhoodCounts.set(neighborhood, (neighborhoodCounts.get(neighborhood) ?? 0) + 1);
  const street = s(row.onstreet);
  if (street) streetCounts.set(street, (streetCounts.get(street) ?? 0) + 1);
  return [id, lat, lng, species, s(row.description), street, neighborhood, n(row.mapdbh), plantedDate, s(row.legalstatus), s(row.siteinfo), s(row.plotsize), s(row.planter), s(row.waterresponsibility), s(row.supervisordistrict), date(row.data_as_of), s(legacy?.permitnotes), n(row.siteorder), s(row.crossstreet), s(row.zip_code), s(row.mapdbh), !!legacy, date(legacy?.plantdate), n(legacy?.dbh)];
});
rows.sort((a, b) => a[0] - b[0]);
if (duplicateCurrentIds) throw new Error(`${duplicateCurrentIds} duplicate current tree IDs; refusing ambiguous population`);
const removalColumns = ['treeId', 'postedDate', 'noticeType', 'address', 'species', 'lat', 'lng', 'neighborhood', 'legalStatus', 'siteOrder'];
const removals = datasets.removals.map(row => [n(row.treeid), date(row.posteddate), s(row.postedtype), s(row.description), s(row.species), n(row.lat), n(row.long), s(row.analysis_neighborhood), s(row.legalstatus), n(row.siteorder)]);
const species = [...speciesCounts].sort((a,b) => b[1] - a[1]).map(([name,count]) => ({name,...speciesParts(name),count}));
const today = manifests.find(source => source.key === 'inventory').fetchedAt.slice(0, 10);
const placeholderLabels = species.filter(item => /^(?:stump|landscape plants|potential site|paved|pave\b|basin\()/i.test(item.scientificName));
const futurePlantDates = rows.filter(row => row[8] && row[8] > today).length;
const meta = {
  title: 'Canopy Atlas • San Francisco', schemaVersion: 1, generatedAt: new Date().toISOString(), inventorySource: 'tkzw-k3nq', archiveSource: 'uzd4-f6yf', removalSource: 'qrwx-q4gg', inventoryDate: manifests.find(source => source.key === 'inventory').rowsUpdatedAt.slice(0,10), totalTrees: rows.length, mappedTrees: rows.length - coordinatesMissing - coordinatesOutsideSf, coordinatesMissing, coordinatesOutsideSf, plantingDatesKnown, plantingDateCoverage: plantingDatesKnown / rows.length, speciesCount: species.length, neighborhoodsCount: neighborhoodCounts.size, streetsCount: streetCounts.size, legacyMatched, permitReferences, removalNotices: removals.length,
  units: { coordinates:'WGS84 decimal degrees', dbh:'inches (source mapdbh; verify field observations)', plotSize:'original source text' },
  sourceQuality: { futurePlantDates, placeholderLabels, placeholderRecords:placeholderLabels.reduce((sum,item)=>sum+item.count,0), speciesCountMeaning:'Distinct source labels, including unidentified and stale placeholder entries; not a verified count of botanical taxa' },
  limitations: [
    'This is a current inventory, not a complete historical census. Missing planting dates do not imply recent trees.',
    'The archived inventory contains historical removals, non-tree sites, and duplicates. It is never added to the current population.',
    'Legacy DBH is an undated archived observation. It must not be used to calculate growth rates.',
    'Removal notifications document permits and notices, not verified completion dates. Emergency removals may be absent.',
    'The inventory publishes no per-tree health assessments, measured height, crown spread, inspection reports, pruning dates, or full maintenance schedules.',
    'A timeline filtered by known planting date is a recorded-planting cohort among current trees, not a reconstruction of the forest at a past date.',
    'Coordinates can be missing or imprecise. Species identification and record conditions have not been independently field verified.',
    'The current source retains some stump, paved-over, landscape, and planting-site labels despite its stated tree-only scope. These records are preserved and flagged, not silently removed.',
    'A small number of source planting dates are in the future; these must not be interpreted as an observed completed planting or a negative age.',
    'Species traits, rendered specimens, and Street View imagery require separate attribution and are not observations of an individual tree.'
  ]
};
const payload = JSON.stringify({ meta, columns, rows, species, neighborhoods:[...neighborhoodCounts].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,count])=>({name,count})), streets:[...streetCounts].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,count])=>({name,count})), removalColumns, removals });
await writeFile(path.join(outputDir, 'trees.json'), payload);
await writeFile(path.join(outputDir, 'trees.json.gz'), gzipSync(Buffer.from(payload), { level: 9 }));
const manifest = { generatedAt: meta.generatedAt, sources: manifests, validation: { duplicateCurrentIds, archiveDuplicateIds, ...meta }, browserDataset: { path:'public/data/trees.json', bytes:Buffer.byteLength(payload), gzipBytes:gzipSync(Buffer.from(payload)).byteLength, columns, removalColumns } };
await writeFile(path.join(root, 'data/source-manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(path.join(outputDir, 'source-manifest.json'), JSON.stringify(manifest));
console.log(JSON.stringify({ ...meta, bytes:Buffer.byteLength(payload) }, null, 2));
