/* Confirmation de commande : lit le paiement dans l'adresse (retour de Stripe) et affiche la commande. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const q = new URLSearchParams(location.search);
  const pi = q.get('payment_intent') || '', secret = q.get('payment_intent_client_secret') || '';
  // On retire le secret de la barre d'adresse (historique, partage d'écran) en le gardant pour la session.
  if (secret) { try { sessionStorage.setItem('archam-last-payment', JSON.stringify({ pi: pi, secret: secret })); } catch (e) { /* ignoré */ } history.replaceState(null, '', location.pathname); }
  let saved = { pi: pi, secret: secret };
  if (!secret) { try { saved = JSON.parse(sessionStorage.getItem('archam-last-payment') || '{}'); } catch (e) { saved = {}; } }

  function show(o) {
    $('[data-c-number]').textContent = MA.t('orderNo', { n: o.number }); $('[data-c-number]').hidden = false;
    $('[data-c-title]').textContent = MA.t('thanksName', { name: o.firstName });
    $('[data-c-lead]').textContent = MA.t('confLead', { email: o.email });
    $('[data-c-items]').replaceChildren.apply($('[data-c-items]'), o.items.map(function (i) {
      const li = document.createElement('li');
      const n = document.createElement('p'); n.className = 'serif conf-name'; n.textContent = i.name;
      const d = document.createElement('p'); d.className = 'muted conf-var'; d.textContent = (i.variant ? i.variant + ' · ' : '') + '× ' + i.quantity;
      li.append(n, d); return li;
    }));
    $('[data-c-ship]').textContent = o.shippingCost ? MACart.euros(o.shippingCost) : MA.t('free');
    if (o.shippingMethod) $('[data-c-ship-label]').textContent = o.shippingMethod;
    $('[data-c-disc-row]').hidden = !o.discount; $('[data-c-disc]').textContent = '− ' + MACart.euros(o.discount || 0);
    $('[data-c-total]').textContent = MACart.euros(o.total);
    const addr = $('[data-c-address]'); addr.replaceChildren();
    [o.name].concat(o.address).forEach(function (line, i) { if (i) addr.append(document.createElement('br')); addr.append(document.createTextNode(line)); });
    $('[data-c-details]').hidden = false;
    MACart.clear();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!saved.pi || !saved.secret) {
      $('[data-c-lead]').textContent = MA.t('confNoPay');
      return;
    }
    for (let i = 0; i < 10; i++) {
      const r = await MA.api('/api/order/confirmation?payment_intent=' + encodeURIComponent(saved.pi) + '&secret=' + encodeURIComponent(saved.secret));
      if (r.ok && r.order) { show(r.order); return; }
      if (!r.ok) { $('[data-c-lead]').textContent = MA.t('confPaidMail'); return; }
      await new Promise(function (res) { setTimeout(res, 1500); });
    }
    $('[data-c-lead]').textContent = MA.t('confPaidSoon');
    MACart.clear();
  });
})();
