// POST /api/account/password — change le mot de passe. Corps : { current, password }
// Ferme toutes les autres sessions et en ouvre une nouvelle pour l'appareil courant.
import { handle, readJson, json, error, rateLimit } from '../../_lib/http.js';
import { requireUser, verifyPassword, hashPassword, passwordProblem, saveUser, destroyAllSessions, createSession } from '../../_lib/auth.js';
import { sendPasswordChangedEmail } from '../../_lib/account-mail.js';

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  await rateLimit(request, 'pwd-change', 5, 900, user.id);
  const b = await readJson(request, 2_000);
  if (!(await verifyPassword(String(b.current || '').slice(0, 128), user.passwordHash))) return error('Mot de passe actuel incorrect.', 422, { fields: { current: 'Mot de passe actuel incorrect.' } });
  const problem = passwordProblem(b.password, user.email);
  if (problem) return error(problem, 422, { fields: { password: problem } });
  user.passwordHash = await hashPassword(b.password);
  user.pwdVersion = (user.pwdVersion || 1) + 1;
  user.updatedAt = new Date().toISOString();
  await saveUser(user);
  await destroyAllSessions(user.id);
  const { cookie } = await createSession(request, user);
  await sendPasswordChangedEmail(user).catch((e) => console.error(e.message));
  return json({ ok: true }, 200, { 'set-cookie': cookie });
});
