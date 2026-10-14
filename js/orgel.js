// Draaiorgel: een eigen walsje (3/4, F-groot), live gespeeld met WebAudio. Geen bestanden, geen rechten.
// Bas op de één, akkoord op twee en drie, een speeldoosmelodie erboven. 16 maten, daarna weer van voren
// (de tweede keer een octaaf hoger met een tegenmelodie).
let ctx = null, out = null, timer = 0, playing = false, nextTime = 0, step = 0, duck = 1;
const BPM = 138, BEAT = 60 / BPM, VOL = .16;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// akkoorden per maat
const CH = { F: [41, [65, 69, 72]], C7: [48, [64, 67, 70]], Bb: [46, [65, 70, 74]], Dm: [50, [65, 69, 74]], Am: [45, [64, 69, 72]], Gm: [43, [67, 70, 74]] };
const PROG = ['F', 'F', 'C7', 'C7', 'Bb', 'F', 'C7', 'F', 'Dm', 'Am', 'Bb', 'F', 'Gm', 'C7', 'F', 'F'];
// melodie: per maat [noot, tellen]
const MEL = [
  [[72, 1], [69, 1], [72, 1]], [[77, 3]], [[76, 1], [74, 1], [72, 1]], [[67, 3]],
  [[74, 1], [70, 1], [74, 1]], [[72, 2], [69, 1]], [[70, 1], [69, 1], [67, 1]], [[65, 3]],
  [[69, 1], [74, 1], [77, 1]], [[76, 2], [72, 1]], [[74, 1], [77, 1], [74, 1]], [[72, 3]],
  [[70, 1], [74, 1], [79, 1]], [[76, 2], [72, 1]], [[69, 1], [72, 1], [77, 1]], [[77, 3]],
];

function note(t, m, dur, type, gain, lp = 4000) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = lp;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
}
function musicBox(t, m, gain = .22) {
  note(t, m, 1.4, 'sine', gain, 6000);
  note(t, m + 12, .5, 'sine', gain * .25, 8000);     // heldere boventoon
  note(t, m + 19, .25, 'triangle', gain * .08, 8000);
}

function schedule() {
  while (nextTime < ctx.currentTime + .35) {
    const loop = Math.floor(step / 48), bar = Math.floor(step / 3) % 16, beat = step % 3;
    const [root, chord] = CH[PROG[bar]];
    const up = loop % 2 ? 12 : 0;
    if (beat === 0) { note(nextTime, root, .5, 'triangle', .34, 900); note(nextTime, root + 12, .3, 'triangle', .08, 900); }
    else chord.forEach(n => note(nextTime, n - 12, .22, 'square', .028, 1500));
    // melodie: noten die op deze tel beginnen
    let pos = 0;
    for (const [m, len] of MEL[bar]) { if (pos === beat) musicBox(nextTime, m + up, up ? .16 : .22); pos += len; }
    // tegenmelodie in de tweede ronde: zachte arpeggio
    if (up && beat) musicBox(nextTime + BEAT / 2, chord[beat % chord.length], .05);
    nextTime += BEAT; step++;
  }
}

export function startOrgel() {
  if (playing) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = ctx || new AC();
  if (ctx.state === 'suspended') ctx.resume();
  out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
  out.gain.linearRampToValueAtTime(VOL * duck, ctx.currentTime + 2.5);
  playing = true; nextTime = ctx.currentTime + .1; step = 0;
  timer = setInterval(schedule, 60); schedule();
}
export function stopOrgel() {
  if (!playing) return; playing = false; clearInterval(timer);
  const o = out; o.gain.cancelScheduledValues(ctx.currentTime); o.gain.setValueAtTime(o.gain.value, ctx.currentTime); o.gain.linearRampToValueAtTime(0, ctx.currentTime + .6);
  setTimeout(() => { try { o.disconnect(); } catch { /* */ } }, 800);
}
/** Zachter tijdens het spelen, zodat de keuzegeluiden erbovenuit komen. */
export function duckOrgel(on) {
  duck = on ? .45 : 1;
  if (playing && out) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(VOL * duck, ctx.currentTime + .8); }
}
export const orgelPlaying = () => playing;
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (playing) ctx.resume(); });
