"""Lowers the practice rates (SG down, practice_rates.py) on the M2 EVO (model20.yml) and the K110S (model21.yml): the
cyclic to 55 % (from 70 %) and the rudder to 65 % (from 80 %), their "Prac" input lines' weights; their expo and the
gentler pitch curve CPP stay. Asked on 24 Nov 2026: the practice rates could be lower. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the files up first.
Usage: practice_lower.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
# Input (chn, from 0): (weight before, weight now). Aileron, elevator, rudder.
WEIGHTS = {0: (70, 55), 1: (70, 55), 3: (80, 65)}

for name in ['model20.yml', 'model21.yml']:
    model = card / 'MODELS' / name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    block = re.search(r'^expoData: *\n((?: .*\n)*)', text, re.M)
    assert block, f'{name}: no input lines'
    entries = re.findall(r'^ -\n(?:   .*\n|      .*\n)*', block.group(1), re.M)
    practice = {}
    for entry in entries:
        if not re.search(r'^   name: "Prac" *$', entry, re.M):
            continue
        channel = int(re.search(r'^   chn: (\d+) *$', entry, re.M).group(1))
        weight = int(re.search(r'^   weight: (-?\d+) *$', entry, re.M).group(1))
        practice[channel] = (entry, weight)
    assert set(practice) == set(WEIGHTS), f'{name}: the practice lines are not on inputs {sorted(WEIGHTS)}'
    if all(practice[channel][1] == now for channel, (_, now) in WEIGHTS.items()):
        print(f'{name}: the practice rates are already 55 % cyclic, 65 % rudder')
        continue
    body = block.group(1)
    for channel, (before, now) in WEIGHTS.items():
        entry, weight = practice[channel]
        assert weight == before, f'{name}: practice input {channel} is at {weight} %, not the {before} % expected'
        assert body.count(entry) == 1, f'{name}: practice input {channel} is not one of a kind'
        body = body.replace(entry, re.sub(r'^   weight: -?\d+( *)$', rf'   weight: {now}\1', entry, count=1, flags=re.M), 1)
    text = text[: block.start(1)] + body + text[block.end(1) :]
    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{name}: practice rates lower, cyclic 55 %, rudder 65 %')
