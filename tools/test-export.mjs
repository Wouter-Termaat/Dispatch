// Bouwt de Excel-export voor Wouter en Luca uit data/seed.json, schrijft hem weg en leest hem terug. node tools/test-export.mjs [bestand.xlsx]
import ExcelJS from 'exceljs';
import { readFile, mkdir } from 'node:fs/promises';
import { buildWorkbook } from '../js/export.js';

const ok = (c, m) => { console.log((c ? 'OK   ' : 'FOUT ') + m); if (!c) process.exitCode = 1; };
const seed = JSON.parse(await readFile('data/seed.json', 'utf8'));
const cat = new Map(seed.coasters.map(c => [c.id, c]));
await mkdir('test-results', { recursive: true });

async function check(file, key, expectN, firstName) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  const luca = key === 'luca';
  ok(wb.worksheets.map(w => w.name).join('|') === 'List of Coaster|Parken|Fabrikanten|Dynamics', `[${key}] tabbladen`);
  const ws = wb.getWorksheet('List of Coaster');
  ok(ws.rowCount === expectN + 1, `[${key}] ${expectN} banen + kopregel`);
  ok(ws.getCell('A1').value === 'Rank' && ws.getCell('B1').value === 'Naam' && ws.getCell('E1').value === 'Operatief', `[${key}] koppen A-E`);
  ok(ws.getCell('F1').value === (luca ? 'Punten P' : 'Punten F') && ws.getCell('G1').value === (luca ? 'Punten F' : 'Punten P'), `[${key}] koppen F/G: ${ws.getCell('F1').value} / ${ws.getCell('G1').value}`);
  ok(ws.getCell('B2').value === firstName, `[${key}] volgorde: eerste baan ${ws.getCell('B2').value}`);
  ok(ws.getCell('A5').formula === 'IF(ISBLANK(B5),"",ROW()-1)', `[${key}] A: ${ws.getCell('A5').formula}`);
  const fF = 'IF(ISBLANK(B5),"",IF((Dynamics!$B$3-Dynamics!$B$2*A5)<0,0,(Dynamics!$B$3-Dynamics!$B$2*A5)))';
  const fP = 'IF(ISBLANK(B5),"",IF((Dynamics!$B$3-Dynamics!$B$2*A5)<0,0,((Dynamics!$B$3-Dynamics!$B$2*A5)*E5)))';
  ok(ws.getCell('F5').formula === (luca ? fP : fF), `[${key}] F: ${ws.getCell('F5').formula}`);
  ok(ws.getCell('G5').formula === (luca ? fF : fP), `[${key}] G: ${ws.getCell('G5').formula}`);
  ok([['B', 44], ['C', 37], ['D', 36], ['E', 11]].every(([c, w]) => ws.getColumn(c).width === w), `[${key}] kolombreedtes B44 C37 D36 E11`);
  ok(ws.getCell('F3').numFmt === '0' && ws.getCell('G3').numFmt === '0', `[${key}] getalnotatie F en G: 0`);
  ok(ws.getCell('C7').font?.name === 'Montserrat' && ws.getCell('C7').font?.size === 12 && ws.getCell('B1').font?.bold, `[${key}] Montserrat 12, kopregel vet`);
  ok(ws.views?.[0]?.state === 'frozen' && ws.views[0].ySplit === 1, `[${key}] bovenste rij vastgezet`);
  const cf = ws.conditionalFormattings || [];
  const colA = cf.find(c => c.ref.startsWith('A2')), colE = cf.find(c => c.ref.startsWith('E2'));
  const fills = colA?.rules.map(r => r.formulae[0] + ':' + r.style.fill.bgColor.argb).join(' ');
  ok(fills === '1:FFF1C232 2:FFB7B7B7 3:FFAD7C5E' && colA.rules.every(r => r.style.font.color.argb === 'FFFFFFFF'), `[${key}] voorwaardelijke opmaak A: ${fills}, tekst wit`);
  ok(colE?.rules[0].formulae[0] === '0' && colE.rules[0].style.fill.bgColor.argb === 'FFCCCCCC', `[${key}] voorwaardelijke opmaak E: 0 = #CCCCCC`);
  const t = Object.values(ws.tables || {})[0]; const tm = t?.table || t;
  ok(tm && (tm.tableRef || tm.ref)?.startsWith('A1') && (tm.style?.showRowStripes ?? true), `[${key}] Excel-tabel ${tm?.tableRef || tm?.ref} met rijstrepen`);
  const wp = wb.getWorksheet('Parken');
  const P = luca ? 'F' : 'G', F = luca ? 'G' : 'F';
  ok(wp.getCell('B2').formula === "COUNTIF('List of Coaster'!C:C,A2)" && wp.getCell('C2').formula === "COUNTIFS('List of Coaster'!C:C,A2,'List of Coaster'!E:E,1)", `[${key}] Parken B/C`);
  ok(wp.getCell('D3').formula === `SUMIF('List of Coaster'!C:C,A3,'List of Coaster'!${P}:${P})`, `[${key}] Parken D: ${wp.getCell('D3').formula}`);
  ok(wp.getCell('E3').formula === 'IFERROR(D3/C3, 0)' && wp.getCell('F3').formula === 'IFERROR((E3/Dynamics!$B$8)*(1+(D3/Dynamics!$B$9)), 0)', `[${key}] Parken E/F`);
  const parks = []; wp.eachRow((r, i) => i > 1 && parks.push(r.getCell(1).value));
  ok(parks.join() === [...parks].sort((a, b) => a.localeCompare(b, 'nl')).join() && wp.getColumn('A').width === 34, `[${key}] Parken alfabetisch (${parks.length}), breedte 34`);
  const wf = wb.getWorksheet('Fabrikanten');
  ok(wf.getCell('B2').formula === "COUNTIF('List of Coaster'!$D:$D,A2)" && wf.getCell('C2').formula === `SUMIF('List of Coaster'!D:D,A2,'List of Coaster'!${F}:${F})` && wf.getCell('D2').formula === 'C2/B2' && wf.getColumn('A').width === 38, `[${key}] Fabrikanten: ${wf.getCell('C2').formula}`);
  const wd = wb.getWorksheet('Dynamics');
  const dyn = [2, 3, 5, 6, 8, 9].map(r => `${wd.getCell('A' + r).value}=${wd.getCell('B' + r).value}`).join(', ');
  ok(wd.getCell('A1').value === 'Naam' && wd.getCell('B1').value === 'Waarde', `[${key}] Dynamics: ${dyn}`);
  ok(!wd.getCell('A4').value && !wd.getCell('A7').value, `[${key}] Dynamics rijen 4 en 7 leeg`);
}

const external = process.argv[2];
if (external) {
  const key = /Luca/.test(external) ? 'luca' : 'wouter';
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(external);
  const n = wb.getWorksheet('List of Coaster').rowCount - 1;
  await check(external, key, n, wb.getWorksheet('List of Coaster').getCell('B2').value);
} else {
  for (const p of seed.profiles) {
    const rows = seed.entries.filter(e => e.user_id === p.id).sort((a, b) => a.initial_rank - b.initial_rank).map(e => cat.get(e.coaster_id));
    const wb = buildWorkbook(ExcelJS, { key: p.key, dynamics: p.dynamics, rows });
    const file = `test-results/Top List Coasters ${p.name}.xlsx`;
    await wb.xlsx.writeFile(file);
    await check(file, p.key, rows.length, rows[0].name);
  }
}
