import { assemble, fresh, masters, presets } from './engine.mjs';
import { families, styles, controls, options, multiChoices, catalogDefaults, resolveCatalog, validCatalog, swatches } from './catalog.mjs';
import { detailLevels } from './prompt-detail.mjs';

const $ = id => document.getElementById(id);
const settings = $('settings');
const detailDescriptions = {
  compact: 'Paling ringkas, dengan aturan wajib dan inti fotografi.',
  standard: 'Versi ringkas eksperimental. Gunakan Full Master untuk teks kanonik.',
  full: 'Menampilkan teks modul asli untuk audit.'
};
const fields = [
  ['scene', 'subject', 'Jenis subjek'],
  ['scene', 'style', 'Gaya arsitektur'],
  ['scene', 'environment', 'Lingkungan'],
  ['scene', 'materials', 'Material'],
  ['scene', 'landscape', 'Detail lanskap atau jalan', 'text', true],
  ['scene', 'details', 'Furnitur dan detail interior', 'textarea', true],
  ['atmosphere', 'timeOfDay', 'Waktu'],
  ['atmosphere', 'weather', 'Cuaca'],
  ['atmosphere', 'lightingCharacter', 'Karakter cahaya'],
  ['atmosphere', 'season', 'Musim'],
  ['atmosphere', 'palette', 'Palet warna', 'text', true],
  ['atmosphere', 'mood', 'Suasana', 'text', true],
  ['advanced', 'foreground', 'Area depan'],
  ['advanced', 'people', 'Orang dalam adegan'],
  ['advanced', 'additional', 'Detail tambahan', 'textarea', true],
];
const fieldNames = Object.fromEntries(fields.map(([, key, label]) => [key, label]));
const icons = {
  window: '<rect x="4" y="3" width="16" height="16" rx="1"/><path d="M12 3v16M2 21h20M4 14l4-4 4 4 4-3 4 3"/>',
  glass: '<path d="M3 21h18M4 21V5h16v16M9 5v16m6-16v16M6 10l2-2m8 8 2-2"/>',
  store: '<path d="M4 10v11h16V10M3 10l2-6h14l2 6H3m6 11v-7h6v7M9 4l-1 6m7-6 1 6"/>',
  land: '<path d="m2 12 5-6 4 5 4-7 7 8M2 21h20M7 21v-6l5-3 5 3v6m-7 0v-4h4v4"/>'
};
const storageKey = 'othernoon.prompt-studio.library.v1';
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const compareIds = new Set();
let state = fresh();
let result;
let catalogFamily = "";
let warningPrompt = "";
let timer;
let library = readLibrary();

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(label, onClick) {
  const node = el('button', label, 'button neutral');
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function toast(message) {
  $('toast').textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => { $('toast').textContent = ''; }, 3500);
}

function init() {
  for (const master of masters) {
    const label = el('label', '', 'master');
    const choice = el('input');
    choice.type = 'radio';
    choice.name = 'master';
    choice.value = master.id;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = icons[master.icon];
    label.append(choice, icon, el('strong', master.name), el('small', master.description));
    $('masters').append(label);
  }
  for (const preset of presets) $('preset').add(new Option(preset.name, preset.id));
  for (const [group, key, label, type, full] of fields) {
    const wrapper = el('label', label, 'field' + (full ? ' full' : ''));
    const control = el(type === 'textarea' ? 'textarea' : 'input');
    control.name = key;
    control.maxLength = type === 'textarea' ? 1500 : 320;
    wrapper.append(control);
    $(group + '-fields').append(wrapper);
  }
  for (const [value, label] of Object.entries(detailLevels)) $('detail-level').add(new Option(label, value));
  initCatalog();
  updateForm();
  renderLibrary();
}

function initCatalog() {
  const family = $('catalog-family');
  family.add(new Option('Tanpa katalog', ''));
  for (const row of families) family.add(new Option(row.name, row.id));
  family.addEventListener('change', () => {
    catalogFamily = family.value;
    setStyle('');
  });
  $('catalog-style').addEventListener('change', event => setStyle(event.target.value));
  $('catalog-reset').addEventListener('click', () => {
    state.dna = {};
    updateForm();
  });
  const groups = [
    ['Warna & cahaya', ['palette', 'lighting', 'atmosphere', 'emotion']],
    ['Lanskap & cuaca', ['landscape', 'environment', 'openness', 'season', 'sky', 'water', 'additional_mist']],
    ['Material & taman', ['materials', 'hardscape', 'botanical_species', 'planting_density', 'ground_cover']],
    ['Satwa', ['wildlife', 'wildlife_placement']]
  ];
  for (const [title, keys] of groups) {
    const group = el('fieldset', '', 'dna-group');
    group.append(el('legend', title));
    const fields = el('div', '', 'fields');
    for (const key of keys) fields.append(createDnaControl(key, controls[key]));
    group.append(fields);
    $('catalog-options').append(group);
  }
}

function createDnaControl(key, label) {
  const wrapper = el('label', label, 'field');
  const select = el('select');
  select.id = 'dna-' + key;
  select.multiple = multiChoices.has(key);
  if (select.multiple) {
    select.size = 3;
    wrapper.append(el('small', 'Gunakan Ctrl atau ⌘ untuk beberapa pilihan.'));
  } else {
    select.add(new Option('Tanpa pilihan', ''));
  }
  for (const row of options[key]) select.add(new Option(row.label, row.id));
  select.addEventListener('change', () => {
    if (!state.styleId) return;
    const ids = [...select.selectedOptions].map(option => option.value).filter(Boolean);
    const original = catalogDefaults(state.styleId)[key] ?? [];
    if (ids.length === original.length && ids.every(id => original.includes(id))) delete state.dna[key];
    else state.dna[key] = ids;
    updateSwatches();
    render();
  });
  wrapper.append(select);
  return wrapper;
}

function setStyle(styleId) {
  if (styleId) {
    if (!state.styleId) state.detailLevel = 'full';
    state.styleId = styleId;
    state.dna = {};
  } else {
    delete state.styleId;
    delete state.dna;
  }
  updateForm();
}

function updateSwatches() {
  $('catalog-swatches').replaceChildren();
  if (!state.styleId) return;
  const selected = resolveCatalog(state).selected.palette ?? [];
  for (const id of selected) {
    for (const color of swatches(id)) {
      const sample = el('span');
      sample.style.backgroundColor = color.hex;
      sample.title = color.hex;
      $('catalog-swatches').append(sample);
    }
  }
}

function updateCatalog() {
  if (state.styleId) catalogFamily = styles.get(state.styleId).family_id;
  $('catalog-family').value = catalogFamily;
  const style = $('catalog-style');
  style.replaceChildren(new Option('Pilih preset', ''));
  for (const row of styles.values()) {
    if (row.family_id === catalogFamily) style.add(new Option(row.name, row.id));
  }
  style.disabled = !catalogFamily;
  style.value = state.styleId ?? '';
  $('catalog-dna').hidden = !state.styleId;
  $('preset').closest('label').hidden = Boolean(state.styleId);
  $('preset-hint').hidden = Boolean(state.styleId);
  if (!state.styleId) return;
  const { selected } = resolveCatalog(state);
  for (const key of Object.keys(controls)) {
    for (const choice of $('dna-' + key).options) {
      choice.selected = choice.value ? selected[key]?.includes(choice.value) ?? false : !selected[key]?.length;
    }
  }
  updateSwatches();
}

function updateForm() {
  settings.elements.master.value = state.master;
  $('preset').value = state.presetId;
  updateCatalog();
  settings.elements.rear.checked = state.rearTransparency;
  $('rear-field').hidden = state.master !== 'exterior_window';
  settings.elements.details.closest('label').hidden = state.master === 'landscape_architecture';
  for (const [, key] of fields) settings.elements[key].value = state.overrides[key] || '';
  render();
}

function render(openPhoto) {
  result = assemble(state);
  const { prompt, blocks, errors, warnings, values, master, photo, photoText, detailLevel } = result;
  $('detail-level').value = detailLevel;
  $('detail-description').textContent = detailDescriptions[detailLevel];
  for (const [, key] of fields) {
    settings.elements[key].placeholder = values[key] || (key === 'additional' ? 'Misalnya, subtle spring blossoms framing the upper edge' : 'Opsional');
  }
  const styleName = styles.get(state.styleId)?.name;
  $('preview-meta').textContent = [master.name + ' v' + master.version, styleName, 'Fotografi v' + photo.version].filter(Boolean).join(' · ');
  $('word-count').textContent = prompt ? new Intl.NumberFormat('id-ID').format(prompt.split(/\s+/).length) + ' kata' : '0 kata';
  const issues = [...errors, ...warnings];
  $('issues').hidden = !issues.length;
  $('issues').replaceChildren(...issues.map(message => el('p', message)));
  const photoOpen = openPhoto ?? $('prompt').querySelector('details')?.open ?? (detailLevel === 'full');
  $('prompt').replaceChildren();
  if (errors.length) {
    $('prompt').append(el('p', 'Sesuaikan detail di atas untuk merangkai prompt.'));
  } else {
    for (const block of blocks) {
      const [heading, ...lines] = block.split('\n');
      if (block === photoText) {
        const details = el('details');
        details.open = Boolean(photoOpen);
        const summary = el('summary', heading);
        details.append(summary, el('p', lines.join('\n').trim()));
        $('prompt').append(details);
      } else {
        const section = el('section');
        const [title, body] = lines.length ? [heading, lines.join('\n')] : [heading.split(': ')[0] + ':', heading.split(': ').slice(1).join(': ')];
        const h3 = el('h3', title);
        section.append(h3, el('p', body));
        $('prompt').append(section);
      }
    }
  }
  const requiresConfirmation = Boolean(prompt && state.styleId && warnings.length);
  if (!requiresConfirmation || warningPrompt !== prompt) $('accept-warnings').checked = false;
  warningPrompt = requiresConfirmation ? prompt : '';
  $('warning-confirm').hidden = !requiresConfirmation;
  updateOutputActions();
}

function updateOutputActions() {
  const allowed = result.prompt && ($('warning-confirm').hidden || $('accept-warnings').checked);
  for (const action of [$('copy'), $('save-open'), ...document.querySelectorAll('[data-export]')]) action.disabled = !allowed;
}

$('accept-warnings').addEventListener('change', updateOutputActions);

settings.addEventListener('input', event => {
  const { name, value, checked } = event.target;
  if (!name) return;
  if (name === 'master') {
    state.master = value;
    updateForm();
  } else if (name === 'preset') {
    const previous = result.values;
    state.presetId = value;
    render();
    const changed = ['timeOfDay', 'weather', 'lightingCharacter', 'palette', 'mood'].filter(key => previous[key] !== result.values[key]);
    $('preset-hint').textContent = changed.length ? 'Diperbarui — ' + changed.map(key => fieldNames[key]).join(', ') + '.' : 'Isian Anda tetap dipakai.';
  } else {
    if (name === 'rear') state.rearTransparency = checked;
    else if (name in fieldNames) state.overrides[name] = value;
    render();
  }
});

$('detail-level').addEventListener('change', event => {
  state.detailLevel = event.target.value;
  render(state.detailLevel === 'full');
});

settings.addEventListener('submit', event => {
  event.preventDefault();
  render();
  $('prompt').scrollTop = 0;
  if (matchMedia('(max-width:850px)').matches) document.querySelector('.preview').scrollIntoView({ block: 'start' });
  if (!$('copy').disabled) toast('Prompt siap disalin.');
});

$('reset').addEventListener('click', () => {
  state = { ...fresh(state.master), detailLevel: state.detailLevel };
  catalogFamily = '';
  $('preset-hint').textContent = '';
  updateForm();
  toast('Pengaturan master dipulihkan.');
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(result.prompt);
    toast('Prompt disalin.');
  } catch {
    const text = el('textarea', result.prompt);
    text.style.cssText = 'position:fixed;opacity:0';
    document.body.append(text);
    text.select();
    const copied = document.execCommand('copy');
    text.remove();
    $('copy').focus();
    toast(copied ? 'Prompt disalin.' : 'Akses clipboard dibatasi. Gunakan Ekspor untuk mengunduh prompt.');
  }
});

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = el('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

for (const action of document.querySelectorAll('[data-export]')) {
  action.addEventListener('click', () => {
    const extension = action.dataset.export;
    const content = extension === 'md'
      ? result.blocks.map(block => {
        const newLine = block.indexOf('\n');
        if (newLine >= 0) return '## ' + block.slice(0, newLine).replace(/:$/, '') + '\n\n' + block.slice(newLine + 1).trim();
        return '## OUTPUT\n\n' + block.replace(/^OUTPUT: /, '');
      }).join('\n\n')
      : result.prompt;
    download(result.master.id + '.' + extension, content, extension === 'md' ? 'text/markdown' : 'text/plain');
    $('export-menu').open = false;
  });
}

function validSnapshot(item) {
  if (!item || typeof item !== 'object') return false;
  const saved = item.state;
  return typeof item.id === 'string' && item.id && typeof item.title === 'string' && item.title.trim() &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
    ['masterVersion', 'photographicVersion', 'prompt', 'status', 'tags', 'notes'].every(key => typeof item[key] === 'string') &&
    item.prompt.trim() && saved && masters.some(master => master.id === saved.master) &&
    presets.some(preset => preset.id === saved.presetId) && typeof saved.rearTransparency === 'boolean' &&
    validCatalog(saved) &&
    (saved.detailLevel === undefined || Object.hasOwn(detailLevels, saved.detailLevel)) &&
    saved.overrides && typeof saved.overrides === 'object' && !Array.isArray(saved.overrides) &&
    Object.entries(saved.overrides).every(([key, value]) => Object.hasOwn(fieldNames, key) && typeof value === 'string');
}

function readLibrary() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(data) ? data.filter(validSnapshot) : [];
  } catch {
    return [];
  }
}

function writeLibrary(next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    library = next;
    renderLibrary();
    return true;
  } catch {
    toast('Penyimpanan browser tidak tersedia atau penuh.');
    return false;
  }
}

$('library-open').addEventListener('click', () => { renderLibrary(); $('library-dialog').showModal(); });
$('library-search').addEventListener('input', renderLibrary);
$('save-open').addEventListener('click', () => {
  $('save-form').reset();
  $('save-form').elements.title.value = result.master.name + ' · ' + (styles.get(state.styleId)?.name ?? $('preset').selectedOptions[0].textContent);
  $('save-dialog').showModal();
});
for (const close of document.querySelectorAll('[data-close]')) close.onclick = () => $(close.dataset.close).close();

$('save-form').addEventListener('submit', event => {
  event.preventDefault();
  const details = Object.fromEntries(new FormData(event.target));
  if (!details.title.trim()) return toast('Isi nama preset.');
  const item = {
    ...details, title: details.title.trim(), id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    state: structuredClone(state), masterVersion: result.master.version, photographicVersion: result.photo.version, prompt: result.prompt
  };
  if (writeLibrary([item, ...library])) {
    $('save-dialog').close();
    toast('Preset disimpan di browser ini.');
  }
});

function renderLibrary() {
  $('library-count').textContent = library.length || '';
  const query = $('library-search').value.trim().toLowerCase();
  const visible = library.filter(item => [item.title, item.tags, item.notes].some(text => text.toLowerCase().includes(query)));
  $('library-list').replaceChildren();
  if (!visible.length) $('library-list').append(el('p', query ? 'Tidak ada preset yang cocok.' : 'Belum ada preset tersimpan.', 'hint'));
  for (const item of visible) {
    const master = masters.find(master => master.id === item.state.master);
    const row = el('article', '', 'library-item');
    const summary = el('div');
    summary.append(el('h3', item.title), el('p', master.name + ' v' + item.masterVersion + ' · Fotografi v' + item.photographicVersion + ' · ' + detailLevels[item.state.detailLevel ?? 'full'] + ' · ' + dateFormat.format(new Date(item.createdAt))));
    const status = { draft: 'Draft', tested: 'Test', approved: 'Approved', rejected: 'Rejected' }[item.status] || item.status;
    summary.append(el('p', [status, item.tags, item.notes].filter(Boolean).join(' · ')));
    const actions = el('div', '', 'library-actions');
    const selectLabel = el('label', 'Bandingkan ');
    const selection = el('input');
    selection.type = 'checkbox';
    selection.checked = compareIds.has(item.id);
    selection.disabled = compareIds.size >= 2 && !selection.checked;
    selection.addEventListener('change', () => {
      if (selection.checked) compareIds.add(item.id);
      else compareIds.delete(item.id);
      renderLibrary();
      [...$('library-list').querySelectorAll('input')].find(input => input.dataset.id === item.id)?.focus();
    });
    selection.dataset.id = item.id;
    selectLabel.append(selection);
    const load = button('Muat', () => {
      state = { ...structuredClone(item.state), detailLevel: item.state.detailLevel ?? 'full' };
      catalogFamily = '';
      $('preset-hint').textContent = '';
      updateForm();
      $('prompt').scrollTop = 0;
      $('library-dialog').close();
      toast('Preset dimuat.');
    });
    const duplicate = button('Duplikat', () => {
      const copy = { ...item, title: (item.title.slice(0, 88) + ' (salinan)'), id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'draft' };
      if (writeLibrary([copy, ...library])) toast('Variasi disalin ke pustaka.');
    });
    actions.append(load, duplicate, selectLabel);
    row.append(summary, actions);
    $('library-list').append(row);
  }
  renderCompare();
}

function renderCompare() {
  const selected = [...compareIds].map(id => library.find(item => item.id === id)).filter(Boolean);
  $('compare').hidden = !selected.length;
  const [a, b] = selected;
  $('compare-fields').replaceChildren();
  $('compare-prompts').replaceChildren();
  $('compare-hint').textContent = b ? 'A · ' + a.title + '   /   B · ' + b.title : 'Pilih satu preset lagi.';
  if (!b) return;
  const av = assemble(a.state).values;
  const bv = assemble(b.state).values;
  const changes = [
    ['Master', av.name + ' v' + a.masterVersion, bv.name + ' v' + b.masterVersion],
    ['Modul fotografi', a.photographicVersion, b.photographicVersion],
    ['Preset visual', styles.get(a.state.styleId)?.name ?? a.state.presetId, styles.get(b.state.styleId)?.name ?? b.state.presetId],
    ...Object.entries(controls).map(([key, label]) => {
      const selected = item => item.state.styleId ? (resolveCatalog(item.state).selected[key] ?? []).map(id =>
        options[key].find(option => option.id === id).label).join(', ') : '';
      return [label, selected(a), selected(b)];
    }),
    ['Prompt Detail Level', detailLevels[a.state.detailLevel ?? 'full'], detailLevels[b.state.detailLevel ?? 'full']],
    ['Pandangan ke halaman belakang', String(a.state.rearTransparency), String(b.state.rearTransparency)],
    ...Object.entries(fieldNames).map(([key, label]) => [label, av[key] || '—', bv[key] || '—'])
  ].filter(([, before, after]) => before !== after);
  for (const [label, before, after] of changes) {
    $('compare-fields').append(el('dt', label), el('dd', 'A · ' + before + '\nB · ' + after));
  }
  if (!changes.length) $('compare-hint').append(' · Pengaturan adegan sama.');
  for (const [label, item] of [['A', a], ['B', b]]) {
    const column = el('div');
    const pre = el('pre', item.prompt);
    pre.tabIndex = 0;
    column.append(el('strong', label + ' · ' + item.title), pre);
    $('compare-prompts').append(column);
  }
}

$('backup').addEventListener('click', () => download('othernoon-presets.json', JSON.stringify({ version: 1, snapshots: library }, null, 2), 'application/json'));
$('import').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('File terlalu besar');
    const data = JSON.parse(await file.text());
    if (data?.version !== 1 || !Array.isArray(data.snapshots) || !data.snapshots.every(validSnapshot)) throw new Error('Skema tidak valid');
    const seen = new Set(library.map(item => item.id));
    const additions = [];
    for (const item of data.snapshots) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      additions.push(item);
    }
    if (writeLibrary([...additions, ...library])) toast(additions.length + ' preset ditambahkan.');
  } catch {
    toast('File cadangan tidak valid atau terlalu besar.');
  } finally {
    event.target.value = '';
  }
});

init();
