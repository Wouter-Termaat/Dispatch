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
    if (q.op === 'select') return { data: db[table], error: null };
    return { error: null };
  };
  const api = {
    insert(r) { q.op = 'insert'; q.rows = r; return api; }, delete() { q.op = 'delete'; return api; }, upsert(r) { q.op = 'upsert'; q.rows = r; return api; },
    update(r) { q.op = 'update'; q.rows = r; return api; }, select() { q.op = 'select'; return api; }, eq(k, v) { q.filters.push([k, v]); return api; },
    range() { return api; }, order() { return api; }, then(res, rej) { return Promise.resolve(run()).then(res, rej); },
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
