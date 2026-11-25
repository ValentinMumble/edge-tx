"""Puts the practice rates on SG up (from SG down, practice_on_sg.py) on the M2 EVO (model20.yml) and the K110S
(model21.yml): flipping SG back down to land is easier. Their three input lines (aileron, elevator, rudder), the pitch
line on CH6 and the logical switch that says "low rates" on arming (practice_arm_warning.py), each on "SG2", go to
"SG0"; the start-up check (sg_warning.py) now wants SG down. Asked on 25 Nov 2026. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the files up first.
Usage: practice_sg_up.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
# Three input lines and the pitch line, each a "swtch:", and the logical switch's "def:".
LINES = 4

for name in ['model20.yml', 'model21.yml']:
    model = card / 'MODELS' / name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    if '"SG2"' not in text and '"SA2,SG2"' not in text:
        assert text.count('   swtch: "SG0"') == LINES, f'{name}: no SG2 left, but not the {LINES} SG0 lines expected'
        print(f'{name}: the practice rates are already on SG up')
        continue
    lines = len(re.findall(r'^   swtch: "SG2" *$', text, re.M))
    assert lines == LINES, f'{name}: {lines} lines on SG2, not the {LINES} expected'
    assert text.count('"SG0"') == 0, f'{name}: SG up already does something'
    text = re.sub(r'^(   swtch: )"SG2"( *)$', r'\1"SG0"\2', text, flags=re.M)
    text, changed = re.subn(r'^(      def: )"SA2,SG2"( *)$', r'\1"SA2,SG0"\2', text, flags=re.M)
    assert changed == 1, f'{name}: no "low rates" logical switch on SA2 and SG2'
    text, changed = re.subn(r'^(   SG: *\n      pos: )up( *)$', r'\1down\2', text, flags=re.M)
    assert changed == 1, f'{name}: SG is not in the start-up check, wanted up'
    assert 'SG2' not in text, f'{name}: SG2 still used somewhere'
    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{name}: practice rates on SG up, SG wanted down at start-up')
