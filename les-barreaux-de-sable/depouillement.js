/* ==========================================================================
   Les Barreaux de Sable — dépouillement
   - filtres par rubrique : depuis « tout », un clic ne garde que la rubrique
     choisie ; les clics suivants en ajoutent ou en retirent
   - « Copier pour un tableur » : les fiches affichées, en colonnes
     séparées par des tabulations
   - « Imprimer »
   Le sommaire, la barre de progression et les flèches ← → viennent de
   treatment.js. Aucune animation : défilement natif.
   ========================================================================== */
(() => {
  const tools = document.querySelector('[data-dp-tools]');
  const seqs = document.querySelector('[data-dp-seqs]');
  if (!tools || !seqs) return;

  const KEY = 'bds-depouillement-hidden';
  const catBtns = Array.from(tools.querySelectorAll('[data-cat]'));
  const cats = catBtns.map((b) => b.dataset.cat);
  const status = tools.querySelector('[role="status"]');
  const allBtn = tools.querySelector('[data-act="all"]');
  let hidden = new Set();

  const apply = () => {
    catBtns.forEach((b) => b.setAttribute('aria-pressed', String(!hidden.has(b.dataset.cat))));
    if (allBtn) allBtn.setAttribute('aria-pressed', String(hidden.size === 0));
    seqs.dataset.hide = Array.from(hidden).join(' ');
    seqs.classList.toggle('is-filtered', hidden.size > 0);
    try { localStorage.setItem(KEY, seqs.dataset.hide); } catch (_) { /* navigation privée */ }
  };

  try {
    (localStorage.getItem(KEY) || '').split(' ').filter((c) => cats.includes(c)).forEach((c) => hidden.add(c));
  } catch (_) { /* rien */ }
  if (hidden.size === cats.length) hidden.clear();
  apply();

  const toggle = (cat) => {
    if (hidden.size === 0) {
      // Tout est affiché : on isole la rubrique choisie
      hidden = new Set(cats.filter((c) => c !== cat));
    } else if (hidden.has(cat)) {
      hidden.delete(cat);
    } else {
      hidden.add(cat);
      if (hidden.size === cats.length) hidden.clear();
    }
    apply();
  };

  // Le texte d'une puce, avec l'étiquette « traitement » entre parenthèses
  const text = (el) => Array.from(el.childNodes)
    .map((n) => (n.nodeType === 1 && n.classList.contains('dp-src') ? '(traitement)' : n.textContent))
    .join('')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tsv = () => {
    const shown = cats.filter((c) => !hidden.has(c));
    const head = ['Séquence', 'Décor'].concat(shown.map((c) => text(tools.querySelector(`[data-cat="${c}"]`))));
    const rows = Array.from(seqs.querySelectorAll('.dp-seq')).map((seq) => {
      const cells = shown.map((c) => {
        const cell = seq.querySelector(`.dp-cat[data-cat="${c}"]`);
        return cell ? Array.from(cell.querySelectorAll('li')).map(text).join(' / ') : '';
      });
      return [seq.dataset.label, seq.dataset.slug].concat(cells);
    });
    return [head].concat(rows).map((r) => r.map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  };

  const copyText = (value) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) resolve(); else reject(new Error('copy'));
    });
  };

  const flash = (btn, label, message) => {
    const original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = label;
    if (status) status.textContent = message;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = original; }, 1800);
  };

  tools.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.cat) { toggle(btn.dataset.cat); return; }
    const act = btn.dataset.act;
    if (act === 'all') { hidden.clear(); apply(); }
    else if (act === 'print') window.print();
    else if (act === 'copy') {
      copyText(tsv()).then(
        () => flash(btn, 'Copié ✓', 'Les fiches affichées sont copiées : collez-les dans un tableur.'),
        () => flash(btn, 'Copie refusée', 'Le navigateur a refusé la copie.'),
      );
    }
  });
})();
