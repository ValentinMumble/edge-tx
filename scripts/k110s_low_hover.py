"""Slides the K110S's Low RPM pitch (model21.yml, curve CPL on CH6 in IU1) up the stick, so it hovers where IU2 does:
+24 % pitch (its hover) at +21 % stick, where it came at mid stick (k110s_low_pitch.py). Its logs of 23 Nov 2026 hovered
IU2 at about +22 % stick on full rates (its pitch is the stick) and +20 % on practice rates (CPP), so going from IU1 to
IU2 at mid stick dropped the pitch from +24 % to about 0 % and the heli sank. The curve keeps its gentle slope and its
-60 % at the bottom (k110s_low_inverted.py): [-60, -7, 15, 37, 59] at -100, -50, 0, 50 and 100 % stick. Skips a model
already changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_low_hover.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

OLD = [-60, 2, 24, 46, 68]
NEW = [-60, -7, 15, 37, 59]
# What k110s_low_softer.py makes of it after.
LATER = [-80, -12, 15, 35, 48]

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^   name: "K110S" *$', text, re.M), 'not the K110S model'


def section(name: str) -> tuple[int, int]:
    """Where a top-level block sits: from its first entry to the next top-level key."""
    found = re.search(rf'^{name}: *\n', text, re.M)
    assert found, f'no {name} in the model'
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, found.end())
    return found.end(), end.start() if end else len(text)


start, end = section('curves')
curves = {
    int(number): dict(re.findall(r'^      (\w+): *(.*?) *$', body, re.M))
    for number, body in re.findall(r'^   (\d+): *\n((?:      .*\n)*)', text[start:end], re.M)
}
first = None
offset = 0
for number in range(32):
    curve = curves.get(number, {'type': '0', 'points': '0', 'name': '""'})
    count = int(curve['points']) + 5
    if curve['name'].strip('"') == 'CPL':
        assert curve['type'] == '0' and count == 5, 'the CPL curve is not a standard curve of 5 points'
        first = offset
    offset += count if curve['type'] == '0' else count * 2 - 2
assert first is not None, 'no CPL curve'

start, end = section('points')
block = text[start:end]
entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
assert len(entries) == block.count('val:'), 'a point the script cannot read'
points = {int(index): int(value) for index, value in entries}
now = [points.get(first + step, 0) for step in range(5)]
if now == NEW or now == LATER:
    print(f'{model}: the Low RPM pitch already hovers at +21 % stick')
    sys.exit(0)
assert now == OLD, f'CPL is {now}, not the {OLD} this script expects'
for step, value in enumerate(NEW):
    points[first + step] = value
listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in sorted(points.items()) if value != 0)
text = text[:start] + listing + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the Low RPM pitch {now} → {NEW}, hovering at +21 % stick as IU2 does')
