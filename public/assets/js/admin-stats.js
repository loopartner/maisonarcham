/* Back-office — statistiques. */
(function () {
  'use strict';
  const A = window.MAAdmin, h = A.h;
  const M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const kpi = (l, v, d) => h('div', { class: 'kpi' }, h('p', { class: 'eyebrow muted' }, l), h('p', { class: 'kpi-v serif' }, v), d ? h('p', { class: 'kpi-d neutral' }, d) : null);

  async function load(year) {
    const r = await MA.api('/api/admin/stats?year=' + year);
    if (!r.ok) return;
    const t = r.totals;
    A.$('[data-kpis]').replaceChildren(kpi('Chiffre d’affaires ' + r.year, A.euros(t.revenue)), kpi('Commandes', String(t.orders)), kpi('Flacons vendus', String(t.units)), kpi('Nouveaux clients', String(t.customers)), kpi('Panier moyen', A.euros(t.orders ? Math.round(t.revenue / t.orders) : 0)));
    A.$('[data-y-cur]').textContent = String(r.year); A.$('[data-y-prev]').textContent = String(r.year - 1);
    const max = Math.max(1, ...r.revenue.current, ...r.revenue.previous);
    A.$('[data-rev]').replaceChildren.apply(A.$('[data-rev]'), M.map(function (m, i) {
      const c = h('span', { class: 'bar last' }), p = h('span', { class: 'bar' });
      c.style.height = Math.max(1, r.revenue.current[i] / max * 100).toFixed(1) + '%'; p.style.height = Math.max(1, r.revenue.previous[i] / max * 100).toFixed(1) + '%';
      return h('div', { class: 'bar-col pair', title: FULL[i] + ' : ' + A.euros(r.revenue.current[i]) + ' (' + (r.year - 1) + ' : ' + A.euros(r.revenue.previous[i]) + ')' }, p, c);
    }));
    A.$('[data-rev-labels]').replaceChildren.apply(A.$('[data-rev-labels]'), M.map(function (m) { return h('span', null, m); }));
    const pts = function (arr) { const mx = Math.max(1, ...arr); return arr.map(function (v, i) { return (i / 11 * 600).toFixed(1) + ',' + (236 - v / mx * 216).toFixed(1); }).join(' '); };
    A.$('[data-l-units]').setAttribute('points', pts(r.units)); A.$('[data-l-cust]').setAttribute('points', pts(r.newCustomers));
    A.$('[data-t-units]').textContent = String(t.units); A.$('[data-t-cust]').textContent = String(t.customers);
    A.$('[data-no-products]').hidden = r.products.length > 0;
    A.$('[data-products]').replaceChildren.apply(A.$('[data-products]'), r.products.map(function (p) {
      return h('tr', null, h('th', { scope: 'row' }, p.name), h('td', null, String(p.units)), h('td', null, A.euros(p.revenue)), h('td', null, t.revenue ? Math.round(p.revenue / t.revenue * 100) + ' %' : '—'));
    }));
    A.$('[data-nl]').replaceChildren(
      h('div', null, h('p', { class: 'eyebrow muted' }, 'Abonnés'), h('p', { class: 'serif kpi-v' }, String(r.newsletter.subscribers))),
      h('div', null, h('p', { class: 'eyebrow muted' }, 'Inscriptions ' + r.year), h('p', { class: 'serif kpi-v' }, String(r.newsletter.monthly.reduce((a, b) => a + b, 0)))),
      h('div', null, h('p', { class: 'eyebrow muted' }, 'Campagnes envoyées'), h('p', { class: 'serif kpi-v' }, String(r.newsletter.campaigns))));
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await A.guard('stats'))) return;
    const y = new Date().getFullYear(), sel = A.$('[data-year]');
    for (let i = y; i >= y - 4; i--) sel.append(h('option', { value: String(i) }, String(i)));
    sel.addEventListener('change', function () { load(sel.value); });
    A.$('[data-print]').addEventListener('click', function () { window.print(); });
    load(y);
  });
})();
