// POST /api/account/profile — modifie prénom, nom, téléphone, date de naissance. Corps : { firstName, lastName, phone, birthDate }
import { handle, readJson, json, error, clean } from '../../_lib/http.js';
import { requireUser, saveUser, publicUser } from '../../_lib/auth.js';

const NAME = /^[\p{L}\p{M}' .-]{1,60}$/u;

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  const b = await readJson(request, 2_000);
  const fields = {};
  const firstName = clean(b.firstName, 60), lastName = clean(b.lastName, 60), phone = clean(b.phone, 30), birthDate = clean(b.birthDate, 10);
  if (!NAME.test(firstName)) fields.firstName = 'Prénom invalide.';
  if (!NAME.test(lastName)) fields.lastName = 'Nom invalide.';
  if (phone && !/^\+?[\d\s().-]{6,20}$/.test(phone)) fields.phone = 'Téléphone invalide.';
  if (birthDate) {
    const d = Date.parse(`${birthDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(d) || d > Date.now() || d < Date.parse('1900-01-01')) fields.birthDate = 'Date invalide.';
  }
  if (Object.keys(fields).length) return error('Merci de vérifier les champs indiqués.', 422, { fields });
  Object.assign(user, { firstName, lastName, phone, birthDate, updatedAt: new Date().toISOString() });
  await saveUser(user);
  return json({ ok: true, user: { ...publicUser(user), phone, birthDate } });
});
