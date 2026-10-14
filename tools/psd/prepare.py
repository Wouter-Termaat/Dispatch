# Snijdt de uitsneden bij, slaat ze op als WebP in assets/scene en schrijft scene.json met de posities (PSD-coordinaten 1134x1417).
import json, sys
from PIL import Image, ImageOps
OUT = sys.argv[1]
meta = {}
def save(name, im, box, q=86):
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)
    meta[name] = [box[0], box[1], box[2] - box[0], box[3] - box[1]]
def crop(name, src=None, region=None):
    im = Image.open(f'out/{src or name}.png')
    if region: 
        mask = Image.new('L', im.size, 0); mask.paste(255, region); a = im.getchannel('A'); im.putalpha(Image.composite(a, Image.new('L', im.size, 0), mask))
    bb = im.getbbox(); save(name, im.crop(bb), bb)
for n in ['wm-body', 'wm-roof', 'wm-sails', 'wm-hub', 'moulin', 'couple', 'inside']: crop(n)
crop('cars-l', 'cars', (0, 0, 567, 1417)); crop('cars-r', 'cars', (567, 0, 1134, 1417))
crop('lamp-l', 'lamps', (0, 0, 567, 1417)); crop('lamp-r', 'lamps', (567, 0, 1134, 1417))
crop('bulbs-sails', 'lampjes', (0, 0, 1134, 900)); crop('bulbs-front', 'lampjes', (0, 900, 1134, 1417))
import os
for n, r in [('buildings-l', (0, 0, 420, 1417)), ('buildings-r', (700, 0, 1134, 1417))]:
    if os.path.exists('out/buildings.png'): crop(n, 'buildings', r)
for n in ['fence', 'street', 'door']:
    if os.path.exists(f'out/{n}.png'): crop(n)
# zonnestralen: grijs -> navy/goud (gradient map zoals op de poster)
sp = Image.open('out/sphere.png'); bb = sp.getbbox(); sp = sp.crop(bb)
g = ImageOps.grayscale(sp.convert('RGB'))
stops = [(0, (12, 10, 26)), (.45, (30, 28, 58)), (.6, (86, 66, 50)), (.8, (160, 126, 80)), (1, (210, 174, 112))]
lut = []
for c in range(3):
    for v in range(256):
        x = v / 255
        for (x0, c0), (x1, c1) in zip(stops, stops[1:]):
            if x0 <= x <= x1: t = (x - x0) / (x1 - x0); lut.append(round(c0[c] + (c1[c] - c0[c]) * t)); break
col = Image.merge('RGB', [g.point(lut[i * 256:(i + 1) * 256]) for i in range(3)]).convert('RGBA'); col.putalpha(sp.getchannel('A'))
save('sunburst', col, bb, q=80)
json.dump(meta, open(f'{OUT}/scene.json', 'w'), indent=1)
print(json.dumps(meta))
