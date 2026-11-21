// GET  /api/admin/subscribers?q=&status=&page=&format=csv — abonnés (confirmés, en attente, désinscrits).
// POST /api/admin/subscribers — désinscrire une adresse. Corps : { email }
import { handle, json, error, readJson, clean, normEmail } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { redis } from '../../_lib/store.js';
import { unsubscribe } from '../../_lib/newsletter.js';
import { toCsv, csvResponse, audit } from '../../_lib/admin.js';

const pairs = (arr) => { const m = new Map(); for (let i = 0; i < (arr || []).length; i += 2) m.set(arr[i], arr[i + 1]); return m; };
const PAGE = 50;

export async function subscriberList() {
  const [active, dates, sources, pending, unsub] = await Promise.all([redis('SMEMBERS', 'newsletter'), redis('HGETALL', 'newsletter:dates'), redis('HGETALL', 'newsletter:sources'), redis('HGETALL', 'newsletter:pending'), redis('HGETALL', 'newsletter:unsub')]);
  const D = pairs(dates), S = pairs(sources), out = [];
  for (const e of active || []) out.push({ email: e, status: 'confirme', at: D.get(e) || null, source: S.get(e) || 'site' });
  for (const [e, v] of pairs(pending)) { if (!(active || []).includes(e)) { let p = {}; try { p = JSON.parse(v); } catch { /* ignoré */ } out.push({ email: e, status: 'attente', at: p.at || null, source: p.source || 'site' }); } }
  for (const [e, at] of pairs(unsub)) if (!(active || []).includes(e)) out.push({ email: e, status: 'desinscrit', at, source: '—' });
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

const LABEL = { confirme: 'Consentement confirmé', attente: 'En attente', desinscrit: 'Désinscrit' };

export const GET = handle(async (request) => {
  const { user } = await requireStaff(request, 'newsletter');
  const q = new URL(request.url).searchParams;
  const search = clean(q.get('q'), 100).toLowerCase(), status = clean(q.get('status'), 20), page = Math.max(1, Math.floor(Number(q.get('page')) || 1));
  const all = await subscriberList();
  let rows = all;
  if (status) rows = rows.filter((s) => s.status === status);
  if (search) rows = rows.filter((s) => s.email.includes(search));
  if (q.get('format') === 'csv') {
    await audit(request, user, 'newsletter.export', { count: rows.length });
    return csvResponse(`abonnes-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Adresse e-mail', 'Statut', 'Date', 'Source'], rows.map((s) => [s.email, LABEL[s.status], s.at ? new Date(s.at).toLocaleString('fr-FR') : '', s.source])));
  }
  const d30 = Date.now() - 30 * 86400000;
  const stats = { active: all.filter((s) => s.status === 'confirme').length, new30: all.filter((s) => s.status === 'confirme' && Date.parse(s.at) >= d30).length, pending: all.filter((s) => s.status === 'attente').length, unsub30: all.filter((s) => s.status === 'desinscrit' && Date.parse(s.at) >= d30).length };
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  return json({ ok: true, stats, total: rows.length, page: Math.min(page, pages), pages, subscribers: rows.slice((page - 1) * PAGE, page * PAGE).map((s) => ({ ...s, statusLabel: LABEL[s.status] })) });
});

export const POST = handle(async (request) => {
  const { user } = await requireStaff(request, 'newsletter');
  const email = normEmail((await readJson(request, 500)).email);
  if (!email) return error('Adresse invalide.', 422);
  await unsubscribe(email);
  await audit(request, user, 'newsletter.desinscription', { email });
  return json({ ok: true });
});
