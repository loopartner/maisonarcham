// Middleware Vercel — contrôle d'accès exécuté côté serveur AVANT l'envoi de la page.
//  - /admin…      : réservé à l'équipe (propriétaire, administrateurs, gestion commandes, éditeurs). Sans session → /connexion ; client connecté → page 404
//                   (on ne révèle pas l'existence de l'administration).
//  - /compte…     : réservé aux comptes connectés.
//  - /connexion   : une personne déjà connectée est envoyée directement vers son espace.
// Les API vérifient de nouveau les droits à chaque appel : ce contrôle est une deuxième barrière.
import { SESSION_COOKIE, roleOf, homeFor, isStaff } from './api/_lib/roles.js';

export const config = {
  runtime: 'nodejs',
  matcher: ['/admin', '/admin/:path*', '/compte', '/compte/:path*', '/connexion'],
};

const env = (k) => (typeof process !== 'undefined' && process.env ? process.env[k] : undefined) || '';

async function redisGet(key) {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(['GET', key]),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function currentRole(request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{30,100}$/.test(token)) return null;
  const session = await redisGet(`sess:${await sha256Hex(token)}`);
  if (!session) return null;
  const user = await redisGet(`user:${session.uid}`);
  if (!user || session.pv !== user.pwdVersion) return null;
  return roleOf(user, env('ADMIN_EMAILS'));
}

const redirect = (request, path) => new Response(null, {
  status: 303,
  headers: { location: new URL(path, request.url).toString(), 'cache-control': 'no-store' },
});

async function notFound(request) {
  const page = await fetch(new URL('/404', request.url));
  return new Response(page.body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const isAccount = path === '/compte' || path.startsWith('/compte/');
  if (!isAdmin && !isAccount && path !== '/connexion') return undefined;

  let role = null;
  try { role = await currentRole(request); }
  catch (e) {
    console.error('Middleware :', e.message);
    // Base indisponible : on refuse l'accès plutôt que de l'ouvrir.
    if (isAdmin || isAccount) return redirect(request, '/connexion?erreur=service');
    return undefined;
  }

  if (path === '/connexion') return role ? redirect(request, homeFor(role)) : undefined;

  if (!role) {
    const next = encodeURIComponent(url.pathname + url.search);
    return redirect(request, `/connexion?suite=${next}`);
  }
  if (isAdmin && !isStaff(role)) return notFound(request);
  // Pages privées : jamais mises en cache, ni par le navigateur ni par un intermédiaire.
  return undefined;
}
