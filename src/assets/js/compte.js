/* Espace client — chargement du compte connecté. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    const r = await MA.api('/api/auth/me');
    if (!r.ok || !r.user) { location.assign('/connexion?suite=' + encodeURIComponent(location.pathname)); return; }
    const u = r.user;
    document.querySelector('[data-greeting]').textContent = 'Bonjour ' + u.firstName;
    if (new URLSearchParams(location.search).has('bienvenue')) { document.querySelector('[data-welcome]').hidden = false; history.replaceState(null, '', location.pathname); }
    const verify = document.querySelector('[data-verify]');
    if (verify && !u.emailVerified) {
      verify.hidden = false;
      verify.querySelector('[data-resend]').addEventListener('click', async function (e) {
        MA.busy(e.target, true, 'Envoi…');
        const s = await MA.api('/api/auth/resend-verification', { method: 'POST', body: {} });
        MA.busy(e.target, false);
        e.target.textContent = s.ok ? 'E-mail envoyé' : s.error;
        e.target.disabled = s.ok;
      });
    }
  });
})();
