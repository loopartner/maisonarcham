/* Confirmation de l'adresse e-mail à partir du lien reçu (#jeton=…). */
(function () {
  'use strict';
  const m = location.hash.match(/jeton=([A-Za-z0-9_-]{30,100})/);
  const token = m ? m[1] : '';
  if (m) history.replaceState(null, '', location.pathname);
  document.addEventListener('DOMContentLoaded', async function () {
    const title = document.querySelector('[data-title]'), msg = document.querySelector('[data-msg]'), cta = document.querySelector('[data-cta]');
    const r = token ? await MA.api('/api/auth/verify', { method: 'POST', body: { token: token } }) : { ok: false, error: MA.t('linkIncomplete') };
    title.textContent = r.ok ? MA.t('emailConfirmed') : MA.t('linkInvalid');
    msg.textContent = r.ok ? MA.t('emailConfirmedX') : r.error;
    cta.hidden = false;
  });
})();
