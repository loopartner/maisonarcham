// Rôles et permissions. Utilisé par l'API ET par le middleware (aucune dépendance Node).
//
// Rôles de l'équipe (stockés sur le compte, attribués depuis Paramètres → Administrateurs) :
//   owner  : propriétaire — adresse listée dans ADMIN_EMAILS ; tous les droits
//   admin  : administrateur — tous les droits sauf modifier un propriétaire
//   orders : gestion des commandes — tableau de bord, commandes, clients
//   editor : éditeur — tableau de bord, contenu, fiches produits, newsletter
// Tout autre compte est « client ».
// Un rôle d'équipe n'est effectif que si l'adresse e-mail du compte est CONFIRMÉE.

export const SESSION_COOKIE = '__Host-ma_session';
export const STAFF_ROLES = ['owner', 'admin', 'orders', 'editor'];
export const ROLE_LABELS = { owner: 'Propriétaire', admin: 'Administrateur', orders: 'Gestion commandes', editor: 'Éditeur', client: 'Client' };

export const PERMISSIONS = {
  owner: ['dashboard', 'orders', 'customers', 'newsletter', 'stats', 'content', 'products', 'settings', 'team'],
  admin: ['dashboard', 'orders', 'customers', 'newsletter', 'stats', 'content', 'products', 'settings', 'team'],
  orders: ['dashboard', 'orders', 'customers'],
  editor: ['dashboard', 'content', 'products', 'newsletter'],
  client: [],
};

export function adminEmailList(raw) {
  return String(raw || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function roleOf(user, adminEmailsRaw) {
  if (!user || user.disabled) return null;
  if (user.emailVerified !== true) return 'client';
  if (adminEmailList(adminEmailsRaw).includes(String(user.email || '').toLowerCase())) return 'owner';
  return ['admin', 'orders', 'editor'].includes(user.role) ? user.role : 'client';
}

export const isStaff = (role) => STAFF_ROLES.includes(role);
export const can = (role, perm) => (PERMISSIONS[role] || []).includes(perm);
export const homeFor = (role) => (isStaff(role) ? '/admin' : '/compte');
