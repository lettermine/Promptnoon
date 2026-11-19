import { controls, resolveCatalog, validCatalog } from './catalog.mjs';
import { describe, describePalette, describeScene, describeTime, describeWeather, fragment, renderMaster } from './compiler-language.mjs';
import { resolveCompatibility } from './compiler-compatibility.mjs';
import photo from './photographic-v2.0.mjs';
import { templates } from './masters.mjs';
import { presets as approved } from './presets.mjs';
import { defaultDetailLevel, detailLevels, renderPhoto } from './prompt-detail.mjs';

export const masters = [
  { id: 'interior_window', name: 'Interior Window', version: '1.2', description: 'Dari dalam ruangan, menghadap jendela panorama.', icon: 'window', subject: 'a contemporary reading lounge', style: 'refined contemporary minimalism', materials: 'warm walnut, matte plaster, and natural stone', details: 'a low sectional sofa and a coffee table', environment: 'a wooded valley', foreground: 'a modest stretch of natural flooring' },
  { id: 'exterior_window', name: 'Exterior Window', version: '1.6', description: 'Dari trotoar, menembus kaca ke interior yang hangat.', icon: 'glass', subject: 'an urban garden café', style: 'refined contemporary architecture', materials: 'slender metal frames, timber, and limestone', details: 'walnut benches and soft pendant lights', environment: 'a quiet leafy urban neighborhood street', foreground: 'a narrow strip of clean pedestrian stone paving' },
  { id: 'urban_cozy', name: 'Urban Cozy', version: '1.0', description: 'Fasad toko atau kafe di jalan kota yang tenang.', icon: 'store', subject: 'a neighborhood bakery', style: 'a contemporary classic storefront', materials: 'painted timber, limestone, and subtle brick', details: 'warm lighting and timber shelving', environment: 'a quiet neighborhood boulevard', foreground: 'narrow, unobtrusive pedestrian paving' },
  { id: 'landscape_architecture', name: 'Landscape Architecture', version: '1.3', description: 'Bangunan utuh di tengah lanskap yang luas.', icon: 'land', subject: 'a modern forest-edge retreat', style: 'premium contemporary minimalism', materials: 'exposed concrete, walnut, and locally sourced stone', environment: 'a wooded hillside', foreground: 'short natural grasses and low groundcover' }
];

const [golden, pastel] = approved;
export const presets = [
  { ...golden, lightingCharacter: 'low-angle golden sunlight with selected honey-gold highlights and deeper detailed olive-green shadows' },
  pastel,
  { id: 'misty-forest', name: 'Misty Forest Green', timeOfDay: 'overcast morning', weather: 'layered fog', lightingCharacter: 'soft overcast daylight', palette: ['forest green', 'muted sage', 'atmospheric gray'], mood: ['quiet', 'reflective'], note: 'Keep the fog physically believable and the subject clearly visible.' },
  { id: 'warm-urban', name: 'Warm Urban Evening / Foggy', timeOfDay: 'early evening around 18:00', weather: 'mild evening fog', lightingCharacter: 'subdued shaded exterior with warm architectural light where appropriate', palette: ['soft shaded greens', 'warm ivory', 'amber accents'], mood: ['intimate', 'peaceful'], note: 'Avoid a harsh blue cast.' },
  { id: 'custom', name: 'Custom' }
];

const simpleHeadings = new Map([
  ['INTERIOR WINDOW — SCENE', 'SCENE'],
  ['EXTERIOR WINDOW — SCENE', 'SCENE'],
  ['URBAN COZY — SCENE', 'SCENE'],
  ['LANDSCAPE ARCHITECTURE — SCENE', 'SCENE'],
  ['INTERIOR DESIGN DNA', 'INTERIOR DESIGN'],
  ['SCENE & ARCHITECTURE', 'ARCHITECTURE'],
  ['ARCHITECTURE & STOREFRONT', 'STOREFRONT'],
  ['COMPOSITION & WINDOW DOMINANCE', 'COMPOSITION'],
  ['COMPOSITION & CENTERED ARCHITECTURE', 'COMPOSITION'],
  ['CAMERA & OPTICS', 'CAMERA'],
  ['LANDSCAPE BEYOND GLASS', 'LANDSCAPE'],
  ['NATURAL ENVIRONMENT', 'LANDSCAPE'],
  ['URBAN GREEN ENVIRONMENT', 'URBAN CONTEXT'],
  ['FOREGROUND & DEPTH CONTROL', 'FOREGROUND'],
  ['FOREGROUND COMPRESSION — v1.3', 'FOREGROUND'],
  ['SHELTERED TRANSPARENCY', 'GLASS TRANSPARENCY'],
  ['GLASS REFLECTION CONTROL', 'GLASS REFLECTIONS'],
  ['PHOTOGRAPHIC REALISM & CINEMATIC ART DIRECTION — v2.0', 'PHOTOGRAPHIC ART DIRECTION'],
  ['COLOR, WEATHER, TIME & LIGHTING', 'COLOR & LIGHTING'],
  ['EMOTIONAL MOOD', 'MOOD'],
  ['EXECUTION CONSTRAINTS', 'CONSTRAINTS']
]);

function simplifyHeading(block) {
  return block.replace(/^[^:\n]+/, heading => simpleHeadings.get(heading) ?? heading);
}

export function fresh(master = masters[0].id) {
  return { master, presetId: presets[0].id, overrides: {}, rearTransparency: false, detailLevel: defaultDetailLevel };
}

export function assemble(state) {
  const index = masters.findIndex(master => master.id === state.master);
  const master = masters[index];
  const invalidCatalog = !validCatalog(state);
  const catalog = state.styleId && !invalidCatalog ? resolveCatalog(state) : null;
  const preset = presets.find(item => item.id === (catalog ? 'custom' : state.presetId));
  const overrides = Object.fromEntries(Object.entries(state.overrides).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
  const defaults = { timeOfDay: 'daytime', weather: 'clear', mood: 'peaceful and reflective', people: 'none', landscape: master.environment };
  const presetValues = {
    timeOfDay: preset.timeOfDay, weather: preset.weather, mood: preset.mood?.join(', '),
    palette: preset.palette?.join(', '), lightingCharacter: preset.lightingCharacter
  };
  const values = { ...master, ...defaults, ...Object.fromEntries(Object.entries(presetValues).filter(([, value]) => value)), ...overrides };
  if (catalog) {
    values.palette = overrides.palette || catalog.palette;
    values.lightingCharacter = overrides.lightingCharacter || catalog.text('lighting');
    values.weather = overrides.weather || catalog.text('atmosphere') || 'clear';
    values.mood = overrides.mood || catalog.text('emotion') || defaults.mood;
    values.environment = overrides.environment || catalog.text('environment') || master.environment;
    values.materials = overrides.materials || catalog.text('materials') || master.materials;
    values.season = overrides.season || catalog.text('season');
  }
  const urban = index === 1 || index === 2;
  values.landscape = overrides.landscape || (!urban && catalog?.text('landscape')) || values.environment;

  const errors = [];
  const warnings = [];
  if (invalidCatalog) errors.push('Referensi opsi katalog tidak valid.');
  const selected = catalog?.selected ?? {};
  const ignored = resolveCompatibility(values, selected, overrides, urban, warnings, errors);
  const remoteBackground = ignored.has('environment');
  if (remoteBackground) values.environment = master.environment;
  if (ignored.has('landscape')) values.landscape = values.environment;

  const custom = Object.values(overrides).join(' ');
  const diagonal = /\b(?:45\s*(?:°|degrees?|derajat)?|diagonal|three[- ]quarter|oblique|fisheye|dutch angle|aerial viewpoint)\b/i;
  const aspect = /\b(?:1:1|9:16|4:3|3:2|4:5|21:9)\b|\bportrait orientation\b/i;
  if (diagonal.test(custom)) errors.push('Sudut khusus bertentangan dengan kamera frontal. Hapus arahan sudut tersebut atau gunakan mode eksperimen saat tersedia.');
  if (aspect.test(custom)) errors.push('Rasio output terkunci pada 16:9. Hapus rasio atau orientasi lain dari isian.');
  const wilderness = /\b(?:dense remote forest|remote wilderness|remote forest|untouched jungle|tropical jungle|jungle|alpine meadow)\b/i;
  if (urban && wilderness.test([values.environment, values.landscape, values.additional].join(' '))) {
    errors.push('Master ini memerlukan konteks perkotaan. Pilih lingkungan urban atau gunakan Landscape Architecture untuk lokasi terpencil.');
  }
  if (urban && /\b(?:broad|prominent|wide|glossy)\b.{0,28}\b(?:road|roadway|wet pavement|grass|reflections)\b/i.test([values.foreground, values.additional].join(' '))) {
    errors.push('Area depan master ini harus sempit. Gunakan paving pejalan kaki yang tidak mendominasi bingkai.');
  }
  if (index === 3 && /\b(?:broad|deep|expansive|overgrown)\b.{0,22}\b(?:foreground|lawn|grass|groundcover)\b/i.test([values.foreground, values.additional].join(' '))) {
    errors.push('Landscape Architecture v1.3 memerlukan area depan yang dangkal dan rapi.');
  }
  const fog = /\b(?:fog|mist|haze)\b/i.test(values.weather) && !/no mandatory visible fog/i.test(values.weather);
  const cloud = /overcast|heavy fog|thick fog|dense fog|storm|heavy rain/i.test(values.weather);
  const lowLight = /night|blue hour|18:00|evening|dusk|twilight/i.test(values.timeOfDay);
  const baseLight = lowLight ? 'subdued natural exterior light with detail in the shadows' :
    cloud ? 'diffused natural light with softly separated tones' :
    /golden hour|sunset|sunrise/i.test(values.timeOfDay) ? 'low-angle directional sunlight' : 'balanced natural daylight';
  const light = (!ignored.has('lighting') && values.lightingCharacter) || baseLight;

  const includeRear = state.rearTransparency
    ? 'Introduce selected rear glazed openings revealing subtle, maintained courtyard greenery beyond the interior to create a natural sightline from exterior, through room, toward the rear environment.'
    : 'Do not require glazing at the rear; allow believable room depth and interior architectural details.';
  const seen = new Set();
  const emit = (key, format = describe) => ignored.has(key) ? [] : (catalog?.entries(key) ?? []).flatMap(row => {
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    return format(key, row.english_prompt, row.id);
  }).filter(Boolean);

  const materials = overrides.materials ? [] : emit('materials', (_, text) => text);
  const landscape = !urban && !overrides.landscape
    ? emit('landscape', (_, text) => text)[0] : '';
  const distinctLandscape = overrides.landscape || landscape;
  const scene = describeScene(values, materials, distinctLandscape, index);
  const context = !overrides.environment && !remoteBackground && selected.environment?.length
    ? 'a ' + fragment(values.environment) : fragment(values.environment);
  const naturalContext = landscape && !overrides.environment && !selected.environment?.length ? 'the surrounding landscape' : context;
  const tokens = {
    INTERIOR_TYPE: fragment(values.subject), OUTDOOR_LANDSCAPE: naturalContext,
    BUILDING_TYPE: fragment(values.subject), URBAN_ENVIRONMENT: context,
    OPTIONAL_REAR_GLAZING_SENTENCE: includeRear,
    BUSINESS_TYPE: fragment(values.subject), CITY_STREET_CONTEXT: context,
    MODERN_BUILDING_TYPE: fragment(values.subject), NATURAL_LANDSCAPE: naturalContext
  };
  const blocks = renderMaster(templates[index], tokens, scene, index);
  if (catalog || (urban && overrides.landscape)) {
    const details = [];
    for (const key of Object.keys(controls)) {
      if (['palette','lighting','atmosphere','emotion','environment','materials','season'].includes(key)) continue;
      if (key === 'landscape') {
        if (urban && overrides.landscape) {
          details.push('Where consistent with the streetscape, depict ' + fragment(overrides.landscape) + '.');
        } else if (urban) {
          details.push(...emit(key, (_, text) => 'Where consistent with the streetscape, use these details in the visible background: ' + fragment(text) + '.'));
        }
        continue;
      }
      if (key === 'wildlife_placement') {
        if (!selected.wildlife?.some(id => id !== 'wildlife.none')) continue;
        if (selected.water?.includes('water.none')) {
          details.push(...emit(key, (category, value, id) => id === 'wildlife_placement.above_water'
            ? 'Place the birds naturally near the treeline.' : describe(category, value, id)));
          continue;
        }
      }
      if (key === 'additional_mist' && selected.additional_mist?.includes('additional_mist.waterfall_spray') &&
          !selected.water?.includes('water.cascading_waterfall')) continue;
      if (key === 'botanical_species' && selected.ground_cover?.includes('ground_cover.ferns')) {
        details.push(...emit(key, (category, value, id) => id === 'botanical_species.ferns' ? '' : describe(category, value, id)));
      } else {
        details.push(...emit(key));
      }
    }
    if (remoteBackground) details.unshift('Keep any secluded natural scenery distant and secondary to the urban setting.');
    if (details.length) {
      blocks.push('ENVIRONMENTAL DETAILS:\n' + details.join(' ') +
        ' Apply these details only where they fit the existing framing. Preserve clear sightlines and keep the foreground subordinate.');
    }
  }
  const foreground = 'FOREGROUND & DEPTH CONTROL:\nFeature ' + values.foreground.replace(/\.$/, '') + ', keeping the foreground subordinate to the architectural subject.';
  if (index === 1) blocks.splice(5, 0, foreground);
  else if (index !== 3) blocks.push(foreground);
  else if (overrides.foreground) blocks[4] += ' ' + foreground.split('\n')[1];

  const execution = [
    values.people === 'none' ? 'Keep the scene unoccupied.' : 'Include ' + values.people.replace(/\.$/, '') + ' as a secondary element.',
    urban ? 'Avoid a prominent roadway and broad pavement reflections.' : '',
    values.additional
  ].filter(Boolean).join(' ');
  const isCatalogAtmosphere = !overrides.weather && selected.atmosphere?.length && !ignored.has('atmosphere');
  const atmosphere = [
    describeTime(values.timeOfDay),
    isCatalogAtmosphere ? emit('atmosphere').join(' ') : describeWeather(values.weather),
    (!overrides.lightingCharacter && emit('lighting')[0]) || describe('lighting', light),
    describePalette(values.palette),
    overrides.season ? describe('season', values.season) : emit('season').join(' '),
    fog && !isCatalogAtmosphere ? 'Keep atmospheric diffusion in the background and preserve a clear view of the main subject.' : '',
    index === 1 && (ignored.has('lighting') || overrides.lightingCharacter || !selected.lighting?.includes('lighting.warm_interior_cool_exterior'))
      ? 'Preserve inviting, warm interior light, with exterior illumination appropriate to the selected conditions.' : '',
    overrides.palette ? '' : preset.note
  ].filter(Boolean).join(' ');
  const mood = overrides.mood || !selected.emotion?.length ? describe('emotion', values.mood) : emit('emotion').join(' ');

  const detailLevel = Object.hasOwn(detailLevels, state.detailLevel) ? state.detailLevel : catalog ? 'full' : defaultDetailLevel;
  const photoText = renderPhoto(detailLevel);
  blocks.push(photoText, 'COLOR, WEATHER, TIME & LIGHTING:\n' + atmosphere,
    'EMOTIONAL MOOD:\n' + mood,
    'EXECUTION CONSTRAINTS:\n' + execution,
    'OUTPUT: Wide landscape composition, 16:9 aspect ratio, authentic professionally art-directed photographic quality. No text, logos, or watermarks.');
  if (blocks.some(block => /\[[A-Z_]+\]/.test(block))) errors.push('Ada placeholder adegan yang belum terisi.');
  const outputBlocks = blocks.map(simplifyHeading);
  return {
    prompt: errors.length ? '' : outputBlocks.join('\n\n'),
    blocks: outputBlocks, errors, warnings, values, master, photo,
    photoText: simplifyHeading(photoText), detailLevel
  };
}
