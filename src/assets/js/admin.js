/* Back-office — éléments communs (identité, menu mobile). */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    const toggle = document.querySelector('[data-an-toggle]'), body = document.getElementById('an-nav');
    if (toggle && body) toggle.addEventListener('click', function () {
      const open = body.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open));
    });
    const r = await MA.api('/api/auth/me');
    if (!r.ok || !r.user || r.user.role !== 'admin') { location.assign('/connexion'); return; }
    const u = r.user;
    document.querySelectorAll('[data-admin-name]').forEach(function (el) { el.textContent = u.firstName + ' ' + u.lastName; });
    document.querySelectorAll('[data-admin-initials]').forEach(function (el) { el.textContent = ((u.firstName[0] || '') + (u.lastName[0] || '')).toUpperCase(); });
    const g = document.querySelector('[data-greeting]');
    if (g) g.textContent = 'Bonjour ' + u.firstName;
  });
})();
