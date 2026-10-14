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

## Scherp (hoge resolutie)

`scale_psd.py` patcht psd-tools in het geheugen zodat de PSD op 3x wordt gerenderd (vectoren scherp, pixellagen opgeschaald).
`extract3.py` gebruikt dat, `heal.py` herstelt de kleine naden die de lijnbijsnijding bij 3x geeft (met de 1x-render),
en `prepare3.py` verkleint naar 2x en schrijft de WebP's plus `scene.json` (posities blijven in 1134 x 1417).

```
venv/Scripts/python extract3.py "../../Can Can Poster.psd" wm-body wm-roof wm-sails wm-hub moulin couple inside lamps cars fence buildings street
venv/Scripts/python prepare3.py ../../assets/scene
```
De lampjes (440 losse vormen) duren op 3x te lang; die komen uit de 1x-render (ze gloeien toch).
