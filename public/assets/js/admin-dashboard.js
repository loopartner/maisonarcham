/* Back-office — tableau de bord. */
(function () {
  'use strict';
  const A = window.MAAdmin;
  let data = null;

  function kpi(label, value, delta, tone) { return A.h('div', { class: 'kpi' }, A.h('p', { class: 'eyebrow muted' }, label), A.h('p', { class: 'kpi-v serif' }, value), A.h('p', { class: 'kpi-d ' + (tone || '') }, delta)); }
  const tone = (v) => (v === null || v === undefined || v === 0 ? 'neutral' : v > 0 ? 'up' : 'down');
  const LABEL = { today: 'vs hier', '7d': 'vs 7 j précédents', '30d': 'vs 30 j précédents', '12m': 'vs 12 mois précédents' };

  function render() {
    const k = data.kpis, cmp = LABEL[data.period];
    A.$('[data-kpis]').replaceChildren(
      kpi('Chiffre d’affaires total', A.euros(k.revenueTotal), 'Depuis l’ouverture', 'neutral'),
      kpi('CA du mois', A.euros(k.revenueMonth), A.pct(k.revenueMonthDelta) + ' vs mois précédent', tone(k.revenueMonthDelta)),
      kpi('Chiffre d’affaires (période)', A.euros(k.revenue), A.pct(k.revenueDelta) + ' ' + cmp, tone(k.revenueDelta)),
      kpi('Commandes', String(k.orders), (k.ordersDelta >= 0 ? '+' : '−') + Math.abs(k.ordersDelta) + ' ' + cmp, tone(k.ordersDelta)),
      kpi('Clients', String(k.customers), k.newCustomers + ' nouveau' + (k.newCustomers > 1 ? 'x' : '') + ' sur la période', 'neutral'),
      kpi('Abonnés newsletter', String(k.subscribers), '+' + k.newSubscribers + ' sur la période', k.newSubscribers ? 'up' : 'neutral'),
      kpi('Panier moyen', A.euros(k.basket), k.basketPrev ? A.pct(Math.round((k.basket - k.basketPrev) / k.basketPrev * 1000) / 10) + ' ' + cmp : '—', tone(k.basket - k.basketPrev))
    );
    const S = data.series, max = Math.max(1, ...S.map((s) => s.revenue));
    const bars = A.$('[data-bars]'), hover = A.$('[data-hover]');
    bars.replaceChildren.apply(bars, S.map(function (s, i) {
      const label = s.label + ' · ' + A.euros(s.revenue) + ' · ' + s.orders + ' commande' + (s.orders > 1 ? 's' : '');
      const bar = A.h('span', { class: 'bar' + (i === S.length - 1 ? ' last' : '') });
      bar.style.height = Math.max(1, s.revenue / max * 100).toFixed(1) + '%';
      const col = A.h('button', { type: 'button', class: 'bar-col', 'aria-label': label }, bar);
      const show = function () { hover.textContent = label; col.classList.add('on'); }, hide = function () { hover.textContent = 'Survolez une barre'; col.classList.remove('on'); };
      col.addEventListener('mouseenter', show); col.addEventListener('focus', show); col.addEventListener('mouseleave', hide); col.addEventListener('blur', hide);
      return col;
    }));
    A.$('[data-bar-labels]').replaceChildren.apply(A.$('[data-bar-labels]'), S.map(function (s) { return A.h('span', null, s.label); }));
    const pts = function (key) { const m = Math.max(1, ...S.map((s) => s[key])); return S.map(function (s, i) { return (S.length > 1 ? i / (S.length - 1) * 600 : 300).toFixed(1) + ',' + (236 - s[key] / m * 216).toFixed(1); }).join(' '); };
    A.$('[data-line-orders]').setAttribute('points', pts('orders'));
    A.$('[data-line-nl]').setAttribute('points', pts('subscribers'));
    A.$('[data-tot-orders]').textContent = String(S.reduce((n, s) => n + s.orders, 0));
    A.$('[data-tot-nl]').textContent = String(S.reduce((n, s) => n + s.subscribers, 0));
    A.$('[data-perf]').replaceChildren.apply(A.$('[data-perf]'), data.quarters.map(function (q) {
      return A.h('tr', null, A.h('th', { scope: 'row' }, q.label), A.h('td', null, A.euros(q.revenue)), A.h('td', null, String(q.orders)), A.h('td', { class: 'kpi-d ' + tone(q.delta) }, A.pct(q.delta)));
    }));
    A.$('[data-recent-empty]').hidden = data.recent.length > 0;
    A.$('[data-recent]').replaceChildren.apply(A.$('[data-recent]'), data.recent.map(function (o) {
      return A.h('tr', null, A.h('th', { scope: 'row' }, A.h('a', { class: 'adm-link', href: '/admin/commandes?n=' + encodeURIComponent(o.number) }, o.number)), A.h('td', null, o.name || '—'), A.h('td', null, A.euros(o.total)), A.h('td', null, A.badge(o.status, o.statusLabel)));
    }));
  }

  async function load(period) {
    A.$$('[data-period]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.period === period)); });
    const r = await MA.api('/api/admin/dashboard?period=' + period);
    A.$('[data-loading]').hidden = true;
    if (!r.ok) { A.$('[data-loading]').hidden = false; A.$('[data-loading]').textContent = r.error; return; }
    data = r; render();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    const t = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    A.$('[data-today]').textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (!(await A.guard('dashboard'))) return;
    A.$$('[data-period]').forEach(function (b) { b.addEventListener('click', function () { load(b.dataset.period); }); });
    load('30d');
  });
})();
