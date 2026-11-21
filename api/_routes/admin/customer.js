// GET /api/admin/customer?email=… (ou ?id=u_…) — fiche client : coordonnées, adresse principale, commandes.
import { handle, json, error, clean, normEmail } from '../../_lib/http.js';
import { requireStaff, getUser, getUserByEmail } from '../../_lib/auth.js';
import { allOrders, STATUSES } from '../../_lib/orders.js';
import { isPaid } from '../../_lib/admin.js';
import { redis } from '../../_lib/store.js';
import { COUNTRIES } from '../../_lib/catalogue.js';

export const GET = handle(async (request) => {
  await requireStaff(request, 'customers');
  const q = new URL(request.url).searchParams;
  const id = clean(q.get('id'), 40);
  const user = /^u_[A-Za-z0-9_-]+$/.test(id) ? await getUser(id) : (q.get('email') ? await getUserByEmail(normEmail(q.get('email'))) : null);
  const email = user ? user.email : normEmail(q.get('email'));
  if (!email) return error('Client introuvable.', 404);
  const orders = (await allOrders()).filter((o) => String(o.email || '').toLowerCase() === email || (user && o.userId === user.id));
  if (!user && !orders.length) return error('Client introuvable.', 404);
  const def = (user?.addresses || []).find((a) => a.isDefault);
  const last = orders[0]?.shipping;
  const address = def ? [def.line1, def.line2, `${def.postalCode} ${def.city}`, COUNTRIES[def.country] || def.country] : last ? [last.line1, last.line2, `${last.postal_code || last.postalCode || ''} ${last.city || ''}`.trim(), COUNTRIES[last.country] || last.country] : [];
  return json({ ok: true, customer: {
    id: user?.id || null, email, account: Boolean(user), verified: user?.emailVerified === true,
    name: user ? `${user.firstName} ${user.lastName}`.trim() : orders[0]?.name || '', phone: user?.phone || orders[0]?.phone || '',
    createdAt: user?.createdAt || orders.at(-1)?.createdAt, lastLoginAt: user?.lastLoginAt || null,
    newsletter: (await redis('SISMEMBER', 'newsletter', email)) === 1,
    address: address.filter(Boolean),
    stats: { orders: orders.filter(isPaid).length, spent: orders.filter(isPaid).reduce((n, o) => n + (o.total || 0), 0) },
    orders: orders.map((o) => ({ number: o.number, createdAt: o.createdAt, total: o.total, status: o.status, statusLabel: STATUSES[o.status] || o.status })),
  } });
});
