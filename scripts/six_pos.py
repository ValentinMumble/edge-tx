"""Frees the 6-position buttons, so they only say which pack is plugged in:

- the "Lower" mix of each model (in idle up 1 it takes 0 to 30% off the throttle) reads the S1 knob instead of the
  buttons, with the same weight and offset: S1 all the way left is button 1 (nothing taken off), all the way right is
  button 6 (30% off);
- the radio's two global functions that only ran on button 1 (S2 sets the volume, RS the backlight) are always on.
  radio.yml carries a checksum the radio checks when it starts, so it is computed again (EdgeTX's crc16: CCITT, from
  0xFFFF, over everything after the checksum line).

Backs every file up first. Usage: six_pos.py <card folder> [<backup folder>]"""
import binascii
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None

# The buttons and S1 as each file format names them: EdgeTX 2.12 writes P2 and P1, 2.8 wrote 6POS and S1.
SOURCES = {'   srcRaw: "P2"\n': '   srcRaw: "P1"\n', '   srcRaw: 6POS\n': '   srcRaw: S1\n'}


def read(path: Path) -> tuple[str, str]:
    raw = path.read_bytes().decode('utf-8')
    return raw.replace('\r\n', '\n'), '\r\n' if '\r\n' in raw else '\n'


def write(path: Path, text: str, newline: str) -> None:
    if backup:
        folder = backup / path.parent.name
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, folder / path.name)
    data = text.replace('\n', newline).encode('utf-8')
    if data.startswith(b'checksum: '):
        first, rest = data.split(b'\n', 1)
        old = first.rstrip(b'\r')
        data = f'checksum: {binascii.crc_hqx(rest, 0xFFFF)}'.encode() + first[len(old):] + b'\n' + rest
    path.write_bytes(data)


def lower_mix(text: str) -> tuple[str, str] | None:
    """The line that makes "Lower" read the buttons, and the same line reading S1."""
    for old, new in SOURCES.items():
        start = 0
        while (at := text.find(old, start)) >= 0:
            start = at + len(old)
            # The mix's own fields run to the next list item: its name must be "Lower", switched by L1.
            end = text.find('\n -\n', at)
            fields = text[at:end + 1 if end >= 0 else len(text)]
            if '   name: "Lower"\n' in fields and '   swtch: "L1"\n' in fields:
                return old, new
    return None


changed = []
for model in sorted((card / 'MODELS').glob('model*.yml')):
    text, newline = read(model)
    found = lower_mix(text)
    if not found:
        continue
    old, new = found
    assert text.count(old) == 1, f'{model.name}: more than one mix reads the buttons, change it by hand'
    updated = text.replace(old, new)
    assert updated.count(new) == text.count(new) + 1 and len(updated.splitlines()) == len(text.splitlines())
    write(model, updated, newline)
    changed.append(f'{model.name}: "Lower" reads S1')

radio = card / 'RADIO' / 'radio.yml'
text, newline = read(radio) if radio.exists() else ('', '\n')
updated = text
for function in ('VOLUME', 'BACKLIGHT'):
    old = f'      swtch: "6P10"\n      func: {function}\n'
    if old in updated:
        assert updated.count(old) == 1, f'radio.yml: more than one {function} on button 1'
        updated = updated.replace(old, f'      swtch: "ON"\n      func: {function}\n')
        changed.append(f'radio.yml: {function.lower()} always on')
# The update to 2.12.5 left the buttons (P2) set up as a slider, so they barely move and the widgets read one pack
# whatever is pressed: EdgeTX 2.12.5 calls a 6-position switch "multipos_switch".
slider = '   P2:\n      type: slider\n'
if slider in updated:
    assert updated.count(slider) == 1, 'radio.yml: P2 set up more than once'
    updated = updated.replace(slider, '   P2:\n      type: multipos_switch\n')
    changed.append('radio.yml: the 6-position buttons are a 6-position switch again')
if updated != text:
    assert len(updated.splitlines()) == len(text.splitlines())
    write(radio, updated, newline)

print('\n'.join(changed) if changed else 'Nothing to change: the buttons are already free')
