// Structured English for catalog fragments and user-supplied scene descriptions.
export function fragment(value) {
  const text = value.trim().replace(/[.!?]+$/, '');
  return text.replace(/^[A-Z](?=[a-z])/, first => first.toLowerCase());
}

function sentence(prefix, value) {
  return value ? prefix + fragment(value) + '.' : '';
}

const templates = {
  materials: 'Use ',
  landscape: 'Frame the landscape with these details: ',
  lighting: 'Light the scene with ',
  atmosphere: 'Preserve ',
  season: 'Show ',
  sky: 'Where the sky is visible in the existing framing, show ',
  water: 'Include ',
  wildlife: 'Include ',
  wildlife_placement: 'For wildlife placement, show ',
  hardscape: 'Place ',
  botanical_species: 'Include ',
  planting_density: 'Use ',
  ground_cover: 'Use ',
  openness: 'Maintain ',
  additional_mist: 'Show '
};

export function describe(category, value, id) {
  if (!value || ['season.custom_season', 'season.season_neutral', 'water.none', 'wildlife.none'].includes(id)) return '';
  if (id === 'wildlife_placement.above_water') return 'Place the birds naturally above the water or near the treeline.';
  if (id === 'wildlife_placement.across_canopy') return 'Show the birds crossing the woodland canopy.';
  if (id === 'wildlife_placement.distant_background') return 'Keep wildlife distant and secondary.';
  if (id === 'additional_mist.soft_garden_mist') {
    return 'Keep soft garden mist behind the planting beds. Preserve sharp foreground and stone detail.';
  }
  if (id === 'lighting.high_key_daylight') {
    return 'Light the scene with naturally luminous high-key daylight. Preserve texture in whites, blossoms, pale walls, and snow. Keep the midtones bright and nuanced, with soft dimensional shadows and controlled highlights.';
  }
  if (id === 'wildlife.flying_white_birds') {
    return 'Include a small, loosely spaced flock of realistically sized white birds. Vary their wing positions and keep them secondary to the architecture.';
  }
  if (category === 'emotion') return sentence('Convey this mood: ', value);
  return sentence(templates[category], value);
}

export function describeScene(values, materials, landscape, index) {
  const design = sentence(index === 2 ? 'Design the storefront in this style: ' : 'Use this architectural style: ', values.style);
  const furniture = [
    'Furnish the interior with ',
    'Show these interior details through the glass: ',
    'Let the windows reveal subtle interior details: '
  ];
  return {
    design,
    materials: (materials.length ? materials : [values.materials]).map(value => describe('materials', value)).join(' '),
    furniture: index < furniture.length ? sentence(furniture[index], values.details) : '',
    landscape: describe('landscape', landscape)
  };
}

export function describeWeather(value) {
  return sentence('Set the scene under these conditions: ', value);
}

export function describeTime(value) {
  return sentence('Set the time of day: ', value);
}

export function describePalette(value) {
  return value ? 'Use this color palette: ' + value.trim().replace(/[.!?]+$/, '') + '.' : '';
}

// Render the variable-bearing portions while keeping each master's composition,
// camera, foreground and non-variable architectural constraints in place.
export function renderMaster(template, tokens, scene, index) {
  const blocks = template.map(block => block
    .replace('The room feels [MOOD] and authentically habitable.', 'Keep the room authentically habitable.')
    .replace('The visible interior feels [INTERIOR_MOOD] with [INTERIOR_DETAILS].', '')
    .replace(' during [TIME_AND_WEATHER]', '')
    .replace('situated along [URBAN_ENVIRONMENT]', 'situated in [URBAN_ENVIRONMENT]')
    .replace('The scene feels [MOOD] and like an authentic, well-loved urban place.', 'Give the scene the character of an authentic, well-loved urban place.')
    .replace('Feature [INTERIOR_MATERIALS] and [INTERIOR_FURNITURE].', scene.materials + ' ' + scene.furniture)
    .replace('Use [BUILDING_MATERIALS] with believable', scene.materials + ' Maintain believable')
    .replace('Feature [FACAD_STYLE] with [FACAD_MATERIALS], a welcoming', scene.design + ' ' + scene.materials + ' Provide a welcoming')
    .replace('Reveal subtle [INTERIOR_DETAILS] through the windows without making glass transparency the only subject.', scene.furniture + ' Do not make glass transparency the only subject.')
    .replace('Use [ARCHITECTURAL_STYLE] with clean coherent geometry, [MATERIALS], expansive', scene.design + ' ' + scene.materials + ' Use clean coherent geometry, expansive')
    .replace('Reveal [OUTDOOR_LANDSCAPE_DETAILS] with realistic', scene.landscape + ' Preserve realistic')
    .replace('Reveal [LANDSCAPE_DETAILS] with naturally layered', scene.landscape + ' Preserve naturally layered')
    .replace('The building is located in [URBAN_ENVIRONMENT], with recognizable and maintained urban/suburban context.', 'Maintain a recognizable, well-kept urban or suburban context.')
    .replace(/\[([A-Z_]+)\]/g, (match, key) => tokens[key] ?? match)
    .trim());
  if (index < 2) blocks[1] += ' ' + scene.design;
  if (index === 1) blocks[0] += ' ' + scene.furniture;
  return blocks;
}
