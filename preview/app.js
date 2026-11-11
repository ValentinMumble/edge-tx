// The preview page: picks a built widget, runs it on the radio screen 20 times a second, and gives its options and
// inputs controls. A rebuilt widget (tstl --watch) is picked up on its own, keeping the controls as they were.
import {PRELUDE, Radio, SCREEN} from './edgetx.js';

const {load} = window.fengari;
const page = {
  canvas: document.getElementById('screen'),
  status: document.getElementById('status'),
  error: document.getElementById('error'),
  widget: document.getElementById('widget'),
  zone: document.getElementById('zone'),
  size: document.getElementById('size'),
  width: document.getElementById('width'),
  height: document.getElementById('height'),
  play: document.getElementById('play'),
  options: document.getElementById('options'),
  sources: document.getElementById('sources'),
  modelName: document.getElementById('model-name'),
  modelBitmap: document.getElementById('model-bitmap'),
  sounds: document.getElementById('sounds'),
};

const OPTION_TYPES = {0: 'value', 1: 'source', 2: 'bool', 3: 'string', 5: 'color'};
const TOP_BAR = 45;
const MAIN_VIEW = {x: 32, y: TOP_BAR};

const params = new URLSearchParams(location.search);
const state = {
  sources: {},
  options: [],
  values: {},
  model: {name: 'M2 EVO', bitmap: 'M2_EVO_o.png'},
};
const radio = new Radio(page.canvas, state);
window.edgetx = radio;
load(PRELUDE, '=edgetx')();
const lua = {
  load: load('return __preview_load')(),
  create: load('return __preview_create')(),
  update: load('return __preview_update')(),
  refresh: load('return __preview_refresh')(),
};

let current = {name: '', changed: 0};
let running = false;
let failed = '';

const showError = problem => {
  failed = problem ? String(problem.message ?? problem) : '';
  page.error.textContent = failed;
};

/** The options as the Lua side reads them: a line a name, a tab, a value. A source option reads as its own name. */
function optionLines() {
  return state.options
    .map(option => `${option.name}\t${option.type === 'source' ? option.name : state.values[option.name]}`)
    .join('\n');
}

function zoneSize() {
  if (page.zone.value === 'custom') return {w: Number(page.width.value) || 100, h: Number(page.height.value) || 60};
  const [width, height] = page.zone.value.split('x').map(Number);
  return {w: width, h: height};
}

function placeZone() {
  const {w, h} = zoneSize();
  const full = w >= SCREEN.width || h >= SCREEN.height - TOP_BAR;
  radio.zone = full ? {x: 0, y: 0, w, h} : {x: MAIN_VIEW.x, y: MAIN_VIEW.y, w, h};
}

async function loadImage(name) {
  if (!name || radio.images.has(name)) return;
  const image = new Image();
  image.src = `../sd-card/IMAGES/${encodeURIComponent(name)}`;
  try {
    await image.decode();
    radio.images.set(name, image);
  } catch {
    // A picture the browser cannot read (a .bmp in an odd format): the widget gets nil, as on the radio.
  }
}

function sourceControl(container, name, label) {
  const row = document.createElement('div');
  row.className = 'row-block';
  const title = document.createElement('div');
  title.textContent = label;
  const positions = document.createElement('div');
  positions.className = 'switch';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-1024';
  slider.max = '1024';
  slider.value = String(state.sources[name] ?? 0);
  const buttons = [
    ['Up −1024', -1024],
    ['Middle 0', 0],
    ['Down 1024', 1024],
  ].map(([text, value]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', () => set(value));
    positions.append(button);
    return {button, value};
  });
  const set = value => {
    state.sources[name] = value;
    slider.value = String(value);
    for (const {button, value: at} of buttons) button.setAttribute('aria-pressed', String(at === value));
  };
  slider.addEventListener('input', () => set(Number(slider.value)));
  set(state.sources[name] ?? 0);
  row.append(title, positions, slider);
  container.append(row);
}

function optionControls() {
  page.options.querySelectorAll(':scope > :not(legend)').forEach(node => node.remove());
  if (!state.options.length) {
    const none = document.createElement('div');
    none.className = 'muted';
    none.textContent = 'This widget has no options.';
    page.options.append(none);
  }
  for (const option of state.options) {
    if (option.type === 'source') {
      sourceControl(page.options, option.name, `${option.name} (a source: the radio passes its value)`);
      continue;
    }
    const label = document.createElement('label');
    label.className = 'row';
    label.append(option.name);
    const input = document.createElement('input');
    if (option.type === 'bool') {
      input.type = 'checkbox';
      input.checked = Number(state.values[option.name]) === 1;
      input.addEventListener('change', () => change(option.name, input.checked ? 1 : 0));
    } else if (option.type === 'color') {
      input.type = 'color';
      input.addEventListener('input', () => change(option.name, radio.RGB(parseInt(input.value.slice(1), 16))));
    } else {
      input.type = option.type === 'value' ? 'number' : 'text';
      input.value = String(state.values[option.name] ?? '');
      input.addEventListener('change', () =>
        change(option.name, option.type === 'value' ? Number(input.value) : input.value),
      );
    }
    label.append(input);
    page.options.append(label);
  }
}

function change(name, value) {
  state.values[name] = value;
  try {
    lua.update(optionLines());
  } catch (problem) {
    showError(problem);
  }
}

/** Inputs the widget reads that are not its options (a sensor by name, a stick), each with a slider. */
function sourceInputs() {
  const known = new Set(state.options.map(option => option.name));
  const shown = new Set([...page.sources.querySelectorAll('[data-source]')].map(node => node.dataset.source));
  for (const name of radio.asked) {
    if (known.has(name) || shown.has(name)) continue;
    const holder = document.createElement('div');
    holder.dataset.source = name;
    sourceControl(holder, name, name);
    page.sources.append(holder);
    page.sources.hidden = false;
  }
}

async function start(name, keep = false) {
  running = false;
  showError('');
  const code = await (await fetch(`../output/${name}?${Date.now()}`)).text();
  try {
    const [title, ...lines] = lua.load(code).split('\n');
    const options = lines.map(line => {
      const [optionName, type, initial] = line.split('\t');
      return {name: optionName, type: OPTION_TYPES[type] ?? 'value', initial};
    });
    if (!keep) {
      state.values = {};
      radio.asked.clear();
      page.sources.querySelectorAll('[data-source]').forEach(node => node.remove());
      page.sources.hidden = true;
    }
    for (const option of options) {
      if (!(option.name in state.values)) state.values[option.name] = Number(option.initial) || 0;
    }
    state.options = options;
    optionControls();
    await loadImage(state.model.bitmap);
    placeZone();
    lua.create(radio.zone.w, radio.zone.h, optionLines());
    page.status.textContent = `${title} · ${name} · zone ${radio.zone.w} × ${radio.zone.h}`;
    running = true;
  } catch (problem) {
    showError(problem);
  }
}

function frame() {
  const {context} = radio;
  context.fillStyle = '#303030';
  context.fillRect(0, 0, SCREEN.width, SCREEN.height);
  context.fillStyle = '#202020';
  context.fillRect(0, 0, SCREEN.width, TOP_BAR);
  context.fillStyle = '#a0a0a0';
  context.font = '500 14px Roboto, Arial, sans-serif';
  context.textBaseline = 'middle';
  context.fillText(state.model.name, 54, TOP_BAR / 2);
  if (!running || failed) return;
  radio.clear();
  try {
    lua.refresh();
  } catch (problem) {
    showError(problem);
  }
  const {x, y, w, h} = radio.zone;
  context.save();
  context.setLineDash([3, 3]);
  context.strokeStyle = 'rgba(124, 255, 178, 0.45)';
  context.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  context.restore();
  sourceInputs();
  page.sounds.textContent = radio.sounds.length ? radio.sounds.join('\n') : 'None yet';
}

async function poll() {
  try {
    const widgets = await (await fetch('/api/widgets')).json();
    if (page.widget.options.length !== widgets.length) {
      page.widget.replaceChildren(...widgets.map(widget => new Option(widget.name.replace(/\.lua$/, ''), widget.name)));
      page.widget.value = current.name || params.get('widget') || 'armed-model.lua';
    }
    const shown = widgets.find(widget => widget.name === page.widget.value) ?? widgets[0];
    if (shown && (shown.name !== current.name || shown.changed !== current.changed)) {
      const rebuilt = shown.name === current.name;
      current = shown;
      await start(shown.name, rebuilt);
    }
  } catch (problem) {
    page.status.textContent = `Cannot reach the preview server: ${problem.message}`;
  }
}

async function images() {
  const names = await (await fetch('/api/images')).json();
  page.modelBitmap.replaceChildren(new Option('None', ''), ...names.map(name => new Option(name, name)));
  page.modelBitmap.value = state.model.bitmap;
}

page.widget.addEventListener('change', () => {
  current = {name: '', changed: 0};
  void poll();
});
page.zone.addEventListener('change', () => {
  page.size.hidden = page.zone.value !== 'custom';
  void start(current.name, true);
});
for (const input of [page.width, page.height]) input.addEventListener('change', () => void start(current.name, true));
page.play.addEventListener('click', () => {
  const pausing = radio.paused === null;
  radio.pause(pausing);
  page.play.textContent = pausing ? 'Play' : 'Pause';
});
page.modelName.addEventListener('input', () => (state.model.name = page.modelName.value));
page.modelBitmap.addEventListener('change', async () => {
  state.model.bitmap = page.modelBitmap.value;
  await loadImage(state.model.bitmap);
});

// For screenshots and tests: window.preview.set('ArmedSwitch', -1024), window.preview.pause(true).
window.preview = {
  set: (name, value) => (state.sources[name] = value),
  pause: paused => radio.pause(paused),
  at: ticks => {
    radio.paused = performance.now();
    radio.started = radio.paused - ticks * 10;
  },
  ready: () => running && !failed,
  error: () => failed,
};

await images();
await poll();
setInterval(frame, 50);
setInterval(poll, 1000);
