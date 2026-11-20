"""Turns on the radio's inactivity alarm (radio.yml): it sounds when no stick or switch has moved for 10 minutes, so a
radio left on (in the pits, or on USB) does not drain its battery. It was off (0). radio.yml carries a checksum the
radio checks when it starts, so it is computed again (EdgeTX's crc16: CCITT, from 0xFFFF, over everything after the
checksum line). Skips it when already on. Backs radio.yml up first.
Usage: inactivity_alarm.py <card folder> [<backup folder>]"""
import binascii
import re
import shutil
import sys
from pathlib import Path

MINUTES = 10

card = Path(sys.argv[1])
radio = card / 'RADIO' / 'radio.yml'
data = radio.read_bytes()
found = re.search(rb'^inactivityTimer: (\d+)', data, re.M)
assert found and len(re.findall(rb'^inactivityTimer:', data, re.M)) == 1, 'no single inactivityTimer in radio.yml'
if int(found.group(1)) > 0:
    print(f'radio.yml: the inactivity alarm is already on ({int(found.group(1))} minutes)')
    sys.exit(0)

data = data[: found.start(1)] + str(MINUTES).encode() + data[found.end(1) :]
first, rest = data.split(b'\n', 1)
assert first.startswith(b'checksum: '), 'radio.yml does not start with its checksum'
ending = first[len(first.rstrip(b'\r')) :]
if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    (backup / 'RADIO').mkdir(parents=True, exist_ok=True)
    shutil.copy2(radio, backup / 'RADIO' / radio.name)
radio.write_bytes(f'checksum: {binascii.crc_hqx(rest, 0xFFFF)}'.encode() + ending + b'\n' + rest)
print(f'radio.yml: the inactivity alarm sounds after {MINUTES} minutes untouched')
