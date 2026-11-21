/* Liens reçus par e-mail : confirmation d'inscription (#jeton=…) et désinscription (?e=…&s=…). */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    const box = document.querySelector('[data-nl-link]'), title = box.querySelector('[data-title]'), msg = box.querySelector('[data-msg]'), cta = box.querySelector('[data-cta]');
    if (box.dataset.nlLink === 'confirm') {
      const m = location.hash.match(/jeton=([A-Za-z0-9_-]{30,100})/);
      if (m) history.replaceState(null, '', location.pathname);
      const r = m ? await MA.api('/api/newsletter/confirm', { method: 'POST', body: { token: m[1] } }) : { ok: false, error: 'Ce lien est incomplet.' };
      title.textContent = r.ok ? 'Inscription confirmée' : 'Lien non valable';
      msg.textContent = r.ok ? 'Merci. La prochaine lettre de la Maison vous parviendra à ' + r.email + '.' : r.error;
      cta.hidden = false;
      return;
    }
    const q = new URLSearchParams(location.search), email = q.get('e') || '', sig = q.get('s') || '';
    const btn = box.querySelector('[data-confirm]');
    if (!email || !sig) { msg.textContent = 'Ce lien est incomplet.'; btn.hidden = true; cta.hidden = false; return; }
    msg.textContent = 'L’adresse ' + email + ' ne recevra plus les lettres de la Maison.';
    btn.addEventListener('click', async function () {
      MA.busy(btn, true, 'Un instant…');
      const r = await MA.api('/api/newsletter/unsubscribe', { method: 'POST', body: { email: email, sig: sig } });
      btn.hidden = true; cta.hidden = false;
      title.textContent = r.ok ? 'Vous êtes désinscrit' : 'Lien non valable';
      msg.textContent = r.ok ? 'Votre adresse a été retirée de la correspondance. Vous pouvez vous réinscrire à tout moment.' : r.error;
    });
  });
})();
