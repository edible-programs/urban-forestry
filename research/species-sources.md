# Species reference enrichment

Retrieved 16 October 2026. This file documents `data/species.json`, the species and cultivar reference layer. It must be presented separately from measured or recorded facts about an individual inventory tree.

## Procured primary sources

1. [SF Plant Finder](https://sfplanninggis.org/plantsf/), published by San Francisco Planning and the City and County of San Francisco. Its public application uses the `PlantSFv5/MapServer/13` table. We retained the full 629-row response in `data/raw/sf-plant-finder.json`. The table supplies botanical/common names, family, SF/California native classification, plant type, bloom seasons/color, water requirements, site conditions, soils, habitat categories and associated wildlife. Only tree taxa and taxa on its street-tree list enter the reference layer. The site's street-tree flag is a reference-table field and should not be presented as current planting approval.
2. [SelecTree](https://selectree.calpoly.edu/), Urban Forest Ecosystems Institute, Cal Poly State University, San Luis Obispo. Selected public species records were read from `/api/tree/detail/{botanical-name-slug}` and, where needed, IDs resolved using the public `/api/tree/search-by-name` endpoint. Every record in `species.json` links directly to its human-readable `tree-detail/{id}` page. Original responses are retained in `data/raw/selectree/`. This source supplies accepted names and synonyms, family, native range, California-native classification, foliage, maximum height/width/growth rate, flower and fruit seasons, colors, root damage potential, wind/salt tolerance, utility compatibility, soils, pest/disease susceptibility and resistance, and other traits. The dataset uses concise categorical and numerical fields; it does not copy the site's descriptive essays or download its photographs.
3. [2024 Recommended Street Tree Species List](https://sfpublicworks.org/sites/default/files/BUF/Street%20Tree%20Planting/AUGUST%202024%20Recommended%20Street%20Tree%20List%20Update.pdf), San Francisco Urban Forestry Council and Public Works. This is the PDF linked by the City's [recommended trees page](https://sfpublicworks.org/services/recommended-street-tree-and-plant-lists) at retrieval. Exact matching taxa receive dated SF guidance: list section, minimum sidewalk width, drought tolerance, allergy friendliness, utility compatibility, and a brief planting/site note. These are species-level planting constraints, not condition findings or maintenance prescriptions for an existing tree. The City requires approval before planting a street tree.

## Coverage and matching

The reference layer contains 110 taxa. It combines 103 unique Cal Poly records with SF Plant Finder taxa not resolved to a Cal Poly record. The most frequent 65 DataSF inventory labels were used to prioritize coverage; their original aggregate query is retained in `data/raw/species-frequency.json`.

Exact accepted names and published synonyms are matched after normalizing case, HTML, punctuation, rank abbreviations and the hybrid marker. A small explicit alias table handles legacy inventory spellings (for example, `Acer buergeranum`, `Syagrus romanzoffianum`, and the missing `i` in the inventory's ironwood subspecies). Cultivar identity is preserved. `Tristaniopsis laurina 'Elegant'` is a separate cultivar from standard `Tristaniopsis laurina`; `Magnolia grandiflora 'Little Gem'` retains its own record. A taxon absent from the references must remain unknown; the UI must not infer that it is non-native, evergreen, drought tolerant, or in bloom.

The top-frequency unresolved specific label is `Syzygium paniculatum`. Empty planting sites, stumps, unspecified `Tree(s)` rows and records with missing species do not gain botanical traits.

## Semantics and uncertainty

- `matureHeightMaxFt`, `canopySpreadMaxFt`, and `maxGrowthInPerYear` are source maxima, not ranges or predictions for an SF street specimen. The `matureHeightFt` and `canopySpreadFt` range fields remain `null` because these sources do not establish a lower bound. `matureSizeClass` preserves SF Plant Finder's coarse category separately.
- `bloomSeasons` preserves published seasons. `bloomMonths` remains an empty array because exact months were not supplied. A month filter may map to seasons only if clearly labeled an approximation. Blooming varies with microclimate, weather and cultivar; no bloom observation is implied. `bloomInterpretation` marks gymnosperm pollen/cone seasons separately from flower seasons.
- Unknown values are `null` or empty arrays. An empty array means unreported, never a verified absence. False boolean values are retained only when explicitly supplied by a source.
- `sun` is taken from SF Plant Finder's site-condition field. Cal Poly's `shadeTolerant: false` is not converted to a guessed full-sun requirement.
- For overlapping traits, the Cal Poly record takes precedence; habitat classifications and San Francisco-native status come from SF Plant Finder. `traitSourceIds` records this choice, and `referenceConflicts` retains conflicting leaf-habit classifications. For example, SF Plant Finder classifies vine maple as evergreen; Cal Poly classifies it as deciduous, which is the normalized value.
- `sf2024Guidance` remains dated and separate from Cal Poly's general urban suitability traits. A source's recommended planting-area width is not a measurement of the inventory tree's actual tree well.
- SF-specific landmark/indigenous-population context in `urbanNotes` describes the species' local context. It does not assign landmark status or native provenance to every street tree of that species.
- No individual pruning date, maintenance schedule, risk assessment, monetary ecosystem valuation, actual canopy size, or 3D scan is inferred from species traits.

## Reproduction

From the application directory, run `python data/enrich_species.py`. The script reuses existing raw Cal Poly records, resolves missing exact names through the public botanical search, and rebuilds `data/species.json`. The SF Plant Finder and inventory-frequency raw inputs are retained; refresh those independently before a future production data release. `data/raw/selectree-fetch-report.json` records attempted and unresolved source names; several unresolved input strings are covered through an explicit published synonym or legacy spelling alias in the normalized output.

Validation checks run during authoring: JSON parsing, unique normalized IDs, source links for every taxon, correct array element types, no invented exact bloom months, no invented size ranges, and top-frequency inventory coverage reconciliation.
