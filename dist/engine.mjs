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

export function fresh(master = masters[0].id) {
  return { master, presetId: presets[0].id, overrides: {}, rearTransparency: false, detailLevel: defaultDetailLevel };
}

export function assemble(state) {
  const index = masters.findIndex(master => master.id === state.master);
  const master = masters[index];
  const preset = presets.find(item => item.id === state.presetId);
  const overrides = Object.fromEntries(Object.entries(state.overrides).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
  const defaults = { timeOfDay: 'daytime', weather: 'clear', mood: 'peaceful and reflective', people: 'none', landscape: master.environment };
  const presetValues = {
    timeOfDay: preset.timeOfDay, weather: preset.weather, mood: preset.mood?.join(', '),
    palette: preset.palette?.join(', '), lightingCharacter: preset.lightingCharacter
  };
  const values = { ...master, ...defaults, ...Object.fromEntries(Object.entries(presetValues).filter(([, value]) => value)), ...overrides };
  values.landscape = overrides.landscape || values.environment;

  const errors = [];
  const warnings = [];
  const custom = Object.values(overrides).join(' ');
  const diagonal = /\b(?:45\s*(?:°|degrees?|derajat)?|diagonal|three[- ]quarter|oblique|fisheye|dutch angle|aerial viewpoint)\b/i;
  const aspect = /\b(?:1:1|9:16|4:3|3:2|4:5|21:9)\b|\bportrait orientation\b/i;
  if (diagonal.test(custom)) errors.push('Sudut khusus bertentangan dengan kamera frontal. Hapus arahan sudut tersebut atau gunakan mode eksperimen saat tersedia.');
  if (aspect.test(custom)) errors.push('Rasio output terkunci pada 16:9. Hapus rasio atau orientasi lain dari isian.');
  const urban = index === 1 || index === 2;
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
  if (/\b(?:snow[- ]covered|snowy|alpine|glacier)\b/i.test(custom) && /\b(?:tropical jungle|tropical rainforest)\b/i.test(custom)) {
    warnings.push('Periksa keselarasan lokasi. Detail alpine dan hutan tropis biasanya membutuhkan konteks geografis yang jelas.');
  }
  const timeWeather = values.timeOfDay + ' under ' + values.weather + ' conditions';
  const fog = /fog|mist|haze/i.test(values.weather);
  const cloud = /overcast|fog|mist|cloud|rain/i.test(values.weather);
  const lowLight = /night|blue hour|18:00|evening|dusk/i.test(values.timeOfDay);
  const baseLight = lowLight ? 'subdued natural exterior light with detail in the shadows' :
    cloud ? 'diffused natural light with softly separated tones' :
    /golden hour|sunset|sunrise/i.test(values.timeOfDay) ? 'low-angle directional sunlight' : 'balanced natural daylight';
  let light = overrides.lightingCharacter || (!(overrides.timeOfDay || overrides.weather) ? values.lightingCharacter : '') || baseLight;
  if ((cloud && /direct sunlight|hard sunlight|harsh midday|hard sun/i.test(light)) || (lowLight && /midday|noon light/i.test(light))) {
    warnings.push('Karakter cahaya khusus disesuaikan dengan cuaca dan waktu yang dipilih.');
    light = baseLight;
  }

  const includeRear = state.rearTransparency
    ? 'Introduce selected rear glazed openings revealing subtle, maintained courtyard greenery beyond the interior to create a natural sightline from exterior, through room, toward the rear environment.'
    : 'Do not require glazing at the rear; allow believable room depth and interior architectural details.';
  const tokens = {
    INTERIOR_TYPE: values.subject, OUTDOOR_LANDSCAPE: values.environment, MOOD: values.mood,
    INTERIOR_MATERIALS: values.materials, INTERIOR_FURNITURE: values.details, OUTDOOR_LANDSCAPE_DETAILS: values.landscape,
    BUILDING_TYPE: values.subject, URBAN_ENVIRONMENT: values.environment, INTERIOR_MOOD: values.mood,
    INTERIOR_DETAILS: values.details, BUILDING_MATERIALS: values.materials, OPTIONAL_REAR_GLAZING_SENTENCE: includeRear,
    BUSINESS_TYPE: values.subject, CITY_STREET_CONTEXT: values.environment, TIME_AND_WEATHER: timeWeather,
    FACAD_STYLE: values.style, FACAD_MATERIALS: values.materials, MODERN_BUILDING_TYPE: values.subject,
    NATURAL_LANDSCAPE: values.environment, ARCHITECTURAL_STYLE: values.style, MATERIALS: values.materials,
    LANDSCAPE_DETAILS: values.landscape
  };
  const blocks = templates[index].map(block => block.replace(/\[([A-Z_]+)\]/g, (_, key) => tokens[key]));
  if (index < 2) blocks[1] += ' Use ' + values.style.replace(/\.$/, '') + ' as the architectural direction.';
  if (urban && overrides.landscape) blocks[index === 1 ? 4 : 3] += ' Include ' + values.landscape.replace(/\.$/, '') + ' where consistent with the streetscape.';
  const foreground = 'FOREGROUND & DEPTH CONTROL:\nFeature ' + values.foreground.replace(/\.$/, '') + ', keeping the foreground subordinate to the architectural subject.';
  if (index === 1) blocks.splice(5, 0, foreground);
  else if (index !== 3) blocks.push(foreground);
  else if (overrides.foreground) blocks[4] += ' ' + foreground.split('\n')[1];

  const execution = [
    values.people === 'none' ? 'Keep the scene unoccupied.' : 'Include ' + values.people.replace(/\.$/, '') + ' as a secondary element.',
    urban ? 'Avoid a prominent roadway and broad pavement reflections.' : '',
    values.additional
  ].filter(Boolean).join(' ');
  const atmosphere = [
    'Render the scene at ' + values.timeOfDay + ' with ' + values.weather + ' conditions.',
    'Shape the light using ' + light.replace(/\.$/, '') + '.',
    values.palette ? 'Use a palette of ' + values.palette.replace(/\.$/, '') + '.' : '',
    values.season ? 'Reflect the natural seasonal cues of ' + values.season.replace(/\.$/, '') + '.' : '',
    fog ? 'Keep atmospheric diffusion in the background and preserve a clear view of the main subject.' : '',
    index === 1 ? 'Balance the subdued outdoor shade with inviting, warm interior light.' : '',
    overrides.palette ? '' : preset.note
  ].filter(Boolean).join(' ');

  const detailLevel = Object.hasOwn(detailLevels, state.detailLevel) ? state.detailLevel : defaultDetailLevel;
  const photoText = renderPhoto(detailLevel);
  blocks.push(photoText, 'COLOR, WEATHER, TIME & LIGHTING:\n' + atmosphere,
    'EMOTIONAL MOOD:\nCreate an atmosphere that feels ' + values.mood.replace(/\.$/, '') + '.',
    'EXECUTION CONSTRAINTS:\n' + execution,
    'OUTPUT: Wide landscape composition, 16:9 aspect ratio, authentic professionally art-directed photographic quality. No text, logos, or watermarks.');
  return { prompt: errors.length ? '' : blocks.join('\n\n'), blocks, errors, warnings, values, master, photo, photoText, detailLevel };
}
