// Achtergronden en licht. De WebGL-mist is weg (te rommelig); licht zit nu in CSS: de scène op Spelen,
// een gedeelde achtergrond met zonnestralen op de andere schermen, en spots per kaart.

export function now() {
  const q = new URLSearchParams(location.search).get('nu'); // testhaak: ?nu=2026-10-31T23:30
  return q ? new Date(q) : new Date();
}
export function isHalloween(d = now()) { const m = d.getMonth(), day = d.getDate(); return (m === 9 && day >= 24) || (m === 10 && day <= 2); }
export function isClosed(d = now()) { const h = d.getHours(); return h >= 23 || h < 6; }

export function initStage() {
  document.getElementById('fx')?.remove();
  if (isHalloween()) document.documentElement.classList.add('halloween');
}

/** Gedeelde achtergrond: variant 'stage' (podiumvloer voor ranken) of 'dim' (rustig, voor lijsten). */
export function backdrop(bg, variant = '') {
  let stars = '';
  for (let i = 0; i < 46; i++) stars += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;animation-delay:${(Math.random() * 6).toFixed(1)}s"></i>`;
  bg.innerHTML = `<div class="backdrop ${variant}"><div class="bd-rays"></div><div class="bd-sun"></div><div class="bd-stars">${stars}</div><div class="bd-floor"></div></div>`;
}

// oude API (licht via WebGL): bewust leeg
export function light() {}
export function beams() {}
export function spotOver() { return {}; }
