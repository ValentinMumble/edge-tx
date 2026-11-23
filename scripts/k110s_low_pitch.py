"""Makes the K110S's Low RPM pitch (model21.yml, curve CPL on CH6 in IU1) gentler and centred: -20 % at the bottom to
+68 % at the top, where it went from -25 % to +100 %. Its first log (23 Nov 2026, 3 minutes in Low RPM) hovered at
-22 % collective stick (39 % of the travel), at +24 % pitch: it lifted off early, each bit of stick gave a lot of pitch,
and IU2 at the same stick gave far less (from about -22 % on its straight line to 0 % on CPP), so the heli sank when
switching. Now +24 % comes at mid stick, with 30 % less pitch per bit of stick around it, and mid stick in IU2 gives
+11 % on CPP (SD down), close to the less pitch the faster head needs. CPL is a standard curve of 2 points in the model's
"points" list, every curve before it taking its count. Skips a model already changed (deploy.sh runs every script on
the radio each time). Backs the file up first.
Usage: k110s_low_pitch.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

OLD = [-25, 100]
NEW = [-20, 68]
# What the scripts after it make of it: 5 points, -60 % at the bottom (k110s_low_inverted.py), then slid up the stick
# (k110s_low_hover.py), then softer (k110s_low_softer.py).
LATER = [[-60, 2, 24, 46, 68], [-60, -7, 15, 37, 59], [-80, -12, 15, 35, 48]]

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
first = count = None
offset = 0
for number in range(32):
    curve = curves.get(number, {'type': '0', 'points': '0', 'name': '""'})
    count = int(curve['points']) + 5
    if curve['name'].strip('"') == 'CPL':
        assert curve['type'] == '0', 'the CPL curve is not a standard curve'
        first, size = offset, count
    offset += count if curve['type'] == '0' else count * 2 - 2
assert first is not None, 'no CPL curve'

start, end = section('points')
block = text[start:end]
entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
assert len(entries) == block.count('val:'), 'a point the script cannot read'
points = {int(index): int(value) for index, value in entries}
if size == 5 and [points.get(first + step, 0) for step in range(size)] in LATER:
    print(f'{model}: the Low RPM pitch already hovers at mid stick (and reaches -60 % for inverted)')
    sys.exit(0)
assert size == 2, 'the CPL curve does not have 2 points'
now = [points.get(first + step, 0) for step in range(2)]
if now == NEW:
    print(f'{model}: the Low RPM pitch already hovers at mid stick')
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
print(f'{model}: the Low RPM pitch {now} → {NEW}, hovering at mid stick, gentler')
