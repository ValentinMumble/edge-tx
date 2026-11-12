"""Adds to the M2 EVO model (model20.yml): "armed" and "disarmed" sounds on SA, and a second screen with the six new
widgets on a 2 x 3 layout (top bar on, no sliders, trims or flight mode, so each zone is 240 x 75):

    left:  FlyTimer, FlightState, Session      right: Pack, Power, Link

Backs the file up first. Usage: m2evo_screen.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

# The sounds: after the last special function, in the next free slots.
functions = text[text.index('customFn: \n'):text.index('flightModeData: \n')]
assert '"SA0"' not in functions and '"!SA0"' not in functions, 'SA already has special functions'
used = [int(index) for index in re.findall(r'^   (\d+):$', functions, re.M)]
first = max(used) + 1
sounds = f'''   {first}:
      swtch: "SA0"
      func: PLAY_TRACK
      def: "armed,1,1x"
   {first + 1}:
      swtch: "!SA0"
      func: PLAY_TRACK
      def: "disarm,1,1x"
'''
assert text.count('flightModeData: \n') == 1
text = text.replace('flightModeData: \n', sounds + 'flightModeData: \n')

# The screen: the second one, before the top bar's data.
screens = text[text.index('screenData: \n'):text.index('topbarData: \n')]
assert not re.search(r'^   1:$', screens, re.M), 'the model already has a second screen'


def source(index: int, name: str) -> str:
    return f'''                     {index}:
                        type: Source
                        value:
                           source: {name}
'''


def flag(index: int, on: bool) -> str:
    return f'''            {index}:
               type: Bool
               value:
                  boolValue: {1 if on else 0}
'''


zones = {
    0: ('FlyTimer', '''                     0:
                        type: Signed
                        value:
                           signedValue: 272
'''),
    1: ('FlightState', source(0, 'SC') + source(1, 'SF')),
    2: ('Session', ''),
    3: ('Power', '''                     0:
                        type: Signed
                        value:
                           signedValue: 40
'''),
    4: ('Link', ''),
    5: ('Pack', ''),
}
screen = '''   1:
      LayoutId: Layout2x3
      layoutData:
         zones:
'''
for index, (widget, options) in zones.items():
    screen += f'''            {index}:
               widgetName: "{widget}"
               widgetData:
                  options:
{options}'''
screen += '''         options:
''' + flag(0, True) + flag(1, False) + flag(2, False) + flag(3, False) + flag(4, False)
assert text.count('topbarData: \n') == 1
text = text.replace('topbarData: \n', screen + 'topbarData: \n')

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: SA sounds as special functions SF{first + 1} and SF{first + 2}, second screen with six widgets')
