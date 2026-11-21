// Empreinte de contenu des fichiers CSS/JS de public/ (?v=…) : le navigateur recharge dès qu'un fichier change.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const memo = new Map();
export function asset(p) {
  if (!memo.has(p)) memo.set(p, `${p}?v=${createHash('sha256').update(readFileSync(join(process.cwd(), 'public', p))).digest('hex').slice(0, 10)}`);
  return memo.get(p);
}
