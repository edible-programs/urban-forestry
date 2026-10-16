// Species/cultivar reference views. Nothing in this module describes an
// individual tree's measured dimensions, health, risk, or observed phenology.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const values = value => Array.isArray(value) ? value.filter(item => item !== null && item !== undefined && String(item).trim()) : [];
const reported = value => value !== null && value !== undefined && value !== '';
const text = value => reported(value) ? escapeHtml(value) : '<span class="muted">Unreported</span>';
const list = value => values(value).length ? values(value).map(escapeHtml).join(', ') : '<span class="muted">Unreported</span>';
const yesNo = value => value === true ? 'Yes' : value === false ? 'No' : '<span class="muted">Unreported</span>';
const measured = (value, unit) => reported(value) ? `${escapeHtml(value)} ${escapeHtml(unit)}` : '<span class="muted">Unreported</span>';
const row = (label, value) => `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`;
const rows = entries => `<dl class="record-list">${entries.map(([label, value]) => row(label, value)).join('')}</dl>`;
const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(url.href) : '';
  } catch {
    return '';
  }
}

function link(url, label) {
  const href = safeUrl(url);
  return href ? `<a class="detail-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>` : '';
}

function section(title, body, open = false) {
  return `<details${open ? ' open' : ''}><summary>${escapeHtml(title)}${chevron}</summary><div style="margin-top:15px">${body}</div></details>`;
}

/** Render a single normalized entry from data/species.json. */
export function botanicalDetails(s) {
  if (!s || typeof s !== 'object') {
    return '<section class="detail-section"><div class="section-title"><h3>Species reference</h3><span>UNREPORTED</span></div><p class="section-note">No verified botanical reference is matched to this inventory label. Species traits remain unknown.</p></section>';
  }

  const form = rows([
    ['Leaf habit', text(s.leafHabit)],
    ['Tree shape', list(s.treeShape)],
    ['Published height maximum', measured(s.matureHeightMaxFt, 'ft')],
    ['Published canopy maximum', measured(s.canopySpreadMaxFt, 'ft')],
    ['SF Plant Finder size class', text(s.matureSizeClass)],
    ['Published growth maximum', measured(s.maxGrowthInPerYear, 'in/year')],
    ['Fall color', yesNo(s.fallColor)],
    ['Leaf form', text(s.leafForm)],
    ['Leaf arrangement', text(s.leafArrangement)],
    ['Leaf shape', text(s.leafShape)],
    ['Leaf colors', list(s.leafColors)],
    ['Bark texture', list(s.barkTextures)],
    ['Bark colors', list(s.barkColors)],
  ]) + '<p class="section-note">Published maxima describe the taxon’s potential size. They are not measurements or predictions for this street tree.</p>';

  const phenology = rows([
    [s.bloomInterpretation === 'cone/pollen season' ? 'Cone / pollen seasons' : 'Flower seasons', list(s.bloomSeasons)],
    ['Flower colors', list(s.bloomColors)],
    ['Flower display', text(s.flowerShowiness)],
    ['Fragrant', yesNo(s.fragrant)],
    ['Fruiting seasons', list(s.fruitingSeasons)],
    ['Fruit type', text(s.fruitType)],
    ['Fruit color', text(s.fruitColor)],
    ['Litter types', list(s.litterTypes)],
  ]) + '<p class="section-note">Reference seasons vary with cultivar, microclimate and weather. Exact bloom months and this individual’s current bloom state are unreported.</p>';

  const ecology = rows([
    ['Family', text(s.family)],
    ['Native range', text(s.nativeRegion)],
    ['California native taxon', yesNo(s.californiaNative)],
    ['San Francisco native taxon', yesNo(s.sanFranciscoNative)],
    ['Habitat functions', list(s.habitatBenefits)],
    ['Associated wildlife', list(s.associatedWildlife)],
    ['Plant communities', list(s.plantCommunities)],
    ['Water use rating', text(s.waterNeed)],
    ['Sun / site conditions', list(s.sun)],
    ['Shade tolerant', yesNo(s.shadeTolerant)],
    ['Soil textures', list(s.soils)],
  ]) + '<p class="section-note">Native status describes the taxon’s geographic range; it does not establish the origin of this planted individual.</p>';

  const branch = s.branchStrengthHigh && s.branchStrengthHigh !== s.branchStrength
    ? `${text(s.branchStrength)} to ${text(s.branchStrengthHigh)}` : text(s.branchStrength);
  const urban = rows([
    ['Root damage potential', text(s.rootDamagePotential)],
    ['Branch strength rating', branch],
    ['Wind resistance', text(s.windResistance)],
    ['Salt tolerance', text(s.saltTolerance)],
    ['Utility friendly', yesNo(s.utilityFriendly)],
    ['Planting-area width', measured(s.recommendedPlantingAreaFt, 'ft')],
    ['Disease susceptibility', list(s.diseaseSusceptibility)],
    ['Pest susceptibility', list(s.pestSusceptibility)],
    ['Disease resistance', list(s.diseaseResistance)],
    ['Pest resistance', list(s.pestResistance)],
    ['Potential health issues', list(s.potentialHealthIssues)],
  ]) + '<p class="section-note">These general reference ratings guide species comparison. They do not assess this individual’s safety, roots, condition, disease or actual planting space.</p>';

  let guidance = '';
  const g = s.sf2024Guidance;
  if (g && typeof g === 'object') {
    const sectionLabels = {
      1: 'Local natives', 2: 'Most sidewalk locations', 3: 'Special considerations',
      4: 'Limited use / site restrictions', 5: 'Palms and palm-like trees',
    };
    guidance = section('San Francisco planting guidance · 2024', rows([
      ['List section', `${text(g.section)}${sectionLabels[g.section] ? ` · ${escapeHtml(sectionLabels[g.section])}` : ''}`],
      ['Minimum sidewalk width', measured(g.minimumSidewalkWidthFt, 'ft')],
      ['Utility friendly', yesNo(g.utilityFriendly)],
      ['Drought tolerant', yesNo(g.droughtTolerant)],
      ['Allergy friendly', yesNo(g.allergyFriendly)],
    ]) + (values(s.urbanNotes).length ? `<p class="section-note">${values(s.urbanNotes).map(escapeHtml).join(' ')}</p>` : '')
      + '<p class="section-note">Dated species/cultivar planting guidance. Utility compatibility refers to typical overhead high-voltage wires. Planting a new street tree requires Public Works approval.</p>'
      + link(g.sourceUrl, 'Read the 2024 City planting list'));
  }

  const urls = values(s.sourceUrls);
  const selectreeUrl = urls.find(url => String(url).startsWith('https://selectree.calpoly.edu/tree-detail/'));
  const plantFinderUrl = urls.find(url => String(url).startsWith('https://sfplanninggis.org/plantsf/'));
  const conflicts = values(s.referenceConflicts).map(conflict => {
    if (!conflict || typeof conflict !== 'object') return '';
    return `<div class="source-item"><strong>${escapeHtml(conflict.trait || 'Reference trait')}</strong><p>SF Plant Finder: ${text(conflict.sfPlantFinderValue)}. Cal Poly SelecTree: ${text(conflict.selectreeValue)}. Displayed source: ${text(conflict.preferredSource)}.</p>${link(plantFinderUrl, 'SF Plant Finder evidence')} ${link(selectreeUrl, 'Cal Poly record evidence')}</div>`;
  }).join('');

  const sources = urls.map(url => link(url,
    String(url).includes('selectree.calpoly.edu') ? 'Cal Poly SelecTree species record'
      : String(url).includes('sfplanninggis.org') ? 'SF Plant Finder reference'
        : String(url).includes('sfpublicworks.org') ? 'SF Public Works 2024 planting list'
          : 'Botanical reference source')).filter(Boolean).join('<br>');
  const provenance = section('Sources & reference uncertainty',
    `<p class="section-note">Reference taxon: <em>${escapeHtml(s.botanicalName || 'Unreported')}</em>. Unknown values remain unreported. Species/cultivar reference facts are separate from the City’s individual tree record.</p>`
    + (values(s.inventoryAliases).length ? `<p class="section-note">Published synonyms and matched inventory labels: ${list(s.inventoryAliases)}.</p>` : '')
    + (values(s.otherCommonNames).length ? `<p class="section-note">Other common names: ${list(s.otherCommonNames)}.</p>` : '')
    + (conflicts ? `<p class="section-note">Source classifications differ for the following traits. The preferred value is retained with the original evidence.</p>${conflicts}` : '<p class="section-note">No conflicting leaf-habit classification is recorded between the matched references.</p>')
    + sources);

  return `<section class="detail-section botanical-reference"><div class="section-title"><h3>Botanical reference</h3><span>SPECIES / CULTIVAR</span></div><p class="section-note">Reference characteristics of <em>${escapeHtml(s.botanicalName || 'this taxon')}</em>.</p>${section('Form, size & identification', form)}${section('Flowers, fruit & seasons', phenology)}${section('Ecology & growing conditions', ecology)}${section('Arborist reference traits', urban)}${guidance}${provenance}</section>`;
}

/** Controls only; parent owns state, event handling and filtering. */
export function advancedFilterMarkup(species) {
  const taxa = Array.isArray(species) ? species : Array.isArray(species?.species) ? species.species : [];
  const options = (field, label, extraField) => {
    const collected = taxa.flatMap(taxon => [
      ...(Array.isArray(taxon?.[field]) ? taxon[field] : [taxon?.[field]]),
      ...(extraField ? values(taxon?.[extraField]) : []),
    ]).filter(value => reported(value) && typeof value === 'string');
    return `<option value="">${escapeHtml(label)}</option>${[...new Set(collected)].sort((a, b) => a.localeCompare(b)).map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  };
  return `<details id="advanced-botany"><summary>Botanical & arborist filters${chevron}</summary>
    <label class="field-label" for="family-filter">BOTANICAL FAMILY<select id="family-filter">${options('family', 'All families')}</select></label>
    <label class="field-label" for="wildlife-filter">WILDLIFE & HABITAT<select id="wildlife-filter">${options('associatedWildlife', 'All wildlife / habitat', 'habitatBenefits')}</select></label>
    <label class="field-label" for="flower-color-filter">FLOWER COLOR<select id="flower-color-filter">${options('bloomColors', 'All flower colors')}</select></label>
    <label class="field-label" for="root-risk-filter">ROOT DAMAGE POTENTIAL<select id="root-risk-filter">${options('rootDamagePotential', 'All reference ratings')}</select></label>
    <label class="checkbox-label"><input type="checkbox" id="utility-filter">Utility friendly species</label>
    <label class="checkbox-label"><input type="checkbox" id="sf-native-filter">Native to San Francisco</label>
    <p class="filter-note">Species/cultivar reference traits. Unreported taxa are excluded when a trait filter is active. Root ratings do not assess an individual tree.</p>
  </details>`;
}
