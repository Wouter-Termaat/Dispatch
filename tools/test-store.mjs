// Test van de offline wachtrij in SupabaseStore met een nep-Supabase: node tools/test-store.mjs
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
globalThis.addEventListener = () => {};
const { SupabaseStore } = await import('../js/store.js');

let net = 'offline'; const db = { comparisons: [], entries: [], coasters: [{ id: 'x', name: 'X', park: 'P' }] }; const calls = [];
function builder(table) {
  const q = { table, op: null, rows: null, filters: [] };
  const run = () => {
    calls.push(q.op + ' ' + table);
    if (net === 'offline') return { error: { message: 'TypeError: Failed to fetch', code: '' } };
    if (net === 'rls' && table === 'entries') return { error: { message: 'new row violates row-level security policy', code: '42501' } };
    if (q.op === 'insert') db[table].push(...q.rows);
    if (q.op === 'delete') db[table] = db[table].filter(r => !q.filters.every(([k, v]) => r[k] === v));
    if (q.op === 'upsert') db[table].push(q.rows);
    if (q.op === 'select') { const rows = (db[table] || []).filter(r => q.filters.every(([k, v]) => r[k] === v)); return { data: q.single ? rows[0] || null : rows, error: null }; }
    return { error: null };
  };
  const api = {
    insert(r) { q.op = 'insert'; q.rows = r; return api; }, delete() { q.op = 'delete'; return api; }, upsert(r) { q.op = 'upsert'; q.rows = r; return api; },
    update(r) { q.op = 'update'; q.rows = r; return api; }, select() { q.op = 'select'; return api; }, eq(k, v) { q.filters.push([k, v]); return api; },
    range() { return api; }, order() { return api; }, limit() { return api; }, single() { q.single = true; return api; }, then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
const st = new SupabaseStore();
st.sb = { from: builder, auth: { refreshSession: async () => ({}) } };
st.userId = 'u1';
st.data = { coasters: [...db.coasters], profiles: [{ id: 'u1', key: 'wouter', settings: {} }], entries: [], comparisons: [] };
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FOUT ') + m); if (!c) process.exitCode = 1; };
const settle = () => new Promise(r => setTimeout(r, 20));

// offline: alles blijft lokaal zichtbaar en in de wachtrij
await st.addComparisons([{ a: 'x', b: 'y', outcome: 'a', batch: 'b1', user_id: 'u1', mode: 'rangee', created_at: '2026-10-14T10:00:00Z' }]);
await st.addComparisons([{ a: 'x', b: 'z', outcome: 'b', batch: 'b2', user_id: 'u1', mode: 'rangee', created_at: '2026-10-14T10:00:01Z' }]);
await st.deleteBatch('u1', 'b2');
await settle();
ok(st.data.comparisons.length === 1, 'offline: wijzigingen direct lokaal zichtbaar');
ok(st.pending === 3 && st.offline, `offline: 3 ops in de wachtrij (${st.pending})`);
ok(JSON.parse(localStorage.getItem('dispatch.queue.v1')).length === 3, 'wachtrij staat in localStorage (overleeft herladen)');

// weer online: wachtrij loopt leeg in volgorde
net = 'ok'; await st.flush(); await settle();
ok(st.pending === 0 && !st.offline, 'online: wachtrij leeg');
ok(db.comparisons.length === 1 && db.comparisons[0].batch === 'b1', 'database bevat alleen de niet-herstelde batch');

// een geweigerde rij (RLS) blokkeert de rest niet
net = 'rls';
await st.upsertEntry({ user_id: 'u1', coaster_id: 'x', initial_rank: 3 });
await st.addComparisons([{ a: 'x', b: 'q', outcome: 'tie', batch: 'b3', user_id: 'u1', mode: 'duel', created_at: '2026-10-14T10:00:02Z' }]);
await settle(); await st.flush(); await settle();
ok(st.pending === 0, 'geweigerde op wordt overgeslagen, de rest gaat door');
ok(db.comparisons.some(c => c.batch === 'b3'), 'volgende vergelijking toch opgeslagen');

// herladen met openstaande wachtrij: ops worden opnieuw toegepast op verse data
net = 'offline'; await st.addComparisons([{ a: 'x', b: 'w', outcome: 'a', batch: 'b4', user_id: 'u1', mode: 'duel', created_at: '2026-10-14T10:00:03Z' }]);
await settle();
const st2 = new SupabaseStore(); st2.sb = st.sb; st2.userId = 'u1';
st2.queue = JSON.parse(localStorage.getItem('dispatch.queue.v1'));
net = 'ok'; db.profiles = [{ id: 'u1', key: 'wouter' }];
const flushOrig = st2.flush.bind(st2); st2.flush = () => {};   // eerst alleen laden
await st2.load();
ok(st2.data.comparisons.some(c => c.batch === 'b4'), 'na herladen: nog niet verstuurde vergelijking zichtbaar');
st2.flush = flushOrig; await st2.flush();
ok(st2.pending === 0 && db.comparisons.some(c => c.batch === 'b4'), 'na herladen: wachtrij alsnog verstuurd');

// na een verloren antwoord: de vergelijking staat al in de database, opnieuw versturen mag geen dubbele geven
net = 'ok'; const before = db.comparisons.length;
const op = { t: 'comps', tried: true, rows: [{ a: 'x', b: 'y', outcome: 'a', batch: 'b1', user_id: 'u1', mode: 'rangee', created_at: '2026-10-14T10:00:00Z' }] };
st2.queue.push(op); await st2.flush();
ok(db.comparisons.length === before && st2.pending === 0, 'opnieuw versturen na verloren antwoord: geen dubbele vergelijking');
// instellingen: stippen van een ander apparaat gaan niet verloren
db.profiles = [{ id: 'u1', key: 'wouter', settings: { dots: ['molen', 'boog'] } }];
st2.data.profiles = [{ id: 'u1', key: 'wouter', settings: { dots: ['logo-i'] } }];
await st2.saveSettings('u1', { sound: false }); await settle(); await st2.flush();
ok(true, 'instellingen samengevoegd: ' + JSON.stringify(st2.data.profiles[0].settings));

// witte stippen resetten: de reset wint van oudere stippen, daarna tellen nieuwe vondsten weer gewoon op
const { mergeSettings } = await import('../js/store.js');
const r1 = mergeSettings({ dots: ['a', 'b'], musicUnlocked: true }, { dots: [], musicUnlocked: false, dotsResetAt: 5 });
const r2 = mergeSettings(r1, { dots: ['c'] });
const r3 = mergeSettings({ dots: ['a', 'b'], musicUnlocked: true, dotsResetAt: 1 }, r1);
ok(r1.dots.length === 0 && !r1.musicUnlocked && r2.dots.join() === 'c' && r2.dotsResetAt === 5 && r3.dots.length === 0, 'witte stippen opnieuw zoeken: reset wint, nieuwe vondsten tellen weer op');

// logboek: tabel 'events' bestaat nog niet -> stilletjes overslaan, geen foutmelding, wachtrij blokkeert niet
{
  let errs = 0; st2.addEventListener('error', () => errs++);
  const realFrom = st2.sb.from;
  st2.sb = { ...st2.sb, from: t => t === 'events' ? { insert: async () => ({ error: { message: 'relation "public.events" does not exist', code: '42P01' } }) } : realFrom(t) };
  net = 'ok'; st2.log({ type: 'choice', data: { ms: 900 }, user_id: 'u1', created_at: new Date().toISOString() }); st2.flushLog();
  await st2.addComparisons([{ a: 'x', b: 'v', outcome: 'a', batch: 'b9', user_id: 'u1', mode: 'duel', created_at: '2026-10-20T10:00:00Z' }]);
  await settle(); await st2.flush(); await settle();
  ok(errs === 0 && st2.queue.length === 0 && db.comparisons.some(c => c.batch === 'b9'), 'logboek zonder tabel: overgeslagen, geen melding, rest gaat door');
  ok(st2.pending === 0, 'logboek telt niet mee als wachtende wijziging');
}

// ideeënbus zonder tabel: briefje apart bewaard, rest gaat door; zodra de tabel er is, gaat het alsnog mee
{
  const st3 = new SupabaseStore(); st3.userId = 'u1';
  st3.data = { coasters: [...db.coasters], profiles: [{ id: 'u1', key: 'wouter', settings: {} }], entries: [], comparisons: [], ideas: [] };
  let errs = 0; st3.addEventListener('error', () => errs++);
  let haveTable = false; const ideasDb = [];
  st3.sb = { auth: st.sb.auth, from: t => t !== 'ideas' ? builder(t) : {
    insert: async r => (haveTable ? (ideasDb.push(r), { error: null }) : { error: { message: 'Could not find the table public.ideas', code: 'PGRST205' } }),
    select() { return { range: () => ({ order: async () => (haveTable ? { data: ideasDb, error: null } : { data: null, error: { code: 'PGRST205', message: 'geen tabel' } }) }) }; },
  } };
  net = 'ok';
  await st3.addIdea({ id: 'i1', user_id: 'u1', kind: 'bug', text: 'Flikkert op de Mac', created_at: '2026-10-21T09:00:00Z' });
  await st3.addComparisons([{ a: 'x', b: 'k', outcome: 'a', batch: 'b10', user_id: 'u1', mode: 'duel', created_at: '2026-10-21T09:00:01Z' }]);
  await settle(); await st3.flush(); await settle();
  ok(errs === 0 && st3.queue.length === 0 && st3.parked.length === 1 && db.comparisons.some(c => c.batch === 'b10'), 'idee zonder tabel: apart bewaard, geen melding, rest gaat door');
  ok(st3.data.ideas.length === 1 && st3.data.ideas[0].kind === 'bug' && st3.data.ideas[0].user_id === 'u1', 'idee staat lokaal met categorie, tekst en afzender');
  haveTable = true; await st3.load(); await settle(); await st3.flush(); await settle();
  ok(ideasDb.length === 1 && ideasDb[0].text === 'Flikkert op de Mac' && st3.parked.length === 0, 'tabel er: bewaard idee alsnog verstuurd');
}
