import sys, dataclasses, time
from psd_tools import PSDImage
from psd_tools.psd.parse_limits import ParseLimits
L = dataclasses.replace(ParseLimits(), max_objects=10**9)
psd = PSDImage.open(sys.argv[1], parse_limits=L)
want = {int(a.split('=')[0]): a.split('=')[1] for a in sys.argv[2:]}
for i, l in enumerate(psd):
    if i not in want: continue
    t = time.time()
    try:
        im = l.composite(viewport=psd.viewbox)
        im.save(f'out/{want[i]}.png'); print(want[i], im.size, im.mode, f'{time.time()-t:.1f}s', flush=True)
    except Exception as e: print(want[i], 'FOUT', e, flush=True)
