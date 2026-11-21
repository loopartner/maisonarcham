// GET /api/admin/dashboard?period=today|7d|30d|12m — indicateurs, courbes, performance trimestrielle, dernières commandes.
import { handle, json } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { allOrders, STATUSES } from '../../_lib/orders.js';
import { redis } from '../../_lib/store.js';
import { isPaid } from '../../_lib/admin.js';

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function buckets(period, now) {
  if (period === 'today') {
    const s = startOfDay(now);
    return Array.from({ length: 8 }, (_, i) => ({ label: `${8 + i * 2}h`, from: +s + (8 + i * 2) * 3600000 - (i === 0 ? 8 * 3600000 : 0), to: +s + (10 + i * 2) * 3600000 + (i === 7 ? 2 * 3600000 : 0) }));
  }
  if (period === '7d' || period === '30d') {
    const n = period === '7d' ? 7 : 30, step = period === '7d' ? 1 : 3, s = +startOfDay(now) - (n - 1) * DAY;
    return Array.from({ length: n / step }, (_, i) => {
      const from = s + i * step * DAY, d = new Date(from);
      return { label: period === '7d' ? d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), from, to: from + step * DAY };
    });
  }
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1), e = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
    return { label: d.toLocaleDateString('fr-FR', { month: 'narrow' }).toUpperCase(), from: +d, to: +e };
  });
}

export const GET = handle(async (request) => {
  await requireStaff(request, 'dashboard');
  const period = ['today', '7d', '30d', '12m'].includes(new URL(request.url).searchParams.get('period')) ? new URL(request.url).searchParams.get('period') : '30d';
  const now = new Date();
  const orders = await allOrders();
  const paid = orders.filter(isPaid);
  const t = (o) => Date.parse(o.createdAt);
  const sum = (list) => list.reduce((n, o) => n + (o.total || 0), 0);

  const b = buckets(period, now);
  const from = b[0].from, to = b[b.length - 1].to, len = to - from;
  const inRange = (list, a, z) => list.filter((o) => t(o) >= a && t(o) < z);
  const cur = inRange(paid, from, to), prev = inRange(paid, from - len, from);

  const nlDates = Object.values(Object.fromEntries((await redis('HGETALL', 'newsletter:dates') || []).reduce((acc, v, i, arr) => (i % 2 ? acc : [...acc, [arr[i], arr[i + 1]]]), [])));
  const nlIn = (a, z) => nlDates.filter((d) => Date.parse(d) >= a && Date.parse(d) < z).length;
  const customers = new Set(cur.map((o) => o.email));
  const firstOrder = new Map(); [...paid].reverse().forEach((o) => { if (!firstOrder.has(o.email)) firstOrder.set(o.email, t(o)); });
  const newCustomers = [...firstOrder.values()].filter((d) => d >= from && d < to).length;
  const pct = (a, z) => (z ? Math.round(((a - z) / z) * 1000) / 10 : null);

  const monthStart = +new Date(now.getFullYear(), now.getMonth(), 1), prevMonthStart = +new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const quarters = Array.from({ length: 4 }, (_, i) => {
    const qi = Math.floor(now.getMonth() / 3) - i, y = now.getFullYear() + Math.floor(qi / 4), q = ((qi % 4) + 4) % 4;
    const a = +new Date(y, q * 3, 1), z = +new Date(y, q * 3 + 3, 1), pa = +new Date(y, q * 3 - 3, 1);
    const list = inRange(paid, a, z), prevList = inRange(paid, pa, a);
    return { label: `T${q + 1} ${y}${i === 0 ? ' (en cours)' : ''}`, revenue: sum(list), orders: list.length, delta: pct(sum(list), sum(prevList)) };
  });

  return json({
    ok: true, period,
    kpis: {
      revenueTotal: sum(paid), revenueMonth: sum(inRange(paid, monthStart, Infinity)), revenueMonthDelta: pct(sum(inRange(paid, monthStart, Infinity)), sum(inRange(paid, prevMonthStart, monthStart))),
      revenue: sum(cur), revenueDelta: pct(sum(cur), sum(prev)), orders: cur.length, ordersDelta: cur.length - prev.length,
      customers: customers.size, newCustomers, subscribers: nlDates.length, newSubscribers: nlIn(from, to),
      basket: cur.length ? Math.round(sum(cur) / cur.length) : 0, basketPrev: prev.length ? Math.round(sum(prev) / prev.length) : 0,
    },
    series: b.map((x) => ({ label: x.label, revenue: sum(inRange(paid, x.from, x.to)), orders: inRange(paid, x.from, x.to).length, subscribers: nlIn(x.from, x.to) })),
    quarters,
    recent: orders.slice(0, 6).map((o) => ({ number: o.number, name: o.name, total: o.total, status: o.status, statusLabel: STATUSES[o.status] || o.status, createdAt: o.createdAt })),
  });
});
