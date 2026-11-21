// GET /api/account/overview — tableau de bord du compte.
import { handle, json } from '../../_lib/http.js';
import { requireUser, publicUser } from '../../_lib/auth.js';
import { listOrders } from '../../_lib/account.js';
import { publicOrder } from '../../_lib/orders.js';
import { isSubscribed } from '../../_lib/newsletter.js';

const ACTIVE = new Set(['confirmee', 'payee', 'preparation', 'expediee']);

export const GET = handle(async (request) => {
  const { user } = await requireUser(request);
  const orders = await listOrders(user);
  const current = orders.find((o) => ACTIVE.has(o.status));
  return json({
    ok: true,
    user: { ...publicUser(user), phone: user.phone || '', birthDate: user.birthDate || '' },
    stats: { orders: orders.length, memberSince: user.createdAt, newsletter: await isSubscribed(user.email) },
    current: current ? publicOrder(current) : null,
  });
});
