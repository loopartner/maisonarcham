import { env } from './env.js';
import { redis, hasStore } from './store.js';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const error = (message, status = 400) => json({ ok: false, error: message }, status);

export async function readJson(request, maxBytes = 20_000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError('Requête trop volumineuse.', 413);
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError('Requête invalide.', 400); }
}

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function handle(fn) {
  return async (request) => {
    try { return await fn(request); }
    catch (e) {
      if (e instanceof HttpError) return error(e.message, e.status);
      console.error(e);
      return error('Une erreur est survenue. Merci de réessayer.', 500);
    }
  };
}

export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
export const clean = (s, max = 500) => String(s ?? '').trim().slice(0, max);

export function siteUrl(request) {
  return env('SITE_URL') || new URL(request.url).origin;
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnu';
}

// Limite simple : `max` requêtes par `windowSec` et par IP (seulement si la base est configurée)
export async function rateLimit(request, bucket, max = 5, windowSec = 600) {
  if (!hasStore()) return;
  const key = `rl:${bucket}:${clientIp(request)}`;
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, windowSec);
  if (n > max) throw new HttpError('Trop de tentatives. Merci de réessayer dans quelques minutes.', 429);
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
