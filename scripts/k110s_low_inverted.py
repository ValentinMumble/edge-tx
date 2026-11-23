"""Gives the K110S's Low RPM pitch (model21.yml, curve CPL on CH6 in IU1) real negative pitch at the bottom of the
stick, for when it is upside down: -60 % there, where it had -20 % (k110s_low_pitch.py), too little to hold it up or
climb inverted (a crash on 23 Nov 2026). The rest stays as it was: +24 % at mid stick (the hover), the same gentle slope
from a quarter of the stick up to the top (+68 %); only the bottom quarter is steeper. CPL becomes a standard curve of
5 points, [-60, 2, 24, 46, 68] at -100, -50, 0, 50 and 100 % stick, from 2 points: its 3 new values go into the model's
"points" list after its own, and the curves after it (CPP) move along. Skips a model already changed (deploy.sh runs
every script on the radio each time). Backs the file up first.
Usage: k110s_low_inverted.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

OLD = [-20, 68]
NEW = [-60, 2, 24, 46, 68]
# What the scripts after it make of it: slid up the stick (k110s_low_hover.py), then softer (k110s_low_softer.py).
LATER = [[-60, -7, 15, 37, 59], [-80, -12, 15, 35, 48]]

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
    size = int(curve['points']) + 5
    if curve['name'].strip('"') == 'CPL':
        assert curve['type'] == '0', 'the CPL curve is not a standard curve'
        first, count = offset, size
    offset += size if curve['type'] == '0' else size * 2 - 2
assert first is not None, 'no CPL curve'
total = offset

start, end = section('points')
block = text[start:end]
entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
assert len(entries) == block.count('val:'), 'a point the script cannot read'
values = [0] * total
for index, value in entries:
    assert int(index) < total, f'point {index} lies past every curve'
    values[int(index)] = int(value)
now = values[first:first + count]
if now == NEW or now in LATER:
    print(f'{model}: the Low RPM pitch already reaches -60 % for inverted')
    sys.exit(0)
assert now == OLD, f'CPL is {now}, not the {OLD} this script expects'
values[first:first + count] = NEW
listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in enumerate(values) if value != 0)
text = text[:start] + listing + text[end:]

# Its count of points: 5 + this, so 0 for 5 (it was -3 for 2).
start, end = section('curves')
curve = re.search(r'^   \d+: *\n(?:      .*\n)*?      points: -3( *)\n(?:      .*\n)*?      name: "CPL" *\n', text[start:end], re.M)
assert curve, 'the CPL curve does not have 2 points'
changed = curve.group(0).replace('      points: -3', '      points: 0', 1)
text = text[:start] + text[start:end].replace(curve.group(0), changed, 1) + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the Low RPM pitch {now} → {NEW}, -60 % at the bottom for inverted')
