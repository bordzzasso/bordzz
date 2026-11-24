/* ==========================================================================
   BORDZZ [PRODUCTION] — interactions
   Aucune dépendance. Tout est désactivé proprement si l'utilisateur
   demande moins d'animations (prefers-reduced-motion).
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  const FPS = 25;
  const toTC = (frames) => {
    const total = Math.max(0, Math.floor(frames));
    const s = Math.floor(total / FPS);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(total % FPS)}`;
  };

  /* ------------------------------------------------------------------
     Défilement : celui du système (fluide, 120 Hz, inertie native).
     Les effets liés à la position (hero, pellicule, logo du footer) passent
     par les « scroll-driven animations » CSS quand le navigateur les connaît :
     ils sont alors calés image par image sur le défilement. Sinon, repli en JS.
     ------------------------------------------------------------------ */
  const sda = !reduced && !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));

  /* ------------------------------------------------------------------
     Titres découpés en mots (ils montent un à un à l'apparition)
     ------------------------------------------------------------------ */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\n]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const mask = document.createElement('span');
            mask.className = 'w-mask';
            const inner = document.createElement('span');
            inner.className = 'w-in';
            inner.style.setProperty('--wi', i++);
            inner.textContent = part;
            mask.appendChild(inner);
            frag.appendChild(mask);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
  }
  if (!reduced) $$('[data-split]').forEach(splitWords);

  /* ------------------------------------------------------------------
     Texte « brouillé » façon terminal
     ------------------------------------------------------------------ */
  const GLYPHS = '/\\_<>[]#=+*-01ZXBRD';
  function scramble(el) {
    if (reduced || !el) return;
    if (el.dataset.final === undefined) el.dataset.final = el.textContent;
    const final = el.dataset.final;
    cancelAnimationFrame(el._scrambleRaf);
    const len = final.length;
    const end = len * 1.5 + 6;
    let frame = 0;
    const tick = () => {
      frame += 1;
      let out = '';
      for (let i = 0; i < len; i++) {
        const ch = final[i];
        out += ch === ' ' || frame > i * 1.5 + 6 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (frame <= end) el._scrambleRaf = requestAnimationFrame(tick);
      else el.textContent = final;
    };
    tick();
  }

  /* ------------------------------------------------------------------
     Hero : préparation (avant l'apparition) puis lecture
     ------------------------------------------------------------------ */
  const hero = $('.hero');
  const typeEl = $('[data-type]');
  const typeText = typeEl ? typeEl.textContent.trim() : '';
  const rings = $$('.hero .le__rings ellipse');

  if (!reduced) {
    if (typeEl) typeEl.textContent = '';
    rings.forEach((el) => {
      const len = el.getTotalLength();
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
    });
  }

  function playHero() {
    if (reduced) return;
    rings.forEach((el, i) => {
      el.style.transition = `stroke-dashoffset 1.8s cubic-bezier(.2,.7,.1,1) ${0.1 + i * 0.12}s`;
      el.style.strokeDashoffset = 0;
    });
    if (typeEl) {
      let i = 0;
      const step = () => {
        i += 1;
        typeEl.textContent = typeText.slice(0, i);
        if (i < typeText.length) setTimeout(step, 30 + Math.random() * 55);
      };
      setTimeout(step, 550);
    }
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add('is-ready');
        playHero();
      });
    });
  }

  /* ------------------------------------------------------------------
     Intro : compte à rebours d'amorce (3, 2, 1)
     ------------------------------------------------------------------ */
  const intro = $('.intro');
  if (intro && !root.classList.contains('intro-seen')) {
    const num = $('.intro__num', intro);
    let n = 3;
    const show = () => {
      num.textContent = n;
      num.classList.remove('flash');
      void num.offsetWidth;
      num.classList.add('flash');
    };
    const finish = () => {
      clearInterval(timer);
      if (intro.classList.contains('is-done')) return;
      intro.classList.add('is-done');
      try { sessionStorage.setItem('bz-intro', '1'); } catch (e) { /* navigation privée */ }
      setTimeout(start, 200);
      setTimeout(() => intro.remove(), 1200);
    };
    const timer = setInterval(() => {
      n -= 1;
      if (n < 1) finish();
      else show();
    }, 650);
    show();
    intro.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
  } else {
    if (intro) intro.remove();
    start();
  }

  /* ------------------------------------------------------------------
     Vidéo de fond + bouton pause
     ------------------------------------------------------------------ */
  const video = $('.hero__video');
  const toggle = $('[data-video-toggle]');
  const recLabel = $('[data-rec-label]');
  let heroPaused = false;
  let heroVisible = true;
  let playerOpen = false;

  const canPlay = () => heroVisible && !heroPaused && !playerOpen;
  const syncVideo = () => {
    if (!video) return;
    if (canPlay()) video.play().catch(() => {});
    else video.pause();
  };

  function setPaused(p) {
    heroPaused = p;
    hero.classList.toggle('is-paused', p);
    syncVideo();
    if (toggle) {
      $('[data-toggle-label]', toggle).textContent = p ? 'Lecture' : 'Pause';
      $('[data-toggle-icon]', toggle).textContent = p ? '▶' : '❚❚';
    }
    if (recLabel) recLabel.textContent = p ? 'PAUSE' : 'REC';
  }
  if (toggle) toggle.addEventListener('click', () => setPaused(!heroPaused));
  if (reduced && video) {
    video.removeAttribute('autoplay');
    setPaused(true);
  }

  if (hero) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      hero.classList.toggle('is-offscreen', !heroVisible);
      syncVideo();
    }).observe(hero);
  }

  /* ------------------------------------------------------------------
     Apparitions au scroll
     ------------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      $$('[data-scramble-in]', el).forEach(scramble);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach((el) => io.observe(el));

  $$('[data-hover-scramble]').forEach((el) => {
    el.addEventListener('pointerenter', () => scramble($('[data-scramble]', el)));
  });
  $$('.frame').forEach((el) => {
    el.addEventListener('pointerenter', () => scramble($('[data-scramble]', el)));
  });

  /* ------------------------------------------------------------------
     Manifeste : les mots s'allument au fil du scroll
     ------------------------------------------------------------------ */
  const mani = $('[data-words]');
  let words = [];
  let litCount = -1;
  if (mani && !reduced) {
    const text = mani.textContent.trim();
    mani.textContent = '';
    text.split(/[ \n\t]+/).forEach((w, i, arr) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = w;
      mani.appendChild(span);
      if (i < arr.length - 1) mani.appendChild(document.createTextNode(' '));
    });
    words = $$('.w', mani);
  }

  /* ------------------------------------------------------------------
     Bandes pellicule (vitesse liée au scroll)
     ------------------------------------------------------------------ */
  const marquees = $$('[data-marquee]').map((track) => ({
    track,
    group: track.firstElementChild,
    dir: Number(track.dataset.marquee) || -1,
    x: 0,
    w: 0,
  }));
  function fillMarquee(m) {
    m.w = m.group.offsetWidth;
    if (!m.w) return;
    let guard = 0;
    while (m.track.children.length * m.w < window.innerWidth * 2 + m.w && guard < 20) {
      m.track.appendChild(m.group.cloneNode(true));
      guard += 1;
    }
  }

  /* ------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------ */
  const burger = $('.hd__burger');
  const menu = $('#menu');
  function setMenu(open) {
    if (!menu || !burger) return;
    menu.classList.toggle('is-open', open);
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    $('[data-menu-label]', burger).textContent = open ? 'Fermer' : 'Menu';
  }
  if (burger) burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  if (menu) $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) setMenu(false);
  });

  /* ------------------------------------------------------------------
     Pointeur (curseur viseur, aperçus)
     ------------------------------------------------------------------ */
  let mx = -999;
  let my = -999;
  const cursor = $('.cursor');
  const cLabel = $('[data-cursor-label]');
  const cursorOn = finePointer && !reduced && !!cursor;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX;
    my = e.clientY;
    if (cursorOn) {
      // directement à l'évènement (pas d'attente de la boucle, pas d'amorti)
      cursor.style.transform = `translate3d(${mx}px,${my}px,0)`;
      cursor.classList.add('is-visible');
    }
  }, { passive: true });
  root.addEventListener('mouseleave', () => {
    if (cursorOn) cursor.classList.remove('is-visible');
  });

  if (cursorOn) {
    root.classList.add('has-cursor');
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor], .frame');
      cursor.classList.toggle('is-hover', !!t);
      cLabel.textContent = t ? (t.dataset.cursor || '') : '';
    });
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  }

  // Inclinaison des tirages / du ticket
  if (finePointer && !reduced) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
      });
    });
  }

  // Boutons « magnétiques » : ils se laissent attirer par le curseur
  if (finePointer && !reduced) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(x * 0.28).toFixed(1)}px ${(y * 0.4).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = '0px 0px'; });
    });
  }

  /* ------------------------------------------------------------------
     Projets : filtres, vues, vidéo de fond, lecteur
     ------------------------------------------------------------------ */
  const work = $('.work');
  const list = $('.projects');
  const items = list ? $$('.project', list) : [];

  $$('[data-filter]').forEach((btn) => {
    const f = btn.dataset.filter;
    // Les catégories sans projet sont masquées automatiquement
    if (f !== 'all' && !items.some((i) => i.dataset.category === f)) btn.hidden = true;

    btn.addEventListener('click', () => {
      $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      list.classList.add('is-switching');
      setTimeout(() => {
        items.forEach((i) => { i.hidden = !(f === 'all' || i.dataset.category === f); });
        list.classList.remove('is-switching');
        $$('.project:not([hidden]) .project__title', list).forEach(scramble);
      }, reduced ? 0 : 200);
    });
  });

  $$('.views [data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      list.dataset.view = v;
      work.classList.toggle('is-grid', v === 'grid');
      $$('.views [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      hidePreview();
    });
  });

  // Vue grille : l'aperçu animé se lance au survol de la vignette
  if (finePointer && list) {
    $$('.project__link', list).forEach((a) => {
      const v = $('.project__media video', a);
      if (!v) return;
      a.addEventListener('pointerenter', () => {
        if (list.dataset.view === 'grid') v.play().catch(() => {});
      });
      a.addEventListener('pointerleave', () => v.pause());
    });
  }

  // Vue liste : la vidéo du projet survolé remplit toute la section
  const workBg = $('.work__bg');
  const bgVideo = workBg && $('video', workBg);
  let bgTimer = 0;

  function hidePreview() {
    clearTimeout(bgTimer);
    if (work) work.classList.remove('has-bg');
    if (bgVideo) bgVideo.pause();
  }
  if (finePointer && !reduced && list && bgVideo) {
    $$('.project__link', list).forEach((a) => {
      a.addEventListener('pointerenter', () => {
        if (list.dataset.view !== 'list') return;
        clearTimeout(bgTimer);
        const v = $('.project__media video', a);
        if (v) {
          const src = v.getAttribute('src');
          if (bgVideo.getAttribute('src') !== src) {
            bgVideo.poster = v.getAttribute('poster') || '';
            bgVideo.src = src;
          }
          bgVideo.play().catch(() => {});
        }
        work.classList.add('has-bg');
      });
    });
    list.addEventListener('pointerleave', () => {
      bgTimer = setTimeout(hidePreview, 150);
    });
  }

  // Sur téléphone / tablette (pas de survol), on affiche directement les vignettes
  if (!finePointer && list) {
    const gridBtn = $('.views [data-view="grid"]');
    if (gridBtn) gridBtn.click();
  }

  // Lecteur
  const player = $('.player');
  const pScreen = $('[data-player-screen]');
  const pTitle = $('[data-player-title]');
  const pCat = $('[data-player-cat]');
  const pCount = $('[data-player-count]');
  const pReel = $('[data-player-reel]');
  const pStrip = $('[data-reel-strip]');
  const pad2 = (n) => String(n).padStart(2, '0');

  /* Carrousel : un projet peut contenir plusieurs vidéos
     (<ol class="project__reel"> dans le <li class="project">) */
  let reel = null; // { items, i, video }

  function reelItems(a) {
    const ol = $('.project__reel', a.closest('.project') || a);
    if (!ol) return null;
    const items = $$('a', ol).map((l) => ({
      src: l.getAttribute('href'),
      poster: l.dataset.poster || '',
      title: l.textContent.trim(),
    }));
    return items.length > 1 ? items : null;
  }

  function buildReel(items, video) {
    reel = { items, i: 0, video };
    pStrip.replaceChildren(...items.map((it, k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'reel__item';
      b.setAttribute('aria-label', `${pad2(k + 1)} — ${it.title}`);
      const th = document.createElement('span');
      th.className = 'reel__thumb';
      if (it.poster) {
        const img = document.createElement('img');
        img.src = it.poster; img.alt = ''; img.decoding = 'async';
        th.appendChild(img);
      }
      const cap = document.createElement('span');
      cap.className = 'reel__cap';
      const n = document.createElement('i');
      n.textContent = pad2(k + 1);
      cap.append(n, document.createTextNode(it.title));
      b.append(th, cap);
      b.addEventListener('click', () => showReel(k));
      li.appendChild(b);
      return li;
    }));
    video.addEventListener('ended', () => {
      if (reel && reel.video === video && reel.i < reel.items.length - 1) showReel(reel.i + 1);
    });
    pReel.hidden = false;
    player.classList.add('has-reel');
  }

  function showReel(i, first = false) {
    if (!reel) return;
    const n = reel.items.length;
    i = (i + n) % n;
    if (!first && i === reel.i) return;
    reel.i = i;
    const it = reel.items[i];
    const v = reel.video;
    v.poster = it.poster;
    v.src = it.src;
    v.play().catch(() => {});
    pCount.textContent = ` ${pad2(i + 1)}/${pad2(n)}`;
    const btns = $$('.reel__item', pStrip);
    btns.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    const cur = btns[i];
    if (cur) {
      const li = cur.parentElement;
      pStrip.scrollTo({ left: li.offsetLeft - (pStrip.clientWidth - li.offsetWidth) / 2, behavior: first || reduced ? 'auto' : 'smooth' });
    }
    if (!first && !reduced) {
      pScreen.classList.remove('is-cut');
      void pScreen.offsetWidth;
      pScreen.classList.add('is-cut');
    }
  }

  function clearReel() {
    reel = null;
    if (pReel) pReel.hidden = true;
    if (pStrip) pStrip.replaceChildren();
    if (pCount) pCount.textContent = '';
    player.classList.remove('has-reel');
    pScreen.classList.remove('is-cut');
  }

  function embedFor(url) {
    if (!url || url === '#') return null;
    let m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    if (m) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1` };
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&title=0&byline=0&portrait=0&dnt=1` };
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return { type: 'video', src: url };
    return { type: 'link', src: url };
  }

  function setPlayerOpen(open) {
    playerOpen = open;
    root.classList.toggle('player-open', open);
    if (cursorOn) root.classList.toggle('has-cursor', !open);
    syncVideo();
  }

  function openPlayer(a) {
    const emb = embedFor(a.getAttribute('href'));
    if (emb && emb.type === 'link') {
      window.open(emb.src, '_blank', 'noopener');
      return;
    }
    const title = `${$('.project__n', a).textContent} — ${$('.project__title', a).textContent}`;
    pTitle.textContent = title;
    pCat.textContent = `${$('.project__cat', a).textContent} · ${$('.project__year', a).textContent}`;
    pScreen.replaceChildren();
    clearReel();

    if (!emb) {
      const card = document.createElement('span');
      card.className = 'testcard testcard--big';
      card.innerHTML = '<b>No signal</b><small>Vidéo bientôt en ligne</small>';
      pScreen.appendChild(card);
    } else if (emb.type === 'iframe') {
      const f = document.createElement('iframe');
      f.src = emb.src;
      f.title = title;
      f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      f.allowFullscreen = true;
      pScreen.appendChild(f);
    } else {
      const v = document.createElement('video');
      const thumb = $('.project__media video, .project__media img', a);
      const poster = thumb && (thumb.getAttribute('poster') || thumb.getAttribute('src'));
      if (poster && !/\.(mp4|webm|mov)$/i.test(poster)) v.poster = poster;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      pScreen.appendChild(v);
      const items = reelItems(a);
      if (items) {
        buildReel(items, v);
        showReel(0, true);
      } else {
        v.src = emb.src;
      }
    }
    hidePreview();
    setPlayerOpen(true);
    player.showModal();
  }

  if (list && player) {
    list.addEventListener('click', (e) => {
      const a = e.target.closest('.project__link');
      if (!a) return;
      e.preventDefault();
      openPlayer(a);
    });
    $('[data-player-close]').addEventListener('click', () => player.close());
    player.addEventListener('click', (e) => { if (e.target === player) player.close(); });
    player.addEventListener('close', () => {
      if (player.open) return; // rouvert entre-temps : ne pas effacer le nouveau projet
      pScreen.replaceChildren();
      clearReel();
      setPlayerOpen(false);
    });
    if (pReel) {
      $('[data-reel-prev]').addEventListener('click', () => reel && showReel(reel.i - 1));
      $('[data-reel-next]').addEventListener('click', () => reel && showReel(reel.i + 1));
      // Flèches ← → du clavier (sauf quand la vidéo a le focus : elles servent alors à avancer dans la vidéo)
      player.addEventListener('keydown', (e) => {
        if (!reel || e.target instanceof HTMLVideoElement) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          showReel(reel.i + (e.key === 'ArrowRight' ? 1 : -1));
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     Copier l'adresse mail
     ------------------------------------------------------------------ */
  $$('[data-copy]').forEach((btn) => {
    btn.dataset.label = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copié ✓';
        setTimeout(() => { btn.textContent = btn.dataset.label; }, 1800);
      } catch (e) {
        window.location.href = `mailto:${btn.dataset.copy}`;
      }
    });
  });

  /* ------------------------------------------------------------------
     Mesures (recalculées au redimensionnement)
     ------------------------------------------------------------------ */
  const hd = $('.hd');
  const heroTc = $('[data-hero-tc]');
  const navLinks = $$('.hd__nav a');
  const toned = $$('main > [data-tone], body > footer[data-tone]');

  const heroMedia = $('.hero__media');
  const heroDim = $('.hero__dim');
  const heroContent = $('.hero__content');
  const hud = $('.hud');
  const stacks = $$('.stack');
  const covers = stacks.map((el) => {
    const c = document.createElement('i');
    c.className = 'stack__cover';
    c.setAttribute('aria-hidden', 'true');
    el.appendChild(c);
    return c;
  });
  const team = $('.team');
  const film = $('.film');
  const frameImgs = $$('.frame__img img');
  const footer = $('.ft');
  const ftWord = $('[data-ftword]');

  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let sections = [];
  let stackData = [];
  let teamBox = null;
  let footTop = 0;
  let docMax = 1;

  // Position « de mise en page » d'une section, même quand elle est collée (sticky) :
  // on mesure l'ancre posée juste avant elle.
  function layoutTop(el) {
    const prev = el.previousElementSibling;
    const ref = prev && prev.classList.contains('anchor') ? prev : el;
    return ref.getBoundingClientRect().top + window.scrollY;
  }

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    sections = toned.map((el) => {
      const prev = el.previousElementSibling;
      const top = layoutTop(el);
      const id = el.id || (prev && prev.classList.contains('anchor') ? prev.id : '');
      return { top, bottom: top + el.offsetHeight, tone: el.dataset.tone, id };
    });
    if (!reduced) stacks.forEach((el) => { el.style.top = `${Math.min(0, vh - el.offsetHeight)}px`; });
    stackData = stacks.map((el, i) => ({ el, cover: covers[i], nextTop: i < stacks.length - 1 ? layoutTop(stacks[i + 1]) : null, c: -1 }));
    if (team) teamBox = { top: layoutTop(team), h: team.offsetHeight };
    if (footer) footTop = footer.getBoundingClientRect().top + window.scrollY;
    docMax = Math.max(1, root.scrollHeight - vh);
    marquees.forEach(fillMarquee);
  }
  measure();
  new ResizeObserver(measure).observe(document.body);
  window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);

  /* ------------------------------------------------------------------
     Boucle d'animation
     ------------------------------------------------------------------ */
  let lastT = performance.now();
  let lastY = window.scrollY;
  let vel = 0;
  let scrollDir = 1;
  let heroFrames = 0;
  let lastHeroF = -1;
  let lastActive = null;
  let skew = 0;
  let heroWasMoved = false;

  function loop(t) {
    const dt = Math.min(64, t - lastT) || 16;
    lastT = t;
    const y = window.scrollY;
    const inst = ((y - lastY) / dt) * 1000;
    lastY = y;
    vel = lerp(vel, inst, 0.12);
    if (Math.abs(inst) > 1) scrollDir = inst > 0 ? 1 : -1;

    // Ton de l'en-tête, lien actif
    const yHead = y + 32;
    const yMid = y + vh * 0.5;
    let tone = 'dark';
    let active = '';
    for (const s of sections) {
      if (yHead >= s.top && yHead < s.bottom) tone = s.tone;
      if (yMid >= s.top && yMid < s.bottom) active = s.id;
    }
    if (hd && hd.dataset.tone !== tone) hd.dataset.tone = tone;
    if (hd) hd.classList.toggle('is-scrolled', y > vh * 0.9);
    if (active !== lastActive) {
      navLinks.forEach((a) => {
        if (a.hash === `#${active}`) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      lastActive = active;
    }

    // Timecode « REC » du hero
    if (heroVisible && !heroPaused && root.classList.contains('is-ready')) heroFrames += (dt / 1000) * FPS;
    const hf = Math.floor(heroFrames);
    if (hf !== lastHeroF && heroTc) { heroTc.textContent = toTC(hf); lastHeroF = hf; }

    // Manifeste
    if (words.length) {
      const r = mani.getBoundingClientRect();
      if (r.bottom > -vh && r.top < vh * 2) {
        const prog = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25), 0, 1);
        const n = Math.round(prog * words.length);
        if (n !== litCount) {
          litCount = n;
          words.forEach((w, i) => w.classList.toggle('is-on', i < n));
        }
      }
    }

    if (!reduced) {
      // Hero : l'écran recule, s'arrondit et s'assombrit pendant que la page monte
      if (heroMedia && !sda && y < vh * 1.2) {
        const p = clamp(y / vh, 0, 1);
        heroMedia.style.transform = `translate3d(0,${(y * 0.4).toFixed(1)}px,0) scale(${(1 - p * 0.09).toFixed(4)})`;
        heroMedia.style.borderRadius = `${(p * 40).toFixed(1)}px`;
        if (heroDim) heroDim.style.opacity = (p * 0.6).toFixed(3);
        if (p > 0.001) {
          heroContent.style.transform = `translate3d(0,${(y * 0.22).toFixed(1)}px,0)`;
          heroContent.style.opacity = Math.max(0, 1 - p * 1.5).toFixed(3);
          if (hud) hud.style.opacity = Math.max(0, 1 - p * 2).toFixed(3);
          heroWasMoved = true;
        } else if (heroWasMoved) {
          heroContent.style.transform = '';
          heroContent.style.opacity = '';
          if (hud) hud.style.opacity = '';
          heroWasMoved = false;
        }
      }

      // Feuilles empilées : celle du dessous s'assombrit quand la suivante arrive
      for (const d of stackData) {
        if (d.nextTop == null) continue;
        const c = clamp(1 - (d.nextTop - y) / vh, 0, 1);
        if (Math.abs(c - d.c) > 0.004) { d.cover.style.opacity = (c * 0.65).toFixed(3); d.c = c; }
      }

      // Bandes pellicule : vitesse et inclinaison liées au défilement
      skew = lerp(skew, clamp(-vel * 0.004, -9, 9), 0.1);
      const speed = 42 + Math.min(Math.abs(vel) * 0.3, 1200);
      marquees.forEach((m) => {
        if (!m.w) return;
        m.x += m.dir * scrollDir * speed * (dt / 1000);
        if (m.x <= -m.w) m.x += m.w;
        else if (m.x > 0) m.x -= m.w;
        m.track.style.transform = `translate3d(${m.x.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
      });

      // Équipe : la pellicule dérive, les portraits glissent dans leur cadre
      if (teamBox && film && !sda && vw > 900) {
        const r = teamBox.top - y;
        if (r < vh && r + teamBox.h > 0) {
          const tp = clamp((vh - r) / (vh + teamBox.h), 0, 1);
          film.style.setProperty('--fx', `${((0.5 - tp) * 64).toFixed(1)}px`);
          const py = `${((tp - 0.5) * -46).toFixed(1)}px`;
          frameImgs.forEach((img) => img.style.setProperty('--py', py));
        }
      }

      // Footer : le grand logo arrive en glissant
      if (ftWord && !sda) {
        const fStart = Math.min(footTop - vh, docMax - 1);
        const fp = clamp((y - fStart) / Math.max(1, docMax - fStart), 0, 1);
        const e = 1 - Math.pow(1 - fp, 3);
        ftWord.style.transform = `translate3d(${((1 - e) * 35).toFixed(2)}%,0,0) skewX(${(skew * 0.6).toFixed(2)}deg)`;
        ftWord.style.opacity = (0.15 + e * 0.85).toFixed(3);
      }
    }


    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
