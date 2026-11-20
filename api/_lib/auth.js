// Authentification Maison Archam : comptes, mots de passe, sessions et jetons envoyés par e-mail.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { env } from './env.js';
import { redis, pipeline, getJson, setJson, hasStore } from './store.js';
import { HttpError, getCookie, serializeCookie, clientIp, clean } from './http.js';
import { SESSION_COOKIE, roleOf } from './roles.js';

const scrypt = promisify(crypto.scrypt);

// ---------- Mots de passe (scrypt, paramètres recommandés par l'OWASP) ----------
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(String(password).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * Number(N) * Number(r) * 2 });
  return crypto.timingSafeEqual(key, expected);
}

// Empreinte factice : on vérifie toujours un mot de passe, même si le compte n'existe pas,
// pour que le temps de réponse ne révèle pas quelles adresses ont un compte.
let dummyHash = null;
async function dummyVerify(password) {
  if (!dummyHash) dummyHash = await hashPassword('maison-archam-dummy-password');
  await verifyPassword(password, dummyHash);
  return false;
}

const COMMON = new Set(['password', 'motdepasse', 'azerty123', 'qwerty123', '123456789', '1234567890', 'password1', 'azertyuiop', 'motdepasse1', 'soleil123', 'bonjour123', 'maisonarcham1']);

export function passwordProblem(password, email = '') {
  if (typeof password !== 'string') return 'Mot de passe invalide.';
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (password.length > 128) return 'Le mot de passe ne doit pas dépasser 128 caractères.';
  if (!/\d/.test(password) || !/\p{L}/u.test(password)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  const low = password.toLowerCase();
  if (COMMON.has(low)) return 'Ce mot de passe est trop courant. Choisissez-en un autre.';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && low.includes(local)) return 'Le mot de passe ne doit pas contenir votre adresse e-mail.';
  return null;
}

// ---------- Jetons ----------
export const newToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const validTokenFormat = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{30,100}$/.test(t);

// ---------- Comptes ----------
const userKey = (id) => `user:${id}`;
const emailKey = (email) => `user:email:${email}`;

export const getUser = (id) => (id ? getJson(userKey(id)) : null);
export async function getUserByEmail(email) {
  const id = await redis('GET', emailKey(email));
  return id ? getUser(id) : null;
}
export const saveUser = (user) => setJson(userKey(user.id), user);

export function effectiveRole(user) { return roleOf(user, env('ADMIN_EMAILS')); }

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified === true,
    newsletter: user.newsletter === true,
    createdAt: user.createdAt,
    role: effectiveRole(user),
  };
}

// Crée le compte ; renvoie null si l'adresse est déjà utilisée (réservation atomique de l'adresse).
export async function createUser({ email, password, firstName, lastName, newsletter }) {
  const id = `u_${newToken(12)}`;
  const claimed = await redis('SET', emailKey(email), id, 'NX');
  if (claimed !== 'OK') return null;
  const now = new Date().toISOString();
  const user = {
    id, email, firstName: clean(firstName, 60), lastName: clean(lastName, 60),
    passwordHash: await hashPassword(password), pwdVersion: 1,
    role: 'client', emailVerified: false, newsletter: Boolean(newsletter), disabled: false,
    createdAt: now, updatedAt: now, lastLoginAt: null,
  };
  await saveUser(user);
  await redis('ZADD', 'users', Date.now(), id);
  return user;
}

// ---------- Sessions ----------
const CLIENT_TTL = 60 * 60 * 24 * 14; // 14 jours
const ADMIN_TTL = 60 * 60 * 12;       // 12 heures pour l'administration
const sessionKey = (hash) => `sess:${hash}`;
const userSessionsKey = (uid) => `user:sessions:${uid}`;

export async function createSession(request, user) {
  const token = newToken(32);
  const hash = sha256(token);
  const role = effectiveRole(user);
  const ttl = role === 'admin' ? ADMIN_TTL : CLIENT_TTL;
  const session = {
    uid: user.id, pv: user.pwdVersion, createdAt: new Date().toISOString(),
    ip: clientIp(request), ua: clean(request.headers.get('user-agent'), 200),
  };
  await pipeline([
    ['SET', sessionKey(hash), JSON.stringify(session), 'EX', ttl],
    ['SADD', userSessionsKey(user.id), hash],
    ['EXPIRE', userSessionsKey(user.id), CLIENT_TTL],
  ]);
  return { cookie: serializeCookie(SESSION_COOKIE, token, { maxAge: ttl }), role };
}

export const clearSessionCookie = () => serializeCookie(SESSION_COOKIE, '', { maxAge: 0 });

// Renvoie { user, role, hash } si la session est valide, sinon null.
export async function getSession(request) {
  if (!hasStore()) return null;
  const token = getCookie(request, SESSION_COOKIE);
  if (!validTokenFormat(token)) return null;
  const hash = sha256(token);
  const session = await getJson(sessionKey(hash));
  if (!session) return null;
  const user = await getUser(session.uid);
  const role = effectiveRole(user);
  if (!user || !role || session.pv !== user.pwdVersion) {
    await redis('DEL', sessionKey(hash));
    return null;
  }
  return { user, role, hash };
}

export async function destroySession(hash, uid) {
  await pipeline([['DEL', sessionKey(hash)], ['SREM', userSessionsKey(uid), hash]]);
}

export async function destroyAllSessions(uid) {
  const hashes = (await redis('SMEMBERS', userSessionsKey(uid))) || [];
  const cmds = hashes.map((h) => ['DEL', sessionKey(h)]);
  cmds.push(['DEL', userSessionsKey(uid)]);
  await pipeline(cmds);
}

// Exige une session valide (et éventuellement le rôle administrateur).
// Pour un non-administrateur, l'administration répond « introuvable » : on ne révèle pas son existence.
export async function requireUser(request, { role } = {}) {
  if (!hasStore()) throw new HttpError("L'espace client n'est pas encore activé.", 503);
  const s = await getSession(request);
  if (!s) throw new HttpError('Votre session a expiré. Merci de vous reconnecter.', 401);
  if (role === 'admin' && s.role !== 'admin') throw new HttpError('Introuvable.', 404);
  return s;
}

// ---------- Jetons à usage unique envoyés par e-mail (vérification, réinitialisation) ----------
export async function createEmailToken(kind, uid, ttlSec) {
  const token = newToken(32);
  await redis('SET', `tok:${kind}:${sha256(token)}`, uid, 'EX', ttlSec);
  return token;
}

export async function consumeEmailToken(kind, token) {
  if (!validTokenFormat(token)) return null;
  // GETDEL : le jeton ne peut servir qu'une seule fois, même avec deux requêtes simultanées.
  return redis('GETDEL', `tok:${kind}:${sha256(token)}`);
}

export { dummyVerify };
