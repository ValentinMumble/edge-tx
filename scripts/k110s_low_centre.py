"""Moves the K110S's Low RPM hover (model21.yml, curve CPL on CH6 in IU1) down the stick to where IU2's is: +27 % pitch
at about +12 % stick, where it came at +31 %. Its logs of 24 Nov 2026 hovered Low RPM (55 % throttle) at +27 % pitch,
+31 % stick, and IU2 (70 %) at +16 % pitch, +8 to +10 % stick, on full and practice rates alike: switching idle ups in
a hover ballooned or sank the heli. The slope below the hover and the ends stay (-80 % for inverted, +48 % on top):
[-80, -4, 23, 40, 48] at -100, -50, 0, 50 and 100 % stick. Skips a model already changed (deploy.sh runs every script on
the radio each time). Backs the file up first.
Usage: k110s_low_centre.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

OLD = [-80, -12, 15, 35, 48]
NEW = [-80, -4, 23, 40, 48]

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
if now == NEW:
    print(f'{model}: the Low RPM pitch already hovers where IU2 does')
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
print(f'{model}: the Low RPM pitch {now} → {NEW}, hovering at about +12 % stick, as IU2 does')
