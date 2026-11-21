// Espace client : rattachement des commandes à un compte, carnet d'adresses.
import { redis } from './store.js';
import { getOrder } from './orders.js';
import { clean } from './http.js';
import { allowedCountries } from './customer.js';
import { newToken } from './auth.js';

// Une commande appartient au compte si elle a été passée depuis ce compte,
// ou avec son adresse e-mail à condition que cette adresse soit CONFIRMÉE.
export function ownsOrder(user, order) {
  if (!order) return false;
  if (order.userId && order.userId === user.id) return true;
  return user.emailVerified === true && String(order.email || '').toLowerCase() === user.email;
}

export async function listOrders(user, limit = 50) {
  const ids = new Set(await redis('LRANGE', `orders:user:${user.id}`, 0, limit - 1) || []);
  if (user.emailVerified) for (const n of (await redis('LRANGE', `orders:email:${user.email}`, 0, limit - 1)) || []) ids.add(n);
  const orders = (await Promise.all([...ids].map((n) => getOrder(n)))).filter((o) => ownsOrder(user, o));
  return orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const NAME = /^[\p{L}\p{M}' .-]{1,60}$/u;
const POSTAL = /^[A-Za-z0-9 -]{3,12}$/;
export const MAX_ADDRESSES = 10;

export function parseAddress(raw = {}) {
  const errors = {};
  const a = {
    label: clean(raw.label, 40) || 'Adresse',
    firstName: clean(raw.firstName, 60), lastName: clean(raw.lastName, 60),
    line1: clean(raw.line1, 120), line2: clean(raw.line2, 120),
    postalCode: clean(raw.postalCode, 12).toUpperCase(), city: clean(raw.city, 80),
    country: clean(raw.country, 2).toUpperCase() || 'FR', phone: clean(raw.phone, 30),
  };
  if (!NAME.test(a.firstName)) errors.firstName = 'Prénom invalide.';
  if (!NAME.test(a.lastName)) errors.lastName = 'Nom invalide.';
  if (!a.line1) errors.line1 = 'Indiquez l’adresse.';
  if (!POSTAL.test(a.postalCode)) errors.postalCode = 'Code postal invalide.';
  if (!a.city) errors.city = 'Indiquez la ville.';
  if (!allowedCountries().some((c) => c.code === a.country)) errors.country = 'Pays non desservi.';
  if (a.phone && !/^\+?[\d\s().-]{6,20}$/.test(a.phone)) errors.phone = 'Téléphone invalide.';
  return { address: a, errors };
}
export const newAddressId = () => `a_${newToken(9)}`;
