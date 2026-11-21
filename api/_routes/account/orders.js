// GET /api/account/orders — historique des commandes du compte.
import { handle, json } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';
import { listOrders } from '../../_lib/account.js';
import { publicOrder } from '../../_lib/orders.js';

export const GET = handle(async (request) => {
  const { user } = await requireUser(request);
  return json({ ok: true, orders: (await listOrders(user)).map(publicOrder), emailVerified: user.emailVerified === true });
});
