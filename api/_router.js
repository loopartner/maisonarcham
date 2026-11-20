// Routeur commun à toutes les API (/api/...), utilisé par api/[route].js et api/<groupe>/[action].js.
// Une seule fonction serverless : le plan Vercel Hobby limite un déploiement à 12 fonctions.
// Chaque route vit dans api/_routes/ et exporte ses méthodes HTTP (GET, POST…).
import { error } from './_lib/http.js';

import * as adminOrder from './_routes/admin-order.js';
import * as checkout from './_routes/checkout.js';
import * as contact from './_routes/contact.js';
import * as health from './_routes/health.js';
import * as newsletter from './_routes/newsletter.js';
import * as order from './_routes/order.js';
import * as paymentIntent from './_routes/payment-intent.js';
import * as stripeWebhook from './_routes/stripe-webhook.js';
import * as authRegister from './_routes/auth/register.js';
import * as authLogin from './_routes/auth/login.js';
import * as authLogout from './_routes/auth/logout.js';
import * as authMe from './_routes/auth/me.js';
import * as authForgot from './_routes/auth/forgot.js';
import * as authReset from './_routes/auth/reset.js';
import * as authVerify from './_routes/auth/verify.js';
import * as authResendVerification from './_routes/auth/resend-verification.js';
import * as cartQuote from './_routes/cart/quote.js';
import * as checkoutValidate from './_routes/checkout/validate.js';

// Table de routage explicite : aucune route n'existe sans figurer ici.
export const ROUTES = {
  'admin-order': adminOrder,
  checkout,
  contact,
  health,
  newsletter,
  order,
  'payment-intent': paymentIntent,
  'stripe-webhook': stripeWebhook,
  'auth/register': authRegister,
  'auth/login': authLogin,
  'auth/logout': authLogout,
  'auth/me': authMe,
  'auth/forgot': authForgot,
  'auth/reset': authReset,
  'auth/verify': authVerify,
  'auth/resend-verification': authResendVerification,
  'cart/quote': cartQuote,
  'checkout/validate': checkoutValidate,
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Chemin demandé : l'URL d'origine si Vercel la transmet, sinon les segments passés en paramètres.
function routePath(request) {
  const u = new URL(request.url);
  const p = u.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  // Chemin réécrit par Vercel (ex. /api/auth/[action]?action=login) : on remet les segments.
  return p.replace(/\[(\w+)\]/g, (_, k) => String(u.searchParams.get(k) || '').replace(/[^a-z0-9-]/gi, ''));
}

export async function dispatch(request) {
  const path = routePath(request);
  const route = Object.prototype.hasOwnProperty.call(ROUTES, path) ? ROUTES[path] : null;
  if (!route) return error('Introuvable.', 404);
  const method = request.method === 'HEAD' ? 'GET' : request.method;
  const fn = METHODS.includes(method) ? route[method] : null;
  if (typeof fn !== 'function') return error('Méthode non autorisée.', 405);
  return fn(request);
}

