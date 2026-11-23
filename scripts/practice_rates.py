"""Gives the M2 EVO (model20.yml) and the K110S (model21.yml) practice rates on SD down, for working on soft landings;
SD up and in the middle fly as before.

- The cyclic and rudder calmer: a line per input before its usual one, on SD2 (an input uses its first line whose
  switch is on). Aileron and elevator at 70 %, rudder at 80 %. The K110S's cyclic gets 35 % expo (from 20), its rudder
  30 % (from 20); the M2 EVO keeps its aileron and elevator dead-band curve (DBD), its rudder gets 30 % expo (from 0).
- A gentler collective: a "Prac" pitch line on SD2, a new curve CPP keeping the pitch the heli hovers at where it
  is now (so flipping SD in a hover does not move it), 30 % less pitch per bit of stick around it, -40 % at the
  bottom (about -5°) and +75 % at the top (about +9°). The M2 EVO's line goes after its idle ups' and before self-
  level's and the rescue's (so those still win); its hover is 66 % stick, about +3.5° (read from its logs). The
  K110S's goes before its Low RPM line (which keeps its own gentle curve, CPL) and the rescue's; its hover is taken at
  65 % stick until its logs say otherwise.
- "Low rates" said when SD goes down (ratlow.wav, from the card's sounds).

The radio writes the file with a space after a key that opens a block, the repo sometimes without: both are read, and
it is written back with them where the file had them (the other scripts look for the radio's way). Skips a model already changed (deploy.sh runs every script on the radio
each time). Backs the files up first.
Usage: practice_rates.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

SWITCH = 'SD2'
PRACTICE = {
    'model20.yml': {
        'name': 'M2 EVO',
        # Input number: (weight, expo), expo None to keep the line's own curve.
        'inputs': {0: (70, None), 1: (70, None), 3: (80, 30)},
        'after': 'Coll3',
        'curve': 'CPP',
        'points': [-40, -16, 8, 41, 75],
    },
    'model21.yml': {
        'name': 'K110S',
        'inputs': {0: (70, 35), 1: (70, 35), 3: (80, 30)},
        'after': 'Pitch',
        'curve': 'CPP',
        'points': [-40, -15, 11, 43, 75],
    },
}
SOUND = 'ratlow,1,1x'

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None


def section(text: str, key: str) -> tuple[int, int]:
    """Where a top-level block's body sits: after its key's line, to the next top-level key."""
    found = re.search(rf'^{key}:\n', text, re.M)
    assert found, f'no {key}'
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, found.end())
    return found.end(), end.start() if end else len(text)


def entries(body: str) -> list[str]:
    """A list block's entries, each starting with its " -" line."""
    assert body.startswith(' -\n'), 'not a list block'
    return [' -\n' + part for part in body[3:].split('\n -\n')]


def join(parts: list[str]) -> str:
    return '\n'.join(part.rstrip('\n') for part in parts) + '\n'


def field(entry: str, key: str) -> str:
    found = re.search(rf'^   {key}: (.*)$', entry, re.M)
    assert found, f'no {key} in an entry'
    return found.group(1)


def curves(text: str) -> tuple[dict[str, int], int, int]:
    """Each named curve's index (from 0); the first index after every defined curve, and where its points start (each
    curve before it takes its values, 5 for one never set, a custom one its x values too)."""
    start, end = section(text, 'curves')
    found = {
        int(number): dict(re.findall(r'^      (\w+): (.*)$', body, re.M))
        for number, body in re.findall(r'^   (\d+):\n((?:      .*\n)*)', text[start:end], re.M)
    }
    named = {curve['name'].strip('"'): number for number, curve in found.items() if curve['name'].strip('"')}
    free = max(found) + 1
    offset = 0
    for number in range(free):
        curve = found.get(number, {'type': '0', 'points': '0'})
        count = int(curve['points']) + 5
        offset += count if curve['type'] == '0' else count * 2 - 2
    return named, free, offset


for filename, practice in PRACTICE.items():
    model = card / 'MODELS' / filename
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = re.sub(r' +\n', '\n', raw.replace('\r\n', '\n'))
    assert f'\n   name: "{practice["name"]}"\n' in text.split('\ntimers:')[0], f'{filename} is not the {practice["name"]}'
    if '   name: "Prac"\n' in text:
        print(f'{filename}: the practice rates on SD are already there')
        continue
    assert f'"{SWITCH}"' not in text, f'{filename} already uses {SWITCH}'

    # The inputs: a practice line before each one's usual line.
    start, end = section(text, 'expoData')
    lines = entries(text[start:end])
    for number, (weight, expo) in practice['inputs'].items():
        usual = next(index for index, line in enumerate(lines) if field(line, 'chn') == str(number))
        line = lines[usual]
        line = re.sub(r'^   weight: .*$', f'   weight: {weight}', line, count=1, flags=re.M)
        line = re.sub(r'^   swtch: .*$', f'   swtch: "{SWITCH}"', line, count=1, flags=re.M)
        line = re.sub(r'^   name: .*$', '   name: "Prac"', line, count=1, flags=re.M)
        if expo is not None:
            line, changed = re.subn(
                r'^   curve:\n      type: \d+\n      value: -?\d+\n',
                f'   curve:\n      type: 1\n      value: {expo}\n',
                line,
                count=1,
                flags=re.M,
            )
            assert changed == 1, f'{filename}: input {number} has no curve to set its expo in'
        lines.insert(usual, line)
    text = text[:start] + join(lines) + text[end:]

    # The M2 EVO's practice pitch curve, after its last curve, so no other curve's points move.
    named, free, offset = curves(text)
    if practice['points']:
        assert practice['curve'] not in named, f'{filename}: a {practice["curve"]} curve is already there'
        number = free
        start, end = section(text, 'curves')
        text = (
            text[:end]
            + f'   {number}:\n      type: 0\n      smooth: 0\n      points: 0\n      name: "{practice["curve"]}"\n'
            + text[end:]
        )
        start, end = section(text, 'points')
        taken = [int(index) for index in re.findall(r'^   (\d+):', text[start:end], re.M)]
        assert not taken or max(taken) < offset, f'{filename}: points already where the new curve goes'
        added = ''.join(
            f'   {offset + step}:\n      val: {value}\n' for step, value in enumerate(practice['points']) if value
        )
        text = text[:end] + added + text[end:]
        named, _, _ = curves(text)
    number = named[practice['curve']]

    # The practice pitch line, right after the one it comes after.
    start, end = section(text, 'mixData')
    mixes = entries(text[start:end])
    after = next(
        index
        for index, mix in enumerate(mixes)
        if field(mix, 'destCh') == '5' and field(mix, 'name') == f'"{practice["after"]}"'
    )
    line = mixes[after]
    line = re.sub(r'^   swtch: .*$', f'   swtch: "{SWITCH}"', line, count=1, flags=re.M)
    line = re.sub(r'^   name: .*$', '   name: "Prac"', line, count=1, flags=re.M)
    line = re.sub(r'^   mltpx: .*$', '   mltpx: REPL', line, count=1, flags=re.M)
    # Its curve, in place of the one it copied, or before its delays when that one had none.
    line = re.sub(r'^   curve:\n      type: \d+\n      value: -?\d+\n', '', line, count=1, flags=re.M)
    line, changed = re.subn(
        r'^   delayUp:', f'   curve:\n      type: 3\n      value: {number + 1}\n   delayUp:', line, count=1, flags=re.M
    )
    assert changed == 1, f'{filename}: the {practice["after"]} line has no delays to put its curve before'
    mixes.insert(after + 1, line)
    text = text[:start] + join(mixes) + text[end:]

    # "Low rates" when SD goes down.
    start, end = section(text, 'customFn')
    index = max(int(found) for found in re.findall(r'^   (\d+):', text[start:end], re.M)) + 1
    text = text[:end] + f'   {index}:\n      swtch: "{SWITCH}"\n      func: PLAY_TRACK\n      def: "{SOUND}"\n' + text[end:]

    # The lines that had a space after their key keep it (the radio's way, which the scripts run before this one on the
    # radio look for), the new ones like them too.
    spaced = {line.rstrip(' ') for line in raw.replace('\r\n', '\n').split('\n') if line.endswith(': ')}
    text = '\n'.join(f'{line} ' if line in spaced else line for line in text.split('\n'))

    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / filename)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{filename}: practice rates on SD down (cyclic, rudder, pitch curve {practice["curve"]}), "low rates" said')
