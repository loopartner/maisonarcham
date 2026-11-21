// GET /api/admin/orders?status=&q=&days=&page= — liste filtrée des commandes, avec compteurs par statut.
import { handle, json, clean } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { allOrders, STATUSES, normStatus } from '../../_lib/orders.js';

const PAGE = 25;

export const GET = handle(async (request) => {
  await requireStaff(request, 'orders');
  const q = new URL(request.url).searchParams;
  const status = clean(q.get('status'), 20), search = clean(q.get('q'), 100).toLowerCase(), days = Number(q.get('days')) || 0;
  const page = Math.max(1, Math.floor(Number(q.get('page')) || 1));
  const all = await allOrders();
  const counts = { all: all.length };
  all.forEach((o) => { const s = normStatus(o.status); counts[s] = (counts[s] || 0) + 1; });
  let rows = all;
  if (status && status !== 'all') rows = rows.filter((o) => normStatus(o.status) === status);
  if (days) rows = rows.filter((o) => Date.parse(o.createdAt) >= Date.now() - days * 86400000);
  if (search) rows = rows.filter((o) => [o.number, o.name, o.email].some((v) => String(v || '').toLowerCase().includes(search)));
  const total = rows.length, pages = Math.max(1, Math.ceil(total / PAGE));
  return json({
    ok: true, counts, total, page: Math.min(page, pages), pages,
    orders: rows.slice((page - 1) * PAGE, page * PAGE).map((o) => ({
      number: o.number, createdAt: o.createdAt, name: o.name, email: o.email, total: o.total,
      payment: o.paymentLabel || 'Carte bancaire', paid: !['attente', 'annulee'].includes(o.status),
      status: normStatus(o.status), statusLabel: STATUSES[o.status] || o.status,
    })),
  });
});
