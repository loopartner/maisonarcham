/* Formulaire de contact. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('[data-contact]'), err = form.querySelector('[data-error]'), sent = document.querySelector('[data-sent]');
    // Pré-remplissage depuis « Demander un retour » (espace client)
    const q = new URLSearchParams(location.search);
    if (q.get('sujet') === 'Retour') form.elements.subject.value = MA.t('subjReturn');
    const n = (q.get('commande') || '').toUpperCase();
    if (/^MA-\d{4,8}$/.test(n)) form.elements.message.value = MA.t('orderPrefix', { n: n });
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); err.hidden = true;
      const f = form.elements;
      const body = { name: f.name.value.trim(), email: f.email.value.trim(), subject: f.subject.value, message: f.message.value.trim(), website: f.website.value };
      if (!body.name || !body.message) { err.textContent = MA.t('nameMsgReq'); err.hidden = false; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) { err.textContent = MA.t('emailInvalid'); err.hidden = false; return; }
      const btn = form.querySelector('button[type="submit"]');
      MA.busy(btn, true, MA.t('sending'));
      const r = await MA.api('/api/contact', { method: 'POST', body: body });
      MA.busy(btn, false);
      if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
      form.hidden = true; sent.hidden = false; sent.focus();
    });
  });
})();
