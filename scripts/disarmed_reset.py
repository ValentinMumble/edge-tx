"""Keeps the mAh count and timer 1 through a telemetry dropout in flight: each heli model reset both whenever telemetry
stopped (special functions 1 and 2 on "!Telem"), so a few seconds without telemetry in the air (it happened on 28 April
2023) started the pack's count again. They now reset only when telemetry stops while disarmed, as when a pack is
unplugged: a new logical switch L16 = AND(!Telem, L5), L5 being "SA not up" (disarmed), drives both.

For every model with those two resets and that L5. Backs the files up first. Usage: disarmed_reset.py <card folder>
[<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None

RESETS = ('      swtch: "!TELEMETRY_STREAMING"\n      func: RESET\n', '      swtch: "L16"\n      func: RESET\n')
DISARMED = '   4:\n      func: FUNC_VPOS\n      def: "SA,-1"\n'
NEW = 15  # L16


def switches_of(text: str) -> str:
    start = text.index('logicalSw: \n')
    return text[start:text.index('customFn: \n', start)]


changed = []
for model in sorted((card / 'MODELS').glob('model*.yml')):
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    if text.count(RESETS[0]) != 2 or 'logicalSw: \n' not in text:
        continue
    switches = switches_of(text)
    assert DISARMED in switches, f'{model.name}: L5 is not "SA not up"'
    assert not re.search(rf'^   {NEW}:$', switches, re.M), f'{model.name}: L16 is already used'
    assert max(int(index) for index in re.findall(r'^   (\d+):$', switches, re.M)) < NEW
    # L16 written as the file writes L14 (an AND of two switches), only its operands changed.
    and_switch = re.search(r'^   13:\n((?:      .*\n)+)', switches, re.M)
    assert and_switch and '      func: FUNC_AND\n      def: "L4,L5"\n' in and_switch.group(1), f'{model.name}: L14 changed'
    fields = and_switch.group(1).replace('      def: "L4,L5"\n', '      def: "!TELEMETRY_STREAMING,L5"\n')
    updated = text.replace('customFn: \n', f'   {NEW}:\n{fields}customFn: \n', 1).replace(*RESETS)
    assert updated.count('customFn: \n') == 1 and updated.count('swtch: "L16"') == 2
    if backup:
        folder = backup / 'MODELS'
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, folder / model.name)
    model.write_bytes(updated.replace('\n', newline).encode('utf-8'))
    changed.append(f'{model.name}: L16 = telemetry lost and disarmed, resets the mAh count and timer 1')

print('\n'.join(changed) if changed else 'Nothing to change')
