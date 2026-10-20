// Achter de schermen: het speluitlegboekje van Dispatch, zoals bij een kaartspel in de doos. Vaste tekst.
import { backdrop } from '../stage.js';
import { dot } from '../stippen.js';
import { icon } from '../modes.js';

const TOC = [['intro', 'Waarom dit spel'], ['idee', 'Het idee in één minuut'], ['spelvormen', 'De spelvormen'], ['rekenen', 'Hoe Dispatch rekent'], ['rest', 'De rest van de voorstelling'], ['coulissen', 'Achter de coulissen'], ['slot', 'Tot slot']];

const mode = (k, naam, sub, tekst) => `<div class="bk-mode"><span class="bk-mi">${icon(k)}</span><div><h3>${naam} <small>${sub}</small></h3><p>${tekst}</p></div></div>`;

export default {
  nav: 'meer', title: 'Achter de schermen',
  mount({ bg, fg, go }) {
    backdrop(bg, 'dim');
    fg.innerHTML = `<div class="page"><article class="achter" id="boek">
      <button class="link back" id="back">‹ Meer</button>
      <div class="eyebrow">Speluitleg</div>
      <h1 class="h-title big">Het programmaboekje</h1>
      <p class="lead">Alles wat je wilt weten over Dispatch, van de eerste tik tot de laatste lamp die uitgaat. Lees het in één keer, of spring naar wat je zoekt.</p>

      <nav class="bk-toc" aria-label="Inhoud">${TOC.map(([id, t], i) => `<a href="#" data-to="${id}"><i>${i + 1}</i>${t}</a>`).join('')}</nav>

      <h2 id="intro">1. Waarom dit spel</h2>
      <p>Er was eens een Excel-lijst. Twee eigenlijk: een van Wouter en een van Luca, met alle achtbanen die ze ooit hebben gereden, van beste naar slechtste. Prachtige lijsten, maar met een probleem: een nieuwe baan een plek geven was gokken, en of plek 37 nou echt beter was dan plek 38, wist eigenlijk niemand.</p>
      <p>Dispatch is de verbeterde versie van die lijst. Je ranking wordt preciezer naarmate je speelt, de app weet bij elke baan hoe zeker die plek is, en het ranken zelf is gewoon leuk om te doen.</p>

      <h2 id="idee">2. Het idee in één minuut</h2>
      <p>Niemand kan 169 achtbanen in één keer op volgorde zetten. Maar twee banen naast elkaar? Dat weet je meestal binnen een seconde. Dus stelt Dispatch je steeds kleine vragen: welke van deze twee vind je beter? Uit al die kleine antwoorden rekent hij zelf de volgorde uit.</p>
      <p>Je hoeft dus nooit meer te slepen of te scrollen. Je kiest alleen, en de lijst schuift vanzelf op zijn plek.</p>

      <h2 id="spelvormen">3. De spelvormen</h2>
      <p>Op Spelen kies je hoe je wilt spelen. Een ronde duurt standaard tien keuzes, en daarna krijg je de affiche met wat er is veranderd.</p>
      ${mode('duel', 'Le Duel', '1 tegen 1', 'Twee banen, één keuze. Tik de beste, of gebruik op de laptop de pijltjes. De snelste manier om even tien minuten weg te tikken, en de spelvorm voor elke dag.')}
      ${mode('rij', 'La Rangée', 'rij van 4', 'Vier banen op een rij. Tik ze op volgorde van beste naar minste en bevestig. Tik de laatste nog eens om hem terug te nemen. Eén rij zijn zes duels tegelijk, dus dit is de snelste weg naar een zekere ranking. Een ronde is vijf rijen.')}
      ${mode('twijfel', 'Twijfelzone', 'duels', 'Alleen de banen waar Dispatch nog het minst zeker over is. Lastige keuzes, maar hier leert hij per tik het meest.')}
      ${mode('park', 'Park-avond', 'duels', 'Kies een park en speel alleen duels tussen de banen daarvan. Bij een klein park komt elk paar precies één keer langs, bij een groot park duurt de avond wat langer.')}
      ${mode('rematch', 'Rematch', 'duels', 'Dispatch zoekt keuzes die elkaar tegenspreken. Een rondje zoals A boven B, B boven C en toch C boven A, of een uitslag die heel onwaarschijnlijk was. Die speel je opnieuw. Je oude keuze blijft staan, de nieuwe telt mee als extra stem. Is er niets tegenstrijdigs, dan hoor je dat je opvallend consequent bent.')}
      ${mode('toernooi', 'Toernooi', 'bracket', 'Zestien banen in een bracket, tot er één kampioen over is. Kies willekeurig (zestien banen die in je ranking bij elkaar staan), per fabrikant of per park. Elke match telt gewoon mee als vergelijking.')}

      <h3>Focus: Top 10, Top 25, Top 50 of Laatste 10</h3>
      <p>Bij Le Duel, La Rangée en Twijfelzone kun je kiezen met welk deel van je ranking je speelt. De rand doet ook mee: bij Top 10 zitten er een paar banen net onder je top 10 bij, zodat een stijger er nog in kan komen. De statusregel laat dan zien hoe zeker dat deel is.</p>

      <h3>De knoppen onder de kaarten</h3>
      <p><b>Gelijk</b> als je ze echt even goed vindt: dat telt als een halve winst voor allebei. <b>Weet niet</b> als je een van de twee niet meer goed weet: die keuze telt niet mee. <b>Herstel</b> draait je laatste keuze terug. Tik je heel snel achter elkaar, dan gaat de <b>trimrem</b> erop en komen de kaarten iets trager binnen. Een goede keuze heeft heel even tijd nodig.</p>

      <h2 id="rekenen">4. Hoe Dispatch rekent</h2>
      <h3>Een kracht per baan</h3>
      <p>Achter de schermen heeft elke baan een getal: hoe sterk hij is in jouw smaak. Je ranking is gewoon die getallen op volgorde. Het verschil tussen twee banen zegt hoe waarschijnlijk het is dat je de een boven de ander kiest. Een groot verschil is bijna zeker, een klein verschil is een gok. Dit heet een Bradley-Terry-model, hetzelfde idee waarmee ook sporters en teams worden gerangschikt.</p>
      <h3>Verrassingen tellen zwaar</h3>
      <p>Wint je nummer 1 van je nummer 150, dan verandert er bijna niets: dat wist Dispatch al. Wint een baan van halverwege je lijst van een baan uit je top 10, dan schuift hij flink op. Je krijgt dus geen vaste punten per winst, het hangt af van van wie je wint.</p>
      <h3>Alles telt in één keer</h3>
      <p>Na elke keuze rekent Dispatch al je keuzes opnieuw door, niet alleen de laatste. De volgorde waarin je kiest maakt daardoor niet uit, en winst telt door: wint A van B en B van C, dan weet Dispatch ook iets over A tegen C. Een rij van vier telt als zes duels: elke baan tegen elke andere in die rij.</p>
      <h3>Je Excel is het startpunt</h3>
      <p>Elke baan begint op zijn plek uit je oude lijst. Die plek telt ongeveer als twee battles. Genoeg om niet bij nul te beginnen, en klein genoeg dat je eigen keuzes het al snel overnemen.</p>
      <h3>Hoe zeker is het?</h3>
      <p>Dispatch weet niet alleen waar een baan staat, maar ook hoe zeker dat is. Op de baankaart zie je dat als balk: waarschijnlijk tussen plek zoveel en zoveel. Die balk laat de plekken zien waar de baan in acht van de tien gevallen staat. Een baan heet zeker als die balk smal is en je hem minstens drie keer zelf in een duel hebt gehad. Je Excel alleen maakt een baan dus nooit zeker.</p>
      <h3>Waarom Dispatch zelf de duels kiest</h3>
      <p>Twee banen die ver uit elkaar staan, leren weinig. Dispatch zoekt daarom vooral paren die dicht bij elkaar staan en waar hij nog over twijfelt. Af en toe zit er bewust een paar tussen dat verder uit elkaar staat, als controle. En tijdens het spelen zie je nooit op welke plek een baan staat. Anders ga je onbewust je oude lijst verdedigen.</p>

      <h2 id="rest">5. De rest van de voorstelling</h2>
      <h3>Ranking</h3>
      <p>Je volledige lijst. Zoek op baan, park of fabrikant, sorteer op bijvoorbeeld onzekerst eerst, meeste duels of stijgers, en bekijk de ranglijst per park of per fabrikant. Tik op een baan voor de baankaart: zijn plek met de balk, van wie hij won en verloor, een eigen notitie, en de knop om gegevens aan te passen of hem van je lijst te halen.</p>
      <h3>Inzichten</h3>
      <p>Bovenaan de smaakmatch: in procenten hoeveel de rankings van Wouter en Luca op elkaar lijken. Onder Jij staan je eigen cijfers: hoeveel en wanneer je speelt, per spelvorm, je grootste stijgers en dalers sinds je Excel en je grootste verrassing. Onder Verhalen staan de opvallendste verschillen tussen jullie, onder Samen een ranking van jullie samen, en onder Nog te rijden de banen die de ander wel heeft gereden en jij nog niet.</p>
      <h3>De affiche</h3>
      <p>Na elke ronde verschijnt een affiche: hoeveel je hebt gespeeld, de grootste stijger en daler, je zwaarste keuze en hoe zeker je ranking nu is. Die zwaarste keuze is een mix van twee dingen: hoe lang je twijfelde, vergeleken met je eigen tempo in die ronde, en hoe dicht de twee banen bij elkaar stonden.</p>
      <h3>Een baan toevoegen</h3>
      <p>Via Meer voeg je een nieuwe baan toe: zoek hem in de catalogus of maak hem aan. Geef een gok waar hij ongeveer hoort, daarna volgen een paar duels die hem precies plaatsen. Na een stuk of negen keuzes staat hij op zijn plek.</p>
      <h3>Tickets</h3>
      <p>Bij 100, 500 en 1000 vergelijkingen verdien je een ticket: Stamgast, Abonnement en Erelid.</p>
      <h3>Exporteren</h3>
      <p>In Meer exporteer je je ranking naar Excel, in het vertrouwde format van je oude lijst. Op je telefoon kun je hem ook direct delen of in Drive zetten.</p>
      <h3>Witte stippen</h3>
      <p>Ergens in het ontwerp zitten tien witte stippen verstopt. Tik er een aan en hij is gevonden. Waar ze zitten, staat niet in dit boekje. In Meer kun je wel om een tip vragen. Wie ze alle tien vindt, krijgt er iets voor terug.</p>
      <h3>De sfeer</h3>
      <p>Het park leeft mee met de klok. Na elf uur 's avonds gaan de lichten uit en zijn alleen de sterren nog wakker, en rond Halloween hangt er iets kils in de lucht. Muziek staat aan of uit in Meer.</p>

      <h2 id="coulissen">6. Achter de coulissen</h2>
      <div class="bk-box">
        <p><b>Geen app store nodig.</b> Dispatch is een website die zich gedraagt als app. Zet hem op je beginscherm en hij opent zoals elke andere app.</p>
        <p><b>Rekenen op je eigen telefoon.</b> Het model rekent op je telefoon zelf, in een apart deel van de browser, zodat de animaties nooit haperen. Alle battles opnieuw doorrekenen kost een paar honderdste seconde.</p>
        <p><b>Werkt ook zonder internet.</b> Geen bereik in de wachtrij van een achtbaan? Je keuzes worden bewaard en verstuurd zodra je weer verbinding hebt.</p>
        <p><b>Alleen voor jullie.</b> Alles staat in een eigen database achter een login. Alleen Wouter en Luca kunnen erbij.</p>
      </div>

      <h2 id="slot">7. Tot slot</h2>
      <p>Dit spel is een cadeautje voor Wouter en Luca. Veel plezier met ranken, en moge jullie lijsten nooit meer twijfelen.</p>

      <p class="sign">Claude${dot('handtekening', 'signdot', 'span')}</p>
    </article></div>`;
    fg.querySelector('#back').onclick = () => go('meer');
    fg.querySelector('.bk-toc').onclick = e => {
      const a = e.target.closest('[data-to]'); if (!a) return; e.preventDefault();
      fg.querySelector('#' + a.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  },
};
