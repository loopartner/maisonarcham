/* Page commande : coordonnées, livraison, récapitulatif. Montants et validation par le serveur. */
(function () {
  'use strict';
  const PREFS = 'archam-checkout', DRAFT = 'archam-checkout-draft';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignoré */ } };
  // Le brouillon ne garde que les champs d'adresse, en session uniquement (jamais de donnée de paiement).
  const readDraft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT) || '{}') || {}; } catch (e) { return {}; } };
  const writeDraft = (v) => { try { sessionStorage.setItem(DRAFT, JSON.stringify(v)); } catch (e) { /* ignoré */ } };

  let prefs = read(PREFS), seq = 0, lastQuote = null;
  const form = $('[data-checkout]');

  function payload() {
    const f = form.elements;
    return {
      items: MACart.items(), shipping: prefs.shipping, code: prefs.code || '', acceptTerms: f.acceptTerms.checked,
      customer: {
        email: f.email.value.trim(), phone: f.phone.value.trim(), firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(),
        shipping: { line1: f.line1.value.trim(), line2: f.line2.value.trim(), postalCode: f.postalCode.value.trim(), city: f.city.value.trim(), country: f.country.value },
        sameBilling: f.sameBilling.checked,
        billing: { line1: f.b_line1.value.trim(), postalCode: f.b_postalCode.value.trim(), city: f.b_city.value.trim(), country: f.b_country.value },
      },
    };
  }

  function showFieldErrors(fields) {
    $$('[data-fe]').forEach(function (el) {
      const m = fields && fields[el.dataset.fe];
      el.textContent = m || ''; el.hidden = !m;
      const input = el.parentElement.querySelector('input, select');
      if (input) { if (m) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    });
  }

  function renderSummary(q) {
    lastQuote = q;
    const ul = $('[data-lines]');
    ul.replaceChildren.apply(ul, q.lines.map(function (l) {
      const li = document.createElement('li'); li.className = 'ck-line';
      const t = document.createElement('div'); t.className = 'ck-thumb';
      const img = document.createElement('img'); img.src = l.image; img.alt = ''; img.width = 72; img.height = 90;
      const badge = document.createElement('span'); badge.className = 'ck-badge'; badge.textContent = String(l.qty); badge.setAttribute('aria-label', 'Quantité ' + l.qty);
      t.append(img, badge);
      const info = document.createElement('div'); info.className = 'ck-info';
      const n = document.createElement('p'); n.className = 'serif ck-name'; n.textContent = l.name;
      const v = document.createElement('p'); v.className = 'muted ck-variant'; v.textContent = l.variant;
      info.append(n, v);
      const p = document.createElement('span'); p.textContent = MACart.euros(l.total);
      li.append(t, info, p); return li;
    }));
    $('[data-subtotal]').textContent = MACart.euros(q.subtotal);
    $('[data-discount-row]').hidden = !q.discount;
    $('[data-discount-label]').textContent = q.promo ? q.promo.code : '';
    $('[data-discount]').textContent = '− ' + MACart.euros(q.discount);
    $('[data-ship-price]').textContent = q.shipping.price ? MACart.euros(q.shipping.price) : 'Offerte';
    $$('[data-total]').forEach(function (el) { el.textContent = MACart.euros(q.total); });

    const box = $('[data-ships]');
    if (!box.childElementCount) {
      q.shippingOptions.forEach(function (o) {
        const l = document.createElement('label'); l.className = 'ck-ship';
        const r = document.createElement('input'); r.type = 'radio'; r.name = 'ship'; r.value = o.id;
        r.addEventListener('change', function () { prefs.shipping = o.id; write(PREFS, prefs); refresh(); });
        const txt = document.createElement('span'); txt.className = 'ck-ship-t';
        const a = document.createElement('span'); a.textContent = o.title || o.label;
        const b = document.createElement('span'); b.className = 'muted ck-ship-d'; b.textContent = o.detail || '';
        txt.append(a, b);
        const pr = document.createElement('span'); pr.textContent = o.price ? MACart.euros(o.price) : 'Offerte';
        l.append(r, txt, pr); box.append(l);
      });
    }
    $$('input', box).forEach(function (r) { r.checked = r.value === q.shipping.id; r.closest('label').classList.toggle('on', r.checked); });

    $$('[data-countries]').forEach(function (sel) {
      if (sel.dataset.filled) return;
      const current = sel.value;
      sel.replaceChildren.apply(sel, q.countries.map(function (c) { const o = document.createElement('option'); o.value = c.code; o.textContent = c.name; return o; }));
      sel.value = q.countries.some(function (c) { return c.code === current; }) ? current : q.countries[0].code;
      sel.dataset.filled = '1';
    });
  }

  async function refresh(showPromo) {
    const items = MACart.items();
    if (!items.length) { location.replace('/panier'); return; }
    const my = ++seq;
    const r = await MA.api('/api/cart/quote', { method: 'POST', body: { items: items, shipping: prefs.shipping, code: prefs.code || '' } });
    if (my !== seq) return;
    const msg = $('[data-promo-msg]');
    if (!r.ok) { msg.textContent = r.error; msg.className = 'promo-msg err'; msg.hidden = false; return; }
    renderSummary(r.quote);
    if (r.quote.promoError && prefs.code) { prefs.code = ''; write(PREFS, prefs); }
    if (showPromo) {
      msg.hidden = false; msg.className = 'promo-msg ' + (r.quote.promo ? 'ok' : 'err');
      msg.textContent = r.quote.promo ? 'Code appliqué.' : r.quote.promoError;
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    // Pré-remplissage : brouillon de la session, puis compte connecté
    const d = readDraft(), f = form.elements;
    Object.keys(d).forEach(function (k) { if (f[k] && f[k].type !== 'checkbox') f[k].value = d[k]; });
    const me = await MA.api('/api/auth/me');
    if (me.ok && me.user) {
      $('[data-login-hint]').hidden = true;
      if (!f.email.value) f.email.value = me.user.email;
      if (!f.firstName.value) f.firstName.value = me.user.firstName;
      if (!f.lastName.value) f.lastName.value = me.user.lastName;
    }
    form.addEventListener('input', function () {
      const keep = {};
      ['email', 'phone', 'firstName', 'lastName', 'line1', 'line2', 'postalCode', 'city', 'country', 'b_line1', 'b_postalCode', 'b_city', 'b_country'].forEach(function (k) { keep[k] = f[k].value; });
      writeDraft(keep);
    });
    f.sameBilling.addEventListener('change', function () { $('[data-billing]').hidden = f.sameBilling.checked; });
    if (prefs.code) $('[data-code]').value = prefs.code;
    $('[data-apply]').addEventListener('click', function () { prefs.code = $('[data-code]').value.trim().toUpperCase(); write(PREFS, prefs); refresh(true); });
    $('[data-code]').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-apply]').click(); } });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const err = $('[data-error]'); err.hidden = true; showFieldErrors(null); $('[data-pay-later]').hidden = true;
      const btn = $('[data-submit]');
      MA.busy(btn, true, 'Vérification…');
      const r = await MA.api('/api/checkout/validate', { method: 'POST', body: payload() });
      MA.busy(btn, false);
      if (!r.ok) {
        showFieldErrors(r.fields);
        err.textContent = r.error; err.hidden = false;
        const first = $('[aria-invalid="true"]'); (first || err).focus();
        return;
      }
      // Le paiement (Stripe) sera branché ici à la dernière étape.
      $('[data-pay-later]').hidden = false;
    });
    refresh();
  });
})();
