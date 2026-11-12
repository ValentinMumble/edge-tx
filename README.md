# EdgeTX

The RadioMaster TX16S's SD card, and its widgets written in TypeScript, turned into Lua with TypeScriptToLua:
`npm run build` (or `npm run dev` to rebuild on every save) writes them to `output/`.

`sd-card/` is the card as of 10 November 2026, after the update to EdgeTX 2.12.5 (its 2.12.3 SD pack, the M2 EVO's
model and the radio settings rewritten by it); its widgets built from `src/` and mAhRe are this repo's versions, the
others the card's. Full card copies taken around an update stay out of git (`backups/`, `update-2.12.5/`).

- **ArmedModel:** the arming state at a glance: SAFE (grey-green), ARMED (amber, throttle cut) or LIVE (red, the border
  blinking), the SA and SF switches as two lights, the model's picture, and its main rotor seen from above in the
  state's colours: still when safe, spooling up when live (a blur and the rotor disc show as it gains speed), coasting
  down after a cut. Red with RESCUE, its border blinking fast, while SH (the rescue) is held.
- **Pack:** the pack in the heli, picked with the 6-position buttons (its names and sizes at the top of `src/pack.ts`),
  volts a cell now and the lowest, % left from the mAh used, and the last minute of volts a cell as a line.
- **FlyTimer:** time in the air on this pack, counted only while it draws over 2 A, towards a time to land at.
- **Power:** amps on a round dial with the peak, and watts.
- **Link:** RSSI and link quality as bars, amber then red at the radio's alarm levels.
- **FlightState:** the gyro (SC) and the throttle hold (SF) as two lights (the flight mode is in the top bar); RESCUE in
  red while SH is held.
- **FMStatus** (in the top bar): the idle up on SE (IU 1 to 3), lit while the gyro (SC) is on; RESCUE in red while SH
  is held.
- **Session:** packs flown and time in the air today, kept across power cycles in global variables 1 to 3.
- **mAhRe** (RCdiy's Lua in `sd-card/WIDGETS/mAhRe`, edited): battery left in mAh and %, the pack's size and name
  taken from the 6-position button pressed for it (`PACKS` at its top, the same as Pack's), not from GV7. Redrawn in
  the other widgets' colours: a bar of what is left with its %, volts a cell, NOT FULL when the pack was not. Its
  checks (pack not full, cells apart) start again on each new pack instead of on a reset switch.

Pack, FlyTimer, Power, Session and mAhRe start again on a new pack: its voltage back with the mAh count at 0. The
models reset that count only when telemetry stops while disarmed, so a telemetry dropout in flight is not a new pack.

## Deploy

`scripts/deploy.sh` puts it all on the radio, plugged in as USB storage: the built widgets and the edited mAhRe, and
the model changes, a script each: the M2 EVO's low-cell alarm (`cell_alarm.py`), its SA sounds and second screen
(`m2evo_screen.py`), the 6-position buttons freed for the packs (`six_pos.py`), the mAh count and timer 1 kept
through a dropout (`disarmed_reset.py`), and timer 1 counting up the time with the motor on, the mAh used saying when
to land (`timer_up.py`). It backs up what it changes in `backups/<date>` first.

## Preview

`npm run preview`, then open http://localhost:5420/preview/: a TX16S screen in the browser that runs the built
widgets as they are (Lua in JavaScript, with Fengari) and reloads them on every save. Pick the widget and its zone
size, flip its switches and sources, change the model's name and picture. Drawing follows the radio (whole pixels,
angles from 12 o'clock, the theme's colours); fonts are close, not exact.
