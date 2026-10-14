# Dispatch

Cabaret des Montagnes Russes: de ranglijst van Wouter en Luca, gerankt in rijen van vier.

## Stappen voor Wouter

1. **Database vullen (1 minuut)**
   Supabase > SQL Editor > New query. Plak de inhoud van `sql/dispatch.sql` en klik **Run**. Onderaan zie je `banen 181, lijstregels 328, profielen 2`. Het script mag je veilig opnieuw draaien.

2. **Inschrijven uit**
   Authentication > Sign In / Providers, zet "Allow new users to sign up" uit.

3. **Bouwen in de Code-tab**
   Open de Claude desktop-app, ga naar de **Code**-tab, kies de map `C:\Claude\Dispatch`, en plak de opdracht uit `PROMPT.md`. Claude Code bouwt de app, test hem, en zet hem op GitHub Pages.
   Nodig op je laptop: Git voor Windows (of GitHub Desktop) en ingelogd zijn bij GitHub. Claude Code controleert dat en zegt het als er iets mist.

4. **Supabase koppelen aan de live-site**
   Als de site live staat: Authentication > URL Configuration, zet de Site URL op `https://wouter-termaat.github.io/Dispatch/`.

5. **Luca uitnodigen**
   Stuur Luca de link en zijn wachtwoord. Hij kan het daarna zelf wijzigen.

## Lokaal bekijken
`python -m http.server 8080` in deze map, dan `http://localhost:8080/?demo=1` (demomodus zonder login).

## Mappen
- `SPEC.md`, `DESIGN.md`, `CLAUDE.md`, `PROMPT.md`: de bouwinstructies
- `design/mockup-v3.html`: goedgekeurde stijl
- `js/model.js`: rankingmodel, `tools/simulate.mjs`: test van het model
- `js/fx/lightfog.js`: licht en mist
- `sql/dispatch.sql`: database, `data/seed.json`: startdata
- `assets/`: uitsneden van de poster
