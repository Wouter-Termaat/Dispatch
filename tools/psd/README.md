# Lagen uit de poster (PSD) halen

De scène op Spelen is opgebouwd uit lagen van `Can Can Poster.psd` (die zelf niet in git staat).
De PSD is CMYK en heeft heel veel vectorpunten, daarom met `psd-tools` (Python) en een hogere parse-limiet.

```
python -m venv venv
venv/Scripts/python -m pip install "psd-tools[composite]"
venv/Scripts/python extract.py  "../../Can Can Poster.psd" 2=sphere 24=moulin 30=couple 35=cars 42=stars
venv/Scripts/python extract2.py "../../Can Can Poster.psd" wm-body wm-roof wm-sails wm-hub inside lamps lampjes buildings fence street door
venv/Scripts/python prepare.py  ../../assets/scene
```

`extract*.py` schrijven volledige PNG's naar `out/`; `prepare.py` snijdt ze bij, maakt WebP's en `scene.json`
(positie van elke laag in PSD-coördinaten 1134 × 1417), en kleurt de grijze zonnestralen in naar navy en goud.
