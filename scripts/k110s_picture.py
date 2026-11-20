"""Gives the K110S's picture (IMAGES/K110S.png, the one its model and the radio's list of models name) the M2 EVO's
look: the heli cut out on a transparent background and framed close, as M2_EVO_o.png is, so the dark picture box of
the cockpit's data plate shows around it. The radio's picture pack has the K110S that way already, K110Sclos.png; the
old K110S.png was a product photo on white, whose white blades and the white between its skids a cut by colour cannot
tell from the paper. Copies the repo's K110Sclos.png over the card's K110S.png. Skips a card where it is there already
(deploy.sh runs every script on the radio each time). Backs the old picture up first.
Usage: k110s_picture.py <card folder> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
source = Path(__file__).resolve().parent.parent / 'sd-card' / 'IMAGES' / 'K110Sclos.png'
picture = card / 'IMAGES' / 'K110S.png'
assert source.exists(), f'no {source}'

if picture.exists() and picture.read_bytes() == source.read_bytes():
    print(f'{picture}: the cut-out K110S already')
    sys.exit(0)

if picture.exists() and len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(picture, backup / picture.name)
# Written into the file that is there, so it keeps the permissions it came off the radio with.
picture.write_bytes(source.read_bytes())
print(f'{picture}: the cut-out K110S (K110Sclos.png), framed as the M2 EVO')
