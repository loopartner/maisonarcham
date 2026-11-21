// Outils communs du back-office : journal d'audit, export CSV, calculs.
import { redis } from './store.js';
import { clientIp } from './http.js';

// Journal d'audit : qui a fait quoi, quand, depuis quelle adresse IP (500 dernières actions).
export async function audit(request, user, action, details = {}) {
  const entry = { at: new Date().toISOString(), by: user.email, name: `${user.firstName} ${user.lastName}`.trim(), action, details, ip: clientIp(request) };
  await redis('LPUSH', 'audit', JSON.stringify(entry));
  await redis('LTRIM', 'audit', 0, 499);
}

// CSV compatible Excel (séparateur « ; », BOM UTF-8). Neutralise les formules (=, +, -, @) : anti-injection CSV.
export function toCsv(header, rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

export function csvResponse(filename, csv) {
  return new Response(csv, { headers: {
    'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
  } });
}

export const PAID = new Set(['payee', 'confirmee', 'preparation', 'expediee', 'livree']);
export const isPaid = (o) => PAID.has(o.status);
