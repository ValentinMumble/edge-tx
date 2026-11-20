"""Sets the M2 EVO's idle up head speeds (model20.yml): each idle up is a flat curve on the motor channel (CH3), FM1
(SE up), FM2 (SE middle) and FM3 (SE down), in EdgeTX's -100 to +100 %. TARGETS below is what each should be; a curve
already there is left alone (deploy.sh runs every script on the radio each time). The curves' points sit one after
the other in the model's "points" list, every curve taking its count of points (5 for one never set), and a custom
curve its x points too (2 fewer). The Cockpit's placards for the idle ups (its options 1 to 3, on the 0 to 100 % scale
of its throttle gate) follow. Backs the file up first.
Usage: idle_ups.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

# 20 Nov 2026: idle up 2 a bit faster, from 15 (1424 µs) to 20 (1398 µs).
TARGETS = {'FM2': 20}

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'


def section(name: str) -> tuple[int, int]:
    start = text.index(f'\n{name}: \n') + 1
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, start + 1)
    return start, end.start() if end else len(text)


start, end = section('curves')
curves = {
    int(number): dict(re.findall(r'^      (\w+): (.*)$', body, re.M))
    for number, body in re.findall(r'^   (\d+):\n((?:      .*\n)*)', text[start:end], re.M)
}
offsets = {}
offset = 0
for number in range(32):
    curve = curves.get(number, {'type': '0', 'points': '0', 'name': '""'})
    count = int(curve['points']) + 5
    offsets[curve['name'].strip('"')] = (offset, count, curve['type'])
    offset += count if curve['type'] == '0' else count * 2 - 2

start, end = section('points')
entries = re.findall(r'^   (\d+):\n      val: (-?\d+)\n', text[start:end], re.M)
points = {int(index): int(value) for index, value in entries}
changed = []
for name, value in TARGETS.items():
    first, count, kind = offsets[name]
    assert kind == '0' and count == 2, f'{name} is not a flat curve of 2 points'
    now = [points.get(first + step, 0) for step in range(count)]
    assert now[0] == now[1], f'{name} is not flat: {now}'
    if now[0] != value:
        changed.append(f'{name} {now[0]} → {value}')
        for step in range(count):
            points[first + step] = value
listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in sorted(points.items()) if value != 0)
text = text[:start] + 'points: \n' + listing + text[end:]

# The Cockpit's placard for each idle up: its throttle on the gate's 0 to 100 %, (curve + 100) / 2, rounded up.
cockpit = text.index('               widgetName: "Cockpit"\n')
for option, name in enumerate(['FM1', 'FM2', 'FM3']):
    first, _, _ = offsets[name]
    placard = (points.get(first, 0) + 101) // 2
    pattern = re.compile(rf'(                     {option}:\n                        type: Signed\n'
                         rf'                        value: \n                           signedValue: )(-?\d+)\n')
    found = pattern.search(text, cockpit)
    assert found and found.start() - cockpit < 2000, f'no Cockpit option {option + 1}'
    if int(found.group(2)) != placard:
        changed.append(f'IU{option + 1} placard {found.group(2)} → {placard}')
        text = text[:found.start(2)] + str(placard) + text[found.end(2):]
if not changed:
    print(f'{model}: the idle ups are already {TARGETS}, with their placards')
    sys.exit(0)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: idle ups {", ".join(changed)}')
