# Canopy Atlas

An independent, data-rich explorer of San Francisco's street trees, built from official city records. Browse the map in 2D or 3D, inspect an individual tree, filter the inventory, compare selections, and keep personal field collections.

## Run locally

Requires Node.js 20 or later and npm. From this directory:

```powershell
npm install
npm run build
npm run dev
```

Open [Canopy Atlas locally](http://127.0.0.1:4173). `dev` serves the built `dist` directory. Rebuild after changing source files or refreshing data. The complete downloaded datasets are included as compressed snapshots; the build restores the large inventory JSON for local analysis; no city-data account or API key is required to explore them.

```powershell
npm test
```

The tests check complete-population integrity, unique tree IDs, geographic validity, pruning joins, planting-cohort filters, botanical filters, GeoJSON exports, and CSV formula protection.

## Explore

- Search tree IDs, addresses, street names, neighborhoods, and species. Combine botanical traits, tree sizes, planting records, and published pruning status.
- Switch between the map, a sortable data table, and citywide insights. Use the planting lens to inspect recorded planting cohorts.
- Open a tree's card for inventory details, species references, permit notes where available, pruning-zone information, an illustrative 3D specimen, and Street View access.
- Multi-select trees, compare specimens, save a collection, and export data as CSV or GeoJSON for review in other tools.
- Read the field guide for enriched botanical references and documented San Francisco tree stories.

Collections and settings are stored in this browser's local storage. They are personal to this browser/profile and origin; there is no account, cloud synchronization, or server-side collection database. Clearing browser storage clears them. Use exports to retain a portable copy of selected records.

## Street View and map services

Basemap tiles, geographic imagery, fonts, and Street View use external services and need an internet connection. Street View links work without an application key. To display Google's static Street View imagery inside a tree card, optionally enter your own Google Maps API key in Settings. The key is kept in this browser's local storage and sent to Google when requesting imagery. Use a browser-restricted key with the appropriate Street View API enabled. No key is bundled with the application.

A Street View image is imagery near the recorded tree location. Coverage, the camera's view of the exact tree, capture date, and current appearance vary. The 3D specimen and map canopies are procedural illustrations, not scans or measured reconstructions of individual trees.

## Data and refresh

The included snapshot was retrieved **October 16, 2026**:

| Data | Included coverage | Official source |
| --- | ---: | --- |
| Current recorded street trees | 144,488 records; 138,733 mapped | [SF Public Works / DataSF](https://data.sfgov.org/d/tkzw-k3nq) |
| Legacy inventory | 198,436 archived rows | [Archived Street Tree List](https://data.sfgov.org/d/uzd4-f6yf) |
| Formal removal notices | 5,722 notices | [Street Tree Removal Notifications](https://data.sfgov.org/d/qrwx-q4gg) |
| Published pruning zones | 315 zones; 133,817 tree assignments | [Public Works Urban Forestry map](https://bsm.sfdpw.org/urbanforestry/) |
| Botanical references | Species and cultivar traits | [SF Plant Finder](https://sfplanninggis.org/plantsf/), [Cal Poly SelecTree](https://selectree.calpoly.edu/) |
| Landmark and heritage context | Official landmark locations and attributed stories | [SF Environment](https://www.sfenvironment.org/landmark-tree-program), [SF Public Works](https://sfpublicworks.org/services/significant-and-landmark-trees) |

Refresh the public city inventory, archive, and removal notices:

```powershell
npm run sync
```

Refresh pruning zones, published tree assignments, and landmark context:

```powershell
node scripts/sync-pruning.mjs
```

Rebuild the botanical reference enrichment with Python 3.10 or later:

```powershell
python data/enrich_species.py
```

Each refresh reads public sources over the network. To rebuild the inventory normalization from the preserved local raw snapshots without network access:

```powershell
node scripts/sync-data.mjs --offline
npm run build
```

Provenance, retrieval timestamps, exact source URLs, field dictionaries, and hashes are recorded in `data/source-manifest.json`. Full raw inventory snapshots are retained in `data/raw/`. See [the data notes](data/README.md) and `research/` for interpretation and source details. The browser dataset uses column names plus positional row arrays to reduce transfer size; its precompressed gzip copy is approximately 4.6 MB.

## What the records can establish

The application preserves missing values and identifies the source of each kind of information. Only **38,622 current records (26.7%)** have a recorded planting date. The planting lens shows trees in today's inventory with a planting date before the chosen year; it is not a reconstruction of the forest at that date. Trees removed before the snapshot are not restored by the slider.

The archived feed has known duplicates and historical removals. It supplies separately labelled legacy fields and permit references through exact tree-ID matches; it never expands the current-tree population. A legacy DBH value is an undated observation and does not establish a growth rate. Removal notices establish a formal notice, not a completed removal or a complete record of emergency removals.

Pruning dates and statuses come from **published zone schedules** joined to trees. They do not establish that a particular tree was pruned on a particular date. Some current trees have no published assignment. The sources do not provide a complete per-tree work-order history, inspection log, health assessment, measured height, or measured crown spread.

The 664 reported species labels include unidentified entries and stale stump, paved-over, landscape, and planting-site labels retained in the authoritative current feed. They are not 664 independently verified botanical taxa. Eight source planting dates are after retrieval. Coordinates and other fields can be incomplete, imprecise, or outdated; no independent field survey is implied.

Botanical filters describe documented species or cultivar traits. Unknown traits are excluded when a corresponding filter is active. Bloom seasons are reference seasons, not a report that an individual tree is flowering today. Source conflicts and uncertain matches remain explicit in the reference data.

## Project layout

`src/` contains the application, data-filter helpers, and procedural tree model. `scripts/` builds, serves, and refreshes data. `public/data/` contains browser-ready inventory files. `data/` and `research/` retain enrichments, official source snapshots, and provenance. `tests/` contains the automated checks; `dist/` is the generated static website.

The application can be deployed as static files from `dist/`. Its tree inventory and enrichments are bundled; the interactive map and optional imagery still depend on their respective external services.
