"""Makes the K110S's idle up 1 its Low RPM (model21.yml), as on the M2 EVO all three head speeds are on SE: SE up (L1)
is IU1, the Low RPM ramp (0 to 60 % throttle up the stick, with the gentler pitch of the PitLow line on CH6), SE
middle IU2 (80 %), SE down IU3 (90 %). SB does nothing any more.

- CH3: the "Low" line on L7 (SB down) goes, and the IU1 line (L1) flies the Low RPM ramp. The ramp takes the IU1
  curve's place, so the curves read Low, IU2, IU3, CPL (the old 70 % IU1 curve goes, and CPL moves up one: the
  PitLow line follows it).
- CH6: the PitLow line runs on L1 instead of L7.
- SB: its sound (fm-nrm on SB down), its start warning and L7 (SB down) go.
- The top bar's FMStatus says LOW on L1 instead of L7.

The curves' points sit one after the other in the model's "points" list, every curve taking its count of points (5
for one never set) and a custom curve its x points too (2 fewer); points at 0 are not written. Skips a model already
changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_iu1_low.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^header: ?\n   name: "K110S"\n', text, re.M), 'not the K110S model'

if 'def: "SB,0"' not in text and 'swtch: "L7"' not in text:
    print(f'{model}: IU1 is Low RPM already, and SB does nothing')
    sys.exit(0)


def section(name: str) -> tuple[int, int]:
    """Where a top-level key's block starts (its line) and ends (the next top-level key)."""
    found = re.search(rf'^{name}: ?\n', text, re.M)
    assert found, f'no {name}'
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, found.end())
    return found.start(), end.start() if end else len(text)


def items(name: str) -> list[str]:
    """A list block's items (mixData, expoData), each whole: its " -" line and the lines under it."""
    start, end = section(name)
    return re.findall(r'^ - ?\n(?:   .*\n)+', text[start:end], re.M)


def field(item: str, key: str) -> str:
    found = re.search(rf'^   {key}: ?(.*)$', item, re.M)
    return found.group(1) if found else ''


def curve_ref(item: str) -> int:
    """The curve a mix or input line runs through (1 to 32, negative when inverted), 0 when none."""
    found = re.search(r'^   curve: ?\n      type: 3\n      value: (-?\d+)\n', item, re.M)
    return int(found.group(1)) if found else 0


# The curves by number, and each one's points.
start, end = section('curves')
headers = {
    int(number): body
    for number, body in re.findall(r'^   (\d+):\n((?:      .*\n)*)', text[start:end], re.M)
}
curves_line = text[start:text.index('\n', start) + 1]
start, end = section('points')
points_line = text[start:text.index('\n', start) + 1]
found = re.findall(r'^   (\d+):\n      val: (-?\d+)\n', text[start:end], re.M)
values = {int(index): int(value) for index, value in found}


def size(body: str) -> int:
    count = int(re.search(r'^      points: (-?\d+)$', body, re.M).group(1)) + 5
    return count if re.search(r'^      type: (\d+)$', body, re.M).group(1) == '0' else count * 2 - 2


slots = []
offset = 0
for number in range(32):
    body = headers.get(number)
    count = size(body) if body else 5
    slots.append((body, [values.get(offset + step, 0) for step in range(count)]))
    offset += count
assert sum(len(slot[1]) for slot in slots) == offset and max(values) < offset, 'points past the last curve'
named = {
    re.search(r'^      name: "(.*)"$', body, re.M).group(1): number for number, (body, _) in enumerate(slots) if body
}
assert 'IU1' in named and 'Low' in named and named['IU1'] < named['Low'], f'no IU1 then Low curve: {sorted(named)}'
iu1, low = named['IU1'], named['Low']

# The mix lines this changes, each found once.
mixes = items('mixData')
three = [item for item in mixes if field(item, 'destCh') == '2']
iu1_line = [item for item in three if field(item, 'swtch') == '"L1"' and curve_ref(item) == iu1 + 1]
low_line = [item for item in three if field(item, 'swtch') == '"L7"' and curve_ref(item) == low + 1]
pitch_low = [item for item in mixes if field(item, 'destCh') == '5' and field(item, 'swtch') == '"L7"']
assert len(iu1_line) == 1, 'no IU1 line on L1 through the IU1 curve on CH3'
assert len(low_line) == 1, 'no Low line on L7 through the Low curve on CH3'
assert len(pitch_low) == 1, 'no PitLow line on L7 on CH6'
references = [curve_ref(item) for item in mixes + items('expoData') if curve_ref(item)]
assert references.count(iu1 + 1) == 1 and references.count(low + 1) == 1, 'another line uses the IU1 or Low curve'
assert all(value == '0' for value in re.findall(r'^      curve: (-?\d+)$', text, re.M)), 'an output has a curve'

# The Low curve in the IU1 curve's place, the others after it moved up one, and the old line numbers mapped.
moved = {number: number for number in range(32)}
moved[low] = iu1
for number in range(low + 1, 32):
    moved[number] = number - 1
new_slots = [slots[low] if number == iu1 else slots[number] for number in range(32) if number != low]
new_slots.append((None, [0] * 5))
text_curves = curves_line + ''.join(f'   {number}:\n{body}' for number, (body, _) in enumerate(new_slots) if body)
flat = [value for _, values_of in new_slots for value in values_of]
text_points = points_line + ''.join(
    f'   {index}:\n      val: {value}\n' for index, value in enumerate(flat) if value != 0
)


def renumber(item: str) -> str:
    reference = curve_ref(item)
    if reference == 0:
        return item
    number = moved[abs(reference) - 1] + 1
    return re.sub(r'(\n      type: 3\n      value: )-?\d+\n', rf'\g<1>{-number if reference < 0 else number}\n', item)


def replace_once(old: str, new: str) -> None:
    global text
    assert text.count(old) == 1, f'not found once: {old!r}'
    text = text.replace(old, new)


# The curves and points blocks first (the line items below are found by their text, not by position).
for name, new in (('curves', text_curves), ('points', text_points)):
    start, end = section(name)
    text = text[:start] + new + text[end:]
replace_once(low_line[0], '')
replace_once(pitch_low[0], pitch_low[0].replace('   swtch: "L7"\n', '   swtch: "L1"\n'))
# Every line through a curve, once: the IU1 line keeps its number (the ramp took the IU1 curve's place).
for item in items('mixData') + items('expoData'):
    if renumber(item) != item:
        replace_once(item, renumber(item))

# SB's sound: the special functions after it move up one, as the radio does when one is deleted.
start, end = section('customFn')
functions = re.findall(r'^   (\d+):\n((?:      .*\n)*)', text[start:end], re.M)
kept = [body for _, body in functions if not re.search(r'^      swtch: "!?SB\d"$', body, re.M)]
assert len(kept) == len(functions) - 1, 'not one special function on SB'
customFn_line = text[start:text.index('\n', start) + 1]
text = text[:start] + customFn_line + ''.join(f'   {number}:\n{body}' for number, body in enumerate(kept)) + text[end:]

# SB's start warning.
start, end = section('switchWarning')
warning = re.search(r'^   SB:\n      pos: \w+\n', text[start:end], re.M)
if warning:
    text = text[:start + warning.start()] + text[start + warning.end():]

# The top bar's FMStatus: LOW on L1.
start, end = section('topbarData')
topbar = text[start:end]
status = re.search(r'widgetName: "FMStatus"\n(?:         .*\n)*', topbar)
assert status and status.group(0).count('source: ls(7)\n') == 1, "no FMStatus with L7 in the top bar"
low_on_l1 = status.group(0).replace('source: ls(7)\n', 'source: ls(1)\n')
text = text[:start] + topbar.replace(status.group(0), low_on_l1) + text[end:]

# L7 (SB down), now that nothing uses it.
start, end = section('logicalSw')
switch = re.search(r'^   6:\n      func: FUNC_VPOS\n      def: "SB,0"\n(?:      .*\n)*', text[start:end], re.M)
assert switch, 'L7 is not SB down'
text = text[:start + switch.start()] + text[start + switch.end():]
assert not re.search(r'\bL7\b|ls\(7\)|\bSB\d?\b|"SB,', text), 'something still uses L7 or SB'

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: IU1 (SE up) is Low RPM, curves Low, IU2, IU3, CPL; SB does nothing')
