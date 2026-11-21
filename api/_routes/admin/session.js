// GET /api/admin/session — membre de l'équipe connecté, ses permissions et les compteurs de la navigation.
import { handle, json } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { PERMISSIONS, ROLE_LABELS, can } from '../../_lib/roles.js';
import { allOrders } from '../../_lib/orders.js';

export const GET = handle(async (request) => {
  const { user, role } = await requireStaff(request);
  const badges = {};
  if (can(role, 'orders')) badges.commandes = (await allOrders()).filter((o) => ['payee', 'confirmee', 'preparation'].includes(o.status)).length;
  return json({ ok: true, user: { firstName: user.firstName, lastName: user.lastName, email: user.email }, role, roleLabel: ROLE_LABELS[role], permissions: PERMISSIONS[role], badges });
});
