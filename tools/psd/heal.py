# Herstelt naden in een 3x-render met behulp van de 1x-render (opgeschaald).
import sys, numpy as np
from PIL import Image, ImageFilter
def heal(p3, p1, out, S=3):
    a = np.asarray(Image.open(p3).convert('RGBA')).astype(np.float32) / 255
    b1 = Image.open(p1).convert('RGBA'); b = np.asarray(b1.resize((b1.width * S, b1.height * S), Image.BICUBIC)).astype(np.float32) / 255
    b = np.clip(b, 0, 1)
    h = min(a.shape[0], b.shape[0]); w = min(a.shape[1], b.shape[1]); a = a[:h, :w]; b = b[:h, :w]
    # naad = te weinig dekking t.o.v. 1x, of veel lichter (wit) dan 1x
    da = b[..., 3] - a[..., 3]
    lum = lambda x: x[..., :3].mean(-1)
    bright = (lum(a) - lum(b)) * np.minimum(a[..., 3], b[..., 3])
    bad = (da > .25) | (bright > .22)
    bad = np.asarray(Image.fromarray((bad * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    a[bad] = b[bad]
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGBA').save(out)
    return bad.mean()
if __name__ == '__main__':
    print('aandeel hersteld', heal(*sys.argv[1:4]))
