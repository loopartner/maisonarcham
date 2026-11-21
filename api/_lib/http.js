import { env } from './env.js';
import { redis, hasStore } from './store.js';
import { translatePayload } from './messages-en.js';

const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export function json(data, status = 200, headers = {}) {
  const h = new Headers({ ...SECURITY_HEADERS });
  for (const [k, v] of Object.entries(headers)) {
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else h.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

export const error = (message, status = 400, extra = {}) => json({ ok: false, error: message, ...extra }, status);

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function readJson(request, maxBytes = 20_000) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  // Exiger du JSON : un formulaire tiers ne peut pas l'envoyer sans pré-vérification CORS (refusée).
  if (!type.startsWith('application/json')) throw new HttpError('Format de requête non accepté.', 415);
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError('Requête trop volumineuse.', 413);
  let data;
  try { data = JSON.parse(text || '{}'); } catch { throw new HttpError('Requête invalide.', 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError('Requête invalide.', 400);
  return data;
}

// Protection CSRF : toute requête qui modifie des données doit venir du site lui-même.
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  const host = new URL(request.url).host;
  const allowed = new Set([host]);
  const site = env('SITE_URL');
  if (site) { try { allowed.add(new URL(site).host); } catch { /* ignoré */ } }
  if (!origin) {
    // Certains navigateurs omettent Origin : on se rabat sur Sec-Fetch-Site.
    if (request.headers.get('sec-fetch-site') === 'same-origin') return;
    throw new HttpError('Requête refusée.', 403);
  }
  let o;
  try { o = new URL(origin); } catch { throw new HttpError('Requête refusée.', 403); }
  if (!allowed.has(o.host)) throw new HttpError('Requête refusée.', 403);
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Réponses en anglais pour les pages anglaises (en-tête « x-lang: en »), hors back-office.
async function localize(request, res) {
  if (request.headers.get('x-lang') !== 'en' || new URL(request.url).pathname.startsWith('/api/admin/')) return res;
  if (!(res.headers.get('content-type') || '').startsWith('application/json')) return res;
  const data = translatePayload(await res.json());
  return new Response(JSON.stringify(data), { status: res.status, headers: res.headers });
}

export function handle(fn, { csrf = true } = {}) {
  return async (request) => {
    let res;
    try {
      if (csrf && UNSAFE.has(request.method)) assertSameOrigin(request);
      res = await fn(request);
    } catch (e) {
      if (e instanceof HttpError) res = error(e.message, e.status);
      else { console.error(e); res = error('Une erreur est survenue. Merci de réessayer.', 500); }
    }
    return localize(request, res);
  };
}

export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/.test(s);
export const clean = (s, max = 500) => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
export const normEmail = (s) => clean(s, 254).toLowerCase();

// Adresse publique du site pour les liens envoyés par e-mail : jamais tirée de l'en-tête Host.
export function siteUrl(request) {
  const s = env('SITE_URL');
  if (s) return s.replace(/\/+$/, '');
  if (env('VERCEL_ENV') === 'production' && env('VERCEL_PROJECT_PRODUCTION_URL')) return `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}`;
  if (env('VERCEL_BRANCH_URL')) return `https://${env('VERCEL_BRANCH_URL')}`;
  if (env('VERCEL_URL')) return `https://${env('VERCEL_URL')}`;
  return new URL(request.url).origin;
}

export function clientIp(request) {
  return (request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0]).trim() || 'inconnu';
}

// Limite de débit : `max` requêtes par `windowSec` pour une clé donnée (IP par défaut).
export async function rateLimit(request, bucket, max = 5, windowSec = 600, key = null) {
  if (!hasStore()) return;
  const k = `rl:${bucket}:${key ?? clientIp(request)}`;
  const n = await redis('INCR', k);
  if (n === 1) await redis('EXPIRE', k, windowSec);
  if (n > max) throw new HttpError('Trop de tentatives. Merci de réessayer dans quelques minutes.', 429);
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Cookies ----------
export function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function serializeCookie(name, value, { maxAge } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax'];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}
