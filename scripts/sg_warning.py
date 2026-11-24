"""Adds SG to the start-up switch check of the M2 EVO (model20.yml) and the K110S (model21.yml): the radio wants it up
(practice rates off) when the model loads, as it wants SA safe, SC up, SE up and SF on hold. On 24 Nov 2026 a K110S
pack was flown on practice rates from the start, SG left down. Skips a model already changed (deploy.sh runs every
script on the radio each time). Backs the files up first.
Usage: sg_warning.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None

for name in ['model20.yml', 'model21.yml']:
    model = card / 'MODELS' / name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    check = re.search(r'^switchWarning: *\n((?:   .*\n)*)', text, re.M)
    assert check, f'{name}: no start-up switch check'
    if re.search(r'^   SG: *$', check.group(1), re.M):
        print(f'{name}: SG is already checked at start-up')
        continue
    last = re.search(r'^   SF: *\n      pos: \w+ *\n', check.group(1), re.M)
    assert last and check.group(1).endswith(last.group(0)), f'{name}: SF is not the last switch checked'
    text = text[: check.end(1)] + '   SG:\n      pos: up\n' + text[check.end(1) :]
    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{name}: SG wanted up at start-up')
