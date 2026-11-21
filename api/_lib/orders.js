import { redis, getJson, setJson } from './store.js';

export const STATUSES = {
  confirmee: 'Commande confirmée',
  preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
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
    number: o.number,
    status: o.status,
    statusLabel: STATUSES[o.status] || o.status,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    total: o.total,
    trackingUrl: o.trackingUrl || null,
    history: o.history || [],
  };
}
