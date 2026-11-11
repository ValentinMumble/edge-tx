#!/bin/bash
# Puts on the radio (its SD card mounted as USB storage):
# - the M2 EVO model: the low-cell alarm, the SA sounds and the second screen;
# - both helis: the 6-position buttons freed for the packs ("Lower" on S1, volume and backlight always on), and the
#   mAh count and timer 1 kept through a telemetry dropout in flight (reset only when telemetry stops while disarmed);
# - the seven widgets built from src/, and the edited mAhRe.
# Backs up the models, the radio settings, the old ArmedModel and mAhRe first, in backups/<today>.
set -euo pipefail
card="/Volumes/NO NAME"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
backup="$repo/backups/$(date +%F)"
test -f "$card/MODELS/model20.yml" || { echo "The radio's card is not mounted at $card"; exit 1; }
grep -q '   name: "M2 EVO"' "$card/MODELS/model20.yml" || { echo "model20.yml is not the M2 EVO"; exit 1; }
test ! -e "$backup/MODELS" || { echo "A backup is already in $backup: move it away first"; exit 1; }
mkdir -p "$backup/WIDGETS/ArmedModel" "$backup/WIDGETS/mAhRe"
cp -R "$card/MODELS" "$card/RADIO" "$backup/"
cp "$card/WIDGETS/ArmedModel/main.lua" "$backup/WIDGETS/ArmedModel/main.lua"
cp "$card/WIDGETS/mAhRe/main.lua" "$backup/WIDGETS/mAhRe/main.lua"
python3 -I "$here/cell_alarm.py" "$card/MODELS/model20.yml"
python3 -I "$here/m2evo_screen.py" "$card/MODELS/model20.yml"
python3 -I "$here/six_pos.py" "$card"
python3 -I "$here/disarmed_reset.py" "$card"
# The widgets: the redrawn ArmedModel, and the six of the second screen, each in its folder.
for pair in armed-model:ArmedModel pack:Pack fly-timer:FlyTimer power:Power link:Link flight-state:FlightState session:Session; do
  file="${pair%%:*}"; folder="${pair##*:}"
  mkdir -p "$card/WIDGETS/$folder"
  cp "$repo/output/$file.lua" "$card/WIDGETS/$folder/main.lua"
  rm -f "$card/WIDGETS/$folder/main.luac"
done
# mAhRe, edited: the pack's size from its 6-position button, its checks again on each new pack.
cp "$repo/sd-card/WIDGETS/mAhRe/main.lua" "$card/WIDGETS/mAhRe/main.lua"
rm -f "$card/WIDGETS/mAhRe/main.luac"
sync
echo "Done: the models, the radio settings and eight widgets updated; the old files in $backup. Eject the card."
