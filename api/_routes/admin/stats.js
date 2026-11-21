// GET /api/admin/stats?year=2026 — rapports : CA mensuel (année et année précédente), ventes, nouveaux clients, produits, newsletter.
import { handle, json } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { allOrders } from '../../_lib/orders.js';
import { isPaid } from '../../_lib/admin.js';
import { redis } from '../../_lib/store.js';

export const GET = handle(async (request) => {
  await requireStaff(request, 'stats');
  const now = new Date();
  const year = Math.min(now.getFullYear(), Math.max(2020, Number(new URL(request.url).searchParams.get('year')) || now.getFullYear()));
  const paid = (await allOrders()).filter(isPaid);
  const y = (o) => new Date(o.createdAt).getFullYear(), m = (o) => new Date(o.createdAt).getMonth();
  const months = (yr, f) => Array.from({ length: 12 }, (_, i) => f(paid.filter((o) => y(o) === yr && m(o) === i)));
  const units = (list) => list.reduce((n, o) => n + (o.items || []).reduce((k, i) => k + (i.quantity || 0), 0), 0);
  const first = new Map(); [...paid].reverse().forEach((o) => { if (!first.has(o.email)) first.set(o.email, o.createdAt); });
  const products = new Map();
  for (const o of paid.filter((x) => y(x) === year)) for (const i of o.items || []) {
    const k = [i.name, i.variant].filter(Boolean).join(' · ');
    const p = products.get(k) || { name: k, units: 0, revenue: 0 }; p.units += i.quantity || 0; p.revenue += i.amount || 0; products.set(k, p);
  }
  const nlDates = (await redis('HGETALL', 'newsletter:dates') || []).filter((_, i) => i % 2 === 1);
  const yearPaid = paid.filter((o) => y(o) === year);
  return json({ ok: true, year,
    revenue: { current: months(year, (l) => l.reduce((n, o) => n + (o.total || 0), 0)), previous: months(year - 1, (l) => l.reduce((n, o) => n + (o.total || 0), 0)) },
    units: months(year, units),
    newCustomers: Array.from({ length: 12 }, (_, i) => [...first.values()].filter((d) => new Date(d).getFullYear() === year && new Date(d).getMonth() === i).length),
    totals: { revenue: yearPaid.reduce((n, o) => n + (o.total || 0), 0), orders: yearPaid.length, units: units(yearPaid), customers: [...first.values()].filter((d) => new Date(d).getFullYear() === year).length },
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue),
    newsletter: { subscribers: nlDates.length, monthly: Array.from({ length: 12 }, (_, i) => nlDates.filter((d) => new Date(d).getFullYear() === year && new Date(d).getMonth() === i).length), campaigns: await redis('LLEN', 'campaigns') },
  });
});
