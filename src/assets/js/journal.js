/* Journal : filtre par catégorie et chargement progressif. */
(function () {
  'use strict';
  const PAGE = 9;
  document.addEventListener('DOMContentLoaded', function () {
    const cards = Array.from(document.querySelectorAll('[data-list] .j-card'));
    const feat = document.querySelector('[data-featured] .j-feat');
    const more = document.querySelector('[data-more]'), none = document.querySelector('[data-none]');
    let cat = 'Tous', shown = PAGE;
    function render() {
      const match = cards.filter(function (c) { return cat === 'Tous' || c.dataset.cat === cat; });
      cards.forEach(function (c) { c.hidden = true; });
      match.slice(0, shown).forEach(function (c) { c.hidden = false; });
      if (feat) feat.hidden = !(cat === 'Tous' || feat.dataset.cat === cat);
      none.hidden = match.length > 0 || (feat && !feat.hidden);
      more.hidden = match.length <= shown;
    }
    document.querySelectorAll('.j-cat').forEach(function (b) {
      b.addEventListener('click', function () {
        cat = b.dataset.filter; shown = PAGE;
        document.querySelectorAll('.j-cat').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        render();
      });
    });
    more.addEventListener('click', function () { shown += PAGE; render(); });
    render();
  });
})();
