# Rendert een PSD op S x de resolutie met psd-tools: vectoren worden scherp opnieuw getekend,
# pixellagen worden mee opgeschaald. Patcht psd-tools in het geheugen (alleen voor dit proces).
import inspect, re
import numpy as np
from PIL import Image
import psd_tools.api.layers as L
import psd_tools.api.psd_image as PI
import psd_tools.api.mask as M
import psd_tools.api.numpy_io as NIO
import psd_tools.composite.vector as V
import psd_tools.composite as C

S = 3
_ON = [True]   # schalen tijdelijk uit tijdens het uitpakken van pixeldata

def _scale_prop(cls, name):
    p = cls.__dict__[name]
    setattr(cls, name, property(lambda self, f=p.fget: int(round(f(self) * S)) if _ON[0] else f(self), p.fset))

# documentgrootte
for n in ('width', 'height'): _scale_prop(PI.PSDImage, n)
# basislaag (record-coördinaten); Group/Artboard rekenen via bbox van kinderen
for n in ('left', 'top', 'right', 'bottom'): _scale_prop(L.Layer, n)
for n in ('left', 'top', 'right', 'bottom'):
    if n in M.Mask.__dict__ and isinstance(M.Mask.__dict__[n], property): _scale_prop(M.Mask, n)
for n in ('width', 'height'):
    if n in M.Mask.__dict__ and isinstance(M.Mask.__dict__[n], property):
        p = M.Mask.__dict__[n]; setattr(M.Mask, n, property(lambda self, f=p.fget: int(round(f(self) * S)) if _ON[0] else f(self)))

# FillLayer: record * S, anders de (al geschaalde) documentmaat
def _fill_right(self): return self._record.right * (S if _ON[0] else 1) if self._record.right else self._psd.width
def _fill_bottom(self): return self._record.bottom * (S if _ON[0] else 1) if self._record.bottom else self._psd.height
L.FillLayer.right = property(_fill_right); L.FillLayer.bottom = property(_fill_bottom)

# ShapeLayer.bbox: pixel- en origination-takken schalen, vector-tak gebruikt al de geschaalde documentmaat
def _shape_bbox(self):
    if self._bbox is None:
        if self.has_pixels():
            r = self._record; self._bbox = (r.left * S, r.top * S, r.right * S, r.bottom * S)
        elif self.has_origination() and not any(x.invalidated for x in self.origination):
            lefts, tops, rights, bottoms = zip(*[x.bbox for x in self.origination])
            self._bbox = (int(min(lefts) * S), int(min(tops) * S), int(max(rights) * S), int(max(bottoms) * S))
        elif self.has_vector_mask() and self.vector_mask is not None:
            b = self.vector_mask.bbox
            self._bbox = (int(round(b[0] * self._psd.width)), int(round(b[1] * self._psd.height)), int(round(b[2] * self._psd.width)), int(round(b[3] * self._psd.height)))
        else:
            self._bbox = (0, 0, 0, 0)
    return self._bbox
L.ShapeLayer.bbox = property(_shape_bbox)

# pixeldata mee opschalen
_get = NIO.get_array
def _get_scaled(layer, channel=None, *a, **k):
    _ON[0] = False
    try: arr = _get(layer, channel, *a, **k)
    finally: _ON[0] = True
    if arr is None or getattr(arr, 'ndim', 0) < 2: return arr
    h, w = arr.shape[:2]; out = []
    chans = arr.shape[2] if arr.ndim == 3 else 1
    for c in range(chans):
        plane = (arr[..., c] if arr.ndim == 3 else arr).astype(np.float32)
        im = Image.fromarray(plane, mode='F').resize((w * S, h * S), Image.BICUBIC)
        out.append(np.clip(np.asarray(im), 0, 1))
    res = np.stack(out, axis=-1) if arr.ndim == 3 else out[0]
    return res.astype(arr.dtype)
NIO.get_array = _get_scaled

# lijndiktes van vectorlijnen
def _patch_source(mod, fname, pattern, repl):
    src = inspect.getsource(getattr(mod, fname)); new = re.sub(pattern, repl, src)
    if new == src: print('LET OP: patch niet toegepast op', fname); return
    ns = mod.__dict__; exec(compile(new, mod.__file__, 'exec'), ns)
_patch_source(V, 'draw_stroke', r'width = float\(desc\.get\("strokeStyleLineWidth", 1\.0\)\)', 'width = float(desc.get("strokeStyleLineWidth", 1.0)) * S_SCALE')
import os
V.S_SCALE = float(os.environ.get("STROKE_S", S))
