# EdgeTX

The RadioMaster TX16S's SD card, its widgets written in TypeScript (turned into Lua with TypeScriptToLua), and the
scripts that change its models. Flightdown shows and runs it (see Preview).

`sd-card/` is the card as it should be: the card as of 10 November 2026, after the update to EdgeTX 2.12.5, with the
model changes of `scripts/` made to it, and the widgets built from `src/` and the edited mAhRe in it. `npm run build`
puts the built widgets there (`widgets.json` says which folder each goes in); `npm run dev` rebuilds them into
`output/` on every save. Full card copies taken from the radio stay out of git (`backups/`, `update-2.12.5/`).

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

`scripts/deploy.sh` makes the radio's card, plugged in as USB storage, what `sd-card/` is. It runs on it the scripts
that changed the models here, each one skipping a change already there: the M2 EVO's low-cell alarm
(`cell_alarm.py`), its SA sounds and second screen (`m2evo_screen.py`), the 6-position buttons freed for the packs
(`six_pos.py`), the mAh count and timer 1 kept through a dropout (`disarmed_reset.py`), timer 1 counting up the time
with the motor on (`timer_up.py`). Then it copies the built widgets and mAhRe from `sd-card/`. It backs up what it
changes in `backups/<date>` first, and names any model the radio changed since, to copy into `sd-card/MODELS`. A new
model change is a new script, run on `sd-card/` and added to the deploy.

## Preview

[Flightdown](https://github.com/ValentinMumble/flightdown)'s Radio tab reads `sd-card/` from this repo (on GitHub, or
the checkout beside it) and runs it in a TX16S screen in the browser (Lua in JavaScript, with Fengari): "Model
screens" the models' screens, "Logic" what each switch and channel does, "One widget" a built widget in a zone of its
size. With `npm run dev` running here and in Flightdown, it reloads a widget on every save.
