/* ==========================================================================
   Les Barreaux de Sable — traitement (v5)
   - l'ouverture : l'entrée dans la crevasse (au défilement)
   - le sommaire en bas à gauche
   - flèches ← → du clavier : section précédente / suivante (présentation orale)
   Défilement natif, aucun effet au-delà de l'ouverture.
   ========================================================================== */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) root.classList.add('fx');

  /* ------------------------------------------------------------------
     L'entrée dans la crevasse
     L'ouverture reste fixe pendant que l'on défile : la caméra avance
     entre des pans de roche (en 3D CSS), les parois se resserrent
     jusqu'au ruban de ciel, Marie et Thomas s'enfoncent devant nous,
     puis la lumière envahit l'écran et devient la page.
     ------------------------------------------------------------------ */
  const entry = $('[data-entry]');
  const slot = $('[data-slot]');
  if (entry && slot && !reduced) {
    root.classList.add('has-entry');
    const world = $('[data-slot-world]', slot);
    const glow = $('.slot__glow', slot);
    const floor = $('.slot__floor', slot);
    const walkers = $('[data-walkers]', slot);
    const eMedia = $('.hero__media', entry);
    const eContent = $('.hero__content', entry);
    const eMarks = $$('.hero > .plus', entry);
    const eCue = $('.hero__cue', entry);
    const eLight = $('.entry__light', entry);
    const eLines = $$('.entry__lines li', entry).map((el, i) => ({ el, i, o: -1 }));
    const WINDOWS = [[0.07, 0.25], [0.29, 0.47], [0.51, 0.71], [0.88, 2]];
    const TEX = ['slot-dark.jpg', 'rock-close.jpg', 'slot-ribbon.jpg'];

    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    let walls = [];
    let P = 1000; let Wf = 0; let Hf = 0; let S = 0; let L = 0; let zNear = 0; let zFar = 0; let Tmax = 0;
    let eTop = 0; let eDist = 1; let eP = -1; let eOn = false; let eRaf = 0;

    const build = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      P = Math.round(Math.max(w, h) * 0.78);
      slot.style.perspective = `${P}px`;
      Wf = Math.max(w, 520) * 1.1;
      Hf = h * 2;
      const N = w < 700 ? 5 : 6;
      S = Wf * 0.72;
      L = N * S;
      zNear = P * 0.8;
      zFar = zNear - L;
      Tmax = L * 1.9;
      walls.forEach((f) => f.el.remove());
      walls = [];
      seed = 7;
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < N; k++) {
          const el = document.createElement('div');
          el.className = 'slot__wall';
          const shade = document.createElement('i');
          el.appendChild(shade);
          // contours de roche irréguliers (marche aléatoire, quelques encoches)
          const pts = [];
          const steps = 30;
          let d = 3 + rnd() * 8;
          for (let j = 0; j <= steps; j++) {
            const y = (j / steps) * 100;
            d = clamp(d + (rnd() - 0.5) * 5 + (rnd() < 0.12 ? (rnd() - 0.3) * 9 : 0), 0.5, 17);
            pts.push(side < 0 ? `${(100 - d).toFixed(1)}% ${y.toFixed(1)}%` : `${d.toFixed(1)}% ${y.toFixed(1)}%`);
          }
          const back = [];
          let e = rnd() * 4;
          for (let j = steps; j >= 0; j -= 3) {
            const y = (j / steps) * 100;
            e = clamp(e + (rnd() - 0.5) * 4, 0, 8);
            back.push(side < 0 ? `${e.toFixed(1)}% ${y.toFixed(1)}%` : `${(100 - e).toFixed(1)}% ${y.toFixed(1)}%`);
          }
          const poly = [...pts, ...back];
          el.style.clipPath = `polygon(${poly.join(',')})`;
          el.style.width = `${Wf.toFixed(0)}px`;
          el.style.height = `${Hf.toFixed(0)}px`;
          el.style.setProperty('--tex', `url("img/${TEX[Math.floor(rnd() * TEX.length)]}")`);
          el.style.setProperty('--bp', `${(rnd() * 100).toFixed(0)}% ${(rnd() * 100).toFixed(0)}%`);
          el.style.setProperty('--dir', side < 0 ? 'to left' : 'to right');
          world.insertBefore(el, walkers);
          walls.push({
            el, shade, side,
            z0: zNear - (k + (side > 0 ? 0.5 : 0) + 0.25) * S,
            jit: (rnd() - 0.5) * 0.05 * w,
            yo: (rnd() - 0.5) * 0.12 * h,
            t: '', o: -1, s: -1,
          });
        }
      }
      measureEntry();
      eP = -1;
      render();
    };

    const measureEntry = () => {
      const r = entry.getBoundingClientRect();
      eTop = r.top + window.scrollY;
      eDist = Math.max(1, entry.offsetHeight - window.innerHeight);
      root.__entryEnd = eTop + entry.offsetHeight;
    };

    const render = () => {
      const p = clamp((window.scrollY - eTop) / eDist, 0, 1);
      if (p === eP) return;
      eP = p;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const a = smooth(0, 0.22, p);
      const b = smooth(0.18, 0.62, p);
      const c = smooth(0.58, 0.82, p);
      const d = smooth(0.82, 1, p);

      // le paysage : on avance vers la faille, puis il s'efface derrière la roche
      eMedia.style.transform = `scale(${(1 + a * 0.42 + b * 0.18).toFixed(4)})`;
      eMedia.style.opacity = (1 - smooth(0.14, 0.34, p)).toFixed(3);
      eContent.style.opacity = (1 - smooth(0, 0.1, p)).toFixed(3);
      eMarks.forEach((m) => { m.style.opacity = (1 - smooth(0, 0.1, p)).toFixed(3); });
      eContent.style.transform = p ? `translate3d(0,${(-a * 70).toFixed(1)}px,0)` : '';
      if (eCue) eCue.style.opacity = (1 - smooth(0, 0.04, p)).toFixed(3);
      glow.style.opacity = smooth(0.1, 0.3, p).toFixed(3);
      glow.style.transform = d ? `scale(${(1 + d * d * 16).toFixed(3)},${(1 + d * 1.2).toFixed(3)})` : '';
      floor.style.opacity = (smooth(0.14, 0.34, p) * (1 - d)).toFixed(3);

      // la caméra avance ; les parois se resserrent, puis s'ouvrent sur la lumière
      const T = Tmax * (p * 0.8 + 0.2 * smooth(0, 1, p));
      const bob = Math.sin(T / 150) * 3 * b * (1 - d);
      world.style.transform = `translate3d(0,${bob.toFixed(2)}px,0)`;
      let g = 0.44 * w;
      g += (0.15 * w - 0.44 * w) * a;
      g += (0.07 * w - 0.15 * w) * b;
      g += (0.028 * w - 0.07 * w) * c;
      g += 1.1 * w * d * d;
      const wallsIn = smooth(0.02, 0.16, p);
      for (const f of walls) {
        let z = f.z0 + T - zFar;
        z = ((z % L) + L) % L + zFar;
        const op = wallsIn * smooth(zFar, zFar + S * 0.9, z) * (1 - smooth(zNear - S * 0.45, zNear, z));
        const inner = g + f.jit;
        const x = f.side < 0 ? -inner - Wf : inner;
        const t = `translate3d(${x.toFixed(1)}px,${(-Hf / 2 + f.yo).toFixed(1)}px,${z.toFixed(1)}px)`;
        if (t !== f.t) { f.t = t; f.el.style.transform = t; }
        if (Math.abs(op - f.o) > 0.004) { f.o = op; f.el.style.opacity = op.toFixed(3); }
        const depth = (zNear - z) / L;
        const sh = clamp(0.55 - depth * 0.62, 0, 0.55) * (1 - d * 0.6);
        if (Math.abs(sh - f.s) > 0.01) { f.s = sh; f.shade.style.opacity = sh.toFixed(3); }
      }

      // Marie et Thomas s'enfoncent devant nous, puis se perdent dans la faille
      const wv = smooth(0.06, 0.15, p) * (1 - smooth(0.6, 0.72, p));
      const zr = -h * 0.12 - smooth(0.06, 0.74, p) * L * 0.5;
      walkers.style.opacity = wv.toFixed(3);
      walkers.style.transform = `translate3d(0,${(h * 0.33).toFixed(1)}px,${zr.toFixed(1)}px)`;
      slot.classList.toggle('is-walking', wv > 0.01);

      // les phrases
      for (const l of eLines) {
        const [s0, s1] = WINDOWS[l.i] || [2, 3];
        const inn = smooth(s0, s0 + 0.05, p);
        const o = inn * (1 - smooth(s1 - 0.05, s1, p));
        if (Math.abs(o - l.o) > 0.004) {
          l.o = o;
          l.el.style.opacity = o.toFixed(3);
          l.el.style.transform = `translate3d(0,${((1 - inn) * 16).toFixed(1)}px,0)`;
        }
      }
      eLight.style.opacity = smooth(0.9, 0.985, p).toFixed(3);
    };

    const tick = () => {
      eRaf = 0;
      if (!eOn) return;
      render();
      eRaf = requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => {
        eOn = en.isIntersecting;
        if (eOn && !eRaf) eRaf = requestAnimationFrame(tick);
      }).observe(entry);
    } else {
      eOn = true;
      eRaf = requestAnimationFrame(tick);
    }
    let eRs = 0;
    const rebuild = () => { cancelAnimationFrame(eRs); eRs = requestAnimationFrame(build); };
    window.addEventListener('resize', rebuild);
    window.addEventListener('load', () => { measureEntry(); eP = -1; render(); });
    build();
  }


  /* ------------------------------------------------------------------
     Sommaire + navigation au clavier
     ------------------------------------------------------------------ */
  const chapters = $$('[data-chapter]').map((el, i) => ({ el, i, name: el.dataset.chapter, top: 0 }));
  const chap = $('[data-chap]');
  const chapBtn = $('[data-chap-btn]');
  const chapList = $('[data-chap-list]');
  const chapN = $('[data-chap-n]');
  const chapT = $('[data-chap-t]');
  const pad2 = (n) => String(n).padStart(2, '0');
  let current = -1;

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
  }
  const setOpen = (open) => {
    if (!chapList) return;
    chapList.hidden = !open;
    chapBtn.setAttribute('aria-expanded', String(open));
  };
  if (chapBtn) chapBtn.addEventListener('click', () => setOpen(chapList.hidden));
  document.addEventListener('click', (e) => { if (chap && !chap.contains(e.target)) setOpen(false); });

  const go = (i) => {
    const c = chapters[clamp(i, 0, chapters.length - 1)];
    if (c) c.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const measure = () => {
    const y = window.scrollY;
    chapters.forEach((c) => { c.top = c.el.getBoundingClientRect().top + y; });
  };
  const update = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const end = root.__entryEnd || vh;
    if (chap) chap.classList.toggle('is-on', y > end - vh * 0.5);
    let ci = -1;
    chapters.forEach((c) => { if (c.top - y <= vh * 0.4) ci = c.i; });
    if (ci !== current) {
      current = ci;
      const c = chapters[Math.max(0, ci)];
      if (chapN) chapN.textContent = pad2(c.i + 1);
      if (chapT) chapT.textContent = c.name;
      $$('a', chapList).forEach((a, k) => { if (k === c.i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    // barre de progression (navigateurs sans animations liées au défilement)
    if (progress) {
      const p = clamp(y / Math.max(1, root.scrollHeight - vh), 0, 1);
      progress.style.transform = `scaleX(${p.toFixed(4)})`;
    }
  };
  const progress = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()') ? null : $('.progress i');

  let raf = 0;
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  window.addEventListener('load', () => { measure(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
  measure();
  update();

  /* ------------------------------------------------------------------
     Schémas de la post-prod : au survol d'une scène, ce qu'on ressent
     et ce qu'on entend (le tableau sous les schémas dit la même chose)
     ------------------------------------------------------------------ */
  $$('[data-schema]').forEach((fig) => {
    const tip = $('.schema__tip', fig);
    const svg = $('svg', fig);
    const cursor = $('.sx-cursor', fig);
    if (!tip || !svg) return;
    const em = (t) => { const e = document.createElement('em'); e.textContent = t; return e; };
    const show = (e, hit) => {
      const i = hit.dataset.i;
      const [title, tension, feel, hear] = (fig.dataset[`s${i}`] || '').split('|');
      const strong = document.createElement('b');
      strong.textContent = title;
      const l1 = document.createElement('span');
      l1.append(em('Tension'), ` ${tension}/10 · `, em('On ressent'), ` ${(feel || '').toLowerCase()}`);
      const l2 = document.createElement('span');
      l2.append(em('On entend'), ` ${hear || ''}`);
      tip.replaceChildren(strong, l1, l2);
      tip.hidden = false;
      const x = parseFloat(hit.getAttribute('x')) + parseFloat(hit.getAttribute('width')) / 2;
      if (cursor) { cursor.setAttribute('x1', x); cursor.setAttribute('x2', x); }
      fig.classList.add('is-hover');
      const r = fig.getBoundingClientRect();
      const left = Math.min(r.width - tip.offsetWidth - 8, Math.max(8, e.clientX - r.left + 14));
      tip.style.left = `${left}px`;
      tip.style.top = `${e.clientY - r.top + 16}px`;
    };
    svg.addEventListener('pointermove', (e) => {
      const hit = e.target.closest('.sx-hit');
      if (hit) show(e, hit);
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; fig.classList.remove('is-hover'); });
  });

  // Présentation : → section suivante, ← section précédente
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
      go(ci); // au milieu d'une section : on revient à son début
    } else if (ci > 0) {
      go(ci - 1);
    } else {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  });
})();
