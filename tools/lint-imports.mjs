// Vindt ongebruikte imports: node tools/lint-imports.mjs
import { readFileSync, readdirSync } from 'node:fs';
const files = [...readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f), ...readdirSync('js/screens').map(f => 'js/screens/' + f)];
let n = 0;
for (const f of files) {
  const s = readFileSync(f, 'utf8'); const body = s.replace(/^import[^\n]*\n/gm, '');
  for (const m of s.matchAll(/^import \{([^}]*)\} from/gm))
    for (const name of m[1].split(',').map(x => x.trim().split(' as ').pop()).filter(Boolean))
      if (!new RegExp('(^|[^\w$])' + name.replace(/\$/g, '\$') + '([^\w$]|$)').test(body)) { console.log(f, 'ongebruikt:', name); n++; }
}
console.log(n ? `${n} ongebruikte imports` : 'geen ongebruikte imports');
