// Routeur commun à toutes les API (/api/...), utilisé par api/[route].js et api/<groupe>/[action].js.
// Une seule fonction serverless : le plan Vercel Hobby limite un déploiement à 12 fonctions.
// Chaque route vit dans api/_routes/ et exporte ses méthodes HTTP (GET, POST…).
import { error } from './_lib/http.js';

import * as checkout from './_routes/checkout.js';
import * as catalogue from './_routes/catalogue.js';
import * as contact from './_routes/contact.js';
import * as health from './_routes/health.js';
import * as newsletter from './_routes/newsletter/subscribe.js';
import * as newsletterConfirm from './_routes/newsletter/confirm.js';
import * as newsletterUnsubscribe from './_routes/newsletter/unsubscribe.js';
import * as newsletterOneClick from './_routes/newsletter/one-click.js';
import * as orderTrack from './_routes/order/track.js';
import * as orderConfirmation from './_routes/order/confirmation.js';
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
import * as admin_customers from './_routes/admin/customers.js';
import * as admin_customer from './_routes/admin/customer.js';
import * as admin_subscribers from './_routes/admin/subscribers.js';
import * as admin_campaign from './_routes/admin/campaign.js';
import * as admin_session from './_routes/admin/session.js';
import * as admin_dashboard from './_routes/admin/dashboard.js';
import * as admin_orders from './_routes/admin/orders.js';
import * as admin_order from './_routes/admin/order.js';
import * as admin_orders_export from './_routes/admin/orders-export.js';
import * as account_overview from './_routes/account/overview.js';
import * as account_orders from './_routes/account/orders.js';
import * as account_order from './_routes/account/order.js';
import * as account_profile from './_routes/account/profile.js';
import * as account_password from './_routes/account/password.js';
import * as account_email from './_routes/account/email.js';
import * as account_addresses from './_routes/account/addresses.js';
import * as account_newsletter from './_routes/account/newsletter.js';
import * as account_delete from './_routes/account/delete.js';
import * as checkoutValidate from './_routes/checkout/validate.js';

// Table de routage explicite : aucune route n'existe sans figurer ici.
export const ROUTES = {
  checkout,
  catalogue,
  contact,
  health,
  newsletter, // POST /api/newsletter
  'newsletter/confirm': newsletterConfirm,
  'newsletter/unsubscribe': newsletterUnsubscribe,
  'newsletter/one-click': newsletterOneClick,
  order: orderTrack, // ancienne adresse, conservée
  'order/track': orderTrack,
  'order/confirmation': orderConfirmation,
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
  'admin/customers': admin_customers,
  'admin/customer': admin_customer,
  'admin/subscribers': admin_subscribers,
  'admin/campaign': admin_campaign,
  'admin/session': admin_session,
  'admin/dashboard': admin_dashboard,
  'admin/orders': admin_orders,
  'admin/order': admin_order,
  'admin/orders-export': admin_orders_export,
  'account/overview': account_overview,
  'account/orders': account_orders,
  'account/order': account_order,
  'account/profile': account_profile,
  'account/password': account_password,
  'account/email': account_email,
  'account/addresses': account_addresses,
  'account/newsletter': account_newsletter,
  'account/delete': account_delete,
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

