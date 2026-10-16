"""Build species reference traits from public SF Planning and Cal Poly feeds.

This is species-level reference information, never an observation of an individual.
Run from canopy-atlas with Python 3.10+: python data/enrich_species.py
"""
import concurrent.futures
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
TODAY = "2026-10-16"
PUBLIC = "https://selectree.calpoly.edu"
INVENTORY_ALIASES = {
    # Explicit legacy inventory spellings; cultivar identity is preserved.
    "Ficus microcarpa 'Green Gem'": ["Ficus microcarpa nitida 'Green Gem'"],
    "Syagrus romanzoffiana": ["Syagrus romanzoffianum"],
    "Acer buergerianum": ["Acer buergeranum"],
    "Afrocarpus gracilior": ["Podocarpus gracilor", "Podocarpus gracilior"],
    "Afrocarpus falcatus": ["Podocarpus gracilor"],
    "Lyonothamnus floribundus subsp. aspleniifolius": ["Lyonothamnus floribundus ssp. asplenifolius", "Lyonothamnus floribundus subsp. asplenifolius"],
    "Laurus 'Saratoga'": ["Laurus x 'Saratoga'", "Laurus nobilis 'Saratoga'"],
}
SF_GUIDANCE_URL = "https://sfpublicworks.org/sites/default/files/BUF/Street%20Tree%20Planting/AUGUST%202024%20Recommended%20Street%20Tree%20List%20Update.pdf"
# Values are from the 2024 City's list, preserved as dated planting guidance.
# Every key is an exact species/cultivar, never a guessed substitution.
SF_GUIDANCE = {
    "Quercus agrifolia": (1, 15, False, True, False, "Large sidewalk; landmark example at 23rd and Castro."),
    "Aesculus californica": (1, 15, True, True, False, "Indigenous population on Yerba Buena Island."),
    "Heteromeles arbutifolia": (1, 10, True, True, True, "Train tree form early."),
    "Morella californica": (1, 10, False, True, False, "Moist sites."),
    "Prunus ilicifolia": (1, 12, False, True, False, "Indigenous occurrence on Bayview Hill."),
    "Quercus chrysolepis": (1, 15, False, True, True, "Indigenous occurrence at Lake Merced."),
    "Callistemon citrinus": (2, 10, True, True, False, "Wide, low crown; sticky flowers."),
    "Crataegus phaenopyrum": (2, 7.5, True, False, True, "Thorns; fire blight susceptibility."),
    "Lagunaria patersonii": (2, 10, False, False, False, "Wind-tolerant."),
    "Lophostemon confertus": (2, 12, False, True, True, "Fast growth."),
    "Magnolia grandiflora 'Little Gem'": (2, 7.5, True, False, False, "Successful locally."),
    "Melaleuca quinquenervia": (2, 10, False, True, False, "Wind shelter; cold sensitivity."),
    "Platanus x acerifolia 'Columbia'": (2, 10, False, False, False, "Wind shelter; fungal disease concerns."),
    "Quercus suber": (2, 12, False, False, False, "Large basin."),
    "Tristaniopsis laurina": (2, 12, True, False, True, "Standard form recommended; 'Elegant' excluded."),
    "Arbutus 'Marina'": (3, 10, True, True, True, "Fruit litter; sometimes short-lived."),
    "Corymbia ficifolia": (3, 12, False, True, True, "Very large basin; seed-pod litter."),
    "Eriobotrya deflexa": (3, 10, True, False, True, "Wind shelter; avoid sandy soil."),
    "Hymenosporum flavum": (3, 10, False, False, True, "Warm, sheltered, well-drained sites."),
    "Jacaranda mimosifolia": (3, 10, False, False, True, "Warm, sheltered, well-drained sites."),
    "Lyonothamnus floribundus subsp. aspleniifolius": (3, 10, False, True, True, "Warmth; transplant and phytophthora concerns."),
    "Melaleuca linariifolia": (3, 10, True, True, False, "Successful locally."),
    "Metrosideros excelsa": (3, 15, False, True, True, "Very large basin."),
    "Olea europaea": (3, 12, True, True, False, "Avoid natural areas; large basin."),
    "Pistacia chinensis": (3, 10, True, True, True, "Shelter; early structural pruning."),
    "Pyrus kawakamii": (3, 10, False, False, False, "Warmest sites; fungal and fire blight concerns."),
    "Quillaja saponaria": (3, 10, False, True, True, "Broad local adaptability."),
    "Ulmus parvifolia 'Drake'": (3, 10, False, False, False, "Substantial maintenance."),
    "Pittosporum undulatum": (4, 10, False, False, None, "Avoid natural areas."),
    "Cordyline australis": (5, 15, True, True, True, "Avoid natural areas; large basin."),
    "Washingtonia robusta": (5, 12, False, True, False, "Warm sites; avoid natural areas."),
    "Syagrus romanzoffiana": (5, 10, False, False, True, "Warmth and wind shelter."),
}


def clean(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", "", str(value or "")))).strip()


def key(value):
    return re.sub(r"[^a-z0-9]+", "-", clean(value).lower()).strip("-")


def botanical_key(value):
    # Rank abbreviations and the typographic hybrid marker differ between feeds.
    value = re.sub(r"\b(?:var|ssp|subsp)\.?\s+", "", clean(value), flags=re.I)
    value = re.sub(r"\s+[x×]\s+", " ", value, flags=re.I)
    return key(value)


def parts(value):
    return [clean(x) for x in re.split(r"[;,]", value or "") if clean(x)]


def fetch(name):
    slug = key(name)
    path = RAW / "selectree" / f"{slug}.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return name, data
    try:
        req = urllib.request.Request(f"{PUBLIC}/api/tree/detail/{slug}", headers={"User-Agent": "SF Canopy Atlas research (public botanical reference data)"})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.load(response)
        except urllib.error.HTTPError:
            data = {}
        if not (isinstance(data, dict) and data.get("tree_id")):
            search = urllib.parse.urlencode({"searchString": name, "region": "all"})
            with urllib.request.urlopen(f"{PUBLIC}/api/tree/search-by-name?{search}", timeout=30) as response:
                suggestions = json.load(response)
            exact = [s for s in suggestions if botanical_key(s.get("name_unformatted") or s.get("name_concat")) == botanical_key(name)]
            if not exact:
                return name, None
            with urllib.request.urlopen(f"{PUBLIC}/api/tree/detail/{exact[0]['tree_id']}", timeout=30) as response:
                data = json.load(response)
        if isinstance(data, dict) and data.get("tree_id"):
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return name, data
        return name, None
    except (urllib.error.URLError, ValueError, TimeoutError) as error:
        return name, None


def main():
    (RAW / "selectree").mkdir(parents=True, exist_ok=True)
    plants = [r["attributes"] for r in json.loads((RAW / "sf-plant-finder.json").read_text(encoding="utf-8-sig"))["features"]]
    reference_plants = [p for p in plants if "Tree" in p["Plant_Type"] or p["Street_Tree_List"] == "Yes"]
    frequent = json.loads((RAW / "species-frequency.json").read_text(encoding="utf-8-sig"))
    inventory_names = [p["species"].split("::")[0].strip() for p in frequent if p.get("species") and p.get("species").split("::")[0].strip() not in ["Tree(s)", "Planting site (plant)", "Stump (use Grinder)"]]
    # These spellings, synonyms and base taxa are needed to match legacy inventory
    # labels. The source retains the accepted name and every supplied synonym.
    supplemental_names = [
        "Platanus x hispanica", "Platanus x acerifolia", "Platanus hispanica",
        "Arbutus Marina", "Ficus microcarpa", "Prunus serrulata", "Hesperocyparis macrocarpa",
        "Pittosporum undulatum", "Pittosporum undulatum", "Syagrus romanzoffiana",
        "Schinus terebinthifolia", "Acer buergerianum", "Afrocarpus gracilior",
        "Podocarpus gracilior", "Eucalyptus ficifolia", "Eucalyptus maculata",
        "Pistacia chinensis", "Ulmus parvifolia", "Magnolia grandiflora", "Laurus nobilis",
        "Sambucus nigra", "Sambucus caerulea", "Sambucus nigra subsp. caerulea",
        "Pinus contorta", "Prunus virginiana", "Lyonothamnus floribundus",
        "Corylus cornuta", "Quercus engelmannii", "Acer circinatum", "Ficus microcarpa 'Green Gem'",
        "Laurus 'Saratoga'", "Lyonothamnus floribundus subsp. aspleniifolius",
    ]
    names = sorted(set(inventory_names + [p["Latin_Name"].strip() for p in reference_plants] + supplemental_names))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(fetch, names))
    records = {int(r["tree_id"]): r for _, r in results if r}
    aliases_by_id = {}
    for alias, record in results:
        if record:
            aliases_by_id.setdefault(int(record["tree_id"]), []).append(alias)
    (RAW / "selectree-fetch-report.json").write_text(json.dumps({"requested": len(names), "matched": len(records), "unmatchedNames": [name for name, r in results if not r]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"requested": len(names), "matched": len(records), "unmatchedNames": [name for name, r in results if not r]}, ensure_ascii=False, indent=2))
    # Normalization is kept separate so the raw published values remain auditable.
    build(reference_plants, records, aliases_by_id)


def build(plants, records, aliases_by_id):
    # Match exact botanical names after punctuation/HTML normalization only.
    # Cultivars never silently inherit a different cultivar's traits.
    by_name = {}
    for record in records.values():
        for n in [record.get("primary_taxon", {}).get("name_concat"), *[t.get("name_concat") for t in record.get("other_taxa", [])], *aliases_by_id.get(record["tree_id"], []), *INVENTORY_ALIASES.get(clean(record.get("primary_taxon", {}).get("name_concat")), [])]:
            if n:
                by_name[botanical_key(n)] = record
    output = []
    used_ids = set()
    for plant in plants:
        record = by_name.get(botanical_key(plant["Latin_Name"]))
        if record and record["tree_id"] in used_ids:
            continue
        output.append(normalize(plant, record, aliases_by_id))
        if record:
            used_ids.add(record["tree_id"])
    for record in records.values():
        if record["tree_id"] not in used_ids:
            output.append(normalize(None, record, aliases_by_id))
    output.sort(key=lambda r: r["botanicalName"])
    data = {
        "schemaVersion": 1,
        "generatedAt": TODAY,
        "scope": "Species and cultivar reference traits. These describe potential characteristics of a taxon; they are not measurements, condition assessments, bloom observations, or pruning instructions for an individual street tree.",
        "unknownValueConvention": "null means unreported; empty arrays mean unreported, never none. Exact bloom months are not inferred from seasons.",
        "sources": {
            "sf-plant-finder": {
                "title": "SF Plant Finder botanical reference table",
                "publisher": "San Francisco Planning / City and County of San Francisco",
                "url": "https://sfplanninggis.org/plantsf/",
                "dataUrl": "https://sfplanninggis.org/arcgiswa/rest/services/PlantSFv5/MapServer/13",
                "retrievedAt": TODAY,
                "notes": "Public website table accessed via its configured public proxy. Full original 629-row response retained in data/raw/sf-plant-finder.json. Street-tree list flag is this source's historical flag, not current planting approval."
            },
            "selectree": {
                "title": "SelecTree: A Tree Selection Guide",
                "publisher": "Urban Forest Ecosystems Institute, Cal Poly State University, San Luis Obispo",
                "url": "https://selectree.calpoly.edu/",
                "retrievedAt": TODAY,
                "notes": "Selected public botanical records. Numeric sizes are published maxima in feet; they are not expected height ranges for an SF sidewalk specimen. Each record links its exact source."
            },
            "sf-street-tree-list-2024": {
                "title": "2024 Recommended Street Tree Species List",
                "publisher": "San Francisco Urban Forestry Council / San Francisco Public Works",
                "url": SF_GUIDANCE_URL,
                "retrievedAt": TODAY,
                "notes": "Dated planting guidance. All new street trees still require Public Works approval. Utility-friendly is the list's definition for typical overhead high-voltage wires."
            }
        },
        "species": output,
    }
    (ROOT / "species.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(output)} species references")


def normalize(plant, record, aliases_by_id):
    plant = plant or {}
    record = record or {}
    source_ids = (["sf-plant-finder"] if plant else []) + (["selectree"] if record else [])
    botanical = clean(record.get("primary_taxon", {}).get("name_concat")) or clean(plant.get("Latin_Name"))
    native = clean(plant.get("Climate_Appropriate_Plants"))
    source_urls = (["https://sfplanninggis.org/plantsf/?search=" + urllib.parse.quote(plant["Latin_Name"])] if plant else []) + ([f"{PUBLIC}/tree-detail/{record['tree_id']}"] if record else [])
    leaf = clean(record.get("foliage_type")) or ("Evergreen" if "evergreen" in plant.get("Plant_Type", "") else "Deciduous" if "deciduous" in plant.get("Plant_Type", "") else None)
    bloom = record.get("flower_time") or record.get("flower_times") or []
    if isinstance(bloom, str):
        bloom = parts(bloom)
    bloom = [clean(s.get("flower_time") or s.get("season") or s.get("name")) if isinstance(s, dict) else clean(s) for s in bloom]
    if not bloom:
        bloom = parts(plant.get("Bloom_Time"))
    colors = record.get("flower_color") or []
    if isinstance(colors, str):
        colors = parts(colors)
    if not colors:
        colors = parts(plant.get("Flower_Color"))
    colors = [clean(s.get("color") or s.get("name")) if isinstance(s, dict) else clean(s) for s in colors]
    aliases = set([plant.get("Latin_Name", ""), *parts(plant.get("Former_Latin_Name")), *aliases_by_id.get(record.get("tree_id"), []), *[clean(t.get("name_concat")) for t in record.get("other_taxa", [])]])
    aliases.update(INVENTORY_ALIASES.get(botanical, []))
    aliases.discard("")
    aliases.discard(botanical)
    ref = {
        "id": key(botanical), "botanicalName": botanical,
        "commonName": clean(plant.get("Common_Name", "").split(";")[0]) or clean(record.get("primary_common", {}).get("common")).title(),
        "otherCommonNames": parts(plant.get("Common_Name"))[1:] + [clean(c.get("common")).title() for c in record.get("other_common", [])],
        "inventoryAliases": sorted(aliases),
        "family": clean(record.get("family")) or clean(plant.get("Family_Name")) or None,
        "nativeRegion": clean(record.get("native_range")) or ("San Francisco, California" if native == "SF Native" else "California" if native == "CA Native" else None),
        "californiaNative": bool(record["california_native"]) if record.get("california_native") is not None else True if native in ["SF Native", "CA Native"] else False if native == "Exotic" else None,
        "sanFranciscoNative": True if native == "SF Native" else False if native == "Exotic" else None,
        "leafHabit": leaf,
        "matureHeightFt": None, "canopySpreadFt": None,
        "matureHeightMaxFt": record.get("height_high"), "canopySpreadMaxFt": record.get("width_high"),
        "matureSizeClass": clean(plant.get("Size_at_Maturity")) or None,
        "bloomSeasons": bloom, "bloomMonths": [], "bloomColors": colors,
        "flowerShowiness": clean(record.get("flower_showiness")) or None,
        "fragrant": bool(record["fragrance"]) if record.get("fragrance") is not None else None,
        "waterNeed": clean(record.get("water_use")) or clean(plant.get("Water_Needs")) or None,
        "sun": parts(plant.get("Suitable_Site_Conditions")),
        "shadeTolerant": bool(record["shade_tolerant"]) if record.get("shade_tolerant") is not None else None,
        "soils": record.get("soil_texture") or parts(plant.get("Soil_Type")),
        "habitatBenefits": parts(plant.get("Habitat_Value")), "associatedWildlife": sorted(set(parts(plant.get("Associated_Wildlife")) + (record.get("attracts_wildlife") or []))),
        "plantCommunities": parts(plant.get("Plant_Communities")),
        "fallColor": bool(record["foliage_fall_color"]) if record.get("foliage_fall_color") is not None else None,
        "treeShape": record.get("tree_shape") or [],
        "maxGrowthInPerYear": record.get("growth_rate_high"),
        "saltTolerance": clean(record.get("salt_tolerance")) or None,
        "windResistance": clean(record.get("wind_resistance")) or None,
        "rootDamagePotential": clean(record.get("root_damage_potential")) or None,
        "branchStrength": clean(record.get("branch_strength_low")) or None,
        "branchStrengthHigh": clean(record.get("branch_strength_high")) or None,
        "utilityFriendly": bool(record["utility_friendly"]) if record.get("utility_friendly") is not None else None,
        "recommendedPlantingAreaFt": clean(record.get("planting_area")) or None,
        "diseaseSusceptibility": record.get("disease_susceptibility") or [],
        "pestSusceptibility": record.get("pest_susceptibility") or [],
        "diseaseResistance": record.get("disease_resistant") or [],
        "pestResistance": record.get("pest_resistant") or [],
        "potentialHealthIssues": record.get("health_hazard") or [],
        "litterTypes": record.get("litter_type") or [],
        "fruitingSeasons": record.get("fruiting_time") or [],
        "fruitType": clean(record.get("fruit_type")) or None,
        "fruitColor": clean(record.get("fruit_color")) or None,
        "barkColors": record.get("bark_color") or [],
        "barkTextures": record.get("bark_texture") or [],
        "leafColors": record.get("foliage_growth_color") or [],
        "leafShape": clean(record.get("leaflet_shape")) or None,
        "leafForm": clean(record.get("leaf_form")) or None,
        "leafArrangement": clean(record.get("leaf_arrangement")) or None,
        "sfPlantFinderStreetTreeList": plant.get("Street_Tree_List") == "Yes" if plant else None,
        "sf2024Guidance": None,
        "urbanNotes": [],
        "sourceIds": source_ids, "sourceUrls": source_urls,
        "traitSourceIds": {
            "botanicalName": "selectree" if record else "sf-plant-finder",
            "family": "selectree" if record else "sf-plant-finder",
            "nativeRegion": "selectree" if record.get("native_range") else "sf-plant-finder" if native in ["SF Native", "CA Native"] else None,
            "californiaNative": "selectree" if record.get("california_native") is not None else "sf-plant-finder" if native else None,
            "sanFranciscoNative": "sf-plant-finder" if native else None,
            "leafHabit": "selectree" if record.get("foliage_type") else "sf-plant-finder" if plant else None,
            "matureHeightMaxFt": "selectree" if record else None,
            "canopySpreadMaxFt": "selectree" if record else None,
            "matureSizeClass": "sf-plant-finder" if plant else None,
            "bloomSeasons": "selectree" if record.get("flower_time") else "sf-plant-finder" if plant.get("Bloom_Time") else None,
            "bloomColors": "selectree" if record.get("flower_color") else "sf-plant-finder" if plant.get("Flower_Color") else None,
            "waterNeed": "selectree" if record.get("water_use") else "sf-plant-finder" if plant.get("Water_Needs") else None,
            "sun": "sf-plant-finder" if plant.get("Suitable_Site_Conditions") else None,
            "soils": "selectree" if record.get("soil_texture") else "sf-plant-finder" if plant.get("Soil_Type") else None,
            "habitatBenefits": "sf-plant-finder" if plant.get("Habitat_Value") else None,
            "associatedWildlife": source_ids,
            "urbanSuitabilityTraits": "selectree" if record else None,
        },
        "referenceConflicts": [],
        "sourceRecords": {"sfPlantFinderObjectId": plant.get("OBJECTID"), "selectreeTreeId": record.get("tree_id")},
        "traitBasis": "species/cultivar reference; not observed individual",
    }
    if record and plant:
        original_leaf = "Evergreen" if "evergreen" in plant.get("Plant_Type", "") else "Deciduous" if "deciduous" in plant.get("Plant_Type", "") else None
        if original_leaf and leaf and original_leaf != leaf:
            ref["referenceConflicts"].append({"trait": "leafHabit", "sfPlantFinderValue": original_leaf, "selectreeValue": leaf, "preferredSource": "selectree"})
    names = {botanical_key(n) for n in [botanical, *aliases]}
    for taxon, guidance in SF_GUIDANCE.items():
        if botanical_key(taxon) in names:
            section, width, utility, drought, allergy, note = guidance
            ref["sf2024Guidance"] = {"section": section, "minimumSidewalkWidthFt": width, "utilityFriendly": utility, "droughtTolerant": drought, "allergyFriendly": allergy, "sourceId": "sf-street-tree-list-2024", "sourceUrl": SF_GUIDANCE_URL}
            ref["urbanNotes"].append(note)
            ref["sourceIds"].append("sf-street-tree-list-2024")
            ref["sourceUrls"].append(SF_GUIDANCE_URL)
            ref["traitSourceIds"]["urbanNotes"] = "sf-street-tree-list-2024"
            break
    # Conifers have reproductive cones, not botanical flowers. The source's
    # season is retained with a clear label for filtering and interpretation.
    ref["bloomInterpretation"] = "cone/pollen season" if ref["family"] in ["Pinaceae", "Cupressaceae", "Taxaceae", "Podocarpaceae", "Ginkgoaceae"] else "flower season"
    return ref


if __name__ == "__main__":
    main()
