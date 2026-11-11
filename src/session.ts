const name = 'Session';

/**
 * Today at the field: the packs flown and the time in the air. A pack counts when a new one powers the receiver (not
 * when telemetry comes back after a dropout), the air time while it draws over 2 A. Kept in the model's global
 * variables 1 to 3 so a power cycle keeps them (mAhRe reads GV6 and GV7); a new day starts at zero.
 */
const options: any[] = [];

type Widget = {zone: Zone; powered: boolean; poweredSince: number; lastTime: number};

const DRIVEN_AMPS = 2;
/** The global variables it keeps its count in: the day, the packs, the air time in tens of seconds. */
const DAY = 0;
const PACKS = 1;
const AIR = 2;
/** A pack counts once it has powered the receiver this long (ticks of 10 ms): a bump is not a pack. */
const SETTLE = 300;
/**
 * A new pack: its voltage back after none with the mAh count at 0. The model resets the count only when telemetry
 * stops while disarmed (SA), so a dropout in flight is not a new pack.
 */
const NEW_PACK_MAH = 5;

function create(zone: Zone): Widget {
  return {zone, powered: false, poweredSince: 0, lastTime: getTime()};
}

function update(): void {}

/** Today as a day of the year, to start again each day. */
function today(): number {
  const now = getDateTime();
  const days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return days[now.mon - 1] + now.day;
}

function draw(widget: Widget, width: number, height: number): void {
  if (model.getGlobalVariable(DAY, 0) !== today()) {
    model.setGlobalVariable(DAY, 0, today());
    model.setGlobalVariable(PACKS, 0, 0);
    model.setGlobalVariable(AIR, 0, 0);
  }
  const now = getTime();
  const elapsed = math.min(50, math.max(0, now - widget.lastTime));
  widget.lastTime = now;

  const powered = getValue('VFAS') > 0.5;
  if (powered && !widget.powered) widget.poweredSince = getValue('mAh') < NEW_PACK_MAH ? now : -1;
  // Counted once settled; a pack powered when the radio starts counts as well.
  if (powered && widget.poweredSince >= 0 && now - widget.poweredSince >= SETTLE) {
    model.setGlobalVariable(PACKS, 0, model.getGlobalVariable(PACKS, 0) + 1);
    widget.poweredSince = -1;
  }
  widget.powered = powered;
  if (powered && getValue('Curr') >= DRIVEN_AMPS) {
    // Tens of seconds in the global variable; the rest carried in the widget until it makes ten.
    const tenths = (model.getGlobalVariable(AIR, 0) * 1000 + elapsed) / 1000;
    model.setGlobalVariable(AIR, 0, math.floor(tenths));
    widget.lastTime -= math.floor(((tenths % 1) * 1000) % elapsed);
  }

  const packs = model.getGlobalVariable(PACKS, 0);
  const minutes = math.floor((model.getGlobalVariable(AIR, 0) * 10) / 60);
  lcd.drawText(6, 2, 'Today', SMLSIZE + lcd.RGB(0x9aa3ad));
  lcd.drawText(6, 16, `${packs}`, (height >= 60 ? DBLSIZE : MIDSIZE) + BOLD + lcd.RGB(0xeeeeee));
  const [packsWidth] = lcd.sizeText(`${packs}`, (height >= 60 ? DBLSIZE : MIDSIZE) + BOLD);
  lcd.drawText(10 + packsWidth, height >= 60 ? 30 : 22, packs === 1 ? 'pack' : 'packs', SMLSIZE + lcd.RGB(0x9aa3ad));
  lcd.drawText(width - 6, 16, `${minutes} min`, MIDSIZE + BOLD + RIGHT + lcd.RGB(0x7cd69a));
  lcd.drawText(width - 6, height >= 60 ? 42 : 36, 'in the air', SMLSIZE + RIGHT + lcd.RGB(0x9aa3ad));
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
