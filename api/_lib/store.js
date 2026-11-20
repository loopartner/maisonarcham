// Base de données clé-valeur Redis via l'API REST d'Upstash (intégration « Upstash for Redis » dans Vercel).
import { env } from './env.js';

const url = () => env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
const token = () => env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');

export const hasStore = () => Boolean(url() && token());

export async function redis(...command) {
  if (!hasStore()) throw new Error('Base de données non configurée');
  const res = await fetch(url(), {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Redis : ${data.error || res.status}`);
  return data.result;
}

export async function getJson(key) {
  const v = await redis('GET', key);
  return v ? JSON.parse(v) : null;
}
export const setJson = (key, value) => redis('SET', key, JSON.stringify(value));

// Plusieurs commandes en un seul aller-retour (non atomique). Renvoie le tableau des résultats.
export async function pipeline(commands) {
  if (!hasStore()) throw new Error('Base de données non configurée');
  const res = await fetch(`${url().replace(/\/+$/, '')}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) throw new Error(`Redis : ${res.status}`);
  return data.map((r) => { if (r.error) throw new Error(`Redis : ${r.error}`); return r.result; });
}

// Plusieurs commandes exécutées de façon atomique (MULTI/EXEC).
export async function transaction(commands) {
  if (!hasStore()) throw new Error('Base de données non configurée');
  const res = await fetch(`${url().replace(/\/+$/, '')}/multi-exec`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) throw new Error(`Redis : ${res.status}`);
  return data.map((r) => { if (r.error) throw new Error(`Redis : ${r.error}`); return r.result; });
}
