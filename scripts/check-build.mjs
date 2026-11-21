// Contrôle de sécurité après le build : toute page qui violerait la CSP stricte fait échouer le déploiement.
//  - aucun script exécutable intégré (seuls les blocs de données type="application/json" sont admis)
//  - aucun attribut style="…" ni balise <style> (hors SVG)
//  - aucune ressource chargée depuis un autre domaine
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}
const problems = [];
const files = await walk(DIST);
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const rel = path.relative(DIST, f);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    if (/\bsrc=/.test(attrs)) { if (/src="(https?:)?\/\//.test(attrs)) problems.push(`${rel} : script externe ${attrs}`); continue; }
    if (!/type="application\/json"/.test(attrs)) problems.push(`${rel} : script intégré`);
  }
  const noSvg = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  if (/\sstyle="/.test(noSvg)) problems.push(`${rel} : attribut style`);
  if (/<style[\s>]/.test(noSvg)) problems.push(`${rel} : balise <style>`);
  if (/<(link|img|source|iframe)[^>]+(href|src|srcset)="https?:\/\/(?!maisonarcham)/.test(html.replace(/<link rel="(alternate|canonical)"[^>]*>/g, ''))) problems.push(`${rel} : ressource externe`);
}
if (problems.length) { console.error('Contrôle CSP : ÉCHEC\n' + problems.join('\n')); process.exit(1); }
console.log(`Contrôle CSP : ${files.length} page(s) conformes`);
