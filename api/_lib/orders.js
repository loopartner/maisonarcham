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
