/* Liens reçus par e-mail : confirmation d'inscription (#jeton=…) et désinscription (?e=…&s=…). */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    const box = document.querySelector('[data-nl-link]'), title = box.querySelector('[data-title]'), msg = box.querySelector('[data-msg]'), cta = box.querySelector('[data-cta]');
    if (box.dataset.nlLink === 'confirm') {
      const m = location.hash.match(/jeton=([A-Za-z0-9_-]{30,100})/);
      if (m) history.replaceState(null, '', location.pathname);
      const r = m ? await MA.api('/api/newsletter/confirm', { method: 'POST', body: { token: m[1] } }) : { ok: false, error: MA.t('linkIncomplete') };
      title.textContent = r.ok ? MA.t('nlConfirmed') : MA.t('linkInvalid');
      msg.textContent = r.ok ? MA.t('nlConfirmedX', { email: r.email }) : r.error;
      cta.hidden = false;
      return;
    }
    const q = new URLSearchParams(location.search), email = q.get('e') || '', sig = q.get('s') || '';
    const btn = box.querySelector('[data-confirm]');
    if (!email || !sig) { msg.textContent = MA.t('linkIncomplete'); btn.hidden = true; cta.hidden = false; return; }
    msg.textContent = MA.t('unsubWill', { email: email });
    btn.addEventListener('click', async function () {
      MA.busy(btn, true, MA.t('wait'));
      const r = await MA.api('/api/newsletter/unsubscribe', { method: 'POST', body: { email: email, sig: sig } });
      btn.hidden = true; cta.hidden = false;
      title.textContent = r.ok ? MA.t('unsubDone') : MA.t('linkInvalid');
      msg.textContent = r.ok ? MA.t('unsubDoneX') : r.error;
    });
  });
})();
