"""Stops showing each model's pre-flight checklist when it loads (at start-up too): displayChecklist and
checklistInteractive off in model20.yml (M2 EVO) and model21.yml (K110S), turned on by checklists.py. The lists stay on
the card (MODELS/M2_EVO.txt and K110S.txt) as the models' notes. Skips what is done already (deploy.sh runs every script
on the radio each time). Backs the files up first.
Usage: checklists_off.py <card folder> [<backup folder>]"""
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
    changed = text
    for key in ['displayChecklist', 'checklistInteractive']:
        assert len(re.findall(rf'^{key}: [01] *$', text, re.M)) == 1, f'{name}: no single {key}'
        changed = re.sub(rf'^{key}: 1( *)$', rf'{key}: 0\1', changed, flags=re.M)
    if changed == text:
        print(f'{name}: its checklist already stays shut when it loads')
        continue
    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(changed.replace('\n', newline).encode('utf-8'))
    print(f'{name}: its checklist no longer shows when it loads')
