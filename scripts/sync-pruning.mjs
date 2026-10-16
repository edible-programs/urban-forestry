import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Public, read-only city sources. No API key is required.
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.join(root, 'data');
const zoneSource = 'https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Key_Map_Grid_Tree_Prune_Schedule/FeatureServer/0';
const treeSource = 'https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/BUF_Street_Trees/FeatureServer/3';
const landmarkPage = 'https://www.sfenvironment.org/landmark-tree-program';
const landmarkSource = 'https://www.google.com/maps/d/kml?mid=1NK4oc4n35UXpAt19FrJUHAkQaxmvmv9a&forcekml=1';
const landmarkStatusSource = 'https://sfpublicworks.org/services/significant-and-landmark-trees';
const retrievedAt = new Date().toISOString().slice(0, 10);

async function download(url, json = true) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const body = json ? await response.json() : await response.text();
      if (json && body.error) throw new Error(JSON.stringify(body.error));
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

function queryUrl(source, parameters) {
  return `${source}/query?${new URLSearchParams(parameters)}`;
}

function completionDates(value) {
  return [...String(value ?? '').matchAll(/\b(\d{4})(\d{2})(\d{2})\b|\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)]
    .map(match => match[1] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[6]}-${match[4].padStart(2, '0')}-${match[5].padStart(2, '0')}`);
}

await mkdir(dataDir, { recursive: true });
const [zoneMetadata, zoneCollection, treeCount, kml] = await Promise.all([
  download(`${zoneSource}?f=json`),
  download(queryUrl(zoneSource, { where: '1=1', outFields: '*', outSR: 4326, returnGeometry: true, f: 'geojson' })),
  download(queryUrl(treeSource, { where: '1=1', returnCountOnly: true, f: 'json' })),
  download(landmarkSource, false),
]);
if (!Array.isArray(zoneCollection.features) || !zoneCollection.features.length || zoneCollection.exceededTransferLimit) {
  throw new Error('Missing or truncated pruning zones; existing files have not been replaced.');
}

const pageSize = 10000;
const pageCount = Math.ceil(treeCount.count / pageSize);
const pages = new Array(pageCount);
let nextPage = 0;
await Promise.all(Array.from({ length: Math.min(4, pageCount) }, async () => {
  while (nextPage < pageCount) {
    const page = nextPage++;
    const result = await download(queryUrl(treeSource, {
      where: '1=1', returnGeometry: false,
      outFields: 'TREEID,keymap,Prune_Status,Prune_Year,Prune_TreeCount',
      orderByFields: 'OBJECTID', resultRecordCount: pageSize,
      resultOffset: page * pageSize, maxRecordCountFactor: 5, f: 'json',
    }));
    pages[page] = result.features.map(({ attributes: a }) => [a.TREEID, a.keymap, a.Prune_Status, a.Prune_Year, a.Prune_TreeCount]);
  }
}));
const rows = pages.flat().sort((a, b) => a[0] - b[0]);
if (rows.length !== treeCount.count || new Set(rows.map(row => row[0])).size !== rows.length) {
  throw new Error('Tree pruning mapping is incomplete or contains duplicate TREEIDs; existing files have not been replaced.');
}

const zones = zoneCollection.features.map(({ properties: p }) => ({
  keymap: p.KeymapID,
  status: p.WorkStatus?.toLowerCase() || 'unknown',
  schedule: p.PruneSched,
  estimatedYear: p.EstPruneYr,
  completedDates: completionDates(p.CompleteDt),
  treeCount: p.CountTrees,
  districts: String(p.BOSDist ?? '').split(/,\s*/).filter(Boolean),
  raw: { Status: p.Status, WorkStatus: p.WorkStatus, CompleteDt: p.CompleteDt },
}));
const statusCounts = zones.reduce((counts, zone) => ({ ...counts, [zone.status]: (counts[zone.status] || 0) + 1 }), {});
const pruning = {
  retrievedAt,
  source: {
    title: 'San Francisco Public Works — Key Map Grid Tree Prune Schedule',
    url: zoneSource,
    mapUrl: 'https://bsm.sfdpw.org/urbanforestry/',
    arcgisItemId: '142991c1621a4891aa017585c4dae3a1',
    layerDataLastEditedAt: new Date(zoneMetadata.editingInfo.dataLastEditDate).toISOString(),
    publisher: 'San Francisco Public Works',
    license: 'Publicly accessible official GIS; item does not state a specific reuse license',
  },
  coverage: {
    zoneCount: zones.length, ...statusCounts,
    joinKey: 'Official tree field keymap to zone field KeymapID. Retain leading zeroes. Use point-in-polygon only where official keymap absent.',
  },
  limitations: [
    'Schedules describe city keymap maintenance zones, not an individual tree work-order history.',
    'A zone marked complete does not establish that every current tree in the zone was pruned on that date.',
    'Upcoming does not give a year. No future dates or repeated pruning cycles are inferred.',
    'The published layer is a current snapshot, not a historical series. Preserve raw text and recorded completion dates.',
    'CountTrees is the publisher zone count and may differ from inventory totals.',
  ],
  zones,
};
const treePruning = {
  retrievedAt, source: treeSource, rowCount: rows.length,
  columns: ['treeId', 'keymap', 'pruneStatus', 'pruneYear', 'zoneTreeCount'],
  limitations: [
    'Pruning fields are attached zone schedule values; not individual tree service history.',
    `This map layer contains ${rows.length} records; it may differ from the DataSF inventory. Retain unmatched trees.`,
  ], rows,
};

// KML ExtendedData is the official source of addresses/species, rather than geocoding.
const decodeXml = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const textTag = (xml, name) => decodeXml(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim() ?? '');
const landmarkFeatures = [...kml.matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/g)].map(([, xml]) => {
  const fields = Object.fromEntries([...xml.matchAll(/<Data name="([^"]+)">([\s\S]*?)<\/Data>/g)]
    .map(([, key, data]) => [decodeXml(key), textTag(data, 'value')]));
  const address = fields.Address?.trim() || '';
  const coordinates = textTag(xml, 'coordinates').split(',').slice(0, 2).map(Number);
  if (coordinates.length !== 2 || !coordinates.every(Number.isFinite)) throw new Error('Invalid landmark coordinates.');
  // Confirmed removed in the published Public Works list. These corrections are
  // explicit, as the embedded official map still includes both historic points.
  const removalNote = address === '20 Rosemont Terrace' ? 'Public Works list records removed due to structural failure'
    : address === '2694 McAllister Street' ? 'Public Works list records removed due to tree death' : null;
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates },
    properties: {
      name: textTag(xml, 'name'), address, scientificName: fields['Scientific Name'],
      landmarkStatus: 'designated', presenceStatus: removalNote ? 'removed' : 'not_verified',
      presenceNote: removalNote || 'Official map point; not a current field observation',
      source: landmarkPage, mapSource: landmarkSource, statusSource: landmarkStatusSource, retrievedAt,
    },
  };
});
if (!landmarkFeatures.length) throw new Error('No landmarks found in official KML.');
const landmarks = { type: 'FeatureCollection', name: 'San Francisco designated landmark trees', features: landmarkFeatures };

await Promise.all([
  writeFile(path.join(dataDir, 'pruning-zones.geojson'), JSON.stringify(zoneCollection)),
  writeFile(path.join(dataDir, 'pruning.json'), JSON.stringify(pruning)),
  writeFile(path.join(dataDir, 'tree-pruning.json'), JSON.stringify(treePruning)),
  writeFile(path.join(dataDir, 'landmarks.kml'), kml),
  writeFile(path.join(dataDir, 'landmarks.geojson'), JSON.stringify(landmarks)),
]);
console.log(JSON.stringify({ treeMappings: rows.length, zones: zones.length, ...statusCounts, landmarks: landmarkFeatures.length }));
console.log('Heritage narratives are curated in data/heritage.json; review their official sources separately.');
