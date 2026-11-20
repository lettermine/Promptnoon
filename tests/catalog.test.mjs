import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { assemble, fresh, masters } from '../dist/engine.mjs';
import { templates } from '../dist/masters.mjs';
import photo from '../dist/photographic-v2.0.mjs';
import { catalogDefaults, families, palettes, styles, validCatalog } from '../dist/catalog.mjs';

const canonicalHashes = [
  'd1bc50348679e7c0b0cabfef35326c904a8daa4cb1060b21586ea8d9e754a03d',
  'eb7296784cab278c2f1f6b1173bcc2a672556d051ad24d363cb3d8c5bb6b1243',
  '8444810a59d23627b3aaec1e487844a0d010e75bc4b173e1892d75d93d84dc63',
  '61edbf79fd8051b6a7946eeeba1e71e6f9a36dae05d7bb9d4446a714f88d2828',
  '79f5896744846255395df65180cc7b2967eb76e98fa727bd64332dbd00ed8380'
];

test('catalog counts, locked hashes, and published defaults', () => {
  assert.equal(families.length, 9);
  assert.equal(styles.size, 36);
  assert.equal(palettes.size, 27);
  const modules = [...templates.map(blocks => blocks.join('\n\n')), photo.text];
  assert.deepEqual(modules.map(text => createHash('sha256').update(text).digest('hex')), canonicalHashes);
  for (const [styleId, style] of styles) {
    assert.ok(validCatalog({ styleId, dna: catalogDefaults(styleId) }));
    if (style.family_id === 'family_04') assert.equal(style.atmosphere_id, 'atmosphere.gentle_haze');
    assert.equal(Boolean(catalogDefaults(styleId).wildlife?.includes('wildlife.flying_white_birds')), styleId === 'preset_03_01');
  }
});

test('all masters, catalog styles, and output modes compile without placeholders', () => {
  for (const master of masters) {
    const baseline = assemble(fresh(master.id));
    const locks = result => result.blocks.filter(block => /^(COMPOSITION(?: & CAMERA)?|CAMERA):/.test(block) ||
      (master.id === 'landscape_architecture' && block.startsWith('FOREGROUND:')));
    for (const styleId of styles.keys()) {
      const state = { ...fresh(master.id), styleId, dna: {} };
      for (const detailLevel of ['compact', 'standard', 'full']) {
        const result = assemble({ ...state, detailLevel });
        assert.equal(result.errors.length, 0, master.id + '/' + styleId);
        assert.doesNotMatch(result.prompt, /\[[A-Z_]+\]/);
        assert.equal(result.prompt.split('PHOTOGRAPHIC ART DIRECTION').length, 2);
        assert.deepEqual(locks(result), locks(baseline));
        assert.ok(result.blocks[0].startsWith('SCENE:\n'));
        for (const block of result.blocks) {
          assert.doesNotMatch(block.split('\n')[0].split(':')[0], /\b(?:DNA|MASTER|LOCKED)\b|\bv\d/i);
        }
        if (detailLevel === 'full') {
          assert.equal(result.photoText, 'PHOTOGRAPHIC ART DIRECTION' + photo.text.slice(photo.text.indexOf('\n')));
        }
      }
    }
  }
});

test('independent overrides and conflicts', () => {
  const state = { ...fresh('exterior_window'), styleId: 'preset_03_01', dna: {} };
  assert.match(assemble(state).prompt, /white birds/);
  assert.doesNotMatch(assemble({ ...state, dna: { wildlife: [] } }).prompt, /white birds/);
  assert.match(assemble({ ...state, dna: { environment: ['environment.secluded_nature'] } }).warnings.join(' '), /konteks jalan/);
  assert.ok(assemble({ ...state, dna: { water: ['lighting.high_key_daylight'] } }).errors.length);
  assert.equal(assemble({ ...state, overrides: { additional: 'Use a diagonal camera angle' } }).prompt, '');
});

test('scene grammar separates material, furniture, weather, light, and mood instructions', () => {
  const state = { ...fresh(), styleId: 'preset_08_02', dna: {}, detailLevel: 'compact' };
  const { prompt } = assemble(state);
  assert.match(prompt, /Use realistic textured whitewashed plaster\. Use pale natural stone with visible fine texture\. Furnish the interior with a low sectional sofa and a coffee table\./);
  assert.match(prompt, /Preserve soft clear coastal air[^.]+\. Light the scene with naturally luminous high-key daylight\./);
  assert.match(prompt, /MOOD:\nConvey this mood: airy minimalist coastal serenity/);
  assert.doesNotMatch(prompt, /feels airy minimalist|with .*? conditions\.|undefined/);
  assert.equal(assemble(JSON.parse(JSON.stringify(state))).prompt, prompt);
});

test('canonical IDs render once and optional details follow effective selections', () => {
  const state = {
    ...fresh(), styleId: 'preset_02_02',
    dna: { botanical_species: ['botanical_species.ferns'], materials: ['materials.pale_stone'] }
  };
  const { prompt } = assemble(state);
  assert.equal((prompt.match(/\bferns\b/gi) ?? []).length, 1);
  assert.equal((prompt.match(/pale natural stone with visible fine texture/gi) ?? []).length, 1);
  assert.doesNotMatch(prompt, /wildlife|waterfall spray/i);
  assert.ok(assemble({ ...state, dna: { materials: ['materials.pale_stone', 'materials.pale_stone'] } }).errors.length);
  const waterfall = { ...fresh(), styleId: 'preset_03_02', dna: { water: ['water.none'] } };
  const overridden = assemble(waterfall);
  assert.ok(overridden.warnings.length);
  assert.doesNotMatch(overridden.prompt, /\bwaterfall\b|local water spray/i);
});

test('conflicting timing, sky, light, atmosphere and season produce compatible output', () => {
  const dawn = assemble({
    ...fresh('exterior_window'), styleId: 'preset_07_04', dna: {}, overrides: { timeOfDay: 'morning' }
  });
  assert.ok(dawn.warnings.length >= 2);
  assert.doesNotMatch(dawn.prompt, /pastel sunset|peach-pink sunset gradient/i);
  const cloudy = assemble({
    ...fresh(), styleId: 'preset_08_01', dna: {},
    overrides: { weather: 'heavy fog' }
  });
  assert.ok(cloudy.warnings.length >= 2);
  assert.doesNotMatch(cloudy.prompt, /naturally luminous high-key daylight|pale powder-blue natural sky/i);
  const tropics = assemble({
    ...fresh('landscape_architecture'), styleId: 'preset_05_01',
    dna: { season: ['season.snowy_winter'], sky: ['sky.alpine_cloud_bank'], atmosphere: ['atmosphere.clear_alpine_air'] }
  });
  assert.ok(tropics.warnings.length >= 3);
  assert.doesNotMatch(tropics.prompt, /cloud bank near mountain peaks|dormant seasonal vegetation|clear alpine air/i);
  assert.match(tropics.prompt, /contemporary enclosed tropical courtyard/i);
  assert.equal(assemble({
    ...fresh(), styleId: 'preset_05_01', dna: {}, overrides: { season: 'snowy winter' }
  }).prompt, '');
});

test('clear sky takes precedence over overcast lighting', () => {
  const state = { ...fresh(), styleId: 'preset_01_01', dna: { sky: ['sky.clear_pale_sky'] } };
  const result = assemble(state);
  assert.match(result.warnings.join(' '), /mendung/);
  assert.match(result.prompt, /mostly clear pale natural sky/);
  assert.doesNotMatch(result.prompt, /soft diffused overcast daylight/i);
});

test('all palettes render concrete color behavior rather than catalog names', () => {
  for (const [id, palette] of palettes) {
    const state = { ...fresh(), styleId: 'preset_04_01', dna: { palette: [id] } };
    const output = assemble(state).blocks.find(block => block.startsWith('COLOR & LIGHTING:'));
    assert.ok(output.includes('Build the palette around '), id);
    assert.ok(!output.includes(palette.name), id);
  }
  const example = assemble({ ...fresh(), styleId: 'preset_04_01', dna: {} });
  assert.match(example.prompt, /deep olive-green shadows, muted sage and moss midtones, and pale gray-green highlights/);
  const accent = assemble({ ...fresh(), styleId: 'preset_01_03', dna: {} });
  assert.match(accent.prompt, /Use small accents of umber/);
  const manual = assemble({ ...fresh(), styleId: 'preset_04_01', dna: {}, overrides: { palette: 'cobalt and gold' } });
  assert.match(manual.prompt, /Use this color palette: cobalt and gold/);
  assert.doesNotMatch(manual.prompt, /deep olive-green shadows/);
});

test('geography relates compatible landforms, seasons, sky and water', () => {
  const state = { ...fresh('urban_cozy'), styleId: 'preset_07_03', dna: {
    environment: ['environment.coastal_town'], water: ['water.cascading_waterfall']
  }};
  const coastal = assemble(state);
  assert.deepEqual(coastal.warnings, []);
  assert.match(coastal.prompt, /freshwater feature distinct from the sea/);
  assert.match(coastal.prompt, /cascade upstream of the still water/);
  assert.match(coastal.prompt, /Keep pedestrian access clear/);
  assert.match(coastal.prompt, /visible background: lakeside scenery/);
  const alpine = assemble({ ...state, dna: {
    environment: ['environment.coastal_town'],
    landscape: ['landscape.alpine_mountains'],
    season: ['season.spring_bloom'],
    sky: ['sky.alpine_cloud_bank']
  }});
  assert.deepEqual(alpine.warnings, []);
  assert.match(alpine.prompt, /Keep the sea at the lowest elevation/);
  assert.match(alpine.prompt, /spring blooms on sheltered lower slopes/);
  assert.match(alpine.prompt, /cloud bank near mountain peaks/);
});
