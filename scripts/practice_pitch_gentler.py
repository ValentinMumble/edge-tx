"""Makes the practice pitch curve CPP (practice_rates.py) gentler on the M2 EVO (model20.yml) and the K110S
(model21.yml): each point 25 % closer to the pitch the heli hovers at, so the collective gives 25 % less pitch per bit
of stick, and flipping SG in a hover still does not move it. The M2 EVO hovers at 66 % stick, the K110S at 65 % (as
practice_rates.py took them): about 29 and 30 on the curve. Asked on 25 Nov 2026, as the cyclic and rudder were
lowered the day before (practice_lower.py). Skips a model already changed (deploy.sh runs every script on the radio
each time). Backs the files up first.
Usage: practice_pitch_gentler.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
# Model: (points before, points now), at stick -100, -50, 0, 50 and 100.
CHANGES = {
    'model20.yml': ([-40, -16, 8, 41, 75], [-23, -5, 13, 38, 63]),
    'model21.yml': ([-40, -15, 11, 43, 75], [-22, -4, 16, 40, 64]),
}


def section(text: str, key: str) -> tuple[int, int]:
    """Where a top-level block's body sits: after its key's line, to the next top-level key."""
    found = re.search(rf'^{key}: *\n', text, re.M)
    assert found, f'no {key}'
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, found.end())
    return found.end(), end.start() if end else len(text)


for name, (old, new) in CHANGES.items():
    model = card / 'MODELS' / name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')

    # Where CPP's points start: each curve before it takes its values, 5 for one never set, a custom one its x too.
    start, end = section(text, 'curves')
    curves = {
        int(number): dict(re.findall(r'^      (\w+): *(.*?) *$', body, re.M))
        for number, body in re.findall(r'^   (\d+): *\n((?:      .*\n)*)', text[start:end], re.M)
    }
    first = None
    offset = 0
    for number in range(max(curves) + 1):
        curve = curves.get(number, {'type': '0', 'points': '0', 'name': '""'})
        count = int(curve['points']) + 5
        if curve['name'].strip('"') == 'CPP':
            assert curve['type'] == '0' and count == 5, f'{name}: CPP is not a standard curve of 5 points'
            first = offset
        offset += count if curve['type'] == '0' else count * 2 - 2
    assert first is not None, f'{name}: no CPP curve'

    start, end = section(text, 'points')
    block = text[start:end]
    entries = re.findall(r'^   (\d+): *\n      val: (-?\d+) *\n', block, re.M)
    assert len(entries) == block.count('val:'), f'{name}: a point the script cannot read'
    points = {int(index): int(value) for index, value in entries}
    now = [points.get(first + step, 0) for step in range(5)]
    if now == new:
        print(f'{name}: CPP is already gentler')
        continue
    assert now == old, f'{name}: CPP is {now}, not the {old} this script expects'
    for step, value in enumerate(new):
        points[first + step] = value
    listing = ''.join(f'   {index}:\n      val: {value}\n' for index, value in sorted(points.items()) if value != 0)
    text = text[:start] + listing + text[end:]

    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{name}: CPP {now} → {new}, 25 % less pitch per bit of stick')
