// A TX16S screen in the browser: the EdgeTX Lua calls a widget makes (lcd, Bitmap, getValue, getTime...), drawn on a
// canvas the size of the radio's screen. The widget's Lua runs as it is, in Fengari (Lua 5.3 in JavaScript).
//
// It follows the radio where it matters for drawing: coordinates are cut to whole pixels, angles start at 12 o'clock
// and go clockwise, and an arc whose start and end land on the same angle (0 to 360) draws nothing, as on the radio.
// Fonts are close, not exact.

export const SCREEN = {width: 480, height: 272};

/** FM2M Concrete, the radio's theme, and EdgeTX's named colours. */
const THEME = {
  COLOR_THEME_PRIMARY1: 0xa0a0a0,
  COLOR_THEME_PRIMARY2: 0x202020,
  COLOR_THEME_PRIMARY3: 0x505050,
  COLOR_THEME_SECONDARY1: 0x808080,
  COLOR_THEME_SECONDARY2: 0x505050,
  COLOR_THEME_SECONDARY3: 0x303030,
  COLOR_THEME_FOCUS: 0xc0c0c0,
  COLOR_THEME_EDIT: 0xeeeeee,
  COLOR_THEME_ACTIVE: 0x3b75a9,
  COLOR_THEME_WARNING: 0x794044,
  COLOR_THEME_DISABLED: 0x808080,
  WHITE: 0xffffff,
  BLACK: 0x000000,
  LIGHTWHITE: 0xeeeeee,
  LIGHTGREY: 0xc0c0c0,
  GREY: 0x969696,
  DARKGREY: 0x404040,
  RED: 0xe50000,
  DARKRED: 0x800000,
  ORANGE: 0xe58d00,
  YELLOW: 0xf0d000,
  GREEN: 0x19a000,
  DARKGREEN: 0x006400,
  BLUE: 0x0050e0,
  DARKBLUE: 0x00305a,
  CUSTOM_COLOR: 0xffffff,
};

/** Text flags, in the low 16 bits; a colour's slot sits above them. The values are the preview's own. */
const FLAG = {
  INVERS: 1,
  BLINK: 2,
  BOLD: 4,
  SHADOWED: 8,
  RIGHT: 16,
  CENTER: 32,
  VCENTER: 64,
  TINSIZE: 128,
  SMLSIZE: 256,
  MIDSIZE: 512,
  DBLSIZE: 1024,
  XXLSIZE: 2048,
  PREC1: 4096,
  PREC2: 8192,
};

const FONT_SIZES = [
  [FLAG.XXLSIZE, 64],
  [FLAG.DBLSIZE, 32],
  [FLAG.MIDSIZE, 22],
  [FLAG.SMLSIZE, 12],
  [FLAG.TINSIZE, 9],
];

const hex = rgb => `#${rgb.toString(16).padStart(6, '0')}`;

/**
 * The radio. `drawWidget` runs one widget refresh inside its zone; the inputs (switches, sources, the model) are read
 * from `state`, which the page's controls change.
 */
export class Radio {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.state = state;
    this.palette = [0];
    this.slots = new Map();
    this.names = {};
    for (const [name, rgb] of Object.entries(THEME)) this.names[name] = this.colorFlag(rgb, name);
    this.bitmaps = [];
    this.images = new Map();
    this.started = performance.now();
    this.paused = null;
    this.zone = {x: 0, y: 0, w: SCREEN.width, h: SCREEN.height};
    this.sounds = [];
    this.asked = new Set();
  }

  // Colours: a slot in the palette, kept in bits 16 and up of a flag, as on the radio.
  colorFlag(rgb, name) {
    const key = name ?? `rgb:${rgb}`;
    if (!this.slots.has(key)) {
      this.slots.set(key, this.palette.length);
      this.palette.push(rgb);
    }
    return this.slots.get(key) << 16;
  }

  color(flags, fallback = THEME.COLOR_THEME_PRIMARY1) {
    const slot = (flags >>> 16) & 0xfff;
    return hex(slot ? this.palette[slot] : fallback);
  }

  constants() {
    return {...FLAG, ...this.names, LCD_W: SCREEN.width, LCD_H: SCREEN.height};
  }

  RGB(red, green, blue) {
    const rgb = green === undefined ? red & 0xffffff : ((red & 255) << 16) | ((green & 255) << 8) | (blue & 255);
    return this.colorFlag(rgb);
  }

  setColor(slotFlag, colorFlag) {
    const slot = (slotFlag >>> 16) & 0xfff;
    const from = (colorFlag >>> 16) & 0xfff;
    if (slot) this.palette[slot] = this.palette[from] ?? 0;
  }

  // Time and inputs.
  getTime() {
    const now = this.paused ?? performance.now();
    return Math.floor((now - this.started) / 10);
  }

  pause(paused) {
    if (paused && this.paused === null) this.paused = performance.now();
    if (!paused && this.paused !== null) {
      this.started += performance.now() - this.paused;
      this.paused = null;
    }
  }

  getValue(source) {
    const key = String(source);
    this.asked.add(key);
    return this.state.sources[key] ?? 0;
  }

  modelName() {
    return this.state.model.name;
  }

  modelBitmap() {
    return this.state.model.bitmap;
  }

  play(kind, what) {
    this.sounds.unshift(`${kind} ${what}`);
    this.sounds.length = Math.min(this.sounds.length, 8);
  }

  // Bitmaps: preloaded by the page, so a widget can read a size right after opening one.
  bitmapOpen(path) {
    const image = this.images.get(String(path).replace(/^\/?IMAGES\//, ''));
    if (!image) return -1;
    const [width, height] = [image.naturalWidth, image.naturalHeight];
    this.bitmaps.push({image, width, height, inside: {x: 0, y: 0, width, height}});
    return this.bitmaps.length - 1;
  }

  bitmapWidth(id) {
    return this.bitmaps[id]?.width ?? 0;
  }

  bitmapHeight(id) {
    return this.bitmaps[id]?.height ?? 0;
  }

  /** As the radio's: a bitmap of the size asked, the picture scaled to fit inside it, keeping its shape, centred. */
  bitmapResize(id, width, height) {
    const bitmap = this.bitmaps[id];
    if (!bitmap) return -1;
    const [wide, tall] = [Math.trunc(width), Math.trunc(height)];
    const scale = Math.min(wide / bitmap.inside.width, tall / bitmap.inside.height);
    const [fitWidth, fitHeight] = [bitmap.inside.width * scale, bitmap.inside.height * scale];
    this.bitmaps.push({
      image: bitmap.image,
      width: wide,
      height: tall,
      inside: {
        x: Math.trunc((wide - fitWidth) / 2),
        y: Math.trunc((tall - fitHeight) / 2),
        width: fitWidth,
        height: fitHeight,
      },
    });
    return this.bitmaps.length - 1;
  }

  // Drawing, in the zone: the radio cuts every coordinate to a whole pixel.
  withZone(draw) {
    const {context, zone} = this;
    context.save();
    context.beginPath();
    context.rect(zone.x, zone.y, zone.w, zone.h);
    context.clip();
    context.translate(zone.x, zone.y);
    draw(context);
    context.restore();
  }

  clear(flags) {
    this.withZone(context => {
      context.fillStyle = this.color(flags ?? 0, THEME.COLOR_THEME_SECONDARY3);
      context.fillRect(0, 0, this.zone.w, this.zone.h);
    });
  }

  drawPoint(x, y, flags) {
    this.withZone(context => {
      context.fillStyle = this.color(flags ?? 0);
      context.fillRect(Math.trunc(x), Math.trunc(y), 1, 1);
    });
  }

  drawLine(x1, y1, x2, y2, pattern, flags) {
    let fromX = Math.trunc(x1);
    let fromY = Math.trunc(y1);
    const toX = Math.trunc(x2);
    const toY = Math.trunc(y2);
    const dotted = pattern !== undefined && pattern !== null && pattern !== 0;
    this.withZone(context => {
      context.fillStyle = this.color(flags ?? 0);
      // Bresenham, a pixel at a time, as the radio draws it.
      const stepX = Math.abs(toX - fromX);
      const stepY = -Math.abs(toY - fromY);
      const directionX = fromX < toX ? 1 : -1;
      const directionY = fromY < toY ? 1 : -1;
      let error = stepX + stepY;
      let count = 0;
      for (;;) {
        if (!dotted || count % 2 === 0) context.fillRect(fromX, fromY, 1, 1);
        count += 1;
        if (fromX === toX && fromY === toY) break;
        const doubled = 2 * error;
        if (doubled >= stepY) {
          error += stepY;
          fromX += directionX;
        }
        if (doubled <= stepX) {
          error += stepX;
          fromY += directionY;
        }
      }
    });
  }

  drawRectangle(x, y, width, height, flags, thickness = 1, opacity = 0) {
    const line = Math.max(1, Math.trunc(thickness ?? 1));
    this.withZone(context => {
      context.globalAlpha = 1 - (opacity & 15) / 16;
      context.fillStyle = this.color(flags ?? 0);
      const [left, top, wide, tall] = [x, y, width, height].map(Math.trunc);
      context.fillRect(left, top, wide, line);
      context.fillRect(left, top + tall - line, wide, line);
      context.fillRect(left, top, line, tall);
      context.fillRect(left + wide - line, top, line, tall);
    });
  }

  drawFilledRectangle(x, y, width, height, flags, opacity = 0) {
    this.withZone(context => {
      context.globalAlpha = 1 - ((opacity ?? 0) & 15) / 16;
      context.fillStyle = this.color(flags ?? 0);
      context.fillRect(Math.trunc(x), Math.trunc(y), Math.trunc(width), Math.trunc(height));
    });
  }

  invertRect(x, y, width, height) {
    this.withZone(context => {
      context.globalCompositeOperation = 'difference';
      context.fillStyle = '#ffffff';
      context.fillRect(Math.trunc(x), Math.trunc(y), Math.trunc(width), Math.trunc(height));
    });
  }

  drawCircle(x, y, radius, flags) {
    this.withZone(context => {
      context.strokeStyle = this.color(flags ?? 0);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(Math.trunc(x) + 0.5, Math.trunc(y) + 0.5, Math.trunc(radius), 0, Math.PI * 2);
      context.stroke();
    });
  }

  drawFilledCircle(x, y, radius, flags) {
    this.withZone(context => {
      context.fillStyle = this.color(flags ?? 0);
      context.beginPath();
      context.arc(Math.trunc(x) + 0.5, Math.trunc(y) + 0.5, Math.trunc(radius) + 0.5, 0, Math.PI * 2);
      context.fill();
    });
  }

  drawTriangle(x1, y1, x2, y2, x3, y3, flags) {
    this.withZone(context => {
      context.strokeStyle = this.color(flags ?? 0);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(Math.trunc(x1) + 0.5, Math.trunc(y1) + 0.5);
      context.lineTo(Math.trunc(x2) + 0.5, Math.trunc(y2) + 0.5);
      context.lineTo(Math.trunc(x3) + 0.5, Math.trunc(y3) + 0.5);
      context.closePath();
      context.stroke();
    });
  }

  drawFilledTriangle(x1, y1, x2, y2, x3, y3, flags) {
    this.withZone(context => {
      context.fillStyle = this.color(flags ?? 0);
      context.beginPath();
      context.moveTo(Math.trunc(x1), Math.trunc(y1));
      context.lineTo(Math.trunc(x2), Math.trunc(y2));
      context.lineTo(Math.trunc(x3), Math.trunc(y3));
      context.closePath();
      context.fill();
    });
  }

  /** The radio's arcs: angles from 12 o'clock, clockwise; the same start and end draws nothing. */
  annulusSector(x, y, inner, outer, start, end, flags) {
    let from = Math.trunc(start);
    let to = Math.trunc(end);
    if (to === from) to += 1;
    from -= 90;
    if (from < 0) from += 360;
    to -= 90;
    if (to < 0) to += 360;
    if (from === to || outer <= inner) return;
    const centerX = Math.trunc(x) + 0.5;
    const centerY = Math.trunc(y) + 0.5;
    const radians = degrees => (degrees * Math.PI) / 180;
    this.withZone(context => {
      context.fillStyle = this.color(flags ?? 0);
      context.beginPath();
      context.arc(centerX, centerY, outer, radians(from), radians(to));
      if (inner > 0) context.arc(centerX, centerY, inner, radians(to), radians(from), true);
      else context.lineTo(centerX, centerY);
      context.closePath();
      context.fill();
    });
  }

  drawArc(x, y, radius, start, end, flags) {
    const outer = Math.trunc(radius);
    if (outer > 0) this.annulusSector(x, y, outer - 1, outer, start, end, flags);
  }

  drawPie(x, y, radius, start, end, flags) {
    const outer = Math.trunc(radius);
    if (outer > 0) this.annulusSector(x, y, 0, outer, start, end, flags);
  }

  drawAnnulus(x, y, inner, outer, start, end, flags) {
    this.annulusSector(x, y, Math.trunc(inner), Math.trunc(outer), start, end, flags);
  }

  // Text.
  font(flags = 0) {
    const size = FONT_SIZES.find(([flag]) => (flags & 0xf80) === flag)?.[1] ?? 16;
    return {size, css: `${flags & FLAG.BOLD ? 700 : 500} ${size}px Roboto, "Helvetica Neue", Arial, sans-serif`};
  }

  sizeTextWidth(text, flags) {
    this.context.font = this.font(flags ?? 0).css;
    return Math.ceil(this.context.measureText(String(text)).width);
  }

  sizeTextHeight(flags) {
    return Math.round(this.font(flags ?? 0).size * 1.2);
  }

  drawText(x, y, text, flags = 0, inverseColor) {
    const value = String(text);
    const options = flags ?? 0;
    const {size, css} = this.font(options);
    this.withZone(context => {
      context.font = css;
      const width = context.measureText(value).width;
      let left = Math.trunc(x);
      if (options & FLAG.RIGHT) left -= width;
      else if (options & FLAG.CENTER) left -= width / 2;
      let top = Math.trunc(y);
      if (options & FLAG.VCENTER) top -= (size * 1.2) / 2;
      if (options & FLAG.INVERS) {
        context.fillStyle = this.color(inverseColor ?? 0, THEME.COLOR_THEME_FOCUS);
        context.fillRect(left - 2, top, width + 4, size * 1.2);
      }
      context.textBaseline = 'top';
      if (options & FLAG.SHADOWED) {
        context.fillStyle = '#000000';
        context.fillText(value, left + 1, top + size * 0.1 + 1);
      }
      context.fillStyle = this.color(options);
      context.fillText(value, left, top + size * 0.1);
    });
  }

  drawNumber(x, y, value, flags = 0) {
    const options = flags ?? 0;
    const digits = options & FLAG.PREC2 ? 2 : options & FLAG.PREC1 ? 1 : 0;
    this.drawText(x, y, (Number(value) / 10 ** digits).toFixed(digits), options);
  }

  drawTimer(x, y, seconds, flags = 0) {
    const total = Math.trunc(Math.abs(Number(seconds)));
    const text = `${seconds < 0 ? '-' : ''}${Math.floor(total / 60)
      .toString()
      .padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
    this.drawText(x, y, text, flags);
  }

  drawSource(x, y, source, flags = 0) {
    this.drawText(x, y, String(source), flags);
  }

  drawGauge(x, y, width, height, fill, maximum, flags) {
    this.drawRectangle(x, y, width, height, flags);
    const share = maximum ? Math.max(0, Math.min(1, fill / maximum)) : 0;
    this.drawFilledRectangle(x + 1, y + 1, (width - 2) * share, height - 2, flags);
  }

  drawBitmap(id, x, y, scale = 100) {
    const bitmap = this.bitmaps[id];
    if (!bitmap) return;
    const factor = (scale || 100) / 100;
    const {inside} = bitmap;
    this.withZone(context => {
      context.drawImage(
        bitmap.image,
        Math.trunc(x) + inside.x * factor,
        Math.trunc(y) + inside.y * factor,
        inside.width * factor,
        inside.height * factor,
      );
    });
  }
}

/**
 * The EdgeTX API in Lua, each call handed to the radio above (window.edgetx). The __preview functions take a first
 * argument they ignore: Fengari passes JavaScript's `this` there when the page calls them.
 */
export const PRELUDE = String.raw`
local host = js.global.edgetx
local function int(value) return math.tointeger(value) or value end
local function bits(value) return math.tointeger(value) or math.tointeger(math.floor(value or 0)) or 0 end

bit32 = {}
function bit32.bor(...) local result = 0 for _, value in ipairs({...}) do result = result | bits(value) end return result end
function bit32.band(...) local result = -1 for _, value in ipairs({...}) do result = result & bits(value) end return result end
function bit32.bxor(...) local result = 0 for _, value in ipairs({...}) do result = result ~ bits(value) end return result end
function bit32.bnot(value) return ~bits(value) end
function bit32.btest(...) return bit32.band(...) ~= 0 end
function bit32.lshift(value, count) return bits(value) << count end
function bit32.rshift(value, count) return (bits(value) & 0xffffffff) >> count end
function bit32.arshift(value, count) return bits(value) // (1 << count) end

for name, value in pairs({SOLID = 0, DOTTED = 1, FORCE = 0, ERASE = 0, VALUE = 0, SOURCE = 1, BOOL = 2, STRING = 3, TIMER = 4,
  COLOR = 5, SWITCH = 6, TEXT_SIZE = 7, ALIGNMENT = 8, SLIDER = 9, CHOICE = 10, EVT_VIRTUAL_ENTER = 1,
  EVT_VIRTUAL_EXIT = 2, EVT_VIRTUAL_NEXT = 3, EVT_VIRTUAL_PREV = 4, EVT_VIRTUAL_NEXT_PAGE = 5,
  EVT_VIRTUAL_PREV_PAGE = 6}) do _G[name] = value end
do
  local constants = host:constants()
  for _, name in ipairs({'INVERS', 'BLINK', 'BOLD', 'SHADOWED', 'RIGHT', 'CENTER', 'VCENTER', 'TINSIZE', 'SMLSIZE',
    'MIDSIZE', 'DBLSIZE', 'XXLSIZE', 'PREC1', 'PREC2', 'LCD_W', 'LCD_H', 'COLOR_THEME_PRIMARY1',
    'COLOR_THEME_PRIMARY2', 'COLOR_THEME_PRIMARY3', 'COLOR_THEME_SECONDARY1', 'COLOR_THEME_SECONDARY2',
    'COLOR_THEME_SECONDARY3', 'COLOR_THEME_FOCUS', 'COLOR_THEME_EDIT', 'COLOR_THEME_ACTIVE', 'COLOR_THEME_WARNING',
    'COLOR_THEME_DISABLED', 'WHITE', 'BLACK', 'LIGHTWHITE', 'LIGHTGREY', 'GREY', 'DARKGREY', 'RED', 'DARKRED',
    'ORANGE', 'YELLOW', 'GREEN', 'DARKGREEN', 'BLUE', 'DARKBLUE', 'CUSTOM_COLOR'}) do
    _G[name] = int(constants[name])
  end
  LEFT = 0
end

lcd = {}
for _, name in ipairs({'drawPoint', 'drawLine', 'drawRectangle', 'drawFilledRectangle', 'invertRect', 'drawText',
  'drawTimer', 'drawNumber', 'drawSource', 'drawCircle', 'drawFilledCircle', 'drawTriangle', 'drawFilledTriangle',
  'drawArc', 'drawPie', 'drawAnnulus', 'drawGauge', 'clear', 'setColor'}) do
  lcd[name] = function(...) host[name](host, ...) end
end
function lcd.RGB(red, green, blue) return int(host:RGB(red, green, blue)) end
function lcd.sizeText(text, flags) return int(host:sizeTextWidth(text, flags)), int(host:sizeTextHeight(flags)) end
function lcd.drawBitmap(bitmap, x, y, scale) if bitmap then host:drawBitmap(bitmap.id, x, y, scale) end end
function lcd.refresh() end
function lcd.resetBacklightTimeout() end
function lcd.exitFullScreen() end
RGB = lcd.RGB

Bitmap = {}
function Bitmap.open(path)
  local id = int(host:bitmapOpen(path))
  if id < 0 then return nil end
  return {id = id}
end
function Bitmap.getSize(bitmap) return int(host:bitmapWidth(bitmap.id)), int(host:bitmapHeight(bitmap.id)) end
function Bitmap.resize(bitmap, width, height)
  local id = int(host:bitmapResize(bitmap.id, width, height))
  if id < 0 then return nil end
  return {id = id}
end

model = {}
function model.getInfo() return {name = host:modelName(), bitmap = host:modelBitmap()} end
function getValue(source) return int(host:getValue(source)) end
function getTime() return int(host:getTime()) end
function getDateTime()
  local now = os.date('*t')
  return {year = now.year, mon = now.month, day = now.day, hour = now.hour, min = now.min, sec = now.sec}
end
function playFile(file) host:play('file', file) end
function playNumber(value, unit) host:play('number', value) end
function playTone(frequency) host:play('tone', frequency) end
function playHaptic(duration) host:play('haptic', duration) end

local widget, state
local function optionsFrom(values)
  local options = {}
  for line in values:gmatch('[^\n]+') do
    local name, value = line:match('^([^\t]*)\t(.*)$')
    if name then options[name] = int(tonumber(value)) or value end
  end
  return options
end

function __preview_load(_, code)
  local chunk, problem = load(code, '=widget', 't')
  if not chunk then error(problem, 0) end
  widget = chunk()
  local lines = {widget.name or '?'}
  for _, option in ipairs(widget.options or {}) do
    lines[#lines + 1] = string.format('%s\t%s\t%s', option[1], tostring(option[2]), tostring(option[3]))
  end
  return table.concat(lines, '\n')
end

function __preview_create(_, width, height, values)
  state = widget.create({x = 0, y = 0, w = int(width), h = int(height)}, optionsFrom(values))
end

function __preview_update(_, values)
  if widget.update then widget.update(state, optionsFrom(values)) end
end

function __preview_refresh(_)
  widget.refresh(state, nil, nil)
end
`;
