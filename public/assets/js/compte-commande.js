/* Détail d'une commande de l'espace client. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const STEPS = [['confirmee', MA.t('st_confirmee')], ['preparation', MA.t('st_preparation')], ['expediee', MA.t('st_expediee')], ['livree', MA.t('st_livree')]];
  const stLabel = (o) => (MA.lang === 'en' ? MA.t('st_' + o.status) : o.statusLabel);
  const STEP_OF = { payee: 0, confirmee: 0, preparation: 1, expediee: 2, livree: 3 };
  const CLS = { confirmee: 'confirmee', payee: 'payee', preparation: 'preparation', expediee: 'expediee', livree: 'livree', annulee: 'annulee', remboursee: 'remboursee' };
  const fmt = (d, o) => new Date(d).toLocaleDateString(MA.locale, o || { day: 'numeric', month: 'long', year: 'numeric' });
  const lines = (el, arr) => { el.replaceChildren(); arr.filter(Boolean).forEach(function (l, i) { if (i) el.append(document.createElement('br')); el.append(document.createTextNode(l)); }); };

  document.addEventListener('DOMContentLoaded', async function () {
    const n = new URLSearchParams(location.search).get('n') || '';
    const r = await MA.api('/api/account/order?n=' + encodeURIComponent(n));
    $('[data-loading]').hidden = true;
    if (!r.ok) { const e = $('[data-error]'); e.textContent = r.status === 404 ? MA.t('orderNotFound') : r.error; e.hidden = false; return; }
    const o = r.order;
    document.title = MA.t('orderNo', { n: o.number }) + ' | Maison Archam';
    $('[data-o-date]').textContent = MA.t('placedOn', { date: fmt(o.createdAt) });
    $('[data-o-title]').textContent = MA.t('orderNo', { n: o.number });
    const st = $('[data-o-status]'); st.textContent = stLabel(o); st.classList.add(CLS[o.status] || 'attente');

    const cur = STEP_OF[o.status] ?? -1, dates = {};
    (o.history || []).forEach(function (h) { if (!dates[h.status]) dates[h.status] = h.at; });
    const ol = $('[data-o-track]');
    ol.replaceChildren.apply(ol, STEPS.map(function (s, i) {
      const li = document.createElement('li'); li.className = 'track-step' + (i <= cur ? ' done' : ''); if (i === cur) li.setAttribute('aria-current', 'step');
      const bar = document.createElement('span'); bar.className = 'track-bar'; bar.setAttribute('aria-hidden', 'true');
      const l = document.createElement('p'); l.className = 'track-l'; l.textContent = s[1];
      const d = document.createElement('p'); d.className = 'track-d'; const when = dates[s[0]] || (i === 0 ? o.createdAt : null);
      d.textContent = when && i <= cur ? fmt(when, { day: 'numeric', month: 'short' }) : '—';
      li.append(bar, l, d); return li;
    }));
    if (o.carrier || o.trackingNumber) {
      $('[data-o-carrier]').hidden = false;
      $('[data-o-carrier-text]').textContent = MA.t('carrier') + ' : ' + (o.carrier || '—') + (o.trackingNumber ? ' · ' + MA.t('trackingNo') + ' ' + o.trackingNumber : '');
      if (o.trackingUrl && /^https:\/\//.test(o.trackingUrl)) { const a = $('[data-o-tracking]'); a.href = o.trackingUrl; a.hidden = false; }
    }

    const ul = $('[data-o-items]');
    ul.replaceChildren.apply(ul, o.items.map(function (i) {
      const li = document.createElement('li'); li.className = 'od-item';
      const t = document.createElement('div'); t.className = 'acct-thumb';
      const img = document.createElement('img'); img.src = i.image || (Object.values(MACart.products)[0] || {}).image || ''; img.alt = ''; img.width = 80; img.height = 100; t.append(img);
      const info = document.createElement('div'); info.className = 'od-info';
      const nm = document.createElement('p'); nm.className = 'serif od-name'; nm.textContent = i.name;
      const v = document.createElement('p'); v.className = 'muted acct-small'; v.textContent = (i.variant ? i.variant + ' · ' : '') + '× ' + i.quantity;
      info.append(nm, v);
      const p = document.createElement('span'); p.textContent = i.amount != null ? MACart.euros(i.amount) : '';
      li.append(t, info, p); return li;
    }));
    $('[data-o-subtotal]').textContent = MACart.euros(o.subtotal);
    $('[data-o-disc-row]').hidden = !o.discount; $('[data-o-disc]').textContent = '− ' + MACart.euros(o.discount || 0);
    if (o.shippingMethod) $('[data-o-ship-label]').textContent = o.shippingMethod;
    $('[data-o-ship]').textContent = o.shippingCost ? MACart.euros(o.shippingCost) : MA.t('free');
    $('[data-o-total]').textContent = MACart.euros(o.total);
    lines($('[data-o-address]'), [o.name].concat(o.address));
    lines($('[data-o-payment]'), [(o.payment || MA.t('onlinePayment')) + ' · ' + MA.t('paidOn') + ' ' + fmt(o.paidAt, { day: '2-digit', month: '2-digit', year: 'numeric' })]);
    $('[data-o-return]').href = MA.route('aide') + '?sujet=Retour&commande=' + encodeURIComponent(o.number) + '#contact';
    $('[data-order]').hidden = false;
  });
})();
