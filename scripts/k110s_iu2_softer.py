"""Softens the K110S's IU2 (model21.yml) once more: its throttle (curve "IU2" on CH3) to 65 % at mid stick and 70 % at
the ends (EdgeTX's 30 and 40), from 70 and 75 (k110s_iu2_lower.py), and its pitch curve CP2 (k110s_idle_pitch.py) to
[-52, -14, 17, 40, 60] at -100, -50, 0, 50 and 100 % stick, from [-70, -20, 10, 40, 70]. On 26 Nov 2026 IU2 still felt
too strong on the collective, the tail lost authority in it, and switching to it from IU1 sank the heli: the calibration
flight hovered IU1 (55 %) at +7 % stick and +25 % pitch, IU2 (70 %) at +13 % stick and +17 % pitch, so at IU1's stick
IU2 gave too little pitch. At 65 % the hover wants about +20 % pitch (pitch times head speed squared held), which the new
curve gives at IU1's +7 % stick, 0.46 pitch a bit of stick around it (from 0.6), about ±6.5° at the ends (from ±8°);
less head speed, less torque for the tail to hold. Skips a model already changed (deploy.sh runs every script on the
radio each time). Backs the file up first.
Usage: k110s_iu2_softer.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

# Curve name: (points before, points now), at stick -100, -50, 0, 50 and 100.
CHANGES = {
    'IU2': ([50, 40, 40, 40, 50], [40, 30, 30, 30, 40]),
    'CP2': ([-70, -20, 10, 40, 70], [-52, -14, 17, 40, 60]),
}

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


# Where each curve's points start: each curve before it takes its values, 5 for one never set, a custom one its x too.
start, end = section('curves')
curves = {
    int(number): dict(re.findall(r'^      (\w+): *(.*?) *$', body, re.M))
    for number, body in re.findall(r'^   (\d+): *\n((?:      .*\n)*)', text[start:end], re.M)
}
firsts: dict[str, int] = {}
offset = 0
for number in range(max(curves) + 1):
    curve = curves.get(number, {'type': '0', 'points': '0', 'name': '""'})
    count = int(curve['points']) + 5
    name = curve['name'].strip('"')
    if name in CHANGES:
        assert curve['type'] == '0' and count == 5, f'{name} is not a standard curve of 5 points'
        firsts[name] = offset
    offset += count if curve['type'] == '0' else count * 2 - 2
assert set(firsts) == set(CHANGES), f'curves missing: {set(CHANGES) - set(firsts)}'

start, end = section('points')
block = text[start:end]
entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
assert len(entries) == block.count('val:'), 'a point the script cannot read'
points = {int(index): int(value) for index, value in entries}
nows = {name: [points.get(firsts[name] + step, 0) for step in range(5)] for name in CHANGES}
if all(nows[name] == new for name, (_, new) in CHANGES.items()):
    print(f'{model}: IU2 is already 65 % with the softer CP2')
    sys.exit(0)
for name, (old, new) in CHANGES.items():
    assert nows[name] == old, f'{name} is {nows[name]}, not the {old} this script expects'
    for step, value in enumerate(new):
        points[firsts[name] + step] = value
listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in sorted(points.items()) if value != 0)
text = text[:start] + listing + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: IU2 65 % (70 at the ends), CP2 {nows["CP2"]} → {CHANGES["CP2"][1]}')
