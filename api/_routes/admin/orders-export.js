// GET /api/admin/orders-export?status=&q=&days= — export CSV des commandes (filtres de la liste).
import { handle, clean } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { allOrders, STATUSES, normStatus } from '../../_lib/orders.js';
import { toCsv, csvResponse, audit } from '../../_lib/admin.js';

export const GET = handle(async (request) => {
  const { user } = await requireStaff(request, 'orders');
  const q = new URL(request.url).searchParams;
  const status = clean(q.get('status'), 20), search = clean(q.get('q'), 100).toLowerCase(), days = Number(q.get('days')) || 0;
  let rows = await allOrders();
  if (status && status !== 'all') rows = rows.filter((o) => normStatus(o.status) === status);
  if (days) rows = rows.filter((o) => Date.parse(o.createdAt) >= Date.now() - days * 86400000);
  if (search) rows = rows.filter((o) => [o.number, o.name, o.email].some((v) => String(v || '').toLowerCase().includes(search)));
  await audit(request, user, 'commandes.export', { count: rows.length });
  const eur = (c) => ((c || 0) / 100).toFixed(2).replace('.', ',');
  return csvResponse(`commandes-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
    ['Commande', 'Date', 'Client', 'E-mail', 'Téléphone', 'Articles', 'Livraison (€)', 'Remise (€)', 'Total (€)', 'Statut', 'Transporteur', 'Nº de suivi', 'Adresse'],
    rows.map((o) => [o.number, new Date(o.createdAt).toLocaleString('fr-FR'), o.name, o.email, o.phone, (o.items || []).map((i) => `${i.name} × ${i.quantity}`).join(', '),
      eur(o.shippingCost), eur(o.discount), eur(o.total), STATUSES[o.status] || o.status, o.carrier || '', o.trackingNumber || '',
      [o.shipping?.line1, o.shipping?.postal_code || o.shipping?.postalCode, o.shipping?.city, o.shipping?.country].filter(Boolean).join(' ')]),
  ));
});
