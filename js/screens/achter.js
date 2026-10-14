// Achter de schermen: waarom Dispatch werkt zoals het werkt. Eerste versie door Claude Code, Wouter past hem aan.
import { backdrop } from '../stage.js';

export default {
  nav: 'meer', title: 'Achter de schermen',
  mount({ bg, fg, go }) {
    backdrop(bg, 'dim');
    fg.innerHTML = `<div class="page"><article class="achter">
      <button class="link back" id="back">‹ Meer</button>
      <div class="eyebrow">Achter de schermen</div>
      <h1 class="h-title big">Waarom Dispatch zo werkt</h1>

      <p class="lead">Luca en ik hielden onze achtbanen bij in een Excel. 169 banen bij mij, 159 bij Luca. Een nieuwe baan erin zetten betekende scrollen, twijfelen, nog eens scrollen, en uiteindelijk een plek kiezen waar ik een week later alweer aan twijfelde. Dispatch is mijn poging om dat eerlijker en leuker te doen.</p>

      <h2>Vergelijken in plaats van sorteren</h2>
      <p>Niemand kan 169 dingen in één keer op volgorde zetten. Maar twee banen naast elkaar? Dat weet je meestal meteen. Dus vraagt Dispatch steeds kleine vragen, en rekent hij zelf uit wat de volgorde moet zijn.</p>

      <h2>Waarom rijen van vier</h2>
      <p>Bij La Rangée tik je vier banen op volgorde. Dat zijn in één keer zes vergelijkingen. In de simulatie is een lijst van 169 na ongeveer 100 tot 150 rijen stabiel. Met losse duels duurt het ongeveer drie keer zo lang. Daarom is de rij de hoofdmodus, en is het duel er voor de twijfelgevallen.</p>

      <h2>Je Excel telt mee, maar niet te veel</h2>
      <p>Mijn oude volgorde is niet waardeloos. Elke baan begint op zijn plek uit de Excel, en die plek telt als een paar virtuele duels (de ankersterkte, standaard drie). Vind je dat je Excel er helemaal naast zat, zet het anker dan op licht. Vertrouw je hem, zet hem op sterk.</p>

      <h2>Elke keuze telt, steeds opnieuw</h2>
      <p>Het model (een Bradley-Terry-model, voor wie het wil weten) rekent bij elke keuze alles opnieuw door. De volgorde waarin je kiest maakt niet uit, en je dagvorm ook niet echt: een verrassende uitslag weegt zwaarder dan een verwachte, gelijk telt als een half, en "weet niet" telt niet mee.</p>

      <h2>Hoe zeker is het?</h2>
      <p>Bij elke baan houdt Dispatch bij tussen welke plekken hij waarschijnlijk staat. Is dat bereik klein genoeg, dan heet hij zeker. Dispatch kiest zelf de banen waar de meeste twijfel over is, tegen banen die er dichtbij staan. Daardoor leer je per tik zo veel mogelijk.</p>

      <h2>Waarom je je eigen rang niet ziet</h2>
      <p>Tijdens het ranken zie je nooit op welke plek een baan nu staat. Anders ga je onbewust je oude volgorde verdedigen. Pas op de affiche en in het programma zie je wat er is verschoven.</p>

      <h2>De poster</h2>
      <p>Het plein is mijn eigen poster: de molen, de lampjes, de straat. Licht speelt de hoofdrol, net als in een echte voorstelling. Wat ertoe doet staat in de spot.</p>

      <p class="sign">Wouter</p>
    </article></div>`;
    fg.querySelector('#back').onclick = () => go('meer');
  },
};
