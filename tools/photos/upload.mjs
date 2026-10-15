// Zet de foto's uit fotos/web in de afgeschermde Supabase-map. Wouter draait dit zelf en typt zijn wachtwoord in de terminal;
// het wordt nergens bewaard. Eerst eenmalig sql/fotos.sql draaien in Supabase.
//   node tools/photos/build.mjs && node tools/photos/upload.mjs
import { readFile, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../../js/config.js';

const WEB = new URL('../../fotos/web/', import.meta.url);

function ask(q, hidden = false) {
  return new Promise(res => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(q); };   // wachtwoord niet tonen
    rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); res(a.trim()); });
  });
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const email = process.env.DISPATCH_EMAIL || await ask('E-mail: ');
const password = await ask('Wachtwoord: ', true);
const { error: le } = await sb.auth.signInWithPassword({ email, password });
if (le) { console.error('Inloggen lukte niet:', le.message); process.exit(1); }

const b = sb.storage.from('fotos');
const index = JSON.parse(await readFile(new URL('index.json', WEB), 'utf8'));
const want = new Set((await readdir(WEB)).filter(f => f.endsWith('.webp')));

// wat staat er al? (bestanden heten naar hun versie, dus wat er staat is goed)
const have = new Set();
for (let off = 0; ; off += 1000) {
  const { data, error } = await b.list('', { limit: 1000, offset: off });
  if (error) { console.error('Map lezen lukte niet:', error.message, '\nIs sql/fotos.sql al gedraaid?'); process.exit(1); }
  data.forEach(f => have.add(f.name)); if (data.length < 1000) break;
}
const todo = [...want].filter(f => !have.has(f));
console.log(`${todo.length} nieuwe bestanden, ${want.size - todo.length} staan er al`);
let n = 0;
for (const f of todo) {
  const { error } = await b.upload(f, await readFile(new URL(f, WEB)), { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
  if (error) { console.error('\nFOUT', f, error.message); process.exit(1); }
  process.stdout.write(`\r${++n} van ${todo.length}`);
}
// als laatste de index: pas dan ziet de app de nieuwe foto's
const { error: ie } = await b.upload('index.json', JSON.stringify(index), { contentType: 'application/json', cacheControl: '60', upsert: true });
if (ie) { console.error('\nFOUT index.json', ie.message); process.exit(1); }
// oude versies opruimen
const old = [...have].filter(f => f.endsWith('.webp') && !want.has(f));
if (old.length) await b.remove(old);
console.log(`\nKlaar: ${Object.keys(index).length} banen met foto${old.length ? `, ${old.length} oude bestanden opgeruimd` : ''}.`);
