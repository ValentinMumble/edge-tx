"""Moves the practice rates (practice_rates.py) from SD down to SG down on the M2 EVO (model20.yml) and the K110S
(model21.yml): SG is easier to reach, and no model used it. Their three input lines (aileron, elevator, rudder), the
pitch line on CH6 and the "low rates" sound, each on "SD2", go to "SG2"; SD is free again. Skips a model already
changed (deploy.sh runs every script on the radio each time). Backs the files up first.
Usage: practice_on_sg.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
LINES = 5

for name in ['model20.yml', 'model21.yml']:
    model = card / 'MODELS' / name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    if '"SD2"' not in text and text.count('"SG2"') == LINES:
        print(f'{name}: the practice rates are already on SG')
        continue
    assert text.count('"SD2"') == LINES, f'{name}: not the {LINES} practice lines on SD2 this script expects'
    assert not re.search(r'"!?SG[0-2]"', text), f'{name}: SG is already used'
    text = text.replace('"SD2"', '"SG2"')
    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{name}: the practice rates on SG down, SD free')
