// Validation des coordonnées et adresses saisies à la commande (utilisée avant tout paiement).
import { env } from './env.js';
import { clean, isEmail } from './http.js';
import { COUNTRIES } from './catalogue.js';

export function allowedCountries() {
  const codes = env('SHIPPING_COUNTRIES', 'FR').split(',').map((x) => x.trim().toUpperCase()).filter((c) => COUNTRIES[c]);
  return (codes.length ? codes : ['FR']).map((code) => ({ code, name: COUNTRIES[code] }));
}

const POSTAL = { FR: /^\d{5}$/, MC: /^980\d{2}$/, BE: /^\d{4}$/, LU: /^(L-?)?\d{4}$/i, CH: /^\d{4}$/, DE: /^\d{5}$/, IT: /^\d{5}$/, ES: /^\d{5}$/, NL: /^\d{4}\s?[A-Z]{2}$/i, GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i };
const NAME = /^[\p{L}\p{M}' .-]{1,60}$/u;

function address(raw, prefix, errors) {
  const a = {
    line1: clean(raw?.line1, 120), line2: clean(raw?.line2, 120),
    postalCode: clean(raw?.postalCode, 12).toUpperCase(), city: clean(raw?.city, 80),
    country: clean(raw?.country, 2).toUpperCase() || 'FR',
  };
  const allowed = allowedCountries().map((c) => c.code);
  if (!a.line1) errors[`${prefix}line1`] = 'Indiquez l’adresse.';
  if (!a.city) errors[`${prefix}city`] = 'Indiquez la ville.';
  if (!allowed.includes(a.country)) errors[`${prefix}country`] = 'Nous ne livrons pas encore ce pays.';
  if (!a.postalCode) errors[`${prefix}postalCode`] = 'Indiquez le code postal.';
  else if (POSTAL[a.country] && !POSTAL[a.country].test(a.postalCode)) errors[`${prefix}postalCode`] = 'Code postal invalide.';
  return a;
}

// Renvoie { customer, errors } ; errors est vide si tout est valide.
export function parseCustomer(raw = {}) {
  const errors = {};
  const c = {
    email: clean(raw.email, 254).toLowerCase(),
    phone: clean(raw.phone, 30),
    firstName: clean(raw.firstName, 60),
    lastName: clean(raw.lastName, 60),
  };
  if (!isEmail(c.email)) errors.email = 'Adresse e-mail invalide.';
  if (c.phone && !/^\+?[\d\s().-]{6,20}$/.test(c.phone)) errors.phone = 'Numéro de téléphone invalide.';
  if (!c.firstName) errors.firstName = 'Indiquez votre prénom.'; else if (!NAME.test(c.firstName)) errors.firstName = 'Prénom invalide.';
  if (!c.lastName) errors.lastName = 'Indiquez votre nom.'; else if (!NAME.test(c.lastName)) errors.lastName = 'Nom invalide.';
  c.shipping = address(raw.shipping, '', errors);
  c.sameBilling = raw.sameBilling !== false;
  c.billing = c.sameBilling ? null : address(raw.billing, 'billing.', errors);
  return { customer: c, errors };
}
