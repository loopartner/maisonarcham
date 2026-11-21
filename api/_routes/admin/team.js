// /api/admin/team — membres de l'équipe.
// GET : liste · POST { email, role } : donner un rôle à un compte existant (adresse confirmée) · DELETE { id } : retirer l'accès
import { handle, json, error, readJson, normEmail, siteUrl, escapeHtml } from '../../_lib/http.js';
import { requireStaff, getUser, getUserByEmail, saveUser, destroyAllSessions } from '../../_lib/auth.js';
import { redis } from '../../_lib/store.js';
import { roleOf, ROLE_LABELS, adminEmailList } from '../../_lib/roles.js';
import { env } from '../../_lib/env.js';
import { sendMail, layout } from '../../_lib/mail.js';
import { audit } from '../../_lib/admin.js';

const ASSIGNABLE = ['admin', 'orders', 'editor'];

async function members() {
  const ids = (await redis('ZRANGE', 'users', 0, -1)) || [];
  const users = (await Promise.all(ids.map(getUser))).filter(Boolean);
  const out = users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, role: roleOf(u, env('ADMIN_EMAILS')), verified: u.emailVerified === true, lastLoginAt: u.lastLoginAt || null }))
    .filter((m) => m.role !== 'client' || (users.find((u) => u.id === m.id)?.role && users.find((u) => u.id === m.id).role !== 'client'));
  // Propriétaires déclarés qui n'ont pas encore de compte confirmé
  for (const e of adminEmailList(env('ADMIN_EMAILS'))) if (!out.some((m) => m.email === e)) out.push({ id: null, name: '—', email: e, role: 'owner', verified: false, pending: true });
  return out.map((m) => ({ ...m, roleLabel: m.role === 'client' ? 'En attente de confirmation d’adresse' : ROLE_LABELS[m.role] }));
}

export const GET = handle(async (request) => {
  const { user } = await requireStaff(request, 'team');
  return json({ ok: true, members: await members(), me: user.id, roles: ASSIGNABLE.map((id) => ({ id, label: ROLE_LABELS[id] })) });
});

export const POST = handle(async (request) => {
  const { user, role: myRole } = await requireStaff(request, 'team');
  const b = await readJson(request, 1_000);
  const email = normEmail(b.email), role = String(b.role || '');
  if (!ASSIGNABLE.includes(role)) return error('Rôle invalide.', 422, { fields: { role: 'Rôle invalide.' } });
  const target = await getUserByEmail(email);
  if (!target) return error('Aucun compte n’existe avec cette adresse. La personne doit d’abord créer son compte sur le site.', 404, { fields: { email: 'Compte introuvable.' } });
  if (target.id === user.id) return error('Vous ne pouvez pas modifier votre propre rôle.', 422);
  if (roleOf(target, env('ADMIN_EMAILS')) === 'owner') return error('Le rôle d’un propriétaire se gère par la variable ADMIN_EMAILS.', 422);
  if (myRole !== 'owner' && target.role === 'admin' && role !== 'admin') return error('Seul un propriétaire peut modifier un administrateur.', 403);
  target.role = role; target.updatedAt = new Date().toISOString();
  await saveUser(target);
  await destroyAllSessions(target.id); // nouvelle connexion avec les nouveaux droits
  await sendMail({ to: target.email, subject: 'Maison Archam — accès au back-office', html: layout('Accès au back-office', `<p>Bonjour ${escapeHtml(target.firstName)},</p><p>${escapeHtml(user.firstName)} vous a donné le rôle « ${escapeHtml(ROLE_LABELS[role])} ». Connectez-vous avec votre compte habituel : <a href="${escapeHtml(siteUrl(request))}/connexion" style="color:#241A16">${escapeHtml(siteUrl(request))}/connexion</a>.</p>${target.emailVerified ? '' : '<p>Confirmez d’abord votre adresse e-mail : l’accès n’est actif qu’une fois l’adresse confirmée.</p>'}`) }).catch((e) => console.error(e.message));
  await audit(request, user, 'equipe.role', { email: target.email, role });
  return json({ ok: true, members: await members() });
});

export const DELETE = handle(async (request) => {
  const { user, role: myRole } = await requireStaff(request, 'team');
  const target = await getUser(String((await readJson(request, 500)).id || ''));
  if (!target) return error('Membre introuvable.', 404);
  if (target.id === user.id) return error('Vous ne pouvez pas retirer votre propre accès.', 422);
  if (roleOf(target, env('ADMIN_EMAILS')) === 'owner') return error('Un propriétaire se retire par la variable ADMIN_EMAILS.', 422);
  if (myRole !== 'owner' && target.role === 'admin') return error('Seul un propriétaire peut retirer un administrateur.', 403);
  target.role = 'client'; target.updatedAt = new Date().toISOString();
  await saveUser(target); await destroyAllSessions(target.id);
  await audit(request, user, 'equipe.retrait', { email: target.email });
  return json({ ok: true, members: await members() });
});
