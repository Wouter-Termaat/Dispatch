# Hoge resolutie: 3x-render herstellen (naden), verkleinen naar OUT_S (2x) en als WebP opslaan.
# Posities in scene.json blijven in PSD-coördinaten (1134 x 1417), zodat de code niet verandert.
import json, sys, os
import numpy as np
from PIL import Image
from heal import heal
OUT, S3, OS = sys.argv[1], 3, 2
meta = json.load(open(f'{OUT}/scene.json'))
def region_alpha(im, region, s):
    if not region: return im
    x0, y0, x1, y1 = [int(v * s) for v in region]
    mask = Image.new('L', im.size, 0); mask.paste(255, (x0, y0, x1, y1))
    im = im.copy(); im.putalpha(Image.composite(im.getchannel('A'), Image.new('L', im.size, 0), mask)); return im
def build(name, src=None, region=None, q=84):
    src = src or name
    p3, p1 = f'out3/{src}.png', f'out/{src}.png'
    healed = f'out3/{src}-healed.png'
    if not os.path.exists(p3):
        # geen 3x-render (bijv. de lampjes): de 1x-versie opschalen; die gloeien toch
        b = Image.open(p1).convert('RGBA'); b.resize((b.width * S3, b.height * S3), Image.BICUBIC).save(healed); print(src, 'uit 1x')
    elif not os.path.exists(healed): print(src, 'hersteld', round(heal(p3, p1, healed) * 100, 2), '%')
    im = region_alpha(Image.open(healed).convert('RGBA'), region, S3)
    bb = im.getbbox(); im = im.crop(bb)
    w, h = round(im.width * OS / S3), round(im.height * OS / S3)
    im = im.resize((w, h), Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)
    meta[name] = [round(bb[0] / S3, 2), round(bb[1] / S3, 2), round((bb[2] - bb[0]) / S3, 2), round((bb[3] - bb[1]) / S3, 2)]
    print(name, (w, h), os.path.getsize(f'{OUT}/{name}.webp') // 1024, 'KB')
for n in ['wm-body', 'wm-roof', 'wm-sails', 'wm-hub', 'moulin', 'couple', 'inside', 'fence', 'street']: build(n)
build('cars-l', 'cars', (0, 0, 567, 1417)); build('cars-r', 'cars', (567, 0, 1134, 1417))
build('lamp-l', 'lamps', (0, 0, 567, 1417)); build('lamp-r', 'lamps', (567, 0, 1134, 1417))
build('bulbs-sails', 'lampjes', (0, 0, 1134, 900)); build('bulbs-front', 'lampjes', (0, 900, 1134, 1417))
build('buildings-l', 'buildings', (0, 0, 420, 1417)); build('buildings-r', 'buildings', (700, 0, 1134, 1417))
json.dump(meta, open(f'{OUT}/scene.json', 'w'), indent=1)
