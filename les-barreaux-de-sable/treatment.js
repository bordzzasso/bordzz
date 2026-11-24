/* LES BARREAUX DE SABLE — interactions
   Défilement natif ; effets de position en CSS (scroll-driven animations), repli JS.
   Les positions sont mesurées une fois (et au redimensionnement) : la boucle
   d'animation ne relit jamais la mise en page. */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  if (!reduced) root.classList.add('fx');

  /* ------------------------------------------------------------------
     Défilement : celui du système (fluide, 120 Hz, inertie native).
     Les effets liés à la position (ouverture, parallaxes, sections qui
     s'ouvrent, storyboard, barre de progression) passent par les
     « scroll-driven animations » CSS quand le navigateur les connaît :
     ils sont calés image par image sur le défilement. Sinon, repli en JS.
     ------------------------------------------------------------------ */
  const sda = !reduced && !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  function scrollToEl(el) {
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------
     Découpages typographiques
     ------------------------------------------------------------------ */
  // Lettre par lettre (chaque mot reste insécable)
  function splitChars(el) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const word = document.createElement('span');
            word.className = 'cw';
            for (const c of part) {
              const mask = document.createElement('span');
              mask.className = 'cm';
              const ch = document.createElement('span');
              ch.className = 'ch';
              ch.style.setProperty('--ci', i++);
              ch.textContent = c;
              mask.appendChild(ch);
              word.appendChild(mask);
            }
            frag.appendChild(word);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          if (n.classList.contains('sun')) { n.style.setProperty('--ci', i++); return; }
          walk(n);
        }
      });
    };
    walk(el);
  }

  // Mot par mot : avec masque (ils montent) ou sans (ils s'allument)
  function splitWords(el, masked) {
    let i = 0;
    const out = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\n]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = masked ? 'w-in' : 'qw';
            w.style.setProperty('--wi', i++);
            w.textContent = part;
            out.push(w);
            if (masked) {
              const m = document.createElement('span');
              m.className = 'w-mask';
              m.appendChild(w);
              frag.appendChild(m);
            } else {
              frag.appendChild(w);
            }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
    return out;
  }

  const heroTitle = $('.hero__title');
  const helloWord = $('.hello__word');
  const endTitle = $('.end__title');
  let qWords = [];

  if (!reduced) {
    if (heroTitle) {
      heroTitle.setAttribute('aria-label', heroTitle.textContent.replace(/\s+/g, ' ').trim());
      $$(':scope > span', heroTitle).forEach((s) => s.setAttribute('aria-hidden', 'true'));
      splitChars(heroTitle);
      requestAnimationFrame(() => requestAnimationFrame(() => heroTitle.classList.add('is-in')));
      // une fois posées, les lettres retrouvent leur ombre portée entière
      setTimeout(() => heroTitle.classList.add('is-done'), 3400);
    }
    if (helloWord) splitChars($('span', helloWord) || helloWord);
    if (endTitle) {
      const txt = endTitle.textContent.trim();
      endTitle.setAttribute('aria-label', txt);
      const inner = document.createElement('span');
      inner.setAttribute('aria-hidden', 'true');
      inner.textContent = txt;
      endTitle.replaceChildren(inner);
      splitChars(inner);
    }
    $$('.statement, .buzz__title, .post__title, .end__line').forEach((el) => splitWords(el, true));
    const q = $('.question__title');
    if (q) qWords = splitWords(q, false).map((el) => ({ el, o: -1 }));
  }

  // Décalages dans les listes
  ['.hello__sheet > div', '.beats li', '.places__notes li', '.palette span'].forEach((sel) => {
    $$(sel).forEach((el, i) => el.style.setProperty('--i', i));
  });

  // Images qui se dévoilent
  const unveils = reduced ? [] : $$('.hello__img, .card__media, .split-head__img, .duo-card__media, .mirror-card__grid figure, .visual__img, .light__stack, .mood__imgs, .film__img, .meet__grid figure:not(.meet__tile), .shepherd figure, .places__duo, .places__row, .post__strip, .post__split figure, .grade__img, .twins__side, .film__end-img');
  unveils.forEach((el) => el.classList.add('unveil'));
  $$('.mirror-card__grid, .meet__grid, .grade__steps, .twins__pair').forEach((g) => {
    $$('.unveil', g).forEach((f, i) => f.style.setProperty('--ud', `${(i * 0.09).toFixed(2)}s`));
  });

  // Parallaxe à l'intérieur des cadres
  const pxImgs = reduced ? [] : $$('.visual__img img, .film__img img, .split-head__img img, .shepherd img, .duo-card__media img, .hello__img img')
    .map((img) => { img.dataset.px = ''; return { img, box: img.parentElement, top: 0, h: 0, v: 9999 }; });
  const pxLoop = sda ? [] : pxImgs;

  /* ------------------------------------------------------------------
     Apparitions au scroll
     ------------------------------------------------------------------ */
  if (!reduced) {
    $$('[data-draw]').forEach((p) => {
      const len = Math.ceil(p.getTotalLength());
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      $$('[data-draw]', e.target).forEach((p, i) => {
        p.style.transition = `stroke-dashoffset 2.2s cubic-bezier(.2,.7,.1,1) ${0.3 + i * 0.15}s`;
        p.style.strokeDashoffset = 0;
      });
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  $$('[data-reveal], .unveil, .film__pair').forEach((el) => io.observe(el));
  if (helloWord) io.observe(helloWord);

  // Démo « mirage » : le filtre ne tourne que lorsqu'il est à l'écran
  const haze = $('.vfx__media--haze');
  if (haze && !reduced) {
    new IntersectionObserver(([e]) => haze.classList.toggle('is-live', e.isIntersecting)).observe(haze);
  }

  /* ------------------------------------------------------------------
     Sommaire flottant
     ------------------------------------------------------------------ */
  const chapters = $$('[data-chapter]').map((el, i) => ({ el, title: el.dataset.chapter, n: String(i + 1).padStart(2, '0'), top: 0 }));
  const scenes = $$('.film__beat > b, .film__pair > div:first-child > b, .film__end-text > b').map((b) => ({ label: b.textContent.trim().replace('#', ''), b, top: 0 }));
  let chap = null;
  let chapNum = null;
  let chapTxt = null;
  let chapLinks = [];
  let chapLabel = '';
  let chapOn = false;
  const setOpen = (open) => {
    if (!chap) return;
    chap.classList.toggle('is-open', open);
    $('.chap__btn', chap).setAttribute('aria-expanded', String(open));
  };
  if (chapters.length) {
    chap = document.createElement('nav');
    chap.className = 'chap';
    chap.setAttribute('aria-label', 'Sommaire');
    chap.innerHTML =
      `<ol class="chap__list" id="chap-list">${chapters.map((c) => `<li><a href="#${c.el.id}"><b>${c.n}</b><span>${c.title}</span></a></li>`).join('')}</ol>` +
      `<button class="chap__btn" type="button" aria-expanded="false" aria-controls="chap-list"><b>${chapters[0].n}</b><span class="chap__t"></span><i aria-hidden="true"></i></button>`;
    document.body.appendChild(chap);
    chapNum = $('.chap__btn > b', chap);
    chapTxt = $('.chap__t', chap);
    chapLinks = $$('a', chap);
    $('.chap__btn', chap).addEventListener('click', () => setOpen(!chap.classList.contains('is-open')));
    chapLinks.forEach((a, i) => a.addEventListener('click', (e) => {
      e.preventDefault();
      setOpen(false);
      scrollToEl(chapters[i].el);
    }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('pointerdown', (e) => { if (!chap.contains(e.target)) setOpen(false); });
  }
  function setChapter(i, sub) {
    const label = chapters[i].title + (sub ? ` · ${sub}` : '');
    if (label === chapLabel) return;
    chapLabel = label;
    chapNum.textContent = chapters[i].n;
    const s = document.createElement('span');
    s.textContent = label;
    chapTxt.replaceChildren(s);
    chapLinks.forEach((a, k) => a.classList.toggle('is-active', k === i));
  }

  /* ------------------------------------------------------------------
     Éléments pilotés par le défilement
     ------------------------------------------------------------------ */
  const progressBar = $('[data-progress]');
  const hero = $('.hero');
  const heroMedia = $('.hero__media');
  const heroContent = $('.hero__content');
  const heroCue = $('.hero__cue');
  const barsWrap = $('.hero__bars');
  const layers = (reduced || sda) ? [] : $$('[data-parallax]').filter((el) => el !== heroMedia)
    .map((el) => ({ el, k: parseFloat(el.dataset.parallax) || 0.15, top: 0, h: 0, v: 9999 }));
  const expands = (reduced || sda) ? [] : $$('[data-expand]').map((el) => ({ el, top: 0, h: 0, e: -1 }));
  const qTitle = $('.question__title');
  const bw = $('.bw-color');
  const light = $('.light');
  const moods = $$('.mood').map((el) => ({ el, top: 0 }));
  // une teinte par lumière : hors du temps, matinée, crevasses, zénith, couleur qui se retire, heure bleue
  const tones = ['#dfdbd4', '#f7e1c3', '#f2d2a4', '#fffdf9', '#ebe8e3', '#dce3eb'];
  // La teinte vit sur un calque fixe à part : changer le fond du body ferait repeindre toute la page
  let tintEl = null;
  if (!reduced && light) {
    tintEl = document.createElement('div');
    tintEl.className = 'tint';
    tintEl.setAttribute('aria-hidden', 'true');
    document.body.prepend(tintEl);
  }
  const merci = $('#merci');
  const stickers = finePointer && !reduced
    ? $$('.sticker').map((el, i) => ({ el, k: 9 + (i % 3) * 6, top: 0, h: 0, x: 0, y: 0 }))
    : [];

  // Têtes de lecture des schémas
  const NS = 'http://www.w3.org/2000/svg';
  const playheads = reduced ? [] : $$('svg[data-playhead]').map((svg) => {
    const [x0, x1, ya, yb] = svg.dataset.playhead.split(' ').map(Number);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'sx-play');
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = `<line x1="0" x2="0" y1="${ya}" y2="${yb}"/><path d="M-6 ${ya - 9}h12l-6 9z"/>`;
    g.setAttribute('transform', `translate(${x0} 0)`);
    svg.appendChild(g);
    let hl = null;
    let ranges = null;
    let nums = [];
    if (svg.dataset.scenes) {
      ranges = svg.dataset.scenes.split(',').map((r) => r.trim().split(' ').map(Number));
      hl = document.createElementNS(NS, 'rect');
      hl.setAttribute('class', 'sx-hl');
      hl.setAttribute('y', ya);
      hl.setAttribute('height', yb - ya);
      hl.setAttribute('x', ranges[0][0]);
      hl.setAttribute('width', ranges[0][1] - ranges[0][0]);
      svg.insertBefore(hl, svg.firstChild);
      nums = $$('.sx-num text', svg);
    }
    return { svg, g, hl, ranges, nums, x0, x1, top: 0, h: 0, x: -1, si: -1 };
  });

  // Storyboard en défilement horizontal (grand écran)
  const board = $('.board');
  const boardPin = $('.board__pin');
  const boardStrip = $('.board__strip');
  const boardBar = $('[data-board-bar]');
  const boardN = $('[data-board-n]');
  const boardFrames = boardStrip ? $$(':scope > figure', boardStrip).map((el) => ({ el, cx: 0, s: -1 })) : [];
  const BOARD_SPEED = 1.5; // 1 px de scroll = 1,5 px de pellicule
  let boardOn = false;
  let boardTop = 0;
  let boardDist = 0;
  let boardScroll = 1;
  let boardP = -1;
  let boardIdx = -1;

  function setupBoard() {
    if (!board || !boardPin || !boardStrip) return;
    const on = !reduced && window.innerWidth > 900;
    board.classList.toggle('is-pinned', on);
    boardOn = on;
    if (!on) {
      boardPin.style.height = '';
      boardStrip.style.transform = '';
      boardFrames.forEach((f) => { f.el.style.scale = ''; f.s = -1; });
      return;
    }
    boardDist = Math.max(0, boardStrip.scrollWidth - window.innerWidth);
    boardScroll = Math.max(1, boardDist / BOARD_SPEED);
    board.style.setProperty('--board-dist', boardDist.toFixed(1));
    boardPin.style.height = `${Math.round(window.innerHeight + boardScroll)}px`;
    const sr = boardStrip.getBoundingClientRect();
    boardFrames.forEach((f) => {
      const r = f.el.getBoundingClientRect();
      f.cx = r.left - sr.left + r.width / 2;
    });
    boardP = -1;
  }

  /* ------------------------------------------------------------------
     Mesures
     ------------------------------------------------------------------ */
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let docH = 0;
  let qTop = 0;
  let bwTop = 0;
  let lightTop = 0;
  let lightBottom = 0;
  let merciTop = 0;
  let dirty = true;

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    setupBoard();
    const sy = window.scrollY;
    const top = (el) => el.getBoundingClientRect().top + sy;
    docH = root.scrollHeight;
    layers.forEach((l) => { const p = l.el.parentElement; l.top = top(p); l.h = p.offsetHeight; l.v = 9999; });
    expands.forEach((x) => { x.top = top(x.el); x.h = x.el.offsetHeight; x.e = -1; });
    pxImgs.forEach((x) => { x.top = top(x.box); x.h = x.box.offsetHeight; x.v = 9999; });
    stickers.forEach((x) => { const r = x.el.getBoundingClientRect(); x.top = r.top + sy; x.h = r.height; });
    playheads.forEach((x) => { x.top = top(x.svg); x.h = x.svg.getBoundingClientRect().height; x.x = -1; });
    chapters.forEach((c) => { c.top = top(c.el); });
    scenes.forEach((c) => { c.top = top(c.b); });
    moods.forEach((m) => { m.top = top(m.el); });
    if (qTitle) qTop = top(qTitle);
    if (bw) bwTop = top(bw);
    if (light) { lightTop = top(light); lightBottom = lightTop + light.offsetHeight; }
    if (merci) merciTop = top(merci);
    if (boardOn) boardTop = top(boardPin);
    dirty = true;
  }

  let mq = 0;
  const remeasure = () => { if (!mq) mq = requestAnimationFrame(() => { mq = 0; measure(); }); };
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  measure();

  /* ------------------------------------------------------------------
     Interactions au pointeur
     ------------------------------------------------------------------ */
  let tmx = 0;
  let tmy = 0;
  let mx = 0;
  let my = 0;
  if (stickers.length) {
    window.addEventListener('pointermove', (e) => {
      tmx = (e.clientX / vw) * 2 - 1;
      tmy = (e.clientY / vh) * 2 - 1;
    }, { passive: true });
  }

  // N&B / couleur : le rideau suit le défilement… ou la souris
  let bwCur = 50;
  let bwTarget = 50;
  let bwLast = -1;
  let bwHover = false;
  if (bw && !reduced && finePointer) {
    bw.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = bw.getBoundingClientRect();
      bwHover = true;
      bwTarget = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
    });
    bw.addEventListener('pointerleave', () => { bwHover = false; });
  }

  /* ------------------------------------------------------------------
     Boucle
     ------------------------------------------------------------------ */
  let lastY = -1;
  let goingDown = false;
  let heroP = -1;
  let tone = '';
  let progress = -1;

  function loop() {
    const y = window.scrollY;
    const moved = y !== lastY || dirty;
    if (y > lastY + 2) goingDown = true;
    else if (y < lastY - 2) goingDown = false;
    lastY = y;
    dirty = false;

    if (moved) {
      // Barre de progression
      if (progressBar && !sda) {
        const pr = clamp(y / Math.max(1, docH - vh), 0, 1);
        if (Math.abs(pr - progress) > 0.0005) { progress = pr; progressBar.style.transform = `scaleX(${pr.toFixed(4)})`; }
      }

      if (!reduced) {
        // Ouverture : l'image recule, les barreaux se referment, le titre s'en va
        if (hero && !sda) {
          const p = clamp(y / vh, 0, 1);
          if (p !== heroP) {
            heroP = p;
            heroMedia.style.transform = `translate3d(0,${(Math.min(y, vh) * 0.25).toFixed(1)}px,0) scale(${(1 + p * 0.08).toFixed(4)})`;
            if (barsWrap) barsWrap.style.setProperty('--bar', (easeInOut(p) * 0.18).toFixed(4));
            heroContent.style.transform = p ? `translate3d(0,${(Math.min(y, vh) * 0.3).toFixed(1)}px,0)` : '';
            heroContent.style.opacity = p ? Math.max(0, 1 - p * 1.6).toFixed(3) : '';
            if (heroCue) heroCue.style.opacity = p ? Math.max(0, 1 - p * 5).toFixed(3) : '';
          }
        }

        // Parallaxe des grands fonds
        for (const l of layers) {
          const rt = l.top - y;
          if (rt > vh + 100 || rt + l.h < -100) continue;
          const v = Math.round((rt + l.h / 2 - vh / 2) * -l.k * 10) / 10;
          if (v !== l.v) { l.v = v; l.el.style.transform = `translate3d(0,${v}px,0)`; }
        }

        // Parallaxe dans les cadres
        for (const x of pxLoop) {
          const rt = x.top - y;
          if (rt > vh || rt + x.h < 0) continue;
          const v = Math.round(clamp((rt + x.h / 2 - vh / 2) / vh, -1, 1) * -0.045 * x.h * 10) / 10;
          if (v !== x.v) { x.v = v; x.img.style.translate = `0 ${v}px`; }
        }

        // Sections qui s'ouvrent en plein cadre
        for (const x of expands) {
          const rt = x.top - y;
          if (rt > vh || rt + x.h < 0) continue;
          const e = easeOut(clamp((vh - rt) / (vh * 0.85), 0, 1));
          if (Math.abs(e - x.e) < 0.0008) continue;
          x.e = e;
          const k = 1 - e;
          x.el.style.clipPath = k > 0.001
            ? `inset(${(k * vh * 0.07).toFixed(1)}px ${(k * Math.min(vw * 0.06, 90)).toFixed(1)}px round ${(k * 44).toFixed(1)}px)`
            : '';
        }

        // La question s'allume mot à mot
        if (qWords.length) {
          const p = clamp((vh * 0.85 - (qTop - y)) / (vh * 0.5), 0, 1);
          const n = qWords.length;
          qWords.forEach((w, i) => {
            const o = Math.round((0.16 + 0.84 * clamp(p * (n + 1) - i, 0, 1)) * 100) / 100;
            if (o !== w.o) { w.o = o; w.el.style.opacity = o; }
          });
        }

        // La page prend la couleur de la lumière
        if (light && moods.length) {
          let next = '';
          if (moods[0].top - y < vh * 0.6 && lightBottom - y > vh * 0.45) {
            let idx = 0;
            moods.forEach((m, i) => { if (m.top - y < vh * 0.6) idx = i; });
            next = tones[idx] || '';
          }
          if (next !== tone) { tone = next; if (tintEl) tintEl.style.backgroundColor = next || 'transparent'; }
        }

        // Têtes de lecture
        for (const ph of playheads) {
          const rt = ph.top - y;
          if (rt > vh || rt + ph.h < 0) continue;
          const p = clamp((vh * 0.62 - rt) / (vh * 0.57), 0, 1);
          const x = Math.round((ph.x0 + p * (ph.x1 - ph.x0)) * 10) / 10;
          if (x === ph.x) continue;
          ph.x = x;
          ph.g.setAttribute('transform', `translate(${x} 0)`);
          if (ph.ranges) {
            let si = 0;
            ph.ranges.forEach((r, i) => { if (x >= r[0]) si = i; });
            if (si !== ph.si) {
              ph.si = si;
              const [a, b] = ph.ranges[si];
              ph.hl.setAttribute('x', a);
              ph.hl.setAttribute('width', b - a);
              ph.nums.forEach((tx, i) => tx.classList.toggle('is-on', i === si));
            }
          }
        }

        // Storyboard : la pellicule défile
        if (boardOn) {
          const p = clamp((y - boardTop) / boardScroll, 0, 1);
          if (p !== boardP) {
            boardP = p;
            const x = -p * boardDist;
            if (!sda) {
              boardStrip.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
              if (boardBar) boardBar.style.transform = `scaleX(${p.toFixed(4)})`;
            }
            let best = 0;
            let bestD = Infinity;
            boardFrames.forEach((f, i) => {
              const d = Math.abs(f.cx + x - vw / 2);
              if (d < bestD) { bestD = d; best = i; }
            });
            if (best !== boardIdx && boardN) { boardIdx = best; boardN.textContent = `P${best + 1}`; }
          }
        }
      }

      // Sommaire : chapitre courant (et scène, dans « Le film »)
      if (chap) {
        // sur téléphone, il s'efface quand on descend (pour ne pas masquer le texte)
        const on = y > vh * 0.6 && merciTop - y > vh * 0.5 && !(vw <= 600 && goingDown);
        if (on !== chapOn) { chapOn = on; chap.classList.toggle('is-on', on); if (!on) setOpen(false); }
        let ci = 0;
        chapters.forEach((c, i) => { if (c.top - y <= vh * 0.45) ci = i; });
        let sub = '';
        if (chapters[ci].el.id === 'script') {
          let si = -1;
          scenes.forEach((s, i) => { if (s.top - y <= vh * 0.55) si = i; });
          if (si >= 0) sub = `Sc. ${scenes[si].label}`;
        }
        setChapter(ci, sub);
      }
    }

    // N&B / couleur (amorti, donc hors du test « moved »)
    if (bw && !reduced) {
      if (!bwHover) {
        const p = clamp((vh * 0.72 - (bwTop - y)) / (vh * 0.72), 0, 1);
        bwTarget = 94 - easeInOut(p) * 88;
      }
      bwCur = lerp(bwCur, bwTarget, 0.12);
      if (Math.abs(bwCur - bwLast) > 0.04) { bwLast = bwCur; bw.style.setProperty('--split', `${bwCur.toFixed(2)}%`); }
    }

    // Autocollants : ils suivent un peu la souris
    if (stickers.length) {
      mx = lerp(mx, tmx, 0.06);
      my = lerp(my, tmy, 0.06);
      for (const s of stickers) {
        const rt = s.top - y;
        if (rt > vh || rt + s.h < 0) continue;
        const x = -mx * s.k;
        const yy = -my * s.k * 0.7;
        if (Math.abs(x - s.x) + Math.abs(yy - s.y) < 0.05) continue;
        s.x = x;
        s.y = yy;
        s.el.style.transform = `translate3d(${x.toFixed(2)}px,${yy.toFixed(2)}px,0)`;
      }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
