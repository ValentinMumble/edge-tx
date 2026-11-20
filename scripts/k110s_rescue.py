"""Gives the K110S a rescue on SH (model21.yml), built as the M2 EVO's is: its controller has no rescue of its own, but
6G levels it. While SH is held (L9), CH5 goes to 6G whatever SC says ("Rescue"), and the pitch (CH6) goes flat at once
("Flat", so it rights itself without climbing or diving), then to +60 % after 0.1 s ("Climb", the M2's idle up 2
value, to tune). Let go, and SC and the stick have it back. The radio writes the file with a space after a key that
opens a block, the repo without: both are read, and it is written back without them (EdgeTX reads both). Skips a
model already changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_rescue.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = re.sub(r' +\n', '\n', raw.replace('\r\n', '\n'))
assert '   name: "K110S"\n' in text, 'not the K110S model'

HELD = '   8:\n      func: FUNC_VPOS\n      def: "SH,0"\n      andsw: "NONE"\n      lsPersist: 0\n      lsState: 0\n      delay: 0\n      duration: 0\n'


def line(channel: int, weight: int, name: str, delay: int = 0) -> str:
    """A mix line from MAX (a fixed value) on L9, replacing what is above it."""
    return (
        f' -\n   destCh: {channel}\n   srcRaw: "MAX"\n   carryTrim: 0\n   mixWarn: 0\n   mltpx: REPL\n   delayPrec: 0\n'
        f'   speedPrec: 0\n   flightModes: 000000000\n   weight: {weight}\n   offset: 0\n   swtch: "L9"\n'
        f'   delayUp: {delay}\n   delayDown: 0\n   speedUp: 0\n   speedDown: 0\n   name: "{name}"\n'
    )


RESCUE = line(4, 100, 'Rescue')
FLAT = line(5, 0, 'Flat')
CLIMB = line(5, 60, 'Climb', delay=1)

if HELD in text and RESCUE in text and FLAT + CLIMB in text:
    print(f'{model}: the rescue on SH is already there')
    sys.exit(0)
assert '\n   name: "Rescue"\n' not in text and '\n   8:\n      func:' not in text.split('\ncustomFn:')[0], (
    'L9 or a Rescue line is already there, not as this script makes them'
)


def entry_end(name: str) -> int:
    """Where the mix line of this name ends: just after its name."""
    found = re.search(rf'^   name: "{name}"\n', text, re.M)
    assert found, f'no {name} mix line'
    return found.end()


# CH5's rescue after its 6G line, CH6's flat then climb after its last pitch line (PitLow, in Low RPM).
at = entry_end('6G')
text = text[:at] + RESCUE + text[at:]
at = entry_end('PitLow')
text = text[:at] + FLAT + CLIMB + text[at:]

# L9 (index 8) in the logical switches, before L10 (index 9).
found = re.search(r'^logicalSw:\n', text, re.M)
assert found, 'no logical switches'
ten = text.index('\n   9:\n      func:', found.end())
text = text[: ten + 1] + HELD + text[ten + 1 :]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: SH held is a rescue: 6G, the pitch flat, then +60 % after 0.1 s')
