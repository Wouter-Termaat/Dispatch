// Alle teksten met karakter op één plek, zodat Wouter (en Luca) ze makkelijk kunnen aanvullen.
// Regels: Nederlands, kort, nooit een em dash of en dash. Gebruik een punt, komma of "·".
// In sjablonen worden {naam}, {baan}, {a}, {b}, {plekA}, {plekB}, {verschil}, {fabrikant}, {wie}, {ander} ingevuld.

// De ride-op onderin bij Le Duel. Wisselt bij elke keuze, nooit een vertraging.
export const RIDE_OP = [
  'Tik de winnaar · ↑ ↓ op je laptop',
  'Mooi. Volgende staat klaar.',
  'Smaak is geen wiskunde.',
  'Het publiek houdt de adem in.',
  'Beugels dicht, handen vrij.',
  'Graag even blijven zitten tot de trein stilstaat.',
  'Losse voorwerpen in het kluisje, meningen mogen mee.',
  'Station vrij. Volgende trein.',
  'Eerlijk zeggen, niemand kijkt.',
  'Geen fotograaf in de buurt, dus kies maar.',
  'Wachtrij: 0 minuten. Ga je gang.',
  'Dispatch interval: perfect.',
  'De operator knikt goedkeurend.',
  'Dat was snel. Te snel?',
  'Even voelen in je maag.',
  'Airtime telt dubbel. Zeggen ze.',
  'Het orkest speelt door.',
];

// Easter egg: 5x achter elkaar "gelijk"
export const BESLUITELOOS = 'Kiezen is ook een vak.';

// Na een tik in La Rangée
export const GENOTEERD = ['Genoteerd', 'Genoteerd', 'Genoteerd', 'Vastgelegd', 'In het boekje'];

// Titanenclash: je twee hoogste banen tegen elkaar
export const TITANEN = { titel: 'Titanenclash', sub: ['De twee grootsten van je programma. Geen druk.', 'Dit wordt een avond om te onthouden.', 'Het hele cabaret staat op de stoelen.'] };

// Trimrem: wie te snel klikt
export const TRIMREM = { titel: 'Trimrem geactiveerd', sub: 'Rustig aan, de volgende kaarten komen iets trager binnen.' };

// Plein
export const PLEIN = {
  groet: { avond: 'Goedenavond, {naam}.', middag: 'Goedemiddag, {naam}.', ochtend: 'Goedemorgen, {naam}.', nacht: 'Nog wakker, {naam}?' },
  stabiel: 'Je ranking staat. Het doek mag vallen.',
  gesloten: 'Het park is gesloten. Alleen de sterren zijn nog wakker.',
  halloween: 'Er hangt iets kils in de lucht vanavond.',
};


// Credits: verzamelbare ticketjes
export const TICKETS = [
  { at: 100, naam: 'Stamgast', tekst: '100 vergelijkingen. De portier kent je naam.' },
  { at: 500, naam: 'Abonnement', tekst: '500 vergelijkingen. Je hebt een vaste stoel.' },
  { at: 1000, naam: 'Erelid', tekst: '1000 vergelijkingen. Er hangt een portret van je in de foyer.' },
];

// 404
export const NIET_GEVONDEN = 'Deze attractie is tijdelijk gesloten wegens een technische storing.';

// Samen: plagerige kaarten. Meerdere varianten per soort, er wordt er één gekozen.
export const ROAST = {
  eensgezind: [
    'Over één baan geen woord: <i>{baan}</i> staat bij allebei bovenaan.',
    '<i>{baan}</i> op één, bij allebei. Dat scheelt een hoop discussie in de auto.',
  ],
  eensgezindBijna: [
    '<i>{baan}</i>: bij {a} op {plekA}, bij {b} op {plekB}. Eindelijk eens.',
    'Over <i>{baan}</i> zijn jullie het roerend eens. {a} {plekA}, {b} {plekB}. Noteer de datum.',
  ],
  twist: [
    '<i>{baan}</i>. {hoog} zet hem op {plekHoog}, {laag} laat hem pas op {plekLaag} vertrekken.',
    '<i>{baan}</i> splijt het gezelschap: {plekHoog} bij {hoog}, {plekLaag} bij {laag}.',
    'Over <i>{baan}</i> wordt aan tafel niet meer gesproken. {hoog}: {plekHoog}. {laag}: {plekLaag}.',
  ],
  geheimeLiefde: [
    '<i>{baan}</i>. Bij {wie} {verschil} plekken hoger. Er wordt niet over gesproken.',
    '<i>{baan}</i> staat bij {wie} {verschil} plekken hoger dan bij {ander}. Een stille liefde.',
    '{wie} heeft een zwak voor <i>{baan}</i>. {verschil} plekken zwak, om precies te zijn.',
  ],
  bucket: [
    '<i>{baan}</i> staat bij {ander} hoog. Jij kent hem alleen van verhalen.',
    '{ander} zweert bij <i>{baan}</i>. Tijd voor een roadtrip, {wie}.',
    'Op het verlanglijstje van {wie}: <i>{baan}</i>. {ander} kijkt toe.',
  ],
  fabrikantEens: [
    'Bij <i>{fabrikant}</i> lopen jullie in de pas: {pct}% eens.',
    '<i>{fabrikant}</i> brengt jullie samen. {pct}% overeenstemming.',
  ],
  fabrikantOneens: [
    'Over <i>{fabrikant}</i> moeten jullie nog eens praten: maar {pct}% eens.',
    '<i>{fabrikant}</i> is het splijtzwam van de avond. {pct}% eens.',
  ],
};

// Inside jokes van Wouter en Luca: voeg hier regels toe, ze komen vanzelf mee in de ride-op.
export const INSIDE_JOKES = [
];

/** Vul een sjabloon in. */
export function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')); }
export function rideOpLines() { return [...RIDE_OP, ...INSIDE_JOKES]; }
