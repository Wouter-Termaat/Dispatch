# Opdracht voor Claude Code

Plak de tekst hieronder in de Code-tab (met de map C:\Claude\Dispatch geopend).

---

Bouw de webapp **Dispatch** in deze map. Alles wat je nodig hebt staat hier al:

- `SPEC.md`: wat de app doet (lees hem helemaal)
- `DESIGN.md` en `design/mockup-v3.html`: hoe het eruitziet en beweegt (goedgekeurd; hergebruik de CSS en JS uit de mockup waar dat kan)
- `CLAUDE.md`: architectuur en werkafspraken
- `js/model.js` (getest rankingmodel, niet herschrijven), `js/fx/lightfog.js` (licht en mist), `js/config.js`
- `sql/dispatch.sql` (al uitgevoerd in Supabase), `data/seed.json` (dezelfde data voor demomodus)
- `assets/` (uitsneden van mijn poster)

Werkwijze:

1. Lees SPEC.md, DESIGN.md en CLAUDE.md, open de mockup, en maak een kort bouwplan in fases. Laat het plan zien en ga daarna direct door, tenzij je echt een beslissing van mij nodig hebt.
2. Zet git op: `git init`, branch `main`, remote `https://github.com/Wouter-Termaat/Dispatch.git`. Controleer eerst of `git` en mijn GitHub-login werken. Zo niet, vertel me precies wat ik moet doen. Check dat `.gitignore` de poster-bronbestanden en `Claude outputs/` uitsluit voordat je iets commit.
3. Bouw in deze volgorde, en commit na elke fase:
   1. Basis: `index.html`, CSS met de design tokens, router, navigatie, `LocalStore` met demomodus (`?demo=1`), het plein met poster, lampjes, sterren, licht en mist.
   2. Ranken: La Rangée (hoofdmodus) en Le Duel, met het model in een Web Worker, voortgang, herstel, "Klopt dit?" en de affiche na een sessie. Ranken moet snel voelen: test dat de volgende rij binnen 0,5 s klaarstaat.
   3. `SupabaseStore` met inloggen (e-mail + wachtwoord), opslaan met een offline wachtrij, en lezen van beide profielen.
   4. Programma met de baankaart, banen toevoegen met plaatsingsduels, parken en fabrikanten.
   5. Samen (smaakmatch, roasts, gezamenlijke ranking, bucketlist).
   6. Modi: twijfelzone, park-avond, rematch, toernooi.
   7. Meer: instellingen, Excel-export (precies volgens SPEC.md sectie 6), muziek, achter de schermen.
   8. Geluid, haptiek, easter eggs, PWA-manifest met een molenicoon.
4. Test elke fase met Playwright in demomodus op telefoonformaat (390×844) en laptopformaat. Kijk naar screenshots, controleer de console op fouten, en draai `node tools/simulate.mjs` als je iets aan het model verandert.
5. Test daarna tegen de echte Supabase: log in als Wouter (ik geef je het wachtwoord als je erom vraagt, of ik log zelf in in de browser), doe een rij, en controleer dat die in de database staat.
6. Push naar GitHub en zet GitHub Pages aan (branch `main`, root). Lukt dat niet automatisch, geef me de stappen. Geef me aan het eind de live-link.

Belangrijk: de app moet een beleving zijn met klasse en charme, waarin licht de hoofdrol speelt, maar wel duidelijk in gebruik. Ranken moet snel gaan. Alle tekst in het Nederlands, nooit em dashes of en dashes.
