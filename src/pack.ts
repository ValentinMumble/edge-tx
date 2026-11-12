const name = 'Pack';

/**
 * The pack in the heli: which one (picked with the 6-position buttons before flying), volts a cell now and the lowest
 * since it was plugged in, % left from the mAh used against its size, and the last minute of volts a cell as a line.
 */
const options: any[] = [];

/** The packs by 6-position button. Pick the button of the pack you plug in: its size makes the %, its name the log. */
const SLOTS = [
  {name: 'Gens Ace 1', mah: 700},
  {name: 'Gens Ace 3', mah: 750},
  {name: 'Gens Ace 4', mah: 750},
  {name: 'OMP 2', mah: 750},
  {name: 'Eachine 1', mah: 500},
  {name: 'Eachine 2', mah: 500},
];
const CELLS = 3;
/** Volts a cell: the line to land at, the one a LiPo should never see. */
const LAND = 3.5;
const NEVER = 3.3;
/** One sample a second, the last 60 for the line. */
const SAMPLES = 60;

/**
 * A new pack: its voltage back after none with the mAh count at 0. The model resets the count only when telemetry
 * stops while disarmed (SA), so a dropout in flight is not a new pack.
 */
const NEW_PACK_MAH = 5;

type Widget = {zone: Zone; lowest: number; samples: number[]; lastSample: number; powered: boolean};

function create(zone: Zone): Widget {
  return {zone, lowest: 0, samples: [], lastSample: 0, powered: false};
}

function update(): void {}

/** The 6-position button pressed: 1 to 6. */
function slot(): number {
  // EdgeTX 2.12.5 names the TX16S's buttons "6pos" in Lua ("6P" is only their log column), exactly.
  const value = getValue('6pos');
  return math.max(1, math.min(6, math.floor((value + 1024) / 409.6 + 0.5) + 1));
}

function cellColor(volts: number): number {
  return volts <= NEVER ? lcd.RGB(0xff5a5f) : volts <= LAND ? lcd.RGB(0xffb020) : lcd.RGB(0x7cd69a);
}

function draw(widget: Widget, width: number, height: number): void {
  const pack = SLOTS[slot() - 1];
  const volts = getValue('VFAS');
  const used = getValue('mAh');
  const powered = volts > 0.5;
  const cell = powered ? volts / CELLS : 0;

  // A new pack: its lowest and its line start again.
  if (powered && !widget.powered && getValue('mAh') < NEW_PACK_MAH) {
    widget.lowest = 0;
    widget.samples = [];
  }
  widget.powered = powered;
  if (powered) {
    if (widget.lowest === 0 || cell < widget.lowest) widget.lowest = cell;
    const now = getTime();
    if (now - widget.lastSample >= 100) {
      widget.lastSample = now;
      widget.samples.push(cell);
      if (widget.samples.length > SAMPLES) widget.samples.shift();
    }
  }

  const left = math.max(0, math.min(100, 100 - (used / pack.mah) * 100));
  const ink = lcd.RGB(0xeeeeee);
  const muted = lcd.RGB(0x9aa3ad);

  lcd.drawText(6, 2, `${pack.name}, ${pack.mah} mAh`, SMLSIZE + muted);
  if (!powered) {
    lcd.drawText(6, 20, 'No pack', MIDSIZE + muted);
    return;
  }
  lcd.drawText(6, 16, `${string.format('%.2f', cell)} V`, MIDSIZE + cellColor(cell));
  lcd.drawText(width - 6, 2, `low ${string.format('%.2f', widget.lowest)}`, SMLSIZE + RIGHT + cellColor(widget.lowest));

  // What is left of the pack, as a bar with its %.
  const barX = width - 92;
  lcd.drawRectangle(barX, 22, 86, 14, muted);
  lcd.drawFilledRectangle(
    barX + 2,
    24,
    math.floor((82 * left) / 100),
    10,
    left < 20 ? lcd.RGB(0xff5a5f) : left < 35 ? lcd.RGB(0xffb020) : lcd.RGB(0x7cd69a),
  );
  lcd.drawText(barX + 43, 22, `${math.floor(left)}%`, SMLSIZE + CENTER + ink);

  // The last minute of volts a cell, from 3.3 V at the bottom to 4.2 V at the top, the land line dashed.
  const top = 42;
  const bottom = height - 4;
  if (bottom - top >= 12) {
    const y = (volts: number) =>
      bottom - ((math.max(NEVER, math.min(4.2, volts)) - NEVER) / (4.2 - NEVER)) * (bottom - top);
    lcd.drawLine(6, math.floor(y(LAND)), width - 6, math.floor(y(LAND)), DOTTED, lcd.RGB(0xffb020));
    const step = (width - 12) / (SAMPLES - 1);
    for (let index = 1; index < widget.samples.length; index++) {
      const x1 = 6 + (index - 1 + SAMPLES - widget.samples.length) * step;
      lcd.drawLine(
        x1,
        y(widget.samples[index - 1]),
        x1 + step,
        y(widget.samples[index]),
        SOLID,
        cellColor(widget.samples[index]),
      );
    }
  }
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
