const name = 'FMStatus';
const MIN_VALUE = -1024;
const MAX_VALUE = 1024;

const options: any[] = [
  ['FlightModeSource', SOURCE, 1],
  ['GyroSource', SOURCE, 1],
  ['LowSource', SOURCE, 0],
  ['S1Source', SOURCE, 0],
];

/** What S1 adds to each idle up's throttle at either end, in its % (s1_knob.py's lines, as the Cockpit's knob). */
const S1_RANGE = [20, 20, 10];

interface Options {
  FlightModeSource: number;
  GyroSource: number;
  /** On while the low head speed is picked (the K110S's SB down, its L7): the zone says LOW instead of IU 1 to 3. */
  LowSource: number;
  /** The S1 knob, on a model where it changes the head speed (the M2 EVO): what it adds shows under the idle up. */
  S1Source: number;
}

interface Widget {
  filename?: string;
  bitmap?: Bitmap;
  bitmapWidth?: number;
  bitmapHeight?: number;
  zone: Zone;
  options: Options;
}

function create(zone: Zone, options: Options) {
  const widget: Widget = {
    zone,
    options,
  };

  update(widget, options);

  return widget;
}

function update(widget: Widget, options: Options) {
  widget.options = options;
}

/** SH held down: the rescue. The zone turns red and says RESCUE, as big as fits (it is longer than "IU 2"). */
function drawRescue(x: number, y: number, w: number, h: number): void {
  lcd.drawFilledRectangle(0, 0, w, h, lcd.RGB(0x8a1c20));
  let size = SMLSIZE;
  for (const bigger of [DBLSIZE, MIDSIZE, 0]) {
    const [textWidth] = lcd.sizeText('RESCUE', bigger);
    if (textWidth <= w - 4) {
      size = bigger;
      break;
    }
  }
  lcd.drawText(x, y, 'RESCUE', size | lcd.RGB(0xffffff));
}

function draw(widget: Widget, x: number, y: number, w: number, h: number): void {
  if (getValue('sh') > 0) {
    drawRescue(x, y, w, h);
    return;
  }
  const isGyroOn = getValue(widget.options.GyroSource) === MAX_VALUE;

  // Self-level on: the zone turns blue, as the cockpit's LEVEL light (the theme's own "active" colour is a light grey).
  if (isGyroOn) {
    lcd.drawFilledRectangle(0, 0, w, h, lcd.RGB(0x3b75a9));
  }

  const flightModeValue = getValue(widget.options.FlightModeSource);
  const flightMode = MIN_VALUE === flightModeValue ? 1 : 0 === flightModeValue ? 2 : 3;
  const low = getValue(widget.options.LowSource ?? 0) > 0;

  // Light on the top bar's dark grey, whatever the theme's colours (the Cockpit theme's EDIT is a dark red).
  const ink = isGyroOn ? lcd.RGB(0xffffff) : lcd.RGB(0xeeeeee);
  const mode = low ? 'LOW' : `IU ${flightMode}`;
  const s1 = widget.options.S1Source ?? 0;
  if (s1 === 0) {
    lcd.drawText(x, y, mode, DBLSIZE | ink);
    return;
  }
  // With S1: the idle up smaller, and under it what S1 adds, amber while it is off the middle.
  const added = math.floor((getValue(s1) / 1024) * S1_RANGE[flightMode - 1] + 0.5);
  const line = `S1 ${added > 0 ? '+' : ''}${added}`;
  const [, small] = lcd.sizeText(line, SMLSIZE);
  lcd.drawText(x, y, mode, MIDSIZE | ink);
  lcd.drawText(x, y + h - small, line, SMLSIZE | (added === 0 ? ink : lcd.RGB(0xffc14d)));
}

function refresh(widget: Widget, event: any, touch: any) {
  if (event != null) {
    draw(widget, 0, 0, LCD_W, LCD_H);
  } else {
    draw(widget, widget.zone.x, widget.zone.y, widget.zone.w, widget.zone.h);
  }
}

export {refresh, name, create, update, options};
