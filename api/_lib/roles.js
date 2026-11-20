// Calcul du rôle effectif d'un compte. Utilisé par l'API ET par le middleware (aucune dépendance Node).
//
// Un compte est administrateur si son adresse e-mail est VÉRIFIÉE et :
//   - qu'elle figure dans la variable d'environnement ADMIN_EMAILS (liste séparée par des virgules),
//   - ou qu'un administrateur lui a donné ce rôle depuis le back-office.
// Une adresse non vérifiée ne donne jamais accès à l'administration : impossible de « réserver »
// l'adresse de la Maison en créant un compte avant elle.

export const SESSION_COOKIE = '__Host-ma_session';

export function adminEmailList(raw) {
  return String(raw || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function roleOf(user, adminEmailsRaw) {
  if (!user || user.disabled) return null;
  const listed = adminEmailList(adminEmailsRaw).includes(String(user.email || '').toLowerCase());
  if (user.emailVerified === true && (listed || user.role === 'admin')) return 'admin';
  return 'client';
}

export const homeFor = (role) => (role === 'admin' ? '/admin' : '/compte');
