// /api/account/addresses — carnet d'adresses.
// GET : liste · POST { ...adresse, isDefault } : ajout · PUT { id, ...adresse, isDefault } : modification · DELETE { id } : suppression
import { handle, readJson, json, error } from '../../_lib/http.js';
import { requireUser, saveUser } from '../../_lib/auth.js';
import { parseAddress, newAddressId, MAX_ADDRESSES } from '../../_lib/account.js';

const list = (user) => (Array.isArray(user.addresses) ? user.addresses : []);
const out = (user) => json({ ok: true, addresses: list(user) });

function setDefault(user, id) { user.addresses = list(user).map((a) => ({ ...a, isDefault: a.id === id })); }
async function persist(user) { user.updatedAt = new Date().toISOString(); await saveUser(user); return out(user); }

export const GET = handle(async (request) => out((await requireUser(request)).user));

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  if (list(user).length >= MAX_ADDRESSES) return error(`Vous pouvez enregistrer ${MAX_ADDRESSES} adresses au maximum.`, 422);
  const body = await readJson(request, 3_000);
  const { address, errors } = parseAddress(body);
  if (Object.keys(errors).length) return error('Merci de vérifier les champs indiqués.', 422, { fields: errors });
  const a = { id: newAddressId(), ...address, isDefault: false };
  user.addresses = [...list(user), a];
  if (body.isDefault === true || user.addresses.length === 1) setDefault(user, a.id);
  return persist(user);
});

export const PUT = handle(async (request) => {
  const { user } = await requireUser(request);
  const body = await readJson(request, 3_000);
  const i = list(user).findIndex((a) => a.id === body.id);
  if (i < 0) return error('Adresse introuvable.', 404);
  if (body.onlyDefault === true) { setDefault(user, body.id); return persist(user); }
  const { address, errors } = parseAddress(body);
  if (Object.keys(errors).length) return error('Merci de vérifier les champs indiqués.', 422, { fields: errors });
  user.addresses[i] = { ...user.addresses[i], ...address };
  if (body.isDefault === true) setDefault(user, body.id);
  return persist(user);
});

export const DELETE = handle(async (request) => {
  const { user } = await requireUser(request);
  const { id } = await readJson(request, 500);
  const was = list(user).find((a) => a.id === id);
  if (!was) return error('Adresse introuvable.', 404);
  user.addresses = list(user).filter((a) => a.id !== id);
  if (was.isDefault && user.addresses[0]) setDefault(user, user.addresses[0].id);
  return persist(user);
});
