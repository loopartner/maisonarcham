/* Back-office — commandes : liste filtrée, détail, mise à jour du statut et du suivi. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  const TABS = [['all', 'Toutes'], ['attente', 'En attente'], ['payee', 'Payées'], ['preparation', 'En préparation'], ['expediee', 'Expédiées'], ['livree', 'Livrées'], ['annulee', 'Annulées'], ['remboursee', 'Remboursées']];
  const EV = { suivi: 'Suivi mis à jour', notification: 'Client notifié' };
  let st = { status: 'all', q: '', days: 0, page: 1 }, timer, dw, current = null;

  function qs() { return 'status=' + st.status + '&q=' + encodeURIComponent(st.q) + '&days=' + st.days; }

  async function load() {
    const r = await MA.api('/api/admin/orders?' + qs() + '&page=' + st.page);
    if (!r.ok) { A.$('[data-count]').textContent = r.error; return; }
    A.$('[data-tabs]').replaceChildren.apply(A.$('[data-tabs]'), TABS.map(function (t) {
      return h('button', { type: 'button', 'aria-pressed': String(st.status === t[0]), onclick: function () { st.status = t[0]; st.page = 1; load(); } }, t[1], h('span', { class: 'n' }, String(r.counts[t[0]] || 0)));
    }));
    A.$('[data-none]').hidden = r.orders.length > 0;
    A.$('[data-rows]').replaceChildren.apply(A.$('[data-rows]'), r.orders.map(function (o) {
      const open = function () { openOrder(o.number); };
      const tr = h('tr', { class: 'clickable' },
        h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkbtn', onclick: open, 'aria-label': 'Ouvrir la commande ' + o.number }, o.number)),
        h('td', null, A.date(o.createdAt)), h('td', null, o.name || '—'), h('td', null, o.email || '—'), h('td', null, A.euros(o.total)),
        h('td', null, o.payment), h('td', null, h('span', { class: 'status ' + (o.paid ? 'livree' : 'attente') }, o.paid ? 'Payé' : 'Non payé')), h('td', null, A.badge(o.status, o.statusLabel)));
      tr.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON') open(); });
      return tr;
    }));
    A.$('[data-count]').textContent = r.total + ' commande' + (r.total > 1 ? 's' : '');
    A.$('[data-pageinfo]').textContent = 'Page ' + r.page + ' sur ' + r.pages;
    A.$('[data-prev]').disabled = r.page <= 1; A.$('[data-next]').disabled = r.page >= r.pages;
    A.$('[data-export]').href = '/api/admin/orders-export?' + qs();
  }

  function lines(el, arr) { el.replaceChildren(); arr.filter(Boolean).forEach(function (l, i) { if (i) el.append(h('br')); el.append(l); }); }

  async function openOrder(n) {
    const r = await MA.api('/api/admin/order?n=' + encodeURIComponent(n));
    if (!r.ok) return;
    current = r.order; const o = current;
    A.$('[data-d-date]').textContent = 'Commande · ' + A.date(o.createdAt);
    A.$('[data-drawer-title]').textContent = o.number;
    A.$('[data-d-name]').textContent = o.name || '—';
    A.$('[data-d-contact]').textContent = [o.email, o.phone].filter(Boolean).join(' · ');
    A.$('[data-d-address]').textContent = o.address || '';
    const cust = A.$('[data-d-customer]'); cust.hidden = !o.customerId; if (o.customerId) cust.href = '/admin/clients?id=' + encodeURIComponent(o.customerId);
    A.$('[data-d-items]').replaceChildren.apply(A.$('[data-d-items]'), (o.items || []).map(function (i) { return h('div', { class: 'dw-row' }, h('span', null, i.name + (i.variant ? ' · ' + i.variant : '') + ' × ' + i.quantity), h('span', null, A.euros(i.amount))); }));
    A.$('[data-d-ship-label]').textContent = o.shippingMethod || 'Livraison';
    A.$('[data-d-ship]').textContent = o.shippingCost ? A.euros(o.shippingCost) : 'Offerte';
    A.$('[data-d-disc-row]').hidden = !o.discount; A.$('[data-d-disc]').textContent = '− ' + A.euros(o.discount || 0);
    A.$('[data-d-total]').textContent = A.euros(o.total);
    const sel = A.$('[data-d-status]'); sel.replaceChildren.apply(sel, r.statuses.map(function (s) { return h('option', { value: s.id }, s.label); })); sel.value = o.status;
    const car = A.$('[data-d-carrier]'); car.replaceChildren.apply(car, [h('option', { value: '' }, 'Transporteur')].concat(r.carriers.map(function (c) { return h('option', { value: c.id }, c.label); }))); car.value = o.carrierId || '';
    const f = A.$('[data-d-form]'); f.elements.trackingNumber.value = o.trackingNumber || ''; f.elements.notify.checked = true; A.fieldErrors(f, null); A.$('[data-d-flash]').hidden = true;
    renderHistory(o);
    if (!dw) dw = A.drawer(A.$('.dw-panel'));
    if (A.$('[data-drawer]').hidden) dw.open();
    history.replaceState(null, '', '/admin/commandes?n=' + encodeURIComponent(o.number));
  }

  function renderHistory(o) {
    A.$('[data-d-history]').replaceChildren.apply(A.$('[data-d-history]'), (o.history || []).slice().reverse().map(function (e) {
      const what = e.status ? 'Statut : ' + (A.$('[data-d-status] option[value="' + (e.status === 'confirmee' ? 'payee' : e.status) + '"]') || { textContent: e.status }).textContent : (EV[e.event] || e.event) + (e.note ? ' — ' + e.note : '');
      return h('li', null, A.time(e.at) + ' — ' + what + (e.by ? ' (' + e.by + ')' : ''));
    }));
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await A.guard('orders'))) return;
    A.$('[data-q]').addEventListener('input', function (e) { clearTimeout(timer); timer = setTimeout(function () { st.q = e.target.value.trim(); st.page = 1; load(); }, 250); });
    A.$('[data-days]').addEventListener('change', function (e) { st.days = Number(e.target.value); st.page = 1; load(); });
    A.$('[data-prev]').addEventListener('click', function () { st.page--; load(); });
    A.$('[data-next]').addEventListener('click', function () { st.page++; load(); });
    A.$$('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', function () { history.replaceState(null, '', '/admin/commandes'); }); });
    const f = A.$('[data-d-form]');
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); A.fieldErrors(f, null);
      const btn = f.querySelector('button[type="submit"]'); MA.busy(btn, true, 'Enregistrement…');
      const r = await MA.api('/api/admin/order', { method: 'POST', body: { number: current.number, status: f.elements.status.value, carrier: f.elements.carrier.value, trackingNumber: f.elements.trackingNumber.value.trim(), notify: f.elements.notify.checked } });
      MA.busy(btn, false);
      if (!r.ok) { A.fieldErrors(f, r.fields); A.flash(A.$('[data-d-flash]'), r.error, false); return; }
      current = Object.assign(current, r.order); renderHistory(current);
      A.flash(A.$('[data-d-flash]'), r.notified ? '✓ Commande mise à jour, le client a été notifié.' : '✓ Commande mise à jour.');
      load();
    });
    await load();
    const n = new URLSearchParams(location.search).get('n'); if (n) openOrder(n);
  });
})();
