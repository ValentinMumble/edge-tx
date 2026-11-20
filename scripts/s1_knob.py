"""Makes S1 a head speed knob in every idle up of the M2 EVO (model20.yml): its mix on the motor channel (CH3),
"Lower", took 0 to 30% off idle up 1 only (S1 left to right) and becomes two lines with nothing at the middle, added to
the curve SE picks: "S1", -20% to +20% in idle ups 1 and 2 (weight 20, not on L3), and "S1 IU3", -10% to +10% in idle
up 3 (weight 10, on L3), so idle up 3 (50) tops out at +60, OMPHobby's highest throttle for the M2 EVO (Idle 2, 80 on
Futaba's 0 to 100 scale). Hold and disarm still cut the motor: the mix line that does it ("Motor0", on L10) comes after
and replaces them. A start warning (EdgeTX's pots warning, set by hand to the middle) then asks for S1 at the middle
when the model loads, so a flight never starts on a head speed left over from the last one. EdgeTX warns when S1 is
more than about 2% off the middle. The top bar's FMStatus gets S1 as its S1Source (option 4), to show what S1 adds
under the idle up. Skips a model already changed (deploy.sh runs every script on the radio each time). Backs the file
up first.
Usage: s1_knob.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

LOWER = (
    '   srcRaw: "P1"\n   carryTrim: 0\n   mixWarn: 0\n   mltpx: ADD\n   delayPrec: 0\n   speedPrec: 0\n'
    '   flightModes: 000000000\n   weight: -15\n   offset: -15\n   swtch: "L1"\n   delayUp: 0\n   delayDown: 0\n'
    '   speedUp: 0\n   speedDown: 0\n   name: "Lower"\n'
)
SPELL = '   weight: -15\n   offset: -15\n   swtch: "L1"\n'
KNOB = (
    LOWER.replace(SPELL, '   weight: 20\n   offset: 0\n   swtch: "!L3"\n').replace('"Lower"', '"S1"')
    + ' -\n   destCh: 2\n'
    + LOWER.replace(SPELL, '   weight: 10\n   offset: 0\n   swtch: "L3"\n').replace('"Lower"', '"S1 IU3"')
)
WARNING = 'potsWarnMode: WARN_MANUAL\n'
# S1's warning on, at the middle: the radio writes the position back without the 0 (its default), so on is enough
# unless a position other than 0 is written.
CENTRE = 'potsWarnEnabled: 1\npotsWarnPosition: \n   0:\n      val: 0\n'
centred = 'potsWarnEnabled: 1\n' in text and not re.search(r'potsWarnPosition: \n   0:\n      val: -?[1-9]', text)
GYRO = (
    '         widgetName: "FMStatus"\n         widgetData: \n            options: \n'
    '               0:\n                  type: Source\n                  value: \n                     source: SE\n'
    '               1:\n                  type: Source\n                  value: \n                     source: ch(4)\n'
)
S1_OPTION = '               3:\n                  type: Source\n                  value: \n                     source: P1\n'
# Its LowSource (option 3), as the radio writes it back when unset, between the gyro and S1.
UNSET_LOW = '               2:\n                  type: Source\n                  value: \n                     source: NONE\n'


def top_bar_status(text: str) -> tuple[int, int]:
    """Where the top bar's FMStatus widget sits in the model: from its name to the next widget."""
    name = '         widgetName: "FMStatus"\n'
    start = text.index(name)
    end = text.find('widgetName:', start + len(name))
    return start, end if end > 0 else len(text)


start, end = top_bar_status(text)
shown = 'source: P1\n' in text[start:end]

if KNOB in text and WARNING in text and centred and shown:
    print(f'{model}: S1 is already a knob of -20 to +20% (10 in idle up 3), with its start warning')
    sys.exit(0)
if KNOB not in text:
    assert text.count(LOWER) == 1, 'the "Lower" mix on S1 is not as six_pos.py left it'
    text = text.replace(LOWER, KNOB, 1)
if WARNING not in text:
    assert text.count('potsWarnMode: WARN_OFF\n') == 1, 'no pots warning mode to set'
    text = text.replace('potsWarnMode: WARN_OFF\n', WARNING, 1)
if not centred:
    assert text.count('potsWarnEnabled: 0\n') == 1 and 'potsWarnPosition:' not in text, 'pots warning already set'
    text = text.replace('potsWarnEnabled: 0\n', CENTRE, 1)
if not shown:
    assert text.count(GYRO) == 1, "the top bar's FMStatus is not as cockpit_screen.py left it"
    after = GYRO + UNSET_LOW if GYRO + UNSET_LOW in text else GYRO
    text = text.replace(after, after + S1_OPTION, 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: S1 is a knob of -20 to +20% (10 in idle up 3), and the model asks for it at the middle at start')
