import data from './seed-catalog.mjs';

const byId = rows => new Map(rows.map(row => [row.id, row]));
const ordered = rows => [...rows].sort((a,b) => a.sort_order - b.sort_order);
export const families = ordered(data.visual_families);
export const styles = byId([...data.style_presets].sort((a,b) => a.family_id.localeCompare(b.family_id) || a.sort_order - b.sort_order));
export const palettes = byId(data.palettes);
const dna = byId(data.dna_options);

export const controls = {
  palette: 'Palet katalog', lighting: 'Pencahayaan', atmosphere: 'Atmosfer', landscape: 'Lanskap',
  emotion: 'Emosi', environment: 'Konteks lingkungan', water: 'Air', wildlife: 'Satwa',
  wildlife_placement: 'Posisi satwa', hardscape: 'Elemen taman', botanical_species: 'Spesies tanaman',
  planting_density: 'Kerapatan tanaman', ground_cover: 'Penutup tanah', season: 'Musim',
  sky: 'Langit', openness: 'Keterbukaan lanskap', materials: 'Material arsitektur', additional_mist: 'Kabut lokal'
};
export const multiChoices = new Set(['ground_cover', 'botanical_species', 'hardscape', 'materials']);
export const options = Object.fromEntries(Object.keys(controls).map(key => [key, key === 'palette'
  ? [...palettes.values()].map(row => ({ id: row.id, label: row.name }))
  : [...dna.values()].filter(row => row.category === key).sort((a,b) => a.label.localeCompare(b.label, 'en'))]));

export function validCatalog(state) {
  if (state.styleId === undefined) return state.dna === undefined;
  return styles.has(state.styleId) && state.dna && typeof state.dna === 'object' && !Array.isArray(state.dna) &&
    Object.entries(state.dna).every(([key, ids]) => Object.hasOwn(options, key) && Array.isArray(ids) &&
      (multiChoices.has(key) || ids.length <= 1) && new Set(ids).size === ids.length && ids.every(id => options[key].some(option => option.id === id)));
}

export function catalogDefaults(styleId) {
  const style = styles.get(styleId);
  const defaults = { palette: [style.primary_palette_id] };
  for (const key of ['lighting','atmosphere','landscape','emotion']) defaults[key] = [style[key + '_id']];
  const features = data.preset_feature_defaults.filter(row => row.preset_id === styleId && row.enabled);
  for (const row of features.sort((a,b) => a.ordinal - b.ordinal)) (defaults[row.category] ??= []).push(row.dna_id);
  return defaults;
}

export function resolveCatalog(state) {
  const selected = { ...catalogDefaults(state.styleId), ...state.dna };
  const entries = key => [...new Set(selected[key] ?? [])].map(id => dna.get(id));
  const text = key => entries(key).map(row => row.english_prompt).join(', ');
  const palette = (selected.palette ?? []).map(id => palettes.get(id).name);
  const primary = styles.get(state.styleId).primary_palette_id;
  const renderedPalettes = new Set(selected.palette);
  if (palette.length === 1 && (state.dna.palette === undefined || selected.palette[0] === primary)) {
    for (const link of data.preset_palette_links.filter(row => row.preset_id === state.styleId)) {
      if (renderedPalettes.has(link.palette_id)) continue;
      renderedPalettes.add(link.palette_id);
      palette.push(palettes.get(link.palette_id).name + ' (' + link.role + ')');
    }
  }
  return { selected, entries, text, palette: palette.join(', ') };
}

export function swatches(id) {
  return data.palette_swatches.filter(row => row.palette_id === id).sort((a,b) => a.position - b.position);
}
