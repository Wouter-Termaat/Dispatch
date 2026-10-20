// Opslag: één interface, twee implementaties.
//   LocalStore    (?demo=1): data/seed.json + localStorage, geen login.
//   SupabaseStore (normaal): Supabase met e-mail + wachtwoord, schrijfacties optimistisch via een wachtrij.
// Alle schrijfacties zijn "ops". Een op wordt eerst lokaal toegepast (direct zichtbaar), daarna bewaard.
//   { t:'comps', rows }                    vergelijkingen toevoegen
//   { t:'delBatch', user_id, batch }       een batch (rij of duel) terugdraaien
//   { t:'entry', row }                     lijstregel toevoegen of wijzigen
//   { t:'delEntry', user_id, coaster_id }  baan uit een lijst halen
//   { t:'coaster', row }                   catalogus: baan toevoegen of wijzigen
//   { t:'settings', user_id, settings }    instellingen van een profiel
//   { t:'events', rows }                   logboek voor statistieken (zie js/track.js); nooit een foutmelding voor de gebruiker

import { forgetPhotos } from './photos.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { uuid } from './ui.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

class BaseStore extends EventTarget {
  constructor() { super(); this.data = { coasters: [], profiles: [], entries: [], comparisons: [] }; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  get pending() { return 0; }

  apply(op) {
    const d = this.data;
    switch (op.t) {
      case 'comps': d.comparisons.push(...op.rows); break;
      case 'delBatch': d.comparisons = d.comparisons.filter(c => !(c.batch === op.batch && c.user_id === op.user_id)); break;
      case 'entry': {
        const i = d.entries.findIndex(e => e.user_id === op.row.user_id && e.coaster_id === op.row.coaster_id);
        if (i >= 0) d.entries[i] = { ...d.entries[i], ...op.row }; else d.entries.push({ prior_strength: 1, reridden_at: null, note: null, ...op.row });
        break;
      }
      case 'delEntry': d.entries = d.entries.filter(e => !(e.user_id === op.user_id && e.coaster_id === op.coaster_id)); break;
      case 'coaster': {
        // altijd een nieuwe array: de opzoektabel in state.js ververst op een nieuwe array
        const i = d.coasters.findIndex(c => c.id === op.row.id);
        d.coasters = i >= 0 ? d.coasters.map((c, k) => (k === i ? { ...c, ...op.row } : c)) : [...d.coasters, { operational: true, photo_url: null, ...op.row }];
        break;
      }
      case 'settings': { const p = d.profiles.find(p => p.id === op.user_id); if (p) p.settings = mergeSettings(p.settings, op.settings); break; }
    }
  }

  /** Nooit em dashes of en dashes in de app: ook niet uit de catalogus. */
  normalize() { const re = new RegExp('\\s*[' + String.fromCharCode(0x2013, 0x2014) + ']\\s*', 'g'); for (const c of this.data.coasters) for (const k of ['name', 'park', 'manufacturer']) if (c[k]) c[k] = c[k].replace(re, ' - '); }

  async write(op) { this.apply(op); this.emit('change', op); await this.persist(op); }
  async persist() { }

  // handige wrappers
  addComparisons(rows) { return this.write({ t: 'comps', rows }); }
  deleteBatch(user_id, batch) { return this.write({ t: 'delBatch', user_id, batch }); }
  upsertEntry(row) { return this.write({ t: 'entry', row }); }
  deleteEntry(user_id, coaster_id) { return this.write({ t: 'delEntry', user_id, coaster_id }); }
  upsertCoaster(row) { return this.write({ t: 'coaster', row }); }
  saveSettings(user_id, settings) { return this.write({ t: 'settings', user_id, settings }); }

  // logboek: gebeurtenissen bufferen en per groepje wegschrijven (de wachtrij hoeft niet bij elke tik te bewegen)
  log(ev) { (this.evBuf ||= []).push(ev); clearTimeout(this.evT); this.evT = setTimeout(() => this.flushLog(), this.evBuf.length >= 40 ? 0 : 8000); }
  flushLog() { clearTimeout(this.evT); const rows = this.evBuf || []; if (!rows.length) return; this.evBuf = []; this.persist({ t: 'events', rows }); }
}

// ---------------------------------------------------------------- demo
const DEMO_KEY = 'dispatch.demo.v1', DEMO_ME = 'dispatch.demo.me';

export class LocalStore extends BaseStore {
  constructor() { super(); this.kind = 'demo'; }
  async init() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { saved = null; }
    if (saved && saved.coasters?.length) this.data = saved;
    else {
      const seed = await (await fetch('data/seed.json')).json();
      this.data = {
        coasters: seed.coasters.map(c => ({ photo_url: null, ...c })),
        profiles: seed.profiles.map(p => ({ settings: {}, ...p })),
        entries: seed.entries.map(e => ({ prior_strength: 1, reridden_at: null, note: null, ...e })),
        comparisons: [],
      };
      this.save();
    }
    this.normalize();
    const key = localStorage.getItem(DEMO_ME);
    this.userId = this.data.profiles.find(p => p.key === key)?.id || null;
    return this;
  }
  save() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.data)); } catch (e) { console.warn('Demo-opslag vol', e); } }
  async persist() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 150); }
  get needsLogin() { return !this.userId; }
  async chooseProfile(key) { localStorage.setItem(DEMO_ME, key); this.userId = this.data.profiles.find(p => p.key === key).id; }
  async signOut() { localStorage.removeItem(DEMO_ME); this.userId = null; }
  async reset() { localStorage.removeItem(DEMO_KEY); await this.init(); }
  // demo: het logboek blijft alleen in het geheugen (handig om te testen), nooit in localStorage
  log(ev) { (this.events ||= []).push(ev); if (this.events.length > 2000) this.events.shift(); }
  flushLog() { }
}

// ---------------------------------------------------------------- Supabase
const QUEUE_KEY = 'dispatch.queue.v1', CACHE_KEY = 'dispatch.cache.v1';

export class SupabaseStore extends BaseStore {
  constructor() { super(); this.kind = 'supabase'; this.queue = []; this.flushing = false; }

  async init() {
    const { createClient } = await import(SUPABASE_JS);
    this.sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dispatch.auth' } });
    try { this.queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { this.queue = []; }
    const { data } = await this.sb.auth.getSession();
    this.userId = data.session?.user?.id || null;
    if (this.userId) await this.load();
    this.sb.auth.onAuthStateChange((ev, sess) => {
      if (ev === 'SIGNED_OUT' && this.userId) { this.userId = null; this.emit('signedout'); }
      else if (sess?.user?.id && ev === 'TOKEN_REFRESHED') this.flush();
    });
    addEventListener('online', () => this.flush());
    setInterval(() => this.flush(), 20000);
    return this;
  }
  get needsLogin() { return !this.userId; }
  get pending() { return this.queue.filter(op => op.t !== 'events').length; }   // het logboek telt niet als "wachtende wijziging"

  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    this.userId = data.user.id;
    await this.load();
  }
  async signOut() {
    await this.flush();
    await this.sb.auth.signOut().catch(() => {});
    this.userId = null; localStorage.removeItem(CACHE_KEY); forgetPhotos();
  }

  async selectAll(table, order) {
    const out = []; const size = 1000;
    for (let from = 0; ; from += size) {
      let q = this.sb.from(table).select('*').range(from, from + size - 1);
      if (order) q = q.order(order, { ascending: true });
      const { data, error } = await q; if (error) throw error;
      out.push(...data); if (data.length < size) break;
    }
    return out;
  }

  // Leest alles in (beide profielen). Valt terug op de laatste kopie als het netwerk weg is.
  async load() {
    try {
      const [coasters, profiles, entries, comparisons] = await Promise.all([
        this.selectAll('coasters', 'id'), this.selectAll('profiles', 'id'), this.selectAll('entries', 'coaster_id'), this.selectAll('comparisons', 'id')]);
      this.data = { coasters, profiles: profiles.map(p => ({ ...p, settings: p.settings || {} })), entries, comparisons };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(this.data)); } catch { /* te groot: dan zonder kopie */ }
      this.offline = false; this.loadedAt = Date.now();
    } catch (e) {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached) throw e;
      this.data = cached; this.offline = true;
    }
    this.normalize();
    // wijzigingen die nog in de wachtrij staan, opnieuw toepassen bovenop de verse data
    for (const op of this.queue) {
      if (op.t === 'comps' && this.data.comparisons.some(c => c.batch === op.rows[0]?.batch)) continue;   // al op de server
      this.apply(op);
    }
    this.flush();
  }

  saveQueue() { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue)); } catch (e) { console.warn(e); } this.emit('queue', this.queue.length); }
  async persist(op) { this.queue.push(op); this.saveQueue(); this.flush(); }

  async flush() {
    if (this.flushing || !this.queue.length || !this.userId) return;
    this.flushing = true; let again = false;
    try {
      while (this.queue.length) {
        await this.send(this.queue[0]);
        this.queue.shift(); this.saveQueue();
      }
      this.offline = false;
    } catch (e) {
      if (isPermanent(e)) {
        // de database weigert dit echt (bijv. ongeldige data of geen rechten): niet eeuwig blijven proberen
        console.warn('Opslaan geweigerd', e);
        this.queue.shift(); this.saveQueue(); this.emit('error', e);
        again = true;
      } else {
        console.warn('Opslaan mislukt, later opnieuw', e?.message || e);
        this.offline = true; this.emit('queue', this.queue.length);
        if (/JWT|token/i.test(e?.message || '') || e?.code === 'PGRST301') this.sb.auth.refreshSession().catch(() => {});
      }
    } finally { this.flushing = false; }
    if (again) return this.flush();
  }

  async send(op) {
    const sb = this.sb; let r;
    switch (op.t) {
      case 'comps': {
        // na een mislukte poging eerst kijken of de rij toch al is aangekomen (anders dubbel tellen)
        if (op.tried) { const { data: ex } = await sb.from('comparisons').select('id').eq('user_id', op.rows[0].user_id).eq('batch', op.rows[0].batch).limit(1); if (ex?.length) return; }
        op.tried = true; this.saveQueue();
        r = await sb.from('comparisons').insert(op.rows.map(({ a, b, outcome, mode, batch, created_at, user_id }) => ({ a, b, outcome, mode, batch, created_at, user_id }))); break;
      }
      case 'delBatch': r = await sb.from('comparisons').delete().eq('user_id', op.user_id).eq('batch', op.batch); break;
      case 'entry': {
        const e = this.data.entries.find(x => x.user_id === op.row.user_id && x.coaster_id === op.row.coaster_id) || op.row;
        const { user_id, coaster_id, initial_rank, prior_strength = 1, reridden_at = null, note = null } = { ...e, ...op.row };
        r = await sb.from('entries').upsert({ user_id, coaster_id, initial_rank, prior_strength, reridden_at, note }, { onConflict: 'user_id,coaster_id' }); break;
      }
      case 'delEntry': r = await sb.from('entries').delete().eq('user_id', op.user_id).eq('coaster_id', op.coaster_id); break;
      case 'coaster': {
        // alleen de velden die in deze wijziging zitten (geen verouderde lokale kopie terugschrijven)
        const row = Object.fromEntries(Object.entries(op.row).filter(([k, v]) => ['id', 'name', 'park', 'manufacturer', 'operational', 'photo_url', 'created_by'].includes(k) && v !== undefined));
        r = await sb.from('coasters').upsert(row, { onConflict: 'id' }); break;
      }
      case 'events': {
        r = await sb.from('events').insert(op.rows.map(({ user_id, type, session, data, created_at }) => ({ user_id, type, session, data, created_at })));
        // tabel nog niet aangemaakt (sql/stats.sql) of geweigerd: stilletjes overslaan, nooit een melding of blokkade
        if (r.error && (isPermanent(r.error) || /^PGRST2/.test(String(r.error.code)))) { console.info('logboek overgeslagen:', r.error.message); return; }
        break;
      }
      case 'settings': {
        // eerst de actuele instellingen van de server lezen en daar deze wijziging op zetten
        const cur = await sb.from('profiles').select('settings').eq('id', op.user_id).single(); if (cur.error) throw cur.error;
        const merged = mergeSettings(cur.data?.settings, op.settings);
        r = await sb.from('profiles').update({ settings: merged }).eq('id', op.user_id);
        const p = this.data.profiles.find(p => p.id === op.user_id); if (p && !r.error) p.settings = mergeSettings(merged, p.settings);
        break;
      }
    }
    if (r?.error) throw r.error;
  }
}

export function newBatch() { return uuid(); }

/** Instellingen samenvoegen; gevonden witte stippen worden altijd bij elkaar opgeteld (nooit kwijt door een ander apparaat). */
export function mergeSettings(base = {}, patch = {}) {
  const out = { ...(base || {}), ...patch };
  // witte stippen opnieuw beginnen: de nieuwste reset wint, dan geen samenvoegen met de oude stippen
  const rb = base?.dotsResetAt || 0, rp = patch?.dotsResetAt || 0;
  if (rp > rb) { out.dots = patch.dots || []; out.musicUnlocked = !!patch.musicUnlocked; return out; }
  if (rb > rp) out.dotsResetAt = rb;
  if (base?.dots || patch?.dots) out.dots = [...new Set([...(base?.dots || []), ...(patch?.dots || [])])];
  if (base?.musicUnlocked) out.musicUnlocked = true;
  return out;
}

/** Postgres-fouten die bij opnieuw proberen niet verdwijnen (data, constraints, rechten). */
export function isPermanent(e) { return !!e?.code && /^(22|23|42|P0)/.test(String(e.code)); }

export async function createStore() {
  const demo = new URLSearchParams(location.search).has('demo');
  const store = demo ? new LocalStore() : new SupabaseStore();
  await store.init();
  return store;
}
