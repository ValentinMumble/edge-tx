#!/bin/bash
# Makes the radio's card (its SD card mounted as USB storage) what the repo's sd-card/ is:
# - the model changes, by the same scripts that made them in the repo, each skipping a change already there: the M2
#   EVO's low-cell alarm, SA sounds and one cockpit screen; the 6-position buttons freed for the packs ("Lower" on S1,
#   volume and backlight always on, the buttons a 6-position switch again); the mAh count and timer 1 kept through a
#   telemetry dropout; timer 1 counting up; the theme's readable menus (and the M2 EVO's clock); arming down; the
#   sortie timer; the low-cell alarm only with a pack in; the receiver's sensors back in their slots;
# - the widgets built from src/ (widgets.json says which folder each goes in) and the edited mAhRe, from the repo's
#   card, with their pictures (`npm run build` puts the built ones there, and the Cockpit's panel pictures).
# Backs up the models, the radio settings and the widgets it replaces first, in backups/<today>, and lists at the end
# any model that still differs from the repo's: changed on the radio since, to bring into the repo.
set -euo pipefail
card="/Volumes/NO NAME"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
backup="$repo/backups/$(date +%F)"
test -f "$card/MODELS/model20.yml" || { echo "The radio's card is not mounted at $card"; exit 1; }
grep -q '   name: "M2 EVO"' "$card/MODELS/model20.yml" || { echo "model20.yml is not the M2 EVO"; exit 1; }
test ! -e "$backup/MODELS" || { echo "A backup is already in $backup: move it away first"; exit 1; }

folders="$(python3 -I -c 'import json, sys; print(" ".join(json.load(open(sys.argv[1])).values()))' "$repo/widgets.json") mAhRe"
mkdir -p "$backup"
cp -R "$card/MODELS" "$card/RADIO" "$backup/"
mkdir -p "$backup/THEMES/FM2M_Concrete"
cp "$card/THEMES/FM2M_Concrete/theme.yml" "$backup/THEMES/FM2M_Concrete/theme.yml"
for folder in $folders; do
  if [ -f "$card/WIDGETS/$folder/main.lua" ]; then
    mkdir -p "$backup/WIDGETS/$folder"
    cp "$card/WIDGETS/$folder/main.lua" "$backup/WIDGETS/$folder/main.lua"
  fi
done

python3 -I "$here/cell_alarm.py" "$card/MODELS/model20.yml"
python3 -I "$here/m2evo_screen.py" "$card/MODELS/model20.yml"
python3 -I "$here/cockpit_screen.py" "$card/MODELS/model20.yml"
python3 -I "$here/six_pos.py" "$card"
python3 -I "$here/disarmed_reset.py" "$card"
python3 -I "$here/timer_up.py" "$card"
python3 -I "$here/readable_menus.py" "$card"
python3 -I "$here/arm_down.py" "$card/MODELS/model20.yml"
python3 -I "$here/sortie_timer.py" "$card/MODELS/model20.yml"
python3 -I "$here/cell_alarm_live.py" "$card/MODELS/model20.yml"
python3 -I "$here/cell_alarm_sag.py" "$card/MODELS/model20.yml"
python3 -I "$here/rescue_delay.py" "$card/MODELS/model20.yml"
python3 -I "$here/sensor_ids.py" "$card/MODELS/model20.yml"
python3 -I "$here/cockpit_theme.py" "$card"

for folder in $folders; do
  mkdir -p "$card/WIDGETS/$folder"
  # -X: without the Mac's file attributes, which would leave a "._main.lua" beside it on the card.
  cp -X "$repo/sd-card/WIDGETS/$folder/main.lua" "$card/WIDGETS/$folder/main.lua"
  rm -f "$card/WIDGETS/$folder/main.luac"
  # Its pictures too (the Cockpit's gauge faces).
  for picture in "$repo/sd-card/WIDGETS/$folder"/*.png; do
    if [ -f "$picture" ]; then cp -X "$picture" "$card/WIDGETS/$folder/"; fi
  done
done
sync

differ=""
for model in "$repo"/sd-card/MODELS/model*.yml; do
  name="$(basename "$model")"
  cmp -s "$model" "$card/MODELS/$name" || differ="$differ $name"
done
echo "Done: the models, the radio settings and the widgets ($folders) updated; the old files in $backup."
if [ -n "$differ" ]; then
  echo "Still different from the repo's card, changed on the radio since:$differ. Copy them into sd-card/MODELS."
fi
echo "Eject the card."
