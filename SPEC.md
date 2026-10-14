# Dispatch: functionele specificatie

Dispatch is een webapp waarmee Wouter en zijn vriend Luca hun persoonlijke ranglijst van achtbanen (Wouter 169, Luca 159 banen) opnieuw en betrouwbaarder ranken, door banen tegen elkaar af te wegen in plaats van een lange lijst handmatig te sorteren. Het moet voelen als een beleving in de stijl van Wouters eigen poster (cabaret, Parijs rond 1900, nacht, lampjes, licht), niet als een dashboard. Ranken zelf moet snel gaan.

Alle tekst in de app is Nederlands. Frans alleen als accent in titels ("La Rangée", "Le Duel", "Dispatch présente").

## 1. Gebruikers en toegang

- Twee gebruikers, aangemaakt in Supabase Auth (e-mail + wachtwoord). Inschrijven staat uit.
  - Wouter: `e5aeb32f-c2d0-45cb-bd25-13a785fa07e5`
  - Luca: `9d9ab8e2-7489-4c24-8291-8f2cd7e840fa`
- Inloggen: e-mail + wachtwoord, één keer per apparaat (sessie onthouden). Inlogscherm in de stijl van de app ("Toon je kaartje").
- Iedereen die is ingelogd mag alles lezen (je ziet elkaars lijst). Je kunt alleen je eigen lijst en duels bewerken. De banencatalogus is gedeeld en door beiden bewerkbaar. Dit is in de database afgedwongen met Row Level Security (`sql/dispatch.sql`).
- Demomodus: `?demo=1` draait volledig lokaal op `data/seed.json` met localStorage, zonder login, met een profielkiezer. Bedoeld voor ontwikkeling en tests.

## 2. Data

Zie `sql/dispatch.sql` (schema, beveiliging en startdata) en `data/seed.json` (dezelfde data).

- `coasters`: gedeelde catalogus (181 banen). `id` is een slug, `name`, `park`, `manufacturer`, `operational`, `photo_url` (later).
- `profiles`: per persoon `key` ('wouter'/'luca'), `name`, `dynamics` (waarden uit het Dynamics-tabblad van hun Excel, nodig voor de export), `settings` (jsonb: ankersterkte, geluid, muziek, zekerheid tonen, enz.).
- `entries`: iemands lijst. `initial_rank` is de startpositie (Excel-volgorde, of de plek van een nieuwe baan, mag fractioneel zijn), `prior_strength` (vermenigvuldiger op het anker, 1 = normaal), `reridden_at` (datum "herreden"), `note`.
- `comparisons`: elke vergelijking. `a`, `b`, `outcome` in ('a','b','tie','skip'), `mode` (duel, rangee, twijfel, park, rematch, toernooi, plaatsing, check), `batch` (uuid; een rij van 4 is één batch van 6 vergelijkingen, zodat "herstel" de hele rij terugdraait).

Catalogus-afspraken (door Wouter bevestigd): Eurosat (oude versie) en de CanCan Coaster zijn aparte banen. Temple of the Night Hawk en Crazy Bats zijn aparte banen. Spelling "Frida". Bij verschillende fabrikantnamen geldt die van Wouter.

## 3. Rankingmodel (klaar: `js/model.js`)

Gebruik `js/model.js` zoals hij is; pas hem alleen aan als het echt moet en draai dan `node tools/simulate.mjs` opnieuw.

- Bradley-Terry (logistisch) model, MAP-geschat. Elke baan heeft een prior uit de startpositie: een gemiddelde op basis van zijn plek in de Excel, met een sterkte van ~3 "virtuele duels" (instelling `anchorDuels`, standaard 3). De top krijgt geen speciale behandeling.
- Alle vergelijkingen worden telkens opnieuw meegeteld: de volgorde en de dagvorm maken niet uit, een verrassende uitslag weegt zwaarder dan een verwachte, gelijk telt als een half, "weet niet" telt niet mee maar het paar wordt wel onthouden.
- "Herreden": vergelijkingen van vóór die datum met die baan tellen voor de helft.
- Onzekerheid: 80%-bereik van de positie (Monte Carlo). Een baan is "zeker" als het bereik binnen plus of min `max(3, 3,5% van de lijst)` plekken valt.
- Selectie (`nextRow`, `nextDuel`): kiest vooral onzekere banen tegen banen met een vergelijkbare score, vermijdt recent geziene paren.
- Simulatie (`tools/simulate.mjs`): met rijen van 4 is een lijst van 169 na ongeveer 100 tot 150 rijen stabiel; losse duels zijn ongeveer 3x zo traag. Daarom is La Rangée de hoofdmodus.
- Snelheid: een fit duurt ~45 ms op een laptop. Draai de fit in een Web Worker zodat animaties nooit haperen. Kies de volgende rij op basis van het vorige model zodat er geen wachttijd is.

API in het kort (zie de JSDoc in het bestand): `fitModel({entries, comparisons, settings, warm})`, `nextRow(model, comparisons, {size, filter, mode})`, `rowToComparisons(orderedIds)`, `nextDuel(...)`, `checkWindow(model, 5)`, `contradictions(model, comparisons)`, `new Placement(model, newId)`, `coasterInfo(model, id, comparisons)`, `remainingEstimate(model)`, `groupStats(model, catalogMap, 'park'|'manufacturer')`, `compare(modelA, modelB, catalogMap)`, `sessionSummary(beforeMap, afterModel, actions)`.

## 4. Schermen en flows

Vaste navigatie onderin met vier tabs: **Spelen**, **Programma**, **Samen**, **Meer**. Tijdens ranken (rangée, duel) is de navigatie weg; dan is er bovenin een sluitknop, een voortgangsbalk en een teller.

### 4.1 Spelen (het plein)
- Achtergrond: Wouters poster (`assets/home-plate.jpg`), levend gemaakt: lampjes op de molen en de gevel gloeien zachtjes na (posities in `assets/home-points.json`), sterren twinkelen, deur en lantaarns flakkeren als kaarslicht, mist drijft over de straat en licht op in het licht uit de deur (`js/fx/lightfog.js`). Zie `design/mockup-v3.html`.
- Logo "Dispatch" in de nachtlucht, eronder "Cabaret des Montagnes Russes".
- Hoofdknop **Begin met ranken** start een sessie La Rangée in de standaardmodus.
- Onder de knop: status ("Nog 9 rijen tot je ranking staat", uit `remainingEstimate`) en de link "andere voorstelling" die een keuzeblad opent met de modi:
  - **La Rangée** (snel, standaard): rij van 4.
  - **Le Duel**: twee banen.
  - **Twijfelzone**: alleen de onzekerste banen (werkt met rangée en duel).
  - **Park-avond**: kies een park (of twee parken tegen elkaar); alleen banen van dat park.
  - **Rematch**: tegenstrijdigheden (A>B, B>C, C>A en grote verrassingen uit `contradictions`) opnieuw voorleggen als duel.
  - **Toernooi**: bracket van 8 banen (kies: fabrikant, park, of willekeurig uit je top 30). Elke match telt als gewone vergelijking. Afsluiten met een kampioensmoment.
- Is de ranking stabiel, dan zegt het plein dat ("Je ranking staat. Het doek mag vallen.") en blijft ranken optioneel.

### 4.2 La Rangée (hoofdmodus, moet snel zijn)
- Vier banen naast elkaar als ingelijste portretten, elk met een eigen spot van boven.
- Tik in volgorde, favoriet eerst. Na drie tikken wordt de vierde automatisch ingevuld. De nummers verschijnen direct.
- Bij een tik licht de spot van die kaart op. Na de vierde schuiven de kaarten in ~0,35 s naar hun volgorde, er staat even "Genoteerd", en de volgende rij staat er binnen ~0,5 s. De vergelijkingen worden direct opgeslagen (optimistisch, met een wachtrij als het netwerk even weg is).
- Knoppen: **Herstel** (rij opnieuw kiezen of de vorige batch terugdraaien) en **Sla over**.
- Elke ~15 acties een **"Klopt dit?"**-ronde: vijf opeenvolgende plekken uit je ranking; "Klopt" bevestigt (opslaan als vergelijkingen), anders orden je ze opnieuw.
- Een sessie standaard 12 rijen; daarna de affiche. Doorgaan mag.

### 4.3 Le Duel
- Twee kaarten boven elkaar, "of" ertussen. Tik de winnaar (laptop: pijltjes omhoog/omlaag, spatie = gelijk, omlaag-pijl met shift of `n` = weet niet).
- De gekozen kaart licht op (~0,25 s), de andere zakt weg in de schaduw, het volgende paar staat er meteen.
- Knoppen **Gelijk** en **Weet niet**. Een korte, wisselende regel van de "ride-op" onderin, nooit een vertraging.
- Je huidige rang is nooit zichtbaar tijdens ranken (tegen anchoring).

### 4.4 Nieuwe baan toevoegen (vanuit Programma of Meer)
- Kies uit de catalogus met zoeken/autocomplete, of voeg een nieuwe baan toe aan de catalogus (naam, park, fabrikant, operatief).
- Kies een gok-plek (slider of "ongeveer naast..."). Daarna volgen ~7 plaatsingsduels (`Placement`, binair zoeken). Opslaan als entry met `initial_rank` = uitkomst en `prior_strength` = 1/3 (zwak anker), plus de plaatsingsvergelijkingen.

### 4.5 Programma
- Rustige lijst: rang, naam, park · fabrikant, en (na een sessie) een klein pijltje omhoog/omlaag. Top 3 in goud/zilver/brons.
- Schakelaar **Zekerheid** (standaard uit, onthouden in settings) toont het bereik per baan ("± 3").
- Tabs **Banen**, **Parken**, **Fabrikanten** (via `groupStats`: aantal, gemiddelde, beste baan).
- Zoeken/filter op naam en park.
- Tik een baan: **baankaart** als bottom sheet met afbeelding, naam, park · fabrikant, plek, aantal duels, gewonnen/verloren, het bereik als balkje ("waarschijnlijk tussen plek 4 en 9"), **Waarom hier** (won van ..., verloor van ...), en knoppen **Herreden**, **Notitie**, **Wijzig** (catalogusgegevens: naam, park, fabrikant, operatief, foto-URL), **Uit mijn lijst**.
- Je kunt hier ook Luca's programma bekijken (alleen lezen).

### 4.6 Samen (Wouter & Luca)
- Smaakmatch als boog van lampjes die één voor één aangaan met een meetellend percentage (`compare().match`). Tik de boog om het opnieuw af te spelen.
- Kaarten met automatisch gegenereerde, licht plagerige teksten uit de data (sjablonen met variatie):
  - Eensgezind (zelfde #1 of grootste overeenstemming)
  - De grootste twist (grootste verschil)
  - "Luca's geheime liefde" / "Wouters geheime liefde" (baan die de ander veel lager zet)
  - Nog te rijden (bucketlist: top 30 van de ander die jij niet hebt)
  - Per fabrikant: waar jullie het meest en minst eens zijn
- **Gezamenlijke ranking**: lijst van gedeelde banen op gemiddelde score.
- Overal tik je door naar de baankaart.

### 4.7 De affiche (na elke sessie)
- Poster in de stijl van Wouters poster met de molen (`assets/windmill.jpg`): "Dispatch présente / Une Soirée de Duels / datum", met ster van de avond (grootste stijger), gevallen ster (grootste daler), zwaarste keuze (het paar dat het dichtst bij 50/50 lag of waar je het langst over deed), aantal rijen en duels, en zekerheid.
- **Bewaar** (PNG via canvas, met de juiste fonts) en **Stuur naar Luca** (Web Share API met het PNG; fallback: download).
- De affiche mag langer animeren (lichten gaan aan, doek gaat open).

### 4.8 Meer
- Instellingen: ankersterkte (licht 1 / gemiddeld 3 / sterk 8 virtuele duels), geluid aan/uit, achtergrondmuziek (Geen / Witte Stip. Inspiratie), zekerheid tonen, sessielengte.
- **Exporteer naar Excel** (zie 6).
- Baan toevoegen.
- "Achter de schermen": een pagina in Wouters woorden over waarom de app zo werkt (Claude Code schrijft een eerste versie op basis van SPEC.md; Wouter past hem aan).
- Uitloggen.

## 5. Beleving, geluid, easter eggs

- **Geluid** (standaard aan, mute-knop, onthouden): kort en subtiel, gesynthetiseerd met WebAudio, geen bestanden nodig: zacht ratelen van een liftheuvel bij het laden, een heldere stationsbel bij een keuze, een zachte whoosh bij een upset, kort applaus na een sessie.
- **Haptiek**: `navigator.vibrate` met korte tikjes (Android).
- **Muziek**: Spotify-embed van de playlist "Witte Stip. Inspiratie" (`https://open.spotify.com/playlist/30D8B8C5iOewT8Qfr9oQdU`) in een kleine, inklapbare speler die over schermen heen blijft staan. Volledige nummers als je in die browser bij Spotify bent ingelogd, anders fragmenten.
- **Easter eggs**:
  - **Witte Stip.**: tik op het straatbordje "Point Blanc" op het plein. Een witte stip licht op en de muziek-optie gaat open (de stip zit ook verstopt in de instellingen).
  - **Trimrem**: wie sneller dan ~0,6 s per keuze klikt, krijgt "Trimrem geactiveerd" en de volgende kaarten komen iets trager binnen.
  - **Besluiteloos**: 5x achter elkaar "gelijk" geeft de ride-op-regel "Kiezen is ook een vak."
  - **Titanenclash**: als je #1 en #2 tegen elkaar komen, een korte speciale intro.
  - **Park gesloten**: na 23:00 gaan de lampjes op het plein één voor één uit; alleen de sterren blijven. Tussen 24 oktober en 2 november een Halloween-sfeer (kouder licht, meer mist).
  - **Credits**: bij 100, 500 en 1000 vergelijkingen een verzamelbaar ticketje in Meer.
  - **404**: "Deze attractie is tijdelijk gesloten wegens een technische storing."
  - Inside jokes van Wouter en Luca volgen later; maak een plek in de code waar ride-op-regels en roast-sjablonen in één bestand staan, zodat Wouter ze makkelijk kan aanvullen.

## 6. Excel-export (per persoon, eigen format)

Exporteer een `.xlsx` die er hetzelfde uitziet en werkt als de Excel die de persoon nu heeft. Gebruik ExcelJS (lazy-load). Lettertype overal Montserrat 12, kopregel vet, bovenste rij vastgezet, kolombreedtes zoals hieronder.

**Tabblad "List of Coaster"** (rij 1 = kop, daaronder elke baan in de huidige modelvolgorde; `n` = rijnummer)

| Kolom | Wouter | Luca |
|---|---|---|
| A Rank | `=IF(ISBLANK(Bn),"",ROW()-1)` | idem |
| B Naam | catalogusnaam | idem |
| C Park | park | idem |
| D Fabrikant | fabrikant | idem |
| E Operatief | 1 of 0 | idem |
| F | kop "Punten F": `=IF(ISBLANK(Bn),"",IF((Dynamics!$B$3-Dynamics!$B$2*An)<0,0,(Dynamics!$B$3-Dynamics!$B$2*An)))` | kop "Punten P": `=IF(ISBLANK(Bn),"",IF((Dynamics!$B$3-Dynamics!$B$2*An)<0,0,((Dynamics!$B$3-Dynamics!$B$2*An)*En)))` |
| G | kop "Punten P": `=IF(ISBLANK(Bn),"",IF((Dynamics!$B$3-Dynamics!$B$2*An)<0,0,((Dynamics!$B$3-Dynamics!$B$2*An)*En)))` | kop "Punten F": `=IF(ISBLANK(Bn),"",IF((Dynamics!$B$3-Dynamics!$B$2*An)<0,0,(Dynamics!$B$3-Dynamics!$B$2*An)))` |

Kolombreedte B 44, C 37, D 36, E 11. Getalnotatie F en G: `0`. Voorwaardelijke opmaak op kolom A: waarde 1 vulling `#F1C232`, 2 `#B7B7B7`, 3 `#AD7C5E`, tekst wit. Op kolom E: waarde 0 vulling `#CCCCCC`. Excel-tabel over A1:G(laatste rij) met rijstrepen.

**Tabblad "Parken"**: per park (alfabetisch) A Park, B Aantal `=COUNTIF('List of Coaster'!C:C,An)`, C In gebruik `=COUNTIFS('List of Coaster'!C:C,An,'List of Coaster'!E:E,1)`, D Punten `=SUMIF('List of Coaster'!C:C,An,'List of Coaster'!<kolom Punten P>:<kolom Punten P>)` (Wouter G, Luca F), E Gemiddeld `=IFERROR(Dn/Cn, 0)`, F Favo `=IFERROR((En/Dynamics!$B$8)*(1+(Dn/Dynamics!$B$9)), 0)`. Breedte A 34.

**Tabblad "Fabrikanten"**: per fabrikant (alfabetisch) A Fabrikant, B Aantal `=COUNTIF('List of Coaster'!$D:$D,An)`, C Punten `=SUMIF('List of Coaster'!D:D,An,'List of Coaster'!<kolom Punten F>:<kolom Punten F>)` (Wouter F, Luca G), D P/A `=Cn/Bn`. Breedte A 38.

**Tabblad "Dynamics"**: A1 "Naam", B1 "Waarde", daarna precies de labels en waarden uit `profiles.dynamics` op rijen 2, 3, 5, 6, 8, 9 (Wouter: Punten factor 1, Punten max 100, Operatief 1, Niet operatief 0, Favo Gemiddeld 7, Favo Totaal 40; Luca: Punten factor 2.1, Punten max 102, Gesloopt niet 1, Gesloopt wel 0, Favo Gemiddeld 7, Favo Totaal 40).

Bestandsnaam: `Top List Coasters <Naam> <yyyy-mm-dd>.xlsx`. Test de export door hem met een xlsx-parser terug te lezen en de formules en volgorde te controleren.

## 7. Techniek

- Statische site op GitHub Pages: `https://wouter-termaat.github.io/Dispatch/`. Geen build-stap nodig: plain ES modules, HTML en CSS. Externe libraries via een vastgepinde CDN-versie (supabase-js v2 via `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm` met een vaste versie, ExcelJS lazy).
- Supabase project URL `https://kqzrdmmwmddctklwhnin.supabase.co`, publishable key in `js/config.js` (die mag openbaar; beveiliging zit in RLS). Nooit een secret/service_role key in de code.
- Werkt goed op telefoon (Android Chrome is het belangrijkst) en laptop. Mobiel eerst. Installeerbaar als PWA (manifest en icoon met de molen) is een pluspunt.
- Offline-tolerant: vergelijkingen eerst lokaal in een wachtrij, dan naar Supabase; bij een netwerkfout later opnieuw.
- Respecteer `prefers-reduced-motion`.
- Fonts: Limelight (logo, grote cijfers), Playfair Display (namen en tekst, vaak cursief), Josefin Sans (labels, kleine hoofdletters).
