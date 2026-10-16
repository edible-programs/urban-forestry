export const seasons=['Spring','Summer','Fall','Winter'];
export function normalize(value=''){return String(value).toLowerCase().replace(/×/g,'x').replace(/[^a-z0-9]/g,'');}
export function names(label=''){const p=label.split(/\s*::\s*|\s+:\s+/);return {scientificName:p[0]||'Unidentified',commonName:p[1]||p[0]||'Unidentified tree'};}
export function matchSpecies(taxon,list){const n=normalize(names(taxon).scientificName);return list.find(s=>[s.botanicalName,s.scientificName,...(s.inventoryAliases||[]),...(s.aliases||[])].filter(Boolean).some(x=>normalize(x)===n))||null;}
export function validDate(v){return !!v&&/^\d{4}-\d{2}-\d{2}/.test(v)&&Number.isFinite(Date.parse(v));}
export function seasonalMonths(s){if(s.bloomMonths?.length)return s.bloomMonths;const result=new Set();for(const season of s.bloomSeasons||[]){const name=season.toLowerCase();const groups={spring:[3,4,5],summer:[6,7,8],fall:[9,10,11],autumn:[9,10,11],winter:[12,1,2]};for(const [k,v] of Object.entries(groups))if(name.includes(k))v.forEach(x=>result.add(x));}return [...result];}
export function filterTrees(trees,f,bounds){return trees.filter(t=>{
 const s=t.traits,q=f.query?.trim().toLowerCase();
 if(q&&!t.search.includes(q))return false;
 if(f.species&&t.species!==f.species)return false;
 if(f.neighborhood&&t.neighborhood!==f.neighborhood)return false;
 if(f.street&&!t.street?.toLowerCase().includes(f.street.toLowerCase()))return false;
 if(f.native&&s?.californiaNative!==true)return false;
 if(f.large&&!(t.dbh>=24))return false;
 if(f.bloom&&(!s||s.bloomInterpretation==='cone/pollen season'||!seasonalMonths(s).includes(f.currentMonth)))return false;
 if(f.habit&&(!s?.leafHabit||!s.leafHabit.toLowerCase().includes(f.habit.toLowerCase())))return false;
 if(f.water){const w=String(s?.waterNeed||'').toLowerCase().replace('medium','moderate');if(!w.includes(f.water.toLowerCase()))return false;}
 if(f.season&&(!s||s.bloomInterpretation==='cone/pollen season'||!(s.bloomSeasons||[]).some(x=>x.toLowerCase().includes(f.season.toLowerCase())||(f.season==='Fall'&&x.toLowerCase().includes('autumn')))))return false;
 if(f.minDbh!==''&&f.minDbh!=null&&!(t.dbh!=null&&t.dbh>=Number(f.minDbh)))return false;
 if(f.maxDbh!==''&&f.maxDbh!=null&&!(t.dbh!=null&&t.dbh<=Number(f.maxDbh)))return false;
 if(f.height){const h=s?.matureHeightMaxFt||s?.matureHeightFt?.[1];if(!h||f.height==='small'&&h>=30||f.height==='medium'&&(h<30||h>60)||f.height==='large'&&h<=60)return false;}
 if(f.plantedOnly&&!validDate(t.plantedDate))return false;
 if(f.prune&&(t.pruneStatus||'Unknown').toLowerCase()!==f.prune.toLowerCase())return false;
 if(f.legal&&t.legalStatus!==f.legal)return false;
 if(f.family&&s?.family!==f.family)return false;
 if(f.wildlife&&![...(s?.associatedWildlife||[]),...(s?.habitatBenefits||[])].some(x=>x.toLowerCase().includes(f.wildlife.toLowerCase())))return false;
 if(f.flowerColor&&!(s?.bloomColors||[]).some(x=>x.toLowerCase().includes(f.flowerColor.toLowerCase())))return false;
 if(f.rootRisk&&s?.rootDamagePotential!==f.rootRisk)return false;
 if(f.utility&&s?.utilityFriendly!==true)return false;
 if(f.sfNative&&s?.sanFranciscoNative!==true)return false;
 if(f.timeline){const y=validDate(t.plantedDate)?Number(t.plantedDate.slice(0,4)):null;if(y===null&&!f.includeUndated)return false;if(y!==null&&y>f.year)return false;}
 if(f.inBounds&&bounds&&(!t.lat||!bounds.contains([t.lng,t.lat])))return false;
 return true;
});}
export function csv(rows,columns){const safe=v=>{const s=String(v??'');const guarded=typeof v==='string'&&/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)?"'"+s:s;return '"'+guarded.replaceAll('"','""')+'"';};return [columns.map(safe).join(','),...rows.map(t=>columns.map(k=>safe(t[k])).join(','))].join('\r\n');}
export function featureCollection(trees){return {type:'FeatureCollection',features:trees.filter(t=>Number.isFinite(t.lat)&&Number.isFinite(t.lng)).map(t=>({type:'Feature',id:t.id,geometry:{type:'Point',coordinates:[t.lng,t.lat]},properties:{id:t.id,species:t.species,address:t.address,dbh:t.dbh,plantedDate:t.plantedDate,pruningZone:t.zone?.keymap??null,pruningStatus:t.pruneStatus,...Object.fromEntries(['commonName','scientificName','neighborhood','legalStatus','pruningSchedule','pruningCompleteDates','californiaNative','referenceHeightMaxFt','referenceSpreadMaxFt','bloomSeasons','permitNotes','archivePlantDate','archiveDbh','fieldNote','personalCondition','source','snapshot'].filter(k=>t[k]!==undefined).map(k=>[k,t[k]]))}}))};}
