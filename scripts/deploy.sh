#!/bin/bash
# Puts on the radio (its SD card mounted as USB storage):
# - the M2 EVO model: the low-cell alarm, the SA sounds and the second screen;
# - both helis: the 6-position buttons freed for the packs ("Lower" on S1, volume and backlight always on), and the
#   mAh count and timer 1 kept through a telemetry dropout in flight (reset only when telemetry stops while disarmed),
#   and timer 1 counting up the time with the motor on;
# - the eight widgets built from src/ (FMStatus, in the top bar, among them), and the edited mAhRe.
# Backs up the models, the radio settings, the old ArmedModel, FMStatus and mAhRe first, in backups/<today>.
set -euo pipefail
card="/Volumes/NO NAME"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
backup="$repo/backups/$(date +%F)"
test -f "$card/MODELS/model20.yml" || { echo "The radio's card is not mounted at $card"; exit 1; }
grep -q '   name: "M2 EVO"' "$card/MODELS/model20.yml" || { echo "model20.yml is not the M2 EVO"; exit 1; }
test ! -e "$backup/MODELS" || { echo "A backup is already in $backup: move it away first"; exit 1; }
mkdir -p "$backup/WIDGETS/ArmedModel" "$backup/WIDGETS/FlightStatus" "$backup/WIDGETS/mAhRe"
cp -R "$card/MODELS" "$card/RADIO" "$backup/"
cp "$card/WIDGETS/ArmedModel/main.lua" "$backup/WIDGETS/ArmedModel/main.lua"
cp "$card/WIDGETS/FlightStatus/main.lua" "$backup/WIDGETS/FlightStatus/main.lua"
cp "$card/WIDGETS/mAhRe/main.lua" "$backup/WIDGETS/mAhRe/main.lua"
python3 -I "$here/cell_alarm.py" "$card/MODELS/model20.yml"
python3 -I "$here/m2evo_screen.py" "$card/MODELS/model20.yml"
python3 -I "$here/six_pos.py" "$card"
python3 -I "$here/disarmed_reset.py" "$card"
python3 -I "$here/timer_up.py" "$card"
# The widgets: the redrawn ArmedModel, FMStatus (RESCUE while SH is held), and the six of the second screen.
for pair in armed-model:ArmedModel flight-status:FlightStatus pack:Pack fly-timer:FlyTimer power:Power link:Link flight-state:FlightState session:Session; do
  file="${pair%%:*}"; folder="${pair##*:}"
  mkdir -p "$card/WIDGETS/$folder"
  cp "$repo/output/$file.lua" "$card/WIDGETS/$folder/main.lua"
  rm -f "$card/WIDGETS/$folder/main.luac"
done
# mAhRe, edited: the pack's size from its 6-position button, its checks again on each new pack.
cp "$repo/sd-card/WIDGETS/mAhRe/main.lua" "$card/WIDGETS/mAhRe/main.lua"
rm -f "$card/WIDGETS/mAhRe/main.luac"
sync
echo "Done: the models, the radio settings and nine widgets updated; the old files in $backup. Eject the card."
