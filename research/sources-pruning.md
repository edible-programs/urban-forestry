# Official pruning schedules and San Francisco tree heritage

Retrieved 16 October 2026. All sources below are primary city sources, or city GIS hosted on ArcGIS / Google My Maps. Downloads are snapshots; no historical state, age, inspection record or future pruning date is fabricated.

## Files procured

| File | Content | Records |
| --- | --- | ---: |
| `data/pruning-zones.geojson` | Original official zone polygons, WGS84 longitude/latitude, unchanged properties | 315 |
| `data/pruning.json` | Normalized zone schedules, completion-date arrays and source metadata | 315 |
| `data/tree-pruning.json` | Official TREEID → keymap, schedule status, schedule text and zone count; compact array format | 133,817 |
| `data/landmarks.kml` | Original downloadable official landmark map | 25 points |
| `data/landmarks.geojson` | WGS84 landmark points with published names/species/addresses, source links, and removed-status corrections | 25 |
| `data/heritage.json` | One documented historic grove, 16 signature-tree dedications, and program milestones | 17 stories |

## Pruning: actual published source

The [San Francisco Street Tree Map](https://bsm.sfdpw.org/urbanforestry/) loads ArcGIS web map [`b11a000d57e14b3a9dec64bc65e93082`](https://www.arcgis.com/sharing/rest/content/items/b11a000d57e14b3a9dec64bc65e93082/data?f=json). Its operational layers identify the official schedule and tree services below. This provenance is stronger than finding a similarly named third-party map.

- [Key Map Grid Tree Prune Schedule — ArcGIS layer](https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/Key_Map_Grid_Tree_Prune_Schedule/FeatureServer/0). ArcGIS item `142991c1621a4891aa017585c4dae3a1`, owned by `gis@dpw`. The item's licenseInfo is blank; do not present a specific open-source license as established. Layer data edit timestamp: `2026-10-12T03:09:28.309Z` (metadata in saved JSON retains the API value).
- [Official street tree points — ArcGIS layer 3](https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/BUF_Street_Trees/FeatureServer/3). Full published count 133,817, with unique `TREEID` for every downloaded row. This differs from the DataSF inventory count. Keep unmatched DataSF rows.
- [Public Works StreetTreeSF explanation](https://sfpublicworks.org/streettreesf). Maintenance is organized by city block; prioritization uses high-priority pruning/removals/sidewalk work and safety conditions. The map is planning guidance; block completion is not proof that a specific current tree was pruned. Requests concerning immediate hazards are handled separately.
- [StreetTreeSF FAQ](https://sfpublicworks.org/services/streettreesf-faq). Describes a three-to-five-year intended pruning cycle depending on species and individual needs. This is general policy, not a published future date for a tree; do not calculate and display a made-up next prune date.

### Source fields and join

The polygon service publishes `KeymapID`, `CountTrees`, `PruneSched`, `Status`, `EstPruneYr`, `WorkStatus`, `CompleteDt`, `BOSDist`, plus object/shape metadata. There are 212 Complete, 28 Active, 48 Upcoming, and 27 blank-status zones in the snapshot. Active records say `Active 2026`; Upcoming does not give a year. Blank values remain unknown.

The current city tree layer publishes `TREEID`, `Address`, `SiteOrder`, `COMMON`, `BOTANICAL`, `DBH`, `Latitude`, `Longitude`, `PlantType`, `bos`, `keymap`, `Prune_Status`, `Prune_TreeCount`, `Prune_Year`, `DBHRange`. It does **not** publish inspection dates, a complete pruning work log, LastPrune, or NextPrune. The pruning fields are joined zone values.

Join DataSF `tree_id` / `TreeID` to `tree-pruning.rows[][0]` numerically. Then join keymap to `pruning.zones[].keymap` as a **string**, preserving zeroes. Official keymap assignment is preferable to point-in-polygon inference. A tree not found in this map layer has unknown schedule unless an independently identified match is established.

`tree-pruning.json` uses `columns = [treeId,keymap,pruneStatus,pruneYear,zoneTreeCount]` with each row an array in that order. `pruning.json` uses `zones = [{keymap,status,schedule,estimatedYear,completedDates,treeCount,districts,raw}]`. Complete dates are ISO dates; one zone (`040`) explicitly has two dates (`2024-03-01`, `2026-01-27`), preserved as both. The raw publisher text remains available. Some completed zones have no completion date. These dates support a **recorded zone-completion timeline**, not a historical reconstruction of the tree population.

All rows were paginated from ArcGIS with `orderByFields=OBJECTID`, 10,000 per page using `maxRecordCountFactor=5`, 14 pages. Verified 133,817 rows and 133,817 unique TREEIDs. GeoJSON used `outSR=4326`; zone output is not Web Mercator.

Refresh these datasets and the landmark map with `node scripts/sync-pruning.mjs`. This script validates unique TREEIDs and full record counts before writing. Curated heritage narratives remain separate and should be reviewed against their source pages.

### DBH measurement units

The city's [webmap JSON](https://www.arcgis.com/sharing/rest/content/items/b11a000d57e14b3a9dec64bc65e93082/data?f=json) explicitly labels the `DBH` field `Trunk Size (in.)` in the Street Trees layer popup field configuration. This provides primary evidence for inches. That same popup labels its expression for `Prune_Year` as “Last Pruned”; however the actual values include active/upcoming zone schedules, so the application should still describe the actual source semantics accurately.

## Historical and cultural enrichment

- [SF Environment Landmark Tree Program](https://www.sfenvironment.org/landmark-tree-program) embeds the city-designated tree map. [Downloadable official KML](https://www.google.com/maps/d/kml?mid=1NK4oc4n35UXpAt19FrJUHAkQaxmvmv9a&forcekml=1) supplies the 25 coordinates. These are map locations for individual trees or groups, not inventory TREEIDs; some are in private backyards. Do not silently attach a landmark designation to a nearby inventory tree.
- [Public Works Significant and Landmark Trees](https://sfpublicworks.org/services/significant-and-landmark-trees) has 26 list entries and marks the Rosemont coast live oak as removed after structural failure and 2694 McAllister buckeye as removed after death. The KML still includes both, so saved GeoJSON marks them removed. The map and list are not synchronized; 4 Montclair Terrace appears in the list but not the downloaded map. There are address/spelling differences between official sources (e.g. 28th Avenue number), which must not be used as exact identifiers without verification.
- [2008 city account of Mary Ellen Pleasant's trees](https://www.sfenvironment.org/press/supervisors-celebrate-landmark-trees-planted-cas-mother-civil-rights) connects the Octavia/Bush blue gums with Pleasant's former residence and civil-rights legacy. This is the documented individual-grove story in `heritage.json`.
- [Public Works Signature Trees](https://sfpublicworks.org/node/22070) gives annual honorees, tree types and locations from 2006–2019. The saved 16 dedications cover Ferlinghetti, Mayor Ed Lee, Rose Pak, Irene Crescio, Espanola Jackson, the Brown twins, Sandy Cuadra, Nelson Mandela, Wangari Maathai, Charlie Starbuck, Dana Woldow, Ellen Wolfe, Ruth Asawa, Cesar Chavez and Rosa Parks. Dedication year is not tree age. Fresh page content was verified directly: **Ed Lee = St. Mary's magnolia on Fulton; Espanola Jackson = coast live oak in Evans median**. Some search snippets conflate these records.

## Removals and service requests: enrichment route

- [Public Works Tree Removal Notifications](https://sfpublicworks.org/services/tree-removal-notifications) publishes proposed removals by district, address, site, reasons and posting period. It states weekly Monday updates (Tuesday on observed Monday holidays). A notice is **proposed removal**, not a completed removal event or a death observation. Join by normalized address plus site order only when unambiguous. Keep the source link and posting period. Avoid falsely claiming pending notices are actual removals.
- [SF311 Cases — DataSF](https://data.sf.gov/City-Infrastructure/311-Cases/vw6y-z8j6/about_data) / [Socrata resource](https://data.sfgov.org/resource/vw6y-z8j6.json) provides service requests. Verified `service_name = 'Tree Maintenance'` has 176,654 cases on retrieval. These are reports, not verified tree conditions or actual maintenance work. Coordinates and an address do not uniquely identify a tree; nearby reports should be labelled nearby and not attributed as confirmed tree history. Photos, if any, are report photographs, not guaranteed photographs of the selected tree.
- [SF.gov damaged/fallen tree reporting](https://www.sf.gov/report-damaged-or-fallen-tree/) supplies the public service route for immediate damage concerns.

## Honest product language

Use “Zone maintenance completed [date]”, “Active zone maintenance · 2026”, “Upcoming · date unpublished”, and “No published schedule”. Avoid “Tree last pruned [date]” unless individual work-order evidence becomes available. A saved snapshot can support future change tracking; the current sources do not establish a full tree-by-tree historical timeline.
