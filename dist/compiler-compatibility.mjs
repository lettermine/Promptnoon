// Compatibility rules refer to approved catalog IDs, with conservative
// recognition of the most common conflicts in custom English fields.
const contains = (selected, category, ids) => selected[category]?.some(id => ids.includes(id));
const sunset = ['lighting.directional_golden_hour', 'lighting.pastel_sunset', 'lighting.backlit_golden_atmosphere'];
const openSky = ['sky.clear_pale_sky', 'sky.luminous_cumulus', 'sky.pale_powder_blue', 'sky.powder_blue_cumulus'];
const tropicalLand = ['landscape.botanical_lounge', 'landscape.dense_tropical_foliage', 'landscape.tropical_courtyard', 'landscape.tropical_waterfall_forest'];
const alpineLand = ['landscape.alpine_mountains', 'landscape.alpine_countryside', 'landscape.mountain_valley'];
const hardLight = ['lighting.clear_alpine_sunlight', 'lighting.high_key_daylight', 'lighting.filtered_canopy_sunlight', 'lighting.luminous_meadow_daylight'];
const landscapeWater = {
  'landscape.wooded_waterside': 'water.still_lake',
  'landscape.sakura_lakeside': 'water.still_lake',
  'landscape.reflective_woodland_pond': 'water.still_pond',
  'landscape.tropical_waterfall_forest': 'water.cascading_waterfall'
};

export function resolveCompatibility(values, selected, overrides, urban, warnings, errors) {
  const ignored = new Set();
  const has = (key, ids) => contains(selected, key, ids);
  const ignore = (key, warning) => {
    if (ignored.has(key)) return;
    ignored.add(key);
    warnings.push(warning);
  };

  const remote = has('environment', ['environment.secluded_nature']);
  if (urban && remote && !overrides.environment) {
    ignore('environment', 'Konteks alam terpencil dialihkan ke latar agar konteks jalan tetap sesuai master urban.');
  }

  const sunsetSky = has('sky', ['sky.pastel_sunset']);
  const sunsetLight = has('lighting', sunset) && !overrides.lightingCharacter || /golden[- ]hour|sunset|golden sunlight/i.test(values.lightingCharacter);
  const explicitTime = Boolean(overrides.timeOfDay);
  const daytime = /\b(?:midday|noon|morning)\b/i.test(values.timeOfDay);
  const night = /\b(?:night|midnight|blue hour)\b/i.test(values.timeOfDay);
  if (explicitTime && (daytime || night)) {
    if (sunsetSky) ignore('sky', 'Langit sunset dilewati karena waktu yang dipilih bukan senja.');
    if (sunsetLight) ignore('lighting', 'Pencahayaan senja diganti dengan cahaya yang sesuai waktu pilihan.');
  } else if (!explicitTime && (sunsetSky || sunsetLight)) {
    values.timeOfDay = 'golden hour';
  }
  if (night && has('sky', openSky)) {
    ignore('sky', 'Langit cerah siang hari dilewati untuk adegan malam.');
  }

  const weather = values.weather;
  const overcast = /\b(?:overcast|heavy fog|thick fog|dense fog|storm|heavy rain)\b/i.test(weather);
  const catalogLight = !overrides.lightingCharacter && has('lighting', hardLight);
  const overcastLight = /\bovercast\b/i.test(values.lightingCharacter);
  const clearAtmosphere = /^clear\b/i.test(weather) && !/\b(?:fog|mist|haze)\b/i.test(weather);
  if (overcastLight && (clearAtmosphere || has('sky', openSky))) {
    ignore('lighting', 'Pencahayaan mendung disesuaikan dengan atmosfer atau langit cerah yang dipilih.');
  }
  if (overcast && has('sky', [...openSky, 'sky.pastel_sunset'])) {
    ignore('sky', 'Detail langit dilewati karena bertentangan dengan atmosfer yang dipilih.');
  }
  if ((overcast && (catalogLight || sunsetLight || /direct sunlight|hard sunlight|harsh midday|hard sun/i.test(values.lightingCharacter))) ||
      (night && /sunlight|daylight|sunlit|midday|noon light/i.test(values.lightingCharacter))) {
    ignore('lighting', 'Pencahayaan disesuaikan dengan waktu dan atmosfer pilihan.');
  }

  const requiredWater = landscapeWater[selected.landscape?.[0]];
  if (requiredWater && selected.water?.includes('water.none') && !overrides.landscape) {
    ignore('landscape', 'Detail lanskap yang mengharuskan air dilewati karena fitur air dinonaktifkan.');
  }

  const tropical = /\b(?:tropical|monstera|philodendron|elephant ear)\b/i.test([values.environment, values.landscape].join(' ')) ||
    (!overrides.landscape && has('landscape', tropicalLand));
  const snowy = /\b(?:snow|snowy|snowfall|snow[- ]covered|snow-capped|glacier)\b/i.test(values.landscape) ||
    (!overrides.landscape && has('landscape', ['landscape.alpine_mountains']));
  const alpine = snowy || (!overrides.landscape && has('landscape', alpineLand));
  if (tropical && /\b(?:snow|snowy|snowfall|winter)\b/i.test(values.season)) {
    if (overrides.season) errors.push('Musim dingin bersalju bertentangan dengan lanskap tropis.');
    else ignore('season', 'Musim bersalju dilewati agar lanskap tropis tetap masuk akal.');
  }
  if (alpine && /^clear naturally humid tropical air/i.test(values.weather) && overrides.weather) {
    errors.push('Atmosfer tropis bertentangan dengan lanskap alpine.');
  }
  if (alpine && has('atmosphere', ['atmosphere.clear_tropical_humidity']) && !overrides.weather) {
    ignore('atmosphere', 'Atmosfer tropis diganti dengan udara pegunungan yang sesuai.');
    values.weather = 'clear mountain air';
  }
  if (snowy && has('botanical_species', ['botanical_species.monstera', 'botanical_species.philodendron', 'botanical_species.palms', 'botanical_species.elephant_ear', 'botanical_species.broadleaf'])) {
    ignore('botanical_species', 'Tanaman tropis dilewati pada lanskap bersalju.');
  }
  if (tropical && has('lighting', ['lighting.clear_alpine_sunlight']) && !overrides.lightingCharacter) {
    ignore('lighting', 'Cahaya alpine diganti dengan pencahayaan yang sesuai untuk lanskap tropis.');
  }
  if (tropical && has('atmosphere', ['atmosphere.clear_alpine_air']) && !overrides.weather) {
    ignore('atmosphere', 'Udara alpine diganti dengan atmosfer yang sesuai untuk lanskap tropis.');
    values.weather = 'clear natural air';
  }
  if (tropical && has('sky', ['sky.alpine_cloud_bank'])) {
    ignore('sky', 'Awan alpine dilewati pada lanskap tropis.');
  }
  return ignored;
}

// Position compatible terrain and water features at an appropriate scale instead
// of treating different landforms in a single view as mutually exclusive.
export function geographicRelationships(values, selected, ignored, urban, overrides) {
  const landscapeId = ignored.has('landscape') || overrides.landscape ? '' : selected.landscape?.[0];
  const environmentId = ignored.has('environment') || overrides.environment ? '' : selected.environment?.[0];
  const setting = [values.environment, values.landscape, landscapeId, environmentId].join(' ');
  const coastal = /coast|seaside|headland|(?:^|\s)sea(?:\s|$)|bay|shoreline/i.test(setting);
  const highlands = /mountain|alpine|highlands|rugged peaks/i.test(setting);
  const water = selected.water?.[0];
  const season = overrides.season ? '' : selected.season?.[0];
  const sky = ignored.has('sky') ? '' : selected.sky?.[0];
  const requiredWater = landscapeWater[landscapeId];
  const descriptions = [];

  if (urban && (coastal || highlands)) {
    descriptions.push(coastal
      ? 'Keep the building and pedestrian edge in the urban foreground. Show the coast through a distant opening in the streetscape.'
      : 'Keep the building and pedestrian edge in the urban foreground. Place the high terrain beyond the built area.');
  }
  if (coastal && highlands) {
    descriptions.push('Connect the coast and the higher terrain with believable rising slopes. Keep the sea at the lowest elevation.');
  }
  if (water && water !== 'water.none') {
    if (urban) descriptions.push('Place the water feature in a visible garden, park, or distant landscape. Keep pedestrian access clear.');
    if (coastal) descriptions.push('Keep the freshwater feature distinct from the sea and place it inland or within a maintained garden.');
    if (requiredWater && water !== requiredWater) {
      descriptions.push(water === 'water.cascading_waterfall'
        ? 'Place the cascade upstream of the still water, with calmer reflections away from the inflow.'
        : requiredWater === 'water.cascading_waterfall'
          ? 'Place the selected water feature below the cascade or along its outflow, keeping fast and still water distinct.'
          : 'Separate the water bodies with a natural bank or a narrow change in terrain.');
    } else if (water === 'water.cascading_waterfall' && !highlands && !urban && !coastal) {
      descriptions.push('Set the cascade against a believable change in elevation and confine spray to its immediate surroundings.');
    }
  }
  if (!ignored.has('season') && season === 'season.spring_bloom' && highlands) {
    descriptions.push('Keep spring blooms on sheltered lower slopes. Retain any remaining snow at higher elevations.');
  }
  if (sky === 'sky.alpine_cloud_bank' && !highlands) {
    descriptions.push('Show a cloud bank only if distant peaks are visible in the existing view.');
  }
  return descriptions;
}
