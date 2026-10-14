import sys, dataclasses, time
from PIL import Image
import scale_psd
from psd_tools import PSDImage
from psd_tools.psd.parse_limits import ParseLimits
L = dataclasses.replace(ParseLimits(), max_objects=10**9)
psd = PSDImage.open(sys.argv[1], parse_limits=L)
top = list(psd)
vb = psd.viewbox
def comp(layers, name):
    t = time.time()
    # zet alles uit behalve de gevraagde lagen (en hun ouders), composite het hele document
    keep = set(id(l) for l in layers)
    def anc_ok(l):
        p = l
        while p is not None and p is not psd:
            if id(p) in keep: return True
            p = p.parent
        return False
    saved = {}
    for l in psd.descendants():
        saved[id(l)] = l.visible
    for l in psd.descendants():
        inside = anc_ok(l)
        is_ancestor = any(anc is l for x in layers for anc in iter_parents(x))
        l.visible = saved[id(l)] and (inside or is_ancestor)
    im = psd.composite(force=True, ignore_preview=True)
    for l in psd.descendants(): l.visible = saved[id(l)]
    im.save(f'out3/{name}.png'); print(name, im.getbbox(), f'{time.time()-t:.0f}s', flush=True)
def iter_parents(l):
    p = l.parent
    while p is not None and p is not psd:
        yield p; p = p.parent
wm = top[16]; kids = list(wm)
body = [k for k in kids if k.name == 'Body']
hub = [k for k in kids if k.is_group() and k.name == '<Group>']
sails = [k for k in kids if k.name == '<Compound Path>']
roof = [k for k in kids if k.name in ('<Polygon>', 'Layer 4350', 'Layer 4351')]
hub = hub + [k for k in kids if k.name == '<Ellipse>']
print('windmill kids:', [(k.name, k.bbox) for k in kids], flush=True)
jobs = {
  'wm-body': body + [top[17]], 'wm-roof': roof, 'wm-sails': sails, 'wm-hub': hub,
  'inside': [top[6], top[8], top[9], top[10], top[12]],
  'lamps': [top[33], top[34]], 'buildings': [top[21], top[22]], 'fence': [top[18], top[19]],
  'street': [top[13], top[14]], 'lampjes': [top[29]], 'door': [top[20]],
  'moulin': [top[24]], 'couple': [top[30]], 'cars': [top[35]],
}
for n in sys.argv[2:]: comp(jobs[n], n)
