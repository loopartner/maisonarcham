/* Back-office — clients. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  let st = { q: '', page: 1 }, timer, dw;

  async function load() {
    const r = await MA.api('/api/admin/customers?q=' + encodeURIComponent(st.q) + '&page=' + st.page);
    if (!r.ok) { A.$('[data-count]').textContent = r.error; return; }
    A.$('[data-stats]').replaceChildren(
      h('span', null, h('strong', { class: 'serif' }, String(r.stats.total)), ' clients'),
      h('span', null, h('strong', { class: 'serif' }, '+' + r.stats.newThisMonth), ' ce mois'),
      h('span', null, h('strong', { class: 'serif' }, r.stats.repeatRate + ' %'), ' réachat'));
    A.$('[data-none]').hidden = r.customers.length > 0;
    A.$('[data-rows]').replaceChildren.apply(A.$('[data-rows]'), r.customers.map(function (c) {
      const open = function () { openCustomer(c.id ? 'id=' + encodeURIComponent(c.id) : 'email=' + encodeURIComponent(c.email)); };
      const tr = h('tr', { class: 'clickable' },
        h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkbtn', onclick: open }, c.name || c.email)),
        h('td', null, c.email), h('td', null, c.account ? (c.verified ? 'Oui' : 'Non confirmé') : 'Sans compte'),
        h('td', null, String(c.orders)), h('td', null, A.euros(c.spent)), h('td', null, A.date(c.lastOrder)), h('td', null, c.newsletter ? 'Abonné' : '—'));
      tr.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON') open(); });
      return tr;
    }));
    A.$('[data-count]').textContent = r.total + ' client' + (r.total > 1 ? 's' : '');
    A.$('[data-pageinfo]').textContent = 'Page ' + r.page + ' sur ' + r.pages;
    A.$('[data-prev]').disabled = r.page <= 1; A.$('[data-next]').disabled = r.page >= r.pages;
  }

  async function openCustomer(query) {
    const r = await MA.api('/api/admin/customer?' + query);
    if (!r.ok) return;
    const c = r.customer;
    A.$('[data-drawer-title]').textContent = c.name || c.email;
    A.$('[data-c-since]').textContent = 'Client depuis le ' + A.date(c.createdAt);
    A.$('[data-c-mail]').href = 'mailto:' + c.email;
    A.$('[data-c-orders]').textContent = String(c.stats.orders);
    A.$('[data-c-spent]').textContent = A.euros(c.stats.spent);
    A.$('[data-c-nl]').textContent = c.newsletter ? 'Abonné' : 'Non';
    A.$('[data-c-contact]').textContent = [c.email, c.phone].filter(Boolean).join(' · ');
    A.$('[data-c-account]').textContent = c.account ? 'Compte ' + (c.verified ? 'confirmé' : 'non confirmé') + (c.lastLoginAt ? ' · dernière connexion le ' + A.date(c.lastLoginAt) : '') : 'Commandes passées sans compte';
    const addr = A.$('[data-c-address]'); addr.replaceChildren(); (c.address.length ? c.address : ['—']).forEach(function (l, i) { if (i) addr.append(h('br')); addr.append(l); });
    A.$('[data-c-history]').replaceChildren.apply(A.$('[data-c-history]'), c.orders.map(function (o) {
      return h('tr', null, h('th', { scope: 'row' }, h('a', { class: 'adm-link', href: '/admin/commandes?n=' + encodeURIComponent(o.number) }, o.number)), h('td', null, A.date(o.createdAt)), h('td', null, A.euros(o.total)), h('td', null, A.badge(o.status, o.statusLabel)));
    }));
    if (!dw) dw = A.drawer(A.$('.dw-panel'));
    if (A.$('[data-drawer]').hidden) dw.open();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await A.guard('customers'))) return;
    A.$('[data-q]').addEventListener('input', function (e) { clearTimeout(timer); timer = setTimeout(function () { st.q = e.target.value.trim(); st.page = 1; load(); }, 250); });
    A.$('[data-prev]').addEventListener('click', function () { st.page--; load(); });
    A.$('[data-next]').addEventListener('click', function () { st.page++; load(); });
    await load();
    const q = new URLSearchParams(location.search);
    if (q.get('id')) openCustomer('id=' + encodeURIComponent(q.get('id')));
  });
})();
