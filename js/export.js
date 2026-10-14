// Excel-export per persoon, in het eigen format van Wouter of Luca (SPEC sectie 6). ExcelJS wordt pas geladen als het nodig is.
// buildWorkbook is los te gebruiken (ook in Node, voor tools/test-export.mjs).

const EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const FONT = { name: 'Montserrat', size: 12 };
const LIST = 'List of Coaster';

/**
 * @param ExcelJS  de ExcelJS-module
 * @param p { key:'wouter'|'luca', dynamics:{labels,values}, rows:[{name,park,manufacturer,operational}] }  rows in rankingvolgorde
 */
export function buildWorkbook(ExcelJS, { key, dynamics, rows }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dispatch'; wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  const luca = key === 'luca';
  // Wouter: F = Punten F (zonder operatief), G = Punten P (maal operatief). Luca andersom.
  const fF = n => `IF(ISBLANK(B${n}),"",IF((Dynamics!$B$3-Dynamics!$B$2*A${n})<0,0,(Dynamics!$B$3-Dynamics!$B$2*A${n})))`;
  const fP = n => `IF(ISBLANK(B${n}),"",IF((Dynamics!$B$3-Dynamics!$B$2*A${n})<0,0,((Dynamics!$B$3-Dynamics!$B$2*A${n})*E${n})))`;
  const colP = luca ? 'F' : 'G', colF = luca ? 'G' : 'F';

  // ---------- List of Coaster ----------
  const ws = wb.addWorksheet(LIST, { views: [{ state: 'frozen', ySplit: 1 }] });
  const last = rows.length + 1;
  const pts = (n, rank, op) => { const v = Math.max(0, dynamics.values[1] - dynamics.values[0] * rank); return { F: v, P: v * op }; };
  ws.addTable({
    name: 'Coasters', ref: 'A1', headerRow: true,
    style: { theme: 'TableStyleLight1', showRowStripes: true },
    columns: [{ name: 'Rank' }, { name: 'Naam' }, { name: 'Park' }, { name: 'Fabrikant' }, { name: 'Operatief' }, { name: luca ? 'Punten P' : 'Punten F' }, { name: luca ? 'Punten F' : 'Punten P' }],
    rows: rows.map((r, i) => {
      const n = i + 2, op = r.operational === false ? 0 : 1, p = pts(n, i + 1, op);
      const F = luca ? { formula: fP(n), result: p.P } : { formula: fF(n), result: p.F };
      const G = luca ? { formula: fF(n), result: p.F } : { formula: fP(n), result: p.P };
      return [{ formula: `IF(ISBLANK(B${n}),"",ROW()-1)`, result: i + 1 }, r.name, r.park || '', r.manufacturer || '', op, F, G];
    }),
  });
  ws.getColumn('B').width = 44; ws.getColumn('C').width = 37; ws.getColumn('D').width = 36; ws.getColumn('E').width = 11;
  ws.getColumn('F').numFmt = '0'; ws.getColumn('G').numFmt = '0';
  const white = { color: { argb: 'FFFFFFFF' } };
  ws.addConditionalFormatting({ ref: `A2:A${last}`, rules: [
    { type: 'cellIs', operator: 'equal', formulae: ['1'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF1C232' } }, font: white } },
    { type: 'cellIs', operator: 'equal', formulae: ['2'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFB7B7B7' } }, font: white } },
    { type: 'cellIs', operator: 'equal', formulae: ['3'], priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFAD7C5E' } }, font: white } },
  ] });
  ws.addConditionalFormatting({ ref: `E2:E${last}`, rules: [
    { type: 'cellIs', operator: 'equal', formulae: ['0'], priority: 4, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFCCCCCC' } } } },
  ] });

  // ---------- Parken ----------
  const parks = [...new Set(rows.map(r => r.park).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
  const wp = wb.addWorksheet('Parken', { views: [{ state: 'frozen', ySplit: 1 }] });
  wp.addRow(['Park', 'Aantal', 'In gebruik', 'Punten', 'Gemiddeld', 'Favo']);
  parks.forEach((park, i) => {
    const n = i + 2;
    wp.addRow([park,
      { formula: `COUNTIF('${LIST}'!C:C,A${n})` },
      { formula: `COUNTIFS('${LIST}'!C:C,A${n},'${LIST}'!E:E,1)` },
      { formula: `SUMIF('${LIST}'!C:C,A${n},'${LIST}'!${colP}:${colP})` },
      { formula: `IFERROR(D${n}/C${n}, 0)` },
      { formula: `IFERROR((E${n}/Dynamics!$B$8)*(1+(D${n}/Dynamics!$B$9)), 0)` }]);
  });
  wp.getColumn('A').width = 34;

  // ---------- Fabrikanten ----------
  const mans = [...new Set(rows.map(r => r.manufacturer).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
  const wf = wb.addWorksheet('Fabrikanten', { views: [{ state: 'frozen', ySplit: 1 }] });
  wf.addRow(['Fabrikant', 'Aantal', 'Punten', 'P/A']);
  mans.forEach((m, i) => {
    const n = i + 2;
    wf.addRow([m,
      { formula: `COUNTIF('${LIST}'!$D:$D,A${n})` },
      { formula: `SUMIF('${LIST}'!D:D,A${n},'${LIST}'!${colF}:${colF})` },
      { formula: `C${n}/B${n}` }]);
  });
  wf.getColumn('A').width = 38;

  // ---------- Dynamics ----------
  const wd = wb.addWorksheet('Dynamics', { views: [{ state: 'frozen', ySplit: 1 }] });
  wd.getCell('A1').value = 'Naam'; wd.getCell('B1').value = 'Waarde';
  [2, 3, 5, 6, 8, 9].forEach((r, i) => { wd.getCell('A' + r).value = dynamics.labels[i]; wd.getCell('B' + r).value = dynamics.values[i]; });

  // lettertype overal Montserrat 12, kopregel vet
  for (const sheet of [ws, wp, wf, wd]) {
    sheet.eachRow({ includeEmpty: false }, (row, rn) => row.eachCell({ includeEmpty: true }, cell => { cell.font = { ...FONT, ...(rn === 1 ? { bold: true } : {}) }; }));
    sheet.properties.defaultRowHeight = 18;
  }
  return wb;
}

function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = EXCELJS; s.async = true;
    s.onload = () => res(window.ExcelJS); s.onerror = () => rej(new Error('ExcelJS kon niet geladen worden'));
    document.head.appendChild(s);
  });
}

/** Bouwt de Excel van een persoon (in de huidige modelvolgorde) en downloadt of deelt hem.
 *  share = true: via het deelmenu (op Android o.a. "Opslaan in Drive"), anders downloaden. */
export async function exportExcel({ key, name, dynamics, ranking, catalog, share = false }) {
  const ExcelJS = await loadExcelJS();
  const rows = ranking.map(id => catalog.get(id)).filter(Boolean).map(c => ({ name: c.name, park: c.park, manufacturer: c.manufacturer, operational: c.operational }));
  const wb = buildWorkbook(ExcelJS, { key, dynamics, rows });
  const buf = await wb.xlsx.writeBuffer();
  const d = new Date(), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const file = `Top List Coasters ${name} ${iso}.xlsx`;
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([buf], { type });
  if (share) {
    const f = new File([blob], file, { type });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: file }); return file; }
      catch (e) { if (e.name === 'AbortError') return null; }
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return file;
}
