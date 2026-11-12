"""Puts the receiver's sensors back in the M2 EVO's slots (model20.yml) when the radio found them again under new IDs:
"Discover new sensors" adds them at the end, named as before (RSSI, RxBt, Curr, VFAS), while the old slots stay empty,
and everything reads the old slots (the Cockpit by name gets the first, L15 and L17 read sensor 6, mAh adds up sensor
5's current, a log's first VFAS column is the empty one). Each name found twice keeps its first slot, with the new
sensor's ID (id1, id2, subId) and the slot's own settings, and the new copy goes. Skips a model with no name twice.
Backs the file up first. Usage: sensor_ids.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

HEADER = 'telemetrySensors: \n'
start = text.index(HEADER) + len(HEADER)
end = text.index('screenData: \n', start)
blocks = [block for block in re.split(r'(?m)^(?=   \d+:\n)', text[start:end]) if block]
assert all(re.match(r'   \d+:\n', block) for block in blocks), 'the sensors are not as expected'


def label(block: str) -> str:
    found = re.search(r'^      label: "(.*)"$', block, re.M)
    return found.group(1) if found else ''


IDENTITY = (r'^      id1: \n(?:         .*\n)+', r'^      id2: \n(?:         .*\n)+', r'^      subId: .*\n')

kept, moved = [], []
for block in blocks:
    name = label(block)
    first = next((index for index, earlier in enumerate(kept) if name and label(earlier) == name), None)
    if first is None or '      type: TYPE_CUSTOM\n' not in block:
        kept.append(block)
        continue
    # A sensor found again: its identity goes into the first slot of that name, which keeps its settings.
    updated = kept[first]
    for pattern in IDENTITY:
        new = re.search(pattern, block, re.M)
        assert new and re.search(pattern, updated, re.M), f'{name}: no {pattern!r}'
        updated = re.sub(pattern, lambda _: new.group(0), updated, count=1, flags=re.M)
    kept[first] = updated
    moved.append(name)

if not moved:
    print(f'{model}: no sensor found twice')
    sys.exit(0)
text = text[:start] + ''.join(kept) + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: {", ".join(moved)} back in their first slots with their new IDs')
