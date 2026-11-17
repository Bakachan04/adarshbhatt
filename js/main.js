/* Adarsh Bhatt — Portfolio interactions. No build step, no framework. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Shared pointer + scroll state, read by the single animation loop below.
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, seen: false };
  const scroll = { y: scrollY, v: 0 };
  const frameTasks = [];
  const onFrame = (fn) => frameTasks.push(fn);

  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true;
  }, { passive: true });

  const debounce = (fn, ms = 150) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* ------------------------------------------------------------------ */
  /* Mode: Design <-> Dev                                                */
  /* ------------------------------------------------------------------ */
  const modeListeners = [];
  const getMode = () => root.dataset.mode || 'design';

  function applyMode(mode) {
    root.dataset.mode = mode;
    $$('[data-mode-toggle]').forEach((b) => b.setAttribute('aria-checked', String(mode === 'dev')));
    try { localStorage.setItem('ab-mode', mode); } catch (e) { /* storage unavailable */ }
    modeListeners.forEach((fn) => fn(mode));
  }

  function toggleMode(originX, originY) {
    const next = getMode() === 'dev' ? 'design' : 'dev';
    if (!document.startViewTransition || reduceMotion) { applyMode(next); return; }
    const x = originX ?? innerWidth - 80;
    const y = originY ?? 36;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => applyMode(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 800, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  }

  $$('[data-mode-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const r = btn.getBoundingClientRect();
      toggleMode(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    });
  });
  addEventListener('keydown', (e) => {
    if (!e.key || e.key.toLowerCase() !== 'd' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
    toggleMode();
  });

  /* ------------------------------------------------------------------ */
  /* Hero: fitted name, blueprint layer, X-ray lens                      */
  /* ------------------------------------------------------------------ */
  function initHero() {
    const hero = $('.hero');
    const surface = $('.hero__layer--surface', hero);
    if (!hero || !surface) return;

    // Second copy of the hero that the lens reveals.
    const under = surface.cloneNode(true);
    under.classList.remove('hero__layer--surface', 'is-solid');
    under.classList.add('hero__layer--under', 'is-blueprint');
    under.setAttribute('aria-hidden', 'true');
    under.inert = true;
    hero.appendChild(under);

    // Annotations live in both layers; CSS shows them only on the blueprint one.
    const annoHTML =
      '<div class="anno anno--h" data-a="top"></div><div class="anno anno--h" data-a="bottom"></div>' +
      '<div class="anno anno--v" data-a="left"></div><div class="anno anno--v" data-a="right"></div>' +
      '<div class="anno anno--box" data-a="box"><i></i><i></i><i></i><i></i>' +
      '<span class="anno__font"></span><span class="anno__size"></span></div>';
    [surface, under].forEach((l) => l.insertAdjacentHTML('beforeend', annoHTML));

    const lens = document.createElement('div');
    lens.className = 'lens';
    lens.innerHTML = '<div class="lens__ring"></div><div class="lens__xy"></div>';
    hero.appendChild(lens);
    const ring = $('.lens__ring', lens);
    const xy = $('.lens__xy', lens);

    function syncLayers(mode) {
      const dev = mode === 'dev';
      surface.classList.toggle('is-solid', !dev);
      surface.classList.toggle('is-blueprint', dev);
      under.classList.toggle('is-solid', dev);
      under.classList.toggle('is-blueprint', !dev);
    }
    syncLayers(getMode());
    // Dev mode swaps the body font, which changes the footer height, so refit.
    modeListeners.push((mode) => { syncLayers(mode); fit(); });

    // Fit the name to the container width, capped so the hero never overflows.
    const name = $('.hero__name', surface);
    const words = $$('.w--name', surface);
    function fit() {
      const probe = 200;
      hero.style.setProperty('--name-size', probe + 'px');
      const widest = Math.max(...words.map((w) => w.getBoundingClientRect().width));
      const cs = getComputedStyle(surface);
      const avail = surface.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const byWidth = (avail / widest) * probe;
      // Room left between the meta row and the footer row, for two lines at line-height .8
      const foot = $('.hero__foot', surface), meta = $('.hero__meta', surface);
      const room = hero.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - meta.offsetHeight - foot.offsetHeight - parseFloat(getComputedStyle(foot).marginTop) - 28;
      const byHeight = Math.max(60, room / 1.6);
      const size = Math.floor(Math.min(byWidth, byHeight));
      hero.style.setProperty('--name-size', size + 'px');
      annotate(size);
    }

    function annotate(size) {
      const h = hero.getBoundingClientRect();
      const n = name.getBoundingClientRect();
      const box = { l: n.left - h.left, t: n.top - h.top, w: n.width, hh: n.height };
      [surface, under].forEach((layer) => {
        const q = (k) => $(`[data-a="${k}"]`, layer);
        Object.assign(q('box').style, { left: box.l + 'px', top: box.t + 'px', width: box.w + 'px', height: box.hh + 'px' });
        q('top').style.top = box.t + 'px';
        q('bottom').style.top = box.t + box.hh + 'px';
        q('left').style.left = box.l + 'px';
        q('right').style.left = box.l + box.w + 'px';
        $('.anno__size', layer).textContent = `${Math.round(box.w)} × ${Math.round(box.hh)}`;
        $('.anno__font', layer).textContent = `h1 · Bricolage Grotesque 800 · ${size}px`;
      });
    }

    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    addEventListener('resize', debounce(fit, 120));

    // Lens motion
    const s = { x: 0, y: 0, r: 0, tx: 0, ty: 0, hover: false, hold: false, tapUntil: 0, visible: true, lastXY: '' };
    const baseR = () => clamp(innerWidth * 0.125, 92, 190);
    const local = (e) => { const b = hero.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };

    s.x = s.tx = hero.clientWidth * 0.7;
    s.y = s.ty = hero.clientHeight * 0.5;

    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const p = local(e); s.tx = p.x; s.ty = p.y; s.hover = true;
    });
    hero.addEventListener('pointerleave', () => { s.hover = false; s.hold = false; });
    hero.addEventListener('pointerdown', (e) => {
      const p = local(e); s.tx = p.x; s.ty = p.y;
      if (e.pointerType === 'touch') { s.tapUntil = performance.now() + 2600; return; }
      if (e.button === 0) s.hold = true;
    });
    addEventListener('pointerup', () => { s.hold = false; });

    new IntersectionObserver(([en]) => { s.visible = en.isIntersecting; }).observe(hero);

    onFrame((t) => {
      if (!s.visible || !root.classList.contains('loaded')) return;
      const w = hero.clientWidth, h = hero.clientHeight;
      const guided = s.hover || t < s.tapUntil;

      if (!guided && !reduceMotion) {
        // Idle drift so the effect is visible before anyone touches it.
        const k = t / 1000;
        s.tx = w * (0.5 + 0.3 * Math.cos(k * 0.42));
        s.ty = h * (0.56 + 0.2 * Math.sin(k * 0.67));
      }
      const targetR = s.hold ? Math.hypot(w, h) : baseR();
      const ease = reduceMotion ? 1 : (guided ? 0.16 : 0.045);
      s.x = lerp(s.x, s.tx, ease);
      s.y = lerp(s.y, s.ty, ease);
      s.r = lerp(s.r, targetR, reduceMotion ? 1 : (s.hold ? 0.07 : 0.12));

      under.style.setProperty('--lx', s.x.toFixed(1) + 'px');
      under.style.setProperty('--ly', s.y.toFixed(1) + 'px');
      under.style.setProperty('--lr', s.r.toFixed(1) + 'px');

      const d = s.r * 2;
      ring.style.cssText = `width:${d}px;height:${d}px;transform:translate(${s.x - s.r}px,${s.y - s.r}px)`;
      const label = `x ${Math.round(s.x)}  y ${Math.round(s.y)}`;
      if (label !== s.lastXY) { xy.textContent = label; s.lastXY = label; }
      const off = s.r * 0.7071 + 10;
      xy.style.transform = `translate(${Math.min(s.x + off, w - 120)}px,${Math.min(s.y + off, h - 30)}px)`;
      xy.style.opacity = s.r > Math.max(w, h) * 0.6 ? 0 : 1;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Custom cursor + magnetic elements                                   */
  /* ------------------------------------------------------------------ */
  function initCursor() {
    const el = $('.cursor');
    if (!el || !finePointer || reduceMotion) return;
    const label = $('.cursor__label', el);
    const labels = { view: 'View ↗', drag: 'Drag', code: 'GitHub ↗' };
    let state = '';
    let down = false, press = 1; // press shrinks the cursor in place while the button is held

    function setState(next) {
      if (next === state) return;
      state = next;
      el.dataset.state = next;
      label.textContent = labels[next] || '';
    }

    addEventListener('pointermove', (e) => {
      if (!root.classList.contains('has-cursor')) root.classList.add('has-cursor');
      evaluate(e.target instanceof Element ? e.target : null);
    }, { passive: true });
    addEventListener('pointerdown', () => { down = true; });
    addEventListener('pointerup', () => { down = false; });
    addEventListener('pointercancel', () => { down = false; });
    root.addEventListener('mouseleave', () => setState('hidden'));

    function evaluate(t) {
      if (!t) return;
      if (t.closest('.hero, input, textarea')) return setState('hidden');
      const tagged = t.closest('[data-cursor]');
      if (tagged) return setState(tagged.dataset.cursor);
      if (t.closest('a, button')) return setState('link');
      setState('');
    }

    let seenY = scrollY;
    onFrame(() => {
      // Sit exactly on the real pointer (no easing lag), so what you click is what the cursor is over.
      // The press scale lives inside this same transform: as a separate CSS `scale` it was applied
      // after the translate and pulled the cursor towards the page's top-left corner on every click.
      press = lerp(press, down ? 0.82 : 1, 0.35);
      el.style.transform = `translate(${pointer.x}px,${pointer.y}px) scale(${press.toFixed(3)})`;
      // The page can scroll under a still cursor, so re-check what it is over.
      if (scroll.y !== seenY && pointer.seen) { seenY = scroll.y; evaluate(document.elementFromPoint(pointer.x, pointer.y)); }
    });
  }

  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'translate .15s ease-out';
        el.style.translate = `${dx * 0.28}px ${dy * 0.28}px`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'translate .6s cubic-bezier(.2,.7,.1,1)';
        el.style.translate = '0px 0px';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals, statement scrub, nav state, progress bar            */
  /* ------------------------------------------------------------------ */
  function initReveals() {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((e) => io.observe(e));
  }

  function initStatement() {
    const el = $('[data-scrub]');
    if (!el || reduceMotion) return;
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(/\s+/).map((w) => `<span class="wd" aria-hidden="true">${w}</span>`).join(' ');
    const words = $$('.wd', el);
    let lit = -1;
    onFrame(() => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const start = innerHeight * 0.86, end = innerHeight * 0.3;
      const p = clamp((start - r.top) / (start - end + r.height * 0.75), 0, 1);
      const n = Math.round(p * words.length);
      if (n === lit) return;
      words.forEach((w, i) => w.classList.toggle('on', i < n));
      lit = n;
    });
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const to = Number(el.dataset.count);
        const from = 'countPlain' in el.dataset ? to - 24 : 0;
        const t0 = performance.now(), dur = 1300;
        const step = (t) => {
          const p = clamp((t - t0) / dur, 0, 1);
          const e = 1 - Math.pow(1 - p, 4);
          el.textContent = String(Math.round(lerp(from, to, e)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    els.forEach((e) => io.observe(e));
  }

  function initNav() {
    const bar = $('.progress');
    const links = $$('.nav__links a');
    const targets = links.map((a) => $(a.getAttribute('href')));
    onFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.setProperty('--p', max > 0 ? (scroll.y / max).toFixed(4) : 0);
      const mid = innerHeight * 0.4;
      let current = -1;
      targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= mid) current = i; });
      links.forEach((a, i) => a.classList.toggle('is-current', i === current));
    });

    // Mobile menu
    const btn = $('[data-menu-toggle]');
    const menu = $('#menu');
    if (!btn || !menu) return;
    const setOpen = (open) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';
    };
    btn.addEventListener('click', () => setOpen(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setOpen(false); });
    addEventListener('resize', debounce(() => { if (innerWidth > 820 && !menu.hidden) setOpen(false); }));
  }

  /* ------------------------------------------------------------------ */
  /* Marquee that speeds up with scroll                                  */
  /* ------------------------------------------------------------------ */
  function initMarquee() {
    const track = $('.marquee__track');
    const group = $('.marquee__group');
    if (!track || !group || reduceMotion) return;
    let x = 0, w = group.offsetWidth, last = performance.now();
    addEventListener('resize', debounce(() => { w = group.offsetWidth; }));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { w = group.offsetWidth; });
    onFrame((t) => {
      const dt = Math.min(50, t - last); last = t;
      x -= (0.06 + Math.abs(scroll.v) * 0.012) * dt * (scroll.v < -0.5 ? -1 : 1);
      if (w > 0) { if (x <= -w) x += w; if (x > 0) x -= w; }
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Selected work: vertical scroll drives a horizontal gallery          */
  /* ------------------------------------------------------------------ */
  function initWork() {
    const section = $('.work');
    const track = $('.work__track');
    if (!section || !track) return;
    // Design mode shows the Behance cards, Dev mode the GitHub ones (CSS hides the other set).
    const allCards = $$('.card', track);
    let cards = allCards;
    const idx = $('[data-work-index]');
    const total = $('[data-work-total]');
    const bar = $('[data-work-bar]');
    const mq = matchMedia('(min-width: 900px) and (min-height: 560px)');
    let enabled = false, distance = 0, x = 0, shown = '';

    function measure() {
      cards = allCards.filter((c) => c.getClientRects().length > 0);
      if (total) total.textContent = String(cards.length).padStart(2, '0');
      shown = '';
      const want = mq.matches && !reduceMotion;
      if (want !== enabled) {
        enabled = want;
        section.classList.toggle('is-horizontal', enabled);
        if (!enabled) { section.style.height = ''; track.style.transform = ''; allCards.forEach((c) => c.style.removeProperty('--px')); }
      }
      if (!enabled) { section.style.removeProperty('--mh'); return; }
      fitCovers();
      distance = Math.max(0, track.scrollWidth - innerWidth);
      section.style.height = `${distance + innerHeight}px`;
    }

    // Size the covers so the tallest caption (title, text, tags) still clears the progress bar.
    // A smaller cover makes the card narrower, which can wrap the caption further, so step down until it fits.
    function fitCovers() {
      const top = parseFloat(getComputedStyle(track).paddingTop) || 0;
      const reserve = 62; // progress bar plus breathing room above it
      let mh = clamp(innerHeight - top - reserve - 110, 200, 620);
      for (let i = 0; i < 10; i++) {
        section.style.setProperty('--mh', mh + 'px');
        const tallest = Math.max(...cards.map((c) => $('.card__info', c).offsetHeight));
        const fits = Math.floor(innerHeight - top - reserve - tallest);
        if (fits >= mh || mh <= 200) break;
        mh = Math.max(200, fits);
      }
    }

    measure();
    // Switching modes swaps the card set and the body font, so re-measure everything.
    modeListeners.push(() => measure());

    // "See the code" / "Back to design work" inside the gallery flips the whole page's mode.
    $$('[data-mode-switch]', section).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const r = btn.getBoundingClientRect();
        toggleMode(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
      });
    });

    // Keyboard users: bring a focused card into view by scrolling the page to its position.
    // focusin, because a code card's focusable elements are the links inside it.
    allCards.concat($$('.orb', track)).forEach((el) => {
      el.addEventListener('focusin', (e) => {
        if (!enabled || !e.target.matches(':focus-visible')) return;
        const r = el.getBoundingClientRect();
        const centre = r.left + x + r.width / 2 - innerWidth / 2;
        const top = section.getBoundingClientRect().top + scrollY;
        scrollTo({ top: top + clamp(centre, 0, distance), behavior: 'instant' });
      });
    });
    addEventListener('resize', debounce(measure, 120));
    addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    onFrame(() => {
      if (!enabled) return;
      const top = section.getBoundingClientRect().top;
      if (top > innerHeight || top < -(distance + innerHeight)) return;
      const p = distance > 0 ? clamp(-top / distance, 0, 1) : 0;
      x = lerp(x, p * distance, 0.14);
      if (Math.abs(x - p * distance) < 0.05) x = p * distance;
      track.style.transform = `translate3d(${-x.toFixed(2)}px,0,0)`;
      if (bar) bar.style.setProperty('--wp', p.toFixed(4));

      // Parallax inside each cover, and which card is nearest the centre.
      let best = 0, bestD = Infinity;
      const cx = innerWidth / 2;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.right < -200 || r.left > innerWidth + 200) return;
        const off = (r.left + r.width / 2 - cx) / innerWidth;
        c.style.setProperty('--px', (off * -r.width * 0.055).toFixed(1) + 'px');
        const d = Math.abs(off);
        if (d < bestD) { bestD = d; best = i; }
      });
      const n = String(best + 1).padStart(2, '0');
      if (idx && n !== shown) { idx.textContent = n; shown = n; }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Archive list: cover follows the cursor                              */
  /* ------------------------------------------------------------------ */
  function initArchive() {
    const box = $('.preview');
    const rows = $$('.row');
    if (!box || !rows.length || !finePointer) return;

    const imgs = rows.map((row) => {
      const thumb = $('.row__thumb', row);
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = thumb ? thumb.getAttribute('src') : '';
      box.appendChild(img);
      return img;
    });

    const pos = { x: pointer.x, y: pointer.y, rot: 0 };
    let on = false;
    const show = (i) => { imgs.forEach((im, k) => im.classList.toggle('is-active', k === i)); on = true; box.classList.add('is-on'); };
    const hide = () => { on = false; box.classList.remove('is-on'); };

    rows.forEach((row, i) => {
      row.addEventListener('pointerenter', () => show(i));
      row.addEventListener('pointerleave', hide);
      row.addEventListener('focus', () => show(i));
      row.addEventListener('blur', hide);
    });
    addEventListener('scroll', () => {
      // Scrolling can move rows out from under a stationary cursor.
      if (!on) return;
      const el = document.elementFromPoint(pointer.x, pointer.y);
      const row = el && el.closest('.row');
      if (!row) hide(); else show(rows.indexOf(row));
    }, { passive: true });

    onFrame(() => {
      const px = pos.x;
      pos.x = lerp(pos.x, pointer.x, reduceMotion ? 1 : 0.14);
      pos.y = lerp(pos.y, pointer.y, reduceMotion ? 1 : 0.14);
      if (!on && !box.classList.contains('is-on')) return;
      pos.rot = lerp(pos.rot, clamp((pos.x - px) * 0.6, -10, 10), 0.2);
      const w = box.offsetWidth, h = box.offsetHeight;
      const tx = clamp(pos.x + 28, 8, innerWidth - w - 8);
      const ty = clamp(pos.y - h / 2, 8, innerHeight - h - 8);
      box.style.transform = `translate3d(${tx}px,${ty}px,0) rotate(${pos.rot.toFixed(2)}deg)`;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toolkit: skill chips with real physics (Matter.js)                  */
  /* ------------------------------------------------------------------ */
  function initPit() {
    const pit = $('.pit');
    const M = window.Matter;
    if (!pit || !M || reduceMotion) return;
    const { Engine, Bodies, Body, Composite, Constraint } = M;
    const chips = $$('.chip', pit);
    let engine, walls = [], items = [], started = false, visible = false, last = 0, acc = 0, drag = null;

    const size = () => ({ w: pit.clientWidth, h: pit.clientHeight });

    function buildWalls() {
      walls.forEach((b) => Composite.remove(engine.world, b));
      const { w, h } = size(), t = 300, tall = 8000;
      const opt = { isStatic: true, friction: 0.6 };
      walls = [
        Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opt),
        Bodies.rectangle(-t / 2, h - tall / 2, t, tall, opt),
        Bodies.rectangle(w + t / 2, h - tall / 2, t, tall, opt),
        Bodies.rectangle(w / 2, h - tall - t / 2, w + t * 2, t, opt)
      ];
      Composite.add(engine.world, walls);
    }

    function start() {
      started = true;
      pit.classList.add('is-live');
      engine = Engine.create();
      engine.gravity.y = 1.15;
      buildWalls();
      const { w } = size();

      items = chips.map((el, i) => {
        const cw = el.offsetWidth, ch = el.offsetHeight;
        const x = clamp(cw / 2 + 12 + Math.random() * (w - cw - 24), cw / 2 + 4, Math.max(cw / 2 + 4, w - cw / 2 - 4));
        const y = -60 - i * 78;
        const ball = el.classList.contains('chip--ball');
        const body = ball
          ? Bodies.circle(x, y - 300, cw / 2, { restitution: 0.84, friction: 0.03, frictionAir: 0.004, density: 0.0014 })
          : Bodies.rectangle(x, y, cw, ch, { chamfer: { radius: ch / 2 - 1 }, restitution: 0.28, friction: 0.45, frictionAir: 0.014, angle: (Math.random() - 0.5) * 0.9 });
        Composite.add(engine.world, body);
        el.style.transform = `translate(${x - cw / 2}px,${y - ch / 2}px)`;
        bindDrag(el, body);
        return { el, body, w: cw, h: ch };
      });
    }

    function local(e) { const r = pit.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    function bindDrag(el, body) {
      el.addEventListener('pointerdown', (e) => {
        if (drag) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
        const p = local(e);
        const c = Constraint.create({
          pointA: p, bodyB: body,
          pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
          length: 0, stiffness: 0.16, damping: 0.12
        });
        Composite.add(engine.world, c);
        drag = { id: e.pointerId, c, el };
        el.classList.add('is-held');
      });
      el.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const p = local(e), { w, h } = size();
        drag.c.pointA.x = clamp(p.x, 0, w);
        drag.c.pointA.y = clamp(p.y, -200, h);
      });
      const release = (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        Composite.remove(engine.world, drag.c);
        drag.el.classList.remove('is-held');
        drag = null;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    }

    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !started) start();
      last = 0;
    }, { threshold: 0.25 }).observe(pit);

    addEventListener('resize', debounce(() => {
      if (!started) return;
      buildWalls();
      const { w, h } = size();
      items.forEach((it) => {
        const p = it.body.position;
        if (p.x > w - 10 || p.x < 10 || p.y > h) Body.setPosition(it.body, { x: clamp(p.x, 40, w - 40), y: Math.min(p.y, h - 60) });
      });
    }, 200));

    onFrame((t) => {
      if (!started || !visible) return;
      if (!last) last = t;
      acc += Math.min(64, t - last); last = t;
      const stepMs = 1000 / 60;
      let steps = 0;
      while (acc >= stepMs && steps < 4) { Engine.update(engine, stepMs); acc -= stepMs; steps++; }
      if (steps === 4) acc = 0;
      const { w, h } = size();
      items.forEach((it) => {
        const b = it.body;
        // Safety net: anything that escapes gets dropped back in.
        if (b.position.y > h + 400 || b.position.x < -400 || b.position.x > w + 400) {
          Body.setPosition(b, { x: w / 2, y: -100 }); Body.setVelocity(b, { x: 0, y: 0 });
        }
        it.el.style.transform = `translate(${(b.position.x - it.w / 2).toFixed(1)}px,${(b.position.y - it.h / 2).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`;
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Copy email                                                          */
  /* ------------------------------------------------------------------ */
  function initCopy() {
    const toast = $('.toast');
    let timer;
    const say = (msg) => {
      if (!toast) return;
      toast.textContent = msg; toast.classList.add('is-on');
      clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('is-on'), 1900);
    };
    $$('[data-copy]').forEach((btn) => {
      const original = btn.textContent;
      btn.addEventListener('click', async () => {
        const value = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(value);
          btn.textContent = 'Copied'; btn.classList.add('is-done'); say('Email address copied');
          setTimeout(() => { btn.textContent = original; btn.classList.remove('is-done'); }, 1900);
        } catch (e) {
          location.href = 'mailto:' + value;
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Contact form                                                        */
  /* Sends through Web3Forms when an access key is set on the form.      */
  /* Without a key, or if sending fails, it hands the message to the     */
  /* visitor's own email app so nothing they typed is lost.              */
  /* ------------------------------------------------------------------ */
  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('.form__status', form);
    const button = $('.form__send', form);
    const buttonHTML = button.innerHTML;
    const key = (form.dataset.accessKey || '').trim();
    const to = form.dataset.to;

    const mailtoFor = (d) => 'mailto:' + to +
      '?subject=' + encodeURIComponent('Portfolio enquiry from ' + d.name) +
      '&body=' + encodeURIComponent(d.message + '\n\n' + d.name + '\n' + d.email);

    function say(text, link) {
      status.textContent = text;
      if (link) {
        const a = document.createElement('a');
        a.href = link.href; a.textContent = link.label;
        status.append(' ', a);
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      if (d.botcheck) return; // filled in by a bot, not a person

      if (!key) {
        say('Opening your email app with the message filled in.');
        location.href = mailtoFor(d);
        return;
      }

      button.disabled = true;
      button.textContent = 'Sending…';
      say('');
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: key,
            subject: 'Portfolio enquiry from ' + d.name,
            from_name: 'Portfolio contact form',
            name: d.name, email: d.email, message: d.message
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.message || 'Request failed');
        form.reset();
        say('Thanks. Your message is on its way, and I’ll reply by email.');
      } catch (err) {
        say('That didn’t send.', { href: mailtoFor(d), label: 'Send it from your email app instead' });
      } finally {
        button.disabled = false;
        button.innerHTML = buttonHTML;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  const safely = (fn) => { try { fn(); } catch (e) { console.error(e); } };
  [initHero, initCursor, initMagnetic, initReveals, initStatement, initCounters,
    initNav, initMarquee, initWork, initArchive, initPit, initCopy, initForm].forEach(safely);
  applyMode(getMode());

  let lastY = scrollY;
  function loop(t) {
    scroll.y = scrollY;
    scroll.v = lerp(scroll.v, scroll.y - lastY, 0.2);
    lastY = scroll.y;
    for (let i = 0; i < frameTasks.length; i++) {
      try { frameTasks[i](t); } catch (e) { console.error(e); frameTasks.splice(i--, 1); }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Start the intro once the first frame has painted.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('loaded')));
})();
