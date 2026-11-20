"""Makes the K110S's IU1, Low RPM (model21.yml, curve "Low" on CH3), a steady low head speed like its other idle ups:
a gentle V, 60 % at mid stick and 65 % at the ends (EdgeTX's 20 and 30), where it followed the stick from 0 % at the
bottom to 60 % at mid stick, slowing the head on every descent. Its 5 points sit in the model's "points" list, every
curve before it taking its count (5 for one never set, a custom curve its x points too). The radio writes the file
with a space after a key that opens a block ("points: "), the repo without: both are read. Skips a model already
changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_low_speed.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

LOW = [30, 20, 20, 20, 30]

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
    if curve['name'].strip('"') == 'Low':
        assert curve['type'] == '0' and count == 5, 'the Low curve is not a standard curve of 5 points'
        first = offset
    offset += count if curve['type'] == '0' else count * 2 - 2
assert first is not None, 'no Low curve'

start, end = section('points')
block = text[start:end]
entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
assert len(entries) == block.count('val:'), 'a point the script cannot read'
points = {int(index): int(value) for index, value in entries}
now = [points.get(first + step, 0) for step in range(5)]
if now == LOW:
    print(f'{model}: Low RPM is already a steady 60 %')
    sys.exit(0)
for step, value in enumerate(LOW):
    points[first + step] = value
listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in sorted(points.items()) if value != 0)
text = text[:start] + listing + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: Low RPM {now} → {LOW}, a steady 60 % (65 at the ends)')
