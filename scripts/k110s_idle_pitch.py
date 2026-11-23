"""Gives the K110S's IU2 and IU3 (model21.yml) their own pitch curves, where they flew the collective stick straight
(-100 to +100 %, the Pitch line on CH6): on 23 Nov 2026 IU2 felt far too strong, the collective twice as sensitive as
Low RPM's and a full punch blowing the tail out. The logs that day hovered every idle up at about the same pitch (+24 to
+26 % at +24 to +25 % stick), so the head speed barely changes with the throttle and the pitch is what to soften. Each
keeps that hover where it is:
- CP2, IU2's: [-70, -20, 10, 40, 70] at -100, -50, 0, 50 and 100 % stick, 0.6 pitch a bit of stick around the hover, ±70
  % at the ends (about ±8°): a sport mode.
- CP3, IU3's: [-90, -35, 5, 45, 90], 0.8 around the hover, ±90 % (about ±11°): the strong one, for 3D.
Two pitch lines on CH6, right after the Pitch line, each on its idle up's logical switch (L2 SE middle, L3 SE down), so
the practice line (SG down, CPP), Low RPM's (CPL) and the rescue's still come after and win. The curves go after every
curve the model has, and their points after every point, so no other curve moves. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_idle_pitch.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

CURVES = [('CP2', 'L2', 'PitIU2', [-70, -20, 10, 40, 70]), ('CP3', 'L3', 'PitIU3', [-90, -35, 5, 45, 90])]

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^   name: "K110S" *$', text, re.M), 'not the K110S model'

if all(f'   name: "{line}"' in text for _, _, line, _ in CURVES):
    print(f'{model}: IU2 and IU3 already have their own pitch curves')
    sys.exit(0)
assert not any(f'name: "{curve}"' in text or f'name: "{line}"' in text for curve, _, line, _ in CURVES), (
    'only some of the IU2 and IU3 pitch curves and lines are there'
)


def section(name: str) -> tuple[int, int]:
    """Where a top-level block's body sits: after its key's line, to the next top-level key."""
    found = re.search(rf'^{name}: *\n', text, re.M)
    assert found, f'no {name} in the model'
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, found.end())
    return found.end(), end.start() if end else len(text)


# The curves: after the last one, their points after every curve's.
start, end = section('curves')
curves = {
    int(number): dict(re.findall(r'^      (\w+): *(.*?) *$', body, re.M))
    for number, body in re.findall(r'^   (\d+): *\n((?:      .*\n)*)', text[start:end], re.M)
}
free = max(curves) + 1
offset = 0
for number in range(free):
    curve = curves.get(number, {'type': '0', 'points': '0'})
    count = int(curve['points']) + 5
    offset += count if curve['type'] == '0' else count * 2 - 2
added = ''.join(
    f'   {free + place}:\n      type: 0\n      smooth: 0\n      points: 0\n      name: "{name}"\n'
    for place, (name, _, _, _) in enumerate(CURVES)
)
text = text[:end] + added + text[end:]

start, end = section('points')
taken = [int(index) for index in re.findall(r'^   (\d+): *$', text[start:end], re.M)]
assert not taken or max(taken) < offset, 'points already where the new curves go'
points = ''.join(
    f'   {offset + place * 5 + step}:\n      val: {value}\n'
    for place, (_, _, _, values) in enumerate(CURVES)
    for step, value in enumerate(values)
    if value
)
text = text[:end] + points + text[end:]

# The pitch lines: Low RPM's line copied, on each idle up's switch with its curve, after the Pitch line.
start, end = section('mixData')
mixes = text[start:end]
low = re.search(r'^ -\n(?:   .*\n|      .*\n)*?   name: "PitLow" *\n', mixes, re.M)
pitch = re.search(r'^ -\n   destCh: 5 *\n(?:   .*\n|      .*\n)*?   name: "Pitch" *\n', mixes, re.M)
assert low and pitch, 'no Pitch or PitLow line on CH6'
assert '   swtch: "L1"\n' in low.group(0) and re.search(r'      value: \d+ *\n', low.group(0)), 'PitLow is not as expected'
lines = ''
for place, (_, switch, name, _) in enumerate(CURVES):
    line = low.group(0).replace('   swtch: "L1"\n', f'   swtch: "{switch}"\n', 1)
    line = re.sub(r'      value: \d+( *)\n', rf'      value: {free + place + 1}\1\n', line, count=1)
    lines += line.replace('   name: "PitLow"', f'   name: "{name}"', 1)
mixes = mixes[: pitch.end()] + lines + mixes[pitch.end() :]
text = text[:start] + mixes + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: IU2 and IU3 fly their own pitch curves, CP2 (±70 %) and CP3 (±90 %)')
