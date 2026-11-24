"""Sends SA and SF to Flightdown's sim on the M2 EVO (model20.yml) and the K110S (model21.yml): CH10 is +100 % while
SA arms (down) and -100 % otherwise, CH11 +100 % while SF is up (throttle on) and -100 % in hold. Plugged in as a USB
joystick (Classic), the radio sends CH1 to CH8 as axes and CH9 to CH32 as buttons, pressed above 0: the sim reads SA
and SF from buttons 2 and 3, where the motor's channel (both cut it) could not tell them apart. The K110S's S-FHSS link
carries 8 channels, so these never reach it; the M2 EVO's receiver gets them over SBUS, its flybarless unit using only
the first channels. Skips a model already changed (deploy.sh runs every script on the radio each time). Backs the
files up first.
Usage: sim_switches.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
# Channel (from 0): its switch on, and the names of its two lines (EdgeTX keeps 6 letters).
CHANNELS = [(9, 'SA2', 'SA', 'SA arm'), (10, 'SF0', 'SF', 'SF on')]


def line(channel: int, weight: int, how: str, switch: str, name: str) -> str:
    return (
        f' -\n   destCh: {channel}\n   srcRaw: "MAX"\n   carryTrim: 0\n   mixWarn: 0\n   mltpx: {how}\n'
        f'   delayPrec: 0\n   speedPrec: 0\n   flightModes: 000000000\n   weight: {weight}\n   offset: 0\n'
        f'   swtch: "{switch}"\n   delayUp: 0\n   delayDown: 0\n   speedUp: 0\n   speedDown: 0\n   name: "{name}"\n'
    )


for model_name in ['model20.yml', 'model21.yml']:
    model = card / 'MODELS' / model_name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    lines = ''.join(
        line(channel, -100, 'ADD', 'NONE', base) + line(channel, 100, 'REPL', switch, on)
        for channel, switch, base, on in CHANNELS
    )
    if lines in text:
        print(f'{model_name}: SA and SF already go to the sim on CH10 and CH11')
        continue
    used = {int(number) for number in re.findall(r'^   destCh: (\d+) *$', text, re.M)}
    assert not used & {channel for channel, _, _, _ in CHANNELS}, f'{model_name}: CH10 or CH11 is already used'
    block = re.search(r'^mixData: *\n((?: .*\n)*)', text, re.M)
    assert block, f'{model_name}: no mix lines'
    text = text[: block.end(1)] + lines + text[block.end(1) :]
    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / model_name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{model_name}: SA on CH10, SF on CH11, for the sim')
