# Dispatch: design

De visuele referentie is `design/mockup-v3.html` (door Wouter goedgekeurd). Open hem in een browser; de CSS en de JS daarin (kaarten, baanprofielen, lampjes, boog, licht en mist) mogen direct hergebruikt worden.

## Idee in één zin

Een avond in een cabaret rond 1900, gebaseerd op Wouters eigen poster: donker, warm licht, lampjes, mist, met klasse en charme. Niet schreeuwerig, niet goedkoop, geen kermis.

## Principes

1. **Licht is de hoofdrolspeler.** Het scherm is donker; wat ertoe doet, staat in het licht. Een spot op de kaart waar je naar kijkt, warme lichtplassen, gloed rond heldere randen. Het licht laat ook zien waar je moet tikken.
2. **Subtiel.** Lampjes alleen waar ze iets betekenen: op de poster (molen, gevel), in de smaakmatch-boog, en spaarzaam als accent. Verder dunne gouden lijnen.
3. **Textuur, niet plat.** Fijne korrel over elk scherm, de echte textuur van de poster, de kasseien als vloer. Altijd subtiel.
4. **Rook en mist** stromen langzaam en gelijkmatig (geen willekeurige deeltjes) en zijn vooral zichtbaar waar licht ze raakt. Eén WebGL-laag: `js/fx/lightfog.js`.
5. **Ranken is snel.** Animaties tijdens ranken zijn kort en blokkeren nooit de volgende tik. Elders mag het rustiger en theatraler.
6. **Duidelijk.** Eén hoofdactie per scherm, vaste navigatie onderin, gewone Nederlandse woorden op knoppen.

## Kleuren

| Token | Waarde | Gebruik |
|---|---|---|
| `--ink` | `#0d0814` | diepste schaduw |
| `--plum` | `#1d1428` | basis achtergrond |
| `--plum2` | `#2a1d36` | vlakken |
| `--cream` | `#f3e6c6` | tekst |
| `--cream-dim` | `#cbb994` | secundaire tekst |
| `--champ` | `#d9b97a` | labels, kleine hoofdletters |
| `--gold` | `#ecc77f` | accent, actieve staat, lijnen |
| `--warm` | `#ffbf6e` | licht, gloed |
| `--velvet` | `#8a1c25` | primaire knop (fluweel) |
| `--velvet-d` | `#520f17` | knopschaduw, gordijnen |
| `--hair` | `rgba(236,199,127,.5)` | gouden lijn |
| `--hair-soft` | `rgba(236,199,127,.18)` | zachte lijn |
| plus/min | `#a6d3a6` / `#e09486` | stijgers/dalers |
| top 3 | goud `#efce86`, zilver `#d6d7de`, brons `#cf9a6e` | rangnummers |

Alleen een donker thema. Contrast van tekst altijd ruim voldoende.

## Typografie

- **Limelight**: logo "Dispatch", grote cijfers (percentages), affichetitels. Met een warme gloed (`text-shadow` in goud/amber).
- **Playfair Display**: namen van banen, koppen, ride-op-teksten. Vaak cursief.
- **Josefin Sans**: labels, knoppen, navigatie. Kleine hoofdletters met ruime letterspatiëring (0,18 tot 0,32em).

## Componenten

- **Primaire knop**: fluweelrood met radiale belichting van boven, dunne gouden rand, zachte warme gloed. Eén per scherm.
- **Secundaire knop**: transparant donker met een zachte gouden lijn, wordt helderder bij hover/tik.
- **Kaart (baan)**: ingelijst portret, dunne gouden rand, glanslaag schuin over de bovenkant, naam in Playfair, park · fabrikant in kleine hoofdletters. Zolang er geen foto's zijn: het gegenereerde baanprofiel uit de mockup (`art()`), uniek per baan, kleur per park. Later: `photo_url` met hetzelfde kader en een donkere verloop onderin.
- **Gekozen kaart**: gouden rand, warme gloed, licht iets groter; de andere kaart(en) zakken weg in de schaduw.
- **Navigatie**: vier iconen met labels (Spelen = molentje, Programma, Samen, Meer). Actief = goud met lichte gloed.
- **Bottom sheet** (baankaart): donkere plaat met afgeronde bovenhoeken en een gouden lijn.
- **Boog (smaakmatch)**: halve cirkel van lampjes die één voor één aangaan (versnellend), met een meetellend percentage.

## Licht en mist per scherm (startwaarden, zie de mockup)

- Plein: mist laag over de straat, een flakkerende lichtplas bij de deur, twee zachte zwaaiende zoeklichten uit de onderhoeken.
- Rangée: één spot van boven per kaart (intensiteit ~0,4), die op de gekozen kaart gaat naar ~1,0.
- Duel: twee spots schuin van boven; de winnaar ~1,1, de verliezer ~0,1.
- Programma en Samen: een enkele zachte bundel en weinig mist, zodat de tekst rustig blijft.
- Affiche: twee zoeklichten van boven.

## Beweging

| Moment | Duur | Opmerking |
|---|---|---|
| Tik in rangée/duel | 0,15 tot 0,25 s | nummer of gloed verschijnt direct |
| Kaarten naar volgorde | ~0,35 s | ease-out |
| Volgende rij of duel | binnen 0,5 s | kaarten komen gestaffeld binnen (40 ms) |
| Schermovergang | 0,4 tot 0,6 s | zacht vervagen, eventueel lichten dimmen |
| Sessie-start en -einde | 1 tot 1,5 s | doek gaat open of dicht, zaallicht dimt |
| Affiche, boog, plein | rustig | mag theatraal |
| Lampjes, sterren, mist | doorlopend, traag | nooit snel knipperen |

Bij `prefers-reduced-motion`: geen doorlopende animaties, alleen directe statuswisselingen.

## Beeldmateriaal (in `assets/`)

- `home-plate.jpg` (1400×1750) en `home-plate-1000.jpg`: Wouters poster zonder titel; de bovenkant loopt over in de nachtlucht. Toon hem met dezelfde breedte/hoogte-verhouding, gecentreerd, op mobiel ~64 px omhoog geschoven zodat de straat boven de navigatie valt.
- `home-points.json`: posities (in pixels van `home-plate.jpg`) van de naaf van de molen, alle 220 geschilderde lampjes en de sterren. Gebruik ze voor zachte gloed-animaties precies op de geschilderde lampjes en sterren.
- `sky-plate.jpg`: wazige, donkere uitsnede van de zonnestraal-lucht, als achtergrond bovenaan de andere schermen.
- `cobbles.jpg`: kasseien als vloer onder de rangée en het duel.
- `windmill.jpg`: de molen, voor de affiche.
- De bron (PSD/JPG van de poster) staat in de projectmap maar hoort niet in git (te groot).

## Herzien na feedback van Wouter (oktober 2026)

- Geen WebGL-mist meer. Licht in CSS: spots per kaart, zoeklichten, lampjesranden die rondlopen, neon-titels.
- De poster is geen plaatje meer maar een scène in lagen (molen met draaiende wieken, gevel, menigte achter de deur, lantaarns, huizen, auto's), met parallax op muis of kantelen. Alleen op Spelen; de andere schermen hebben een eigen achtergrond (nachtlucht met zachte zonnestralen en sterren, bij ranken een podiumvloer).
- Kaarten zijn speelkaarten: art-deco lijst, fluwelen achterkant met monogram, binnenkomen door om te draaien, kantelen onder vinger of muis, lampjesrand bij de gekozen kaart. Baanprofielen hebben de zonnestralen van de poster in de parkkleur.
- Spelvormen staan als verlichte kaartjes op Spelen; Le Duel is de standaard. La Rangée heeft een bevestigstap. Rondes van 10.
- Knoppen in gewone woorden: Stoppen, Herstel, Bevestig, Opnieuw, Opslaan, Delen, Nog een ronde, Klaar.
