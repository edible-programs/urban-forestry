# Official tree data and interpretation

The application uses the **current San Francisco Street Tree Inventory**, published by San Francisco Public Works through DataSF. Run `npm run sync` from the app directory to refresh the full inventory, the legacy archive, and formal removal notices. Run `node scripts/sync-data.mjs --offline` to rebuild normalized files from the downloaded raw snapshots.

## Sources

- [Current street-tree inventory — tkzw-k3nq](https://data.sfgov.org/d/tkzw-k3nq). Daily CMMS export. Each row is a current recorded tree; empty basins, planting sites, and removed trees are excluded. The publisher replaced the schema in September 2026 following the December 2024 system migration. Coordinates, dates, and measurements may be missing or outdated.
- [Archived Street Tree List — uzd4-f6yf](https://data.sfgov.org/d/uzd4-f6yf). Legacy snapshot retained for permit references and separately labelled historical fields. The publisher explicitly warns that removed trees and duplicate records inflate this archive. It is never added to current population totals.
- [Street Tree Removal Notifications — qrwx-q4gg](https://data.sfgov.org/d/qrwx-q4gg). Notices after a removal permit was issued. A posted notice does **not** establish when or whether a tree was removed. Emergency removals may be absent.
- [Public Works Urban Forestry map](https://bsm.sfdpw.org/urbanforestry/). Official pruning-zone map. The `pruning.json` and `tree-pruning.json` files preserve its published zones and tree-to-zone assignments. Zone completion dates are not individual tree work logs.

`source-manifest.json` records exact URLs, retrieval times, publisher metadata, row counts, field dictionaries, and SHA-256 digests. `raw/*.json.gz` preserves complete source rows; corresponding `*.metadata.json` files preserve Socrata metadata. No private accounts or API keys are needed for these datasets.

## Browser format

`public/data/trees.json` contains `{meta, columns, rows, species, neighborhoods, streets, removalColumns, removals}`. A row uses the corresponding `columns` array for its field names. Species and geographic facets include counts from the complete current inventory. Unknown values remain `null`; records with missing coordinates remain available in the table.

`plantedDate`, `dbh`, and location are current-inventory fields. `archivePlantDate` and `archiveDbh` remain separately named. `archiveRecorded` means an exact TreeID was found in the legacy archive. `permitNotes` comes only from an exact legacy TreeID match. A source-system update date is not an inspection date.

## Boundaries of the evidence

- Planting dates are incomplete. A historical slider filters the known planting cohorts of trees still in today's inventory. It does not reconstruct trees present at a past time, count historic removals, or infer ages for trees without planting dates.
- The source does not publish measured height, crown spread, individual condition assessments, full inspection notes, actual pruning work orders, or complete per-tree maintenance schedules. Those values must not be generated as facts.
- An archived DBH is an undated legacy observation. Comparing it with current DBH does not support an annual growth rate.
- Published coordinates have varying precision. Invalid or missing coordinates must not be plotted at an invented point.
- The downloaded current inventory retains stale stump, paved-over, landscape, and potential-site species labels despite its stated tree-only scope. Those records remain visible because they are in the authoritative current population. The reported species count describes distinct source labels, not field-verified botanical taxa. Eight planting dates in this snapshot are after retrieval; avoid negative ages and treat future dates as unverified source entries.
- Botanical traits describe a species, not a measured individual. A procedural 3D specimen is an illustration, not a scan. Street View is a separately operated imagery service and its capture date is not the observation date of inventory fields.

The datasets retain their publishers' terms. DataSF is the original source; the application performs normalization and filtering, without claiming independent field verification.
