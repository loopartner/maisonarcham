import { redis, getJson, setJson } from './store.js';

export const STATUSES = {
  attente: 'En attente',
  payee: 'Payée',
  confirmee: 'Payée', // ancien libellé des commandes payées
  preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
  remboursee: 'Remboursée',
};
export const EDITABLE_STATUSES = ['attente', 'payee', 'preparation', 'expediee', 'livree', 'annulee', 'remboursee'];
export const normStatus = (s) => (s === 'confirmee' ? 'payee' : s);

export const CARRIERS = {
  colissimo: { label: 'Colissimo', url: (n) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(n)}` },
  chronopost: { label: 'Chronopost', url: (n) => `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${encodeURIComponent(n)}` },
  dhl: { label: 'DHL Express', url: (n) => `https://www.dhl.com/fr-fr/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(n)}` },
};

export const orderKey = (number) => `order:${String(number).toUpperCase()}`;

export async function nextOrderNumber() {
  const n = await redis('INCR', 'order:counter');
  return `MA-${10000 + Number(n)}`;
}

export const getOrder = (number) => getJson(orderKey(number));
export const saveOrder = (order) => setJson(orderKey(order.number), order);

export function publicOrder(o) {
  return {
    firstName: String(o.name || '').split(' ')[0],
    shippingMethod: o.shippingMethod || null,
    shippingCost: o.shippingCost ?? 0,
    discount: o.discount || 0,
    number: o.number,
    status: o.status,
    statusLabel: STATUSES[o.status] || o.status,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.name, variant: i.variant || '', quantity: i.quantity, amount: i.amount, image: i.image || '' })),
    total: o.total,
    trackingUrl: o.trackingUrl || null,
    history: o.history || [],
  };
}

// Toutes les commandes (de la plus récente à la plus ancienne), lues par lots.
export async function allOrders() {
  const numbers = (await redis('LRANGE', 'orders', 0, -1)) || [];
  const out = [];
  for (let i = 0; i < numbers.length; i += 100) {
    const chunk = numbers.slice(i, i + 100);
    const rows = await redis('MGET', ...chunk.map(orderKey));
    rows.forEach((r) => { if (r) { try { out.push(JSON.parse(r)); } catch { /* ignorée */ } } });
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
