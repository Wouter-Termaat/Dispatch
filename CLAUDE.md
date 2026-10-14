# CLAUDE.md: Dispatch

Werkafspraken voor Claude Code in deze repo.

## Wat dit is
Dispatch: een webapp voor Wouter en Luca om hun achtbanen-ranglijst opnieuw te ranken via rijen van 4 en duels. Lees eerst `SPEC.md` (wat), dan `DESIGN.md` (hoe het eruitziet) en open `design/mockup-v3.html` (visuele referentie).

## Belangrijke regels
- **Ranken moet snel zijn.** Geen animatie mag de volgende tik blokkeren. Fit van het model in een Web Worker.
- **`js/model.js` is getest.** Niet herschrijven. Bij wijzigingen: `node tools/simulate.mjs` draaien en de uitkomst vergelijken (rijen: fout daalt van ~9,7 naar ~5,6 plekken na 150 rijen, zekerheid naar ~89%).
- **Geen secrets in de code.** Alleen de Supabase publishable key in `js/config.js`. Beveiliging zit in Row Level Security (`sql/dispatch.sql`).
- **Nooit de poster-bronbestanden committen** (`Can Can Poster.psd`, `Can Can Poster.jpg`, de map `Claude outputs/`). Ze staan in `.gitignore`.
- Alle tekst in de app in het Nederlands. Frans alleen als accent in titels.
- Gebruiker gebruikt vooral Android Chrome; test op mobiel formaat (bijv. 390×844) én laptop.
- Gebruik nooit em dashes of en dashes in teksten in de app.

## Architectuur
- Statische site, geen build-stap. `index.html` + ES modules in `js/`, CSS in `css/`.
- `js/config.js`: Supabase URL, publishable key, profiel-UID's.
- `js/store.js` (te maken): één interface met twee implementaties: `SupabaseStore` en `LocalStore` (`?demo=1`, laadt `data/seed.json`, bewaart in localStorage). Schrijfacties optimistisch met een wachtrij.
- `js/model.js`: rankingmodel (klaar). `js/model.worker.js` (te maken) draait `fitModel` in een worker.
- `js/scene.js` + `assets/scene/`: de poster in lagen (uit de PSD, zie `tools/psd/README.md`) met parallax, draaiende wieken en lampjesgolven. Licht zit in CSS (`css/scene.css`, `css/cards.css`). `js/fx/lightfog.js` (WebGL-mist) wordt niet meer gebruikt: Wouter vond de mist lelijk.
- `js/pick.js`: kiest duels en rijen via het model, maar ~30% van de duels bewust verder uit elkaar (`tools/simulate-mix.mjs`: kost bij duels niets).
- `js/screens/*.js`: één module per scherm. `plein.js` is het Spelen-scherm (scène + spelvormen, Le Duel is standaard), `programma.js` is de Ranking (met filters en sorteren), `rangee.js` heeft een bevestigstap.
- `js/sound.js`: WebAudio-synth voor de geluiden.
- `js/export.js`: Excel-export met ExcelJS (lazy-load).
- `js/copy.js`: alle ride-op-regels, roast-sjablonen en easter-egg-teksten op één plek, zodat Wouter ze makkelijk kan aanvullen.

## Lokaal draaien
- Elke statische server werkt, bijvoorbeeld `npx serve .` of `python -m http.server 8080` in de map, dan `http://localhost:8080/?demo=1`.
- Voor de echte database: zonder `?demo=1` openen en inloggen.

## Deploy
- GitHub repo: `https://github.com/Wouter-Termaat/Dispatch` (branch `main`).
- GitHub Pages vanaf `main`, map `/` (root). URL: `https://wouter-termaat.github.io/Dispatch/`. Gebruik daarom relatieve paden (geen leading `/`).
- In Supabase onder Authentication > URL Configuration de Site URL op de Pages-URL zetten.

## Testen
- `node tools/simulate.mjs` voor het model, `node tools/simulate-mix.mjs` voor de selectie uit `js/pick.js`.
- `node tools/test-store.mjs` (offline wachtrij) en `node tools/test-export.mjs` (Excel teruglezen).
- `node tools/e2e.mjs`, `tools/e2e-pages.mjs`, `tools/e2e-meer.mjs` [phone|laptop]: Playwright in demomodus (gebruikt de geïnstalleerde Chrome).
- End-to-end met Playwright in demomodus: plein laden, een sessie rangée (12 rijen) en een paar duels doen, baankaart openen, export draaien en de xlsx teruglezen.
- Controleer in de browserconsole dat er geen fouten zijn en dat de WebGL-laag op mobiel vloeiend blijft (anders `scale` in lightfog verlagen).
