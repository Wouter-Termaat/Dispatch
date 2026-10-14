// Geluid, gesynthetiseerd met WebAudio (geen bestanden). Kort en subtiel.
// liftHill(): zacht ratelen bij het laden · bell(): heldere stationsbel bij een keuze
// whoosh(): bij een verrassende uitslag · applause(): kort applaus na een sessie
let ctx = null, master = null, enabled = true;

export function setSound(on) { enabled = !!on; }
function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Na de eerste aanraking mag audio starten (browserregel)
export function unlock() { if (enabled) ac(); }

let noiseBuf = null;
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function bell(pitch = 1) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  [[1318.5, .16], [2637, .06], [3951, .03]].forEach(([f, g]) => {
    const o = c.createOscillator(), v = c.createGain(); o.type = 'sine'; o.frequency.value = f * pitch;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .004); v.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(v).connect(master); o.start(t); o.stop(t + 1);
  });
}

export function tick() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), v = c.createGain(); o.type = 'triangle'; o.frequency.value = 1900;
  v.gain.setValueAtTime(.05, t); v.gain.exponentialRampToValueAtTime(.0001, t + .05);
  o.connect(v).connect(master); o.start(t); o.stop(t + .06);
}

export function liftHill(dur = 1.3) {
  const c = ac(); if (!c) return; const t0 = c.currentTime; let t = 0, gap = .085;
  while (t < dur) {
    const s = c.createBufferSource(); s.buffer = noise(c);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 500; f.Q.value = 6;
    const v = c.createGain(); const at = t0 + t;
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(.22 * (1 - t / dur * .5), at + .003); v.gain.exponentialRampToValueAtTime(.0001, at + .03);
    s.connect(f).connect(v).connect(master); s.start(at, Math.random()); s.stop(at + .04);
    t += gap; gap *= 1.02;
  }
}

export function whoosh() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noise(c);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + .35); f.frequency.exponentialRampToValueAtTime(600, t + .7);
  const v = c.createGain(); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(.16, t + .25); v.gain.exponentialRampToValueAtTime(.0001, t + .75);
  s.connect(f).connect(v).connect(master); s.start(t); s.stop(t + .8);
}

export function applause(dur = 2.2) {
  const c = ac(); if (!c) return; const t0 = c.currentTime;
  for (let k = 0; k < 160; k++) {
    const at = t0 + Math.random() * dur * Math.random() ** .3; const s = c.createBufferSource(); s.buffer = noise(c);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1800; f.Q.value = 1.5;
    const v = c.createGain(); const env = Math.sin(Math.PI * Math.min(1, (at - t0) / dur)) * .09 + .01;
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(env, at + .002); v.gain.exponentialRampToValueAtTime(.0001, at + .045);
    s.connect(f).connect(v).connect(master); s.start(at, Math.random() * 1.5); s.stop(at + .06);
  }
}

// ---------- extra effecten ----------
function env(c, t, peak, dur, attack = .004) { const v = c.createGain(); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(peak, t + attack); v.gain.exponentialRampToValueAtTime(.0001, t + dur); return v; }
function tone(c, t, freq, type, peak, dur, lp) {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq; const v = env(c, t, peak, dur);
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f).connect(v); } else o.connect(v);
  v.connect(master); o.start(t); o.stop(t + dur + .05);
}

/** Kaart die omdraait: zacht papieren tikje. */
export function flip() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noise(c); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400;
  const v = env(c, t, .1, .08, .002); s.connect(f).connect(v).connect(master); s.start(t, Math.random()); s.stop(t + .1);
}
/** Kiezen (tab, spelvorm, filter): houten klikje. */
export function select() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  tone(c, t, 1150, 'triangle', .06, .05); tone(c, t + .012, 2300, 'sine', .02, .04);
}
/** Bevestigen: oplopend akkoordje. */
export function confirm() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + i * .055, f, 'sine', .08, .5));
}
/** Blad open: zachte zucht. */
export function swoosh() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = noise(c); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1600, t + .22);
  const v = env(c, t, .05, .28, .06); s.connect(f).connect(v).connect(master); s.start(t); s.stop(t + .3);
}
/** Start van een spel: kort fanfaretje. */
export function fanfare(big = false) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const notes = big ? [[523.25, 0, .18], [659.25, .16, .18], [783.99, .32, .18], [1046.5, .48, .9]] : [[392, 0, .14], [523.25, .12, .4]];
  notes.forEach(([f, at, d]) => { tone(c, t + at, f, 'sawtooth', .05, d + .1, 1800); tone(c, t + at, f * 2, 'square', .012, d, 2600); });
}
/** Tromgeroffel richting de affiche. */
export function drumroll(dur = .9) {
  const c = ac(); if (!c) return; const t0 = c.currentTime;
  for (let t = 0; t < dur; t += .035) {
    const s = c.createBufferSource(); s.buffer = noise(c); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = .9;
    const v = env(c, t0 + t, .03 + .1 * (t / dur), .05, .002); s.connect(f).connect(v).connect(master); s.start(t0 + t, Math.random()); s.stop(t0 + t + .06);
  }
  tone(c, t0 + dur, 110, 'sine', .25, .5);   // bekken/pauk aan het eind
}
/** Witte stip gevonden: glinsterend loopje. */
export function sparkle() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  [1318.5, 1567.98, 1975.5, 2637, 3135.96].forEach((f, i) => tone(c, t + i * .06, f, 'sine', .06, .7));
}
