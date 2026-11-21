// GET /api/admin/customers?q=&page= — clients (comptes et clients sans compte, regroupés par e-mail) avec leurs statistiques.
import { handle, json, clean } from '../../_lib/http.js';
import { requireStaff, getUser } from '../../_lib/auth.js';
import { redis } from '../../_lib/store.js';
import { allOrders } from '../../_lib/orders.js';
import { isPaid } from '../../_lib/admin.js';
import { roleOf } from '../../_lib/roles.js';
import { env } from '../../_lib/env.js';

const PAGE = 30;

export async function customerIndex() {
  const ids = (await redis('ZRANGE', 'users', 0, -1, 'REV')) || [];
  const users = (await Promise.all(ids.map(getUser))).filter(Boolean);
  const subs = new Set((await redis('SMEMBERS', 'newsletter')) || []);
  const map = new Map();
  for (const u of users) map.set(u.email, { id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`.trim(), account: true, verified: u.emailVerified === true, role: roleOf(u, env('ADMIN_EMAILS')), createdAt: u.createdAt, orders: 0, spent: 0, lastOrder: null, newsletter: subs.has(u.email) });
  for (const o of await allOrders()) {
    const e = String(o.email || '').toLowerCase(); if (!e) continue;
    let c = map.get(e);
    if (!c) { c = { id: null, email: e, name: o.name || '', account: false, verified: false, role: 'client', createdAt: o.createdAt, orders: 0, spent: 0, lastOrder: null, newsletter: subs.has(e) }; map.set(e, c); }
    if (isPaid(o)) { c.orders += 1; c.spent += o.total || 0; }
    if (!c.lastOrder || o.createdAt > c.lastOrder) c.lastOrder = o.createdAt;
    if (o.createdAt < c.createdAt) c.createdAt = o.createdAt;
  }
  return [...map.values()];
}

export const GET = handle(async (request) => {
  await requireStaff(request, 'customers');
  const q = new URL(request.url).searchParams;
  const search = clean(q.get('q'), 100).toLowerCase(), page = Math.max(1, Math.floor(Number(q.get('page')) || 1));
  const all = (await customerIndex()).filter((c) => c.role === 'client');
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const buyers = all.filter((c) => c.orders > 0);
  const stats = { total: all.length, newThisMonth: all.filter((c) => Date.parse(c.createdAt) >= +monthStart).length, repeatRate: buyers.length ? Math.round(buyers.filter((c) => c.orders > 1).length / buyers.length * 100) : 0 };
  let rows = all.sort((a, b) => String(b.lastOrder || b.createdAt).localeCompare(String(a.lastOrder || a.createdAt)));
  if (search) rows = rows.filter((c) => [c.name, c.email].some((v) => String(v).toLowerCase().includes(search)));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  return json({ ok: true, stats, total: rows.length, page: Math.min(page, pages), pages, customers: rows.slice((page - 1) * PAGE, page * PAGE) });
});
