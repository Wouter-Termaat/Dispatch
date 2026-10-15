// Keuzepagina voor de coasterfoto's: per baan mijn keuze groot, alternatieven ernaast. Keuzes gaan direct naar fotos/keuze.json.
//   node tools/photos/review.mjs        en open http://localhost:8131
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = new URL('../../fotos/', import.meta.url);
const PORT = 8131;
const file = new URL('keuze.json', DIR);
const load = async () => JSON.parse(await readFile(file, 'utf8'));

const PAGE = String.raw`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Foto's kiezen</title>
<style>
:root{--bg:#14100d;--panel:#1f1914;--ink:#f3e9dc;--mute:#a8998a;--gold:#e0b45c;--ok:#7fbf7a;--no:#d9725f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:rgba(20,16,13,.94);backdrop-filter:blur(8px);padding:14px 16px;border-bottom:1px solid #3a2f25;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0;flex:1}.stat{color:var(--mute)}
button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid #5a4a3a;background:#2a221b;color:var(--ink);padding:8px 14px}
button.main{background:var(--gold);color:#1a130c;border-color:var(--gold);font-weight:600}
main{max-width:1180px;margin:0 auto;padding:16px}
.c{background:var(--panel);border-radius:14px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;border:2px solid transparent}
.c.ok{border-color:rgba(127,191,122,.5)}.c.no{border-color:rgba(217,114,95,.6)}
.c h2{margin:0;font-size:17px}.c .sub{color:var(--mute);font-size:13px;margin-bottom:8px}
.big{position:relative;border-radius:10px;overflow:hidden;aspect-ratio:3/2;background:#000;cursor:crosshair}
.big img{width:100%;height:100%;object-fit:cover;display:block}
.big .fp{position:absolute;width:22px;height:22px;margin:-11px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #0008;pointer-events:none}
.side{display:flex;flex-direction:column;gap:10px}
.prev{display:flex;gap:10px;align-items:flex-end}
.card{border-radius:10px;overflow:hidden;background:#000;position:relative;box-shadow:0 4px 14px #0009}
.card img{width:100%;height:100%;object-fit:cover;display:block}
.card span{position:absolute;left:6px;bottom:5px;font-size:11px;color:#fff;text-shadow:0 1px 3px #000}
.alts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.alts img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:6px;cursor:pointer;opacity:.85;border:2px solid transparent}
.alts img:hover{opacity:1}.alts img.on{border-color:var(--gold);opacity:1}
.acts{display:flex;gap:8px;flex-wrap:wrap}.acts button.on{background:var(--ok);color:#10180f;border-color:var(--ok)}.acts button.nn.on{background:var(--no);border-color:var(--no)}
.note{color:var(--mute);font-size:12px}
@media (max-width:760px){.c{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Foto's kiezen</h1><span class="stat" id="stat"></span><button class="main" id="all">Alles goedgekeurd</button></header>
<main><p class="note">Mijn keuze staat groot. Tik op een alternatief om te wisselen, of op Geen van deze als je iets beters wilt, dan zoek ik verder. Tik in de grote foto om te kiezen waar de kaart op inzoomt (de kaartjes laten zien hoe hij in de app valt). Alles wordt direct bewaard.</p><div id="list"></div></main>
<script>
let data = [];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const save = (id, patch) => fetch('/keuze', { method: 'POST', body: JSON.stringify({ id, ...patch }) });
function stat() { const ok = data.filter(c => c.status === 'ok').length, no = data.filter(c => c.status === 'no').length; $('#stat').textContent = ok + ' goed, ' + no + ' afgekeurd, ' + (data.length - ok - no) + ' nog te bekijken'; }
function src(c, n) { return '/img/' + c.id + '/' + n + '.jpg'; }
function render() {
  $('#list').innerHTML = data.map(c => {
    const pos = (c.focus?.x ?? 50) + '% ' + (c.focus?.y ?? 50) + '%';
    return '<section class="c ' + (c.status || '') + '" data-id="' + c.id + '">' +
      '<div><h2>' + esc(c.name) + '</h2><div class="sub">' + esc(c.park) + (c.note ? ' · ' + esc(c.note) : '') + '</div>' +
      '<div class="big"><img src="' + src(c, c.pick) + '" style="object-position:' + pos + '"><i class="fp" style="left:' + (c.focus?.x ?? 50) + '%;top:' + (c.focus?.y ?? 50) + '%"></i></div></div>' +
      '<div class="side"><div class="prev">' +
        '<div class="card" style="width:130px;height:174px"><img src="' + src(c, c.pick) + '" style="object-position:' + pos + '"><span>kaart laptop</span></div>' +
        '<div class="card" style="width:150px;height:140px"><img src="' + src(c, c.pick) + '" style="object-position:' + pos + '"><span>kaart telefoon</span></div></div>' +
      '<div class="alts">' + (c.opts || [c.pick, ...c.alts]).map(n => '<img data-n="' + n + '" class="' + (n === c.pick ? 'on' : '') + '" src="' + src(c, n) + '" loading="lazy">').join('') + '</div>' +
      '<div class="acts"><button class="ok' + (c.status === 'ok' ? ' on' : '') + '">Goed</button><button class="nn' + (c.status === 'no' ? ' on' : '') + '">Geen van deze</button></div>' +
      '</div></section>';
  }).join('');
  stat();
}
$('#list').addEventListener('click', e => {
  const sec = e.target.closest('.c'); if (!sec) return;
  const c = data.find(x => x.id === sec.dataset.id);
  if (e.target.matches('.alts img')) { c.pick = +e.target.dataset.n; c.focus = { x: 50, y: 50 }; c.status = 'ok'; save(c.id, { pick: c.pick, focus: c.focus, status: 'ok' }); }
  else if (e.target.closest('.big')) { const r = e.target.closest('.big').getBoundingClientRect(); c.focus = { x: Math.round((e.clientX - r.left) / r.width * 100), y: Math.round((e.clientY - r.top) / r.height * 100) }; save(c.id, { focus: c.focus }); }
  else if (e.target.matches('.ok')) { c.status = c.status === 'ok' ? '' : 'ok'; save(c.id, { status: c.status }); }
  else if (e.target.matches('.nn')) { c.status = c.status === 'no' ? '' : 'no'; save(c.id, { status: c.status }); }
  else return;
  const y = scrollY; render(); scrollTo(0, y);
});
$('#all').onclick = async () => { for (const c of data) if (!c.status) { c.status = 'ok'; await save(c.id, { status: 'ok' }); } render(); };
fetch('/data').then(r => r.json()).then(d => { data = d; render(); });
</script></body></html>`;

createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (req.url === '/data') { const k = await load(); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(Object.entries(k).map(([id, v]) => ({ id, ...v })))); }
    const m = req.url.match(/^\/img\/([a-z0-9-]+)\/(\d+)\.jpg$/);
    if (m) {
      const groot = new URL(`groot/${m[1]}/${m[2]}.jpg`, DIR), klein = new URL(`kandidaten/${m[1]}/${m[2]}.jpg`, DIR);
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=3600' });
      return res.end(await readFile(existsSync(groot) ? groot : klein));
    }
    if (req.url === '/keuze' && req.method === 'POST') {
      let body = ''; for await (const ch of req) body += ch;
      const { id, ...patch } = JSON.parse(body); const k = await load();
      if (k[id]) { Object.assign(k[id], patch); await writeFile(file, JSON.stringify(k, null, 1)); }
      res.writeHead(204); return res.end();
    }
    res.writeHead(404); res.end();
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log(`Keuzepagina: http://localhost:${PORT}  (bestand: ${fileURLToPath(file)})`));
