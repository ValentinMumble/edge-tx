"""Takes the K110S's IU2 (model21.yml, curve "IU2" on CH3) down a little, to 75 % at mid stick and 80 % at the ends
(EdgeTX's 50 and 60), from 80 and 85: on 23 Nov 2026 it felt too strong, and a hard full collective blew the tail out
(the tail motor could not hold the main rotor's torque). IU3 stays 90 %, so the two differ more. Its 5 points sit in
the model's "points" list, every curve before it taking its count. The radio writes the file with a space after a key
that opens a block ("points: "), the repo without: both are read. Skips a model already changed (deploy.sh runs every
script on the radio each time). Backs the file up first.
Usage: k110s_iu2_power.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

OLD = [70, 60, 60, 60, 70]
NEW = [60, 50, 50, 50, 60]
# What k110s_iu2_lower.py makes of it after: 70 %.
LATER = [50, 40, 40, 40, 50]

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
    if curve['name'].strip('"') == 'IU2':
        assert curve['type'] == '0' and count == 5, 'the IU2 curve is not a standard curve of 5 points'
        first = offset
    offset += count if curve['type'] == '0' else count * 2 - 2
assert first is not None, 'no IU2 curve'

start, end = section('points')
block = text[start:end]
entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
assert len(entries) == block.count('val:'), 'a point the script cannot read'
points = {int(index): int(value) for index, value in entries}
now = [points.get(first + step, 0) for step in range(5)]
if now == NEW or now == LATER:
    print(f'{model}: IU2 is already 75 %')
    sys.exit(0)
assert now == OLD, f'IU2 is {now}, not the {OLD} this script expects'
for step, value in enumerate(NEW):
    points[first + step] = value
listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in sorted(points.items()) if value != 0)
text = text[:start] + listing + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: IU2 {now} → {NEW}, 75 % (80 at the ends)')
