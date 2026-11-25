/* ==========================================================================
   Les Barreaux de Sable — traitement (v6)
   - le sommaire en bas à gauche
   - flèches ← → du clavier : section précédente / suivante (présentation orale)
   - infobulles des schémas (le tableau sous chaque schéma dit la même chose)
   Aucune animation : défilement natif.
   ========================================================================== */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ------------------------------------------------------------------
     Sommaire
     ------------------------------------------------------------------ */
  const chapters = $$('[data-chapter]').map((el, i) => ({ el, i, name: el.dataset.chapter, top: 0 }));
  const chap = $('[data-chap]');
  const chapBtn = $('[data-chap-btn]');
  const chapList = $('[data-chap-list]');
  const chapN = $('[data-chap-n]');
  const chapT = $('[data-chap-t]');
  const progress = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()') ? null : $('.progress i');
  let current = -1;

  const go = (i) => {
    const c = chapters[clamp(i, 0, chapters.length - 1)];
    if (c) c.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  const setOpen = (open) => {
    if (!chapList) return;
    chapList.hidden = !open;
    chapBtn.setAttribute('aria-expanded', String(open));
  };
  if (chap && chapters.length) {
    chapList.replaceChildren(...chapters.map((c) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${c.el.id}`;
      const n = document.createElement('b');
      n.textContent = pad2(c.i + 1);
      a.append(n, document.createTextNode(c.name));
      a.addEventListener('click', (e) => { e.preventDefault(); go(c.i); setOpen(false); });
      li.appendChild(a);
      return li;
    }));
    chapBtn.addEventListener('click', () => setOpen(chapList.hidden));
    document.addEventListener('click', (e) => { if (!chap.contains(e.target)) setOpen(false); });
  }

  const measure = () => {
    const y = window.scrollY;
    chapters.forEach((c) => { c.top = c.el.getBoundingClientRect().top + y; });
  };
  const update = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (chap) chap.classList.toggle('is-on', y > vh * 0.6);
    let ci = -1;
    chapters.forEach((c) => { if (c.top - y <= vh * 0.4) ci = c.i; });
    if (ci !== current && chapters.length) {
      current = ci;
      const c = chapters[Math.max(0, ci)];
      if (chapN) chapN.textContent = pad2(c.i + 1);
      if (chapT) chapT.textContent = c.name;
      $$('a', chapList).forEach((a, k) => { if (k === c.i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    if (progress) progress.style.transform = `scaleX(${clamp(y / Math.max(1, root.scrollHeight - vh), 0, 1).toFixed(4)})`;
  };
  let raf = 0;
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  window.addEventListener('load', () => { measure(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
  measure();
  update();

  /* ------------------------------------------------------------------
     Présentation : → section suivante, ← section précédente
     ------------------------------------------------------------------ */
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    measure();
    const y = window.scrollY;
    let ci = -1;
    chapters.forEach((c) => { if (c.top <= y + 30) ci = c.i; });
    if (e.key === 'ArrowRight') {
      if (ci + 1 < chapters.length) go(ci + 1);
      else window.scrollTo({ top: root.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    } else if (ci >= 0 && y > chapters[ci].top + 40) {
      go(ci);
    } else if (ci > 0) {
      go(ci - 1);
    } else {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  });

  /* ------------------------------------------------------------------
     Schémas : au survol d'une scène, une infobulle (titre + deux lignes)
     ------------------------------------------------------------------ */
  $$('[data-schema]').forEach((fig) => {
    const tip = $('.schema__tip', fig);
    const svg = $('svg', fig);
    const cursor = $('.sx-cursor', fig);
    if (!tip || !svg) return;
    svg.addEventListener('pointermove', (e) => {
      const hit = e.target.closest('.sx-hit');
      if (!hit) return;
      const [title, l1, l2] = (fig.dataset[`s${hit.dataset.i}`] || '').split('|');
      const b = document.createElement('b');
      b.textContent = title || '';
      const s1 = document.createElement('span');
      s1.textContent = l1 || '';
      const s2 = document.createElement('span');
      s2.textContent = l2 || '';
      tip.replaceChildren(b, s1, s2);
      tip.hidden = false;
      const x = parseFloat(hit.getAttribute('x')) + parseFloat(hit.getAttribute('width')) / 2;
      if (cursor) { cursor.setAttribute('x1', x); cursor.setAttribute('x2', x); }
      fig.classList.add('is-hover');
      const r = fig.getBoundingClientRect();
      tip.style.left = `${Math.min(r.width - tip.offsetWidth - 8, Math.max(8, e.clientX - r.left + 14))}px`;
      tip.style.top = `${e.clientY - r.top + 16}px`;
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; fig.classList.remove('is-hover'); });
  });

  /* ------------------------------------------------------------------
     Références animées : des WebP en boucle, comme des GIF (aucun bouton).
     Si l'appareil demande moins d'animation, on montre l'image fixe.
     ------------------------------------------------------------------ */
  if (reduced) {
    $$('img.ref[src$=".webp"]').forEach((img) => { img.src = img.getAttribute('src').replace(/\.webp$/, '.jpg'); });
  }
})();
