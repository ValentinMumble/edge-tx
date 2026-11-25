"""Says "low rates" when arming on practice rates, on the M2 EVO (model20.yml) and the K110S (model21.yml): on 24 Nov 2026
a pack was flown on practice rates by mistake, SG left down from the pack before (the start-up check, sg_warning.py,
only runs when the model loads, not between packs). A new logical switch is on while SA is armed (down) and SG is down,
and the "low rates" sound (practice_rates.py) plays when it comes on, where it played when SG went down: so once when
arming with SG down, or when flipping SG down while armed; nothing on the bench, disarmed. The logical switch goes after
the model's last one. Skips a model already changed (deploy.sh runs every script on the radio each time). Backs the files
up first.
Usage: practice_arm_warning.py <card folder> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
CONDITION = 'SA2,SG2'

for name in ['model20.yml', 'model21.yml']:
    model = card / 'MODELS' / name
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')

    switches = re.search(r'^logicalSw: *\n((?:   .*\n)*)', text, re.M)
    functions = re.search(r'^customFn: *\n((?:   .*\n)*)', text, re.M)
    assert switches and functions, f'{name}: no logical switches or special functions'
    sound = re.search(r'^   (\d+): *\n      swtch: "([^"]*)" *\n      func: PLAY_TRACK *\n      def: "ratlow,1,1x" *\n', functions.group(1), re.M)
    assert sound, f'{name}: no "low rates" sound'

    # practice_sg_up.py later puts it on SG up.
    found = re.search(
        rf'^   (\d+): *\n      func: FUNC_AND *\n      def: "(?:{CONDITION}|SA2,SG0)" *\n', switches.group(1), re.M
    )
    if found and sound.group(2) == f'L{int(found.group(1)) + 1}':
        print(f'{name}: "low rates" is already said on arming with practice rates')
        continue
    assert not found and sound.group(2) == 'SG2', f'{name}: the "low rates" sound is not on SG2 as practice_on_sg.py left it'

    index = max(int(number) for number in re.findall(r'^   (\d+): *$', switches.group(1), re.M)) + 1
    label = f'L{index + 1}'
    assert not re.search(rf'"!?{label}"', text), f'{name}: {label} is already used somewhere'
    entry = (
        f'   {index}:\n      func: FUNC_AND\n      def: "{CONDITION}"\n      andsw: "NONE"\n      lsPersist: 0\n'
        '      lsState: 0\n      delay: 0\n      duration: 0\n'
    )
    # The sound first (it sits after the logical switches), then the switch, so the first change keeps its place.
    start = functions.start(1) + sound.start()
    old = sound.group(0)
    text = text[:start] + old.replace('      swtch: "SG2"', f'      swtch: "{label}"', 1) + text[start + len(old) :]
    text = text[: switches.end(1)] + entry + text[switches.end(1) :]

    if backup:
        (backup / 'MODELS').mkdir(parents=True, exist_ok=True)
        shutil.copy2(model, backup / 'MODELS' / name)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    print(f'{name}: "low rates" said on arming with practice rates ({label}: SA armed and SG down)')
