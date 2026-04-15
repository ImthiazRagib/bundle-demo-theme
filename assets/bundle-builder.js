/* v:1775061438_a2cbf8fe */
/* ============================================================
   SHOPIFY BUNDLE BUILDER — bundle-builder.js
   ============================================================
   Drop this into your theme's assets/ folder.
   It is called automatically by sections/bundle-builder.liquid
   ============================================================ */

(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    bundleType: null,      // 'single' | 'double' | 'triple'
    totalBelts: 1,
    currentBelt: 1,        // 1-based index of belt being configured
    belts: [],             // Array of belt configurations
    pendingBundles: [],    // Bundles saved before starting the next (max 3 total)
    cartBundles: [],       // Array of completed bundles added to cart
    currentScreen: 'selector',
    _editMode: null,       // { bundleIdx, beltInBundle, savedType, savedTotalBelts, savedCurrentBelt, savedBelts }
  };

  const MAX_BUNDLES = 3;

  /* Belt configuration template */
  function newBeltConfig() {
    return { length: LENGTHS[0], buckle: null, strap: null, done: false };
  }

  /* ── Screen management ──────────────────────────────────── */
  function showScreen(id) {
    document.querySelectorAll('.bb-screen').forEach(s => s.classList.remove('is-active'));
    const screen = document.getElementById('bb-screen-' + id);
    if (screen) { screen.classList.add('is-active'); }
    state.currentScreen = id;
    updateNav(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNav(screenId) {
    const navMap = {
      'selector': 0,
      'composer': 0,
      'review': 1,
      'cart': 2,
      'confirm': 2,
      'confirmed': 2,
    };
    const activeIdx = navMap[screenId] ?? 0;
    document.querySelectorAll('.bb-nav__item').forEach((item, i) => {
      item.classList.toggle('is-active', i === activeIdx);
    });
  }

  /* ── Bundle config ──────────────────────────────────────── */
  const BUNDLES = {
    single:   { name: 'Single Set Belt',   belts: 1, price: 49.99, extra: null },
    double:   { name: 'Double Set Belt',   belts: 2, price: 79.99, extra: null },
    triple:   { name: 'Triple Set Belt',   belts: 3, price: 99.99, extra: null },
    infinity: { name: 'Infinity Set Belt', belts: 4, price: 119.99, extra: 19.99 },
  };

  /* ── Bundle type selection ──────────────────────────────── */
  function selectBundleType(type) {
    const bundle = BUNDLES[type] || BUNDLES.single;
    state.bundleType = type;
    state.totalBelts = bundle.belts;
    state.currentBelt = 1;
    state.belts = Array.from({ length: state.totalBelts }, newBeltConfig);

    document.querySelectorAll('.bb-bundle-card').forEach(c => {
      c.classList.toggle('is-selected', c.dataset.type === type);
    });
  }

  function startComposing() {
    if (!state.bundleType) { alert('Seleziona un pacchetto per continuare.'); return; }
    state.currentBelt = 1;
    renderComposer();
    showScreen('composer');
  }

  /* ── Combo summary bar update ───────────────────────────── */
  function updateComboBar() {
    const belt = state.belts[state.currentBelt - 1];
    if (!belt) return;
    const labelEl = document.getElementById('bb-combo-belt-label');
    const comboEl = document.getElementById('bb-combo-text');
    if (labelEl) {
      if (state.totalBelts > 1) {
        labelEl.style.display = '';
        labelEl.textContent = 'CINTURA ' + state.currentBelt + ' DI ' + state.totalBelts;
      } else {
        labelEl.style.display = 'none';
      }
    }
    if (comboEl) {
      const buckleName = (BUCKLES[belt.buckle] || {}).name || '—';
      const strapName  = (STRAPS[belt.strap]   || {}).name || '—';
      comboEl.innerHTML = 'Combinazione: <strong>' + buckleName + '</strong> + <strong>' + strapName + '</strong>';
    }
  }

  /* ── Composer rendering ─────────────────────────────────── */
  function renderComposer() {
    const belt = state.belts[state.currentBelt - 1];
    if (!belt) return;   /* guard: belt not yet created (e.g. async availability re-render before type selected) */

    /* Pre-apply defaults so the belt is never partially initialised when
     * renderBuckle/StrapCarousel run — both carousels also set these, but
     * doing it here first prevents any edge-case null slipping through. */
    if (!belt.length) belt.length = LENGTHS[0];
    if (!belt.buckle) belt.buckle = getDefaultBuckle();
    if (!belt.strap)  belt.strap  = getDefaultStrap();

    /* --- Progress --- */
    renderProgress();

    /* --- Belt wizard tab bar --- */
    renderBeltWizard();

    /* --- Length buttons --- */
    renderLengthButtons(belt);

    /* --- Buckle carousel --- */
    renderBuckleCarousel(belt);

    /* --- Strap carousel --- */
    renderStrapCarousel(belt);

    /* --- Combo summary bar --- */
    updateComboBar();

    /* --- Belt preview image --- */
    updateBeltPreview();

    /* --- Preload all combo photos for this strap + buckle so swipe is instant --- */
    preloadComboPhotos(belt.strap, belt.length);
    preloadComboPhotosForBuckle(belt.buckle, belt.length);
  }

  /* ── Belt wizard tab bar ────────────────────────────────── */
  function renderBeltWizard() {
    const el = document.getElementById('bb-belt-wizard');
    if (!el) return;

    if (state.bundleType === 'single') {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    el.style.display = '';

    /* Labels — number already shown in the dot, just the word "Cintura" */
    const labels = Array(12).fill('Cintura');
    const total   = state.totalBelts;
    const current = state.currentBelt;

    const tickSvg = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,8 7,12 13,4"/></svg>`;

    let html = '<div class="bb-wizard">';
    for (let i = 1; i <= total; i++) {
      const belt    = state.belts[i - 1] || {};
      const isDone  = !!belt.done;
      const isActive = i === current;
      const isPending = !isDone && !isActive;
      const status  = isDone ? 'is-done' : isActive ? 'is-active' : 'is-pending';
      const num     = isDone ? tickSvg : i;
      const lbl     = labels[i - 1] || (i + '° Cintura');

      html += `<div class="bb-wizard__step ${status}" data-belt="${i}" role="button" aria-label="${lbl}">
        <div class="bb-wizard__pill">
          <div class="bb-wizard__dot">${num}</div>
          <span class="bb-wizard__lbl">${lbl}</span>
        </div>
      </div>`;

      /* connector line between steps */
      if (i < total) {
        const connDone = state.belts[i - 1] && state.belts[i - 1].done;
        html += `<div class="bb-wizard__line ${connDone ? 'is-done' : 'is-pending'}"></div>`;
      }
    }

    html += '</div>';
    el.innerHTML = html;

    /* Scroll active step into view */
    const activeStep = el.querySelector('.bb-wizard__step.is-active');
    if (activeStep) {
      activeStep.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }

    /* Click done step → go back to it */
    el.querySelectorAll('.bb-wizard__step.is-done').forEach(step => {
      const n = parseInt(step.dataset.belt, 10);
      step.addEventListener('click', () => { state.currentBelt = n; renderComposer(); });
    });

    /* Infinity + button */
    const addBtn = el.querySelector('.bb-wizard__add');
    if (addBtn) addBtn.addEventListener('click', () => {
      state.totalBelts += 1;
      state.belts.push(newBeltConfig());
      state.currentBelt = state.totalBelts;
      renderComposer();
    });
  }

  /* Progress steps */
  function renderProgress() {
    const container = document.getElementById('bb-progress');
    if (!container) return;

    const beltLabels = Array.from({ length: state.totalBelts }, (_, i) => `Cintura ${i + 1}`);
    const labels = [...beltLabels, 'Riepilogo'];
    const total = labels.length;
    let html = '';
    labels.forEach((label, i) => {
      const stepNum = i + 1;
      const isDone = state.currentBelt > stepNum || (i === total - 1 && state.currentScreen === 'review');
      const isActive = state.currentBelt === stepNum && state.currentScreen === 'composer';

      html += `
        <div class="bb-progress__step ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}">
          <div class="bb-progress__dot">
            ${isDone ? svgCheck() : stepNum}
          </div>
          <div class="bb-progress__label">${label}</div>
        </div>`;

      if (i < total - 1) {
        html += `<div class="bb-progress__line ${isDone ? 'is-done' : ''}"></div>`;
      }
    });
    container.innerHTML = html;
  }

  /* Summary pills for belts already configured */
  function renderSummaryPills() {
    const container = document.getElementById('bb-summary-pills');
    if (!container) return;

    let html = '';
    for (let i = 0; i < state.currentBelt - 1; i++) {
      const b = state.belts[i];
      if (!b) continue;
      const beltIdx = i + 1;
      const strap = b.strap ? STRAPS[b.strap] : null;
      html += `
        <div class="bb-summary-pill">
          ${strap ? `<span class="bb-summary-pill__dot" style="background:${strap.hex}"></span>` : ''}
          <div class="bb-summary-pill__item">
            <strong>Cintura #${beltIdx}:</strong>&nbsp;
            ${b.length || '—'} &middot; ${b.buckle ? BUCKLES[b.buckle].name : '—'} &middot; ${strap ? strap.name : '—'}
          </div>
          <span class="bb-summary-pill__edit" data-edit-belt="${beltIdx}">Modifica</span>
        </div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('[data-edit-belt]').forEach(el => {
      el.addEventListener('click', () => {
        const belt = parseInt(el.dataset.editBelt, 10);
        state.currentBelt = belt;
        renderComposer();
      });
    });
  }

  /* ── Data definitions ───────────────────────────────────── */
  const LENGTHS = ['130cm', '150cm'];

  /* ── Availability state (populated async from Shopify AJAX API) ── */
  let _bbAvailability = {}; /* variantId → true/false */

  function isBuckleAvailable(key) {
    if (!window.BB_VARIANTS || !window.BB_VARIANTS.buckles) return true;
    const id = window.BB_VARIANTS.buckles[key];
    if (!id || id === 0) return true;
    if (!Object.prototype.hasOwnProperty.call(_bbAvailability, id)) return true;
    return _bbAvailability[id] !== false;
  }

  function isStrapAvailable(key, length) {
    if (!window.BB_VARIANTS || !window.BB_VARIANTS.straps) return true;
    const id = window.BB_VARIANTS.straps[length || '130'];
    if (!id || id === 0) return true;
    if (!Object.prototype.hasOwnProperty.call(_bbAvailability, id)) return true;
    return _bbAvailability[id] !== false;
  }

  const BUCKLES = {
    'buckle-1': { name: 'Classic',  image: '' },
    'buckle-2': { name: 'Silver',   image: '' },
    'buckle-3': { name: 'Gold',     image: '' },
    'buckle-4': { name: 'Luxury',   image: '' },
  };

  const STRAPS = {
    'strap-nero':    { name: 'Nero',                hex: '#1a1a1a' },
    'strap-marrone': { name: 'Marrone',             hex: '#6b3a2a' },
    'strap-cognac':  { name: 'Cammello',            hex: '#c07840' },
    'strap-cuoio':   { name: 'Bianco',              hex: '#f0ede8' },
    'strap-beige':   { name: 'Beige',               hex: '#d4bc94' },
    'strap-rosso':   { name: 'Coccodrillo Marrone', hex: '#8b1a1a' },
    'strap-verde':   { name: 'Coccodrillo Nera',    hex: '#2d5a1b' },
    'strap-blu':     { name: 'Blu',                 hex: '#1a3a6b' },
    'strap-grigio':  { name: 'Grigio',              hex: '#888' },
  };

  /* ── Carousel order config (from Shopify Theme Editor) ──── */
  function getBuckleKeys() {
    const cfg = window.BB_CAROUSEL_CONFIG;
    if (cfg && cfg.buckleOrder && cfg.buckleOrder.trim()) {
      const ordered = cfg.buckleOrder.split(',').map(s => s.trim()).filter(k => BUCKLES[k]);
      if (ordered.length > 0) return ordered;
    }
    return Object.keys(BUCKLES);
  }

  function getStrapKeys() {
    const cfg = window.BB_CAROUSEL_CONFIG;
    if (cfg && cfg.strapOrder && cfg.strapOrder.trim()) {
      const ordered = cfg.strapOrder.split(',').map(s => s.trim()).filter(k => STRAPS[k]);
      if (ordered.length > 0) return ordered;
    }
    return Object.keys(STRAPS);
  }

  function getDefaultBuckle() {
    const cfg = window.BB_CAROUSEL_CONFIG;
    if (cfg && cfg.defaultBuckle && BUCKLES[cfg.defaultBuckle]) return cfg.defaultBuckle;
    return BUCKLES['buckle-2'] ? 'buckle-2' : getBuckleKeys()[0];
  }

  function getDefaultStrap() {
    const cfg = window.BB_CAROUSEL_CONFIG;
    if (cfg && cfg.defaultStrap && STRAPS[cfg.defaultStrap]) return cfg.defaultStrap;
    return STRAPS['strap-nero'] ? 'strap-nero' : getStrapKeys()[0];
  }

  /* ── Infinite wrap helper ────────────────────────────────── */
  /* Returns shortest signed distance from center idx to item i in a list of length n */
  function wrapRel(i, idx, n) {
    let rel = i - idx;
    if (rel >  Math.floor(n / 2)) rel -= n;
    if (rel < -Math.floor(n / 2)) rel += n;
    return rel;
  }

  /* ── Media config (loaded from bundle-builder-media.json) ── */
  let _bbMedia        = null;
  let _previewLoadId  = 0;   /* incremented on each preview change — used to cancel stale loads */

  /* Preload all combo photos for a given strap so buckle-swipe preview is instant */
  function preloadComboPhotos(strapKey, length) {
    if (!_bbMedia || !_bbMedia.combinations) return;
    const len = (length || '130cm').replace('cm', '');
    Object.keys(BUCKLES).forEach(function(buckleKey) {
      const combo = _bbMedia.combinations[strapKey + '__' + len + '__' + buckleKey];
      if (combo && combo.photo) {
        const img = new Image();
        img.src = combo.photo;
      }
    });
  }

  /* Preload all combo photos for a given buckle so strap-swipe preview is instant */
  function preloadComboPhotosForBuckle(buckleKey, length) {
    if (!_bbMedia || !_bbMedia.combinations) return;
    const len = (length || '130cm').replace('cm', '');
    Object.keys(STRAPS).forEach(function(strapKey) {
      const combo = _bbMedia.combinations[strapKey + '__' + len + '__' + buckleKey];
      if (combo && combo.photo) {
        const img = new Image();
        img.src = combo.photo;
      }
    });
  }

  async function fetchMedia() {
    const root = document.getElementById('bb-root');
    const url  = root && root.dataset.mediaUrl;
    if (!url) return;
    try {
      const res = await fetch(url);
      if (res.ok) _bbMedia = await res.json();
    } catch (e) {
      console.warn('[BundleBuilder] Media config not loaded:', e);
    }
  }

  /* Carica automaticamente le immagini prodotto bundle dall'API AJAX di Shopify.
     Usa le URL già configurate in BB_BUNDLE_IMAGES (Theme Editor) come priorità;
     se mancanti, recupera l'immagine dal variant ID del prodotto bundle. */
  async function fetchBundleImages() {
    if (typeof BB_BUNDLE_IMAGES === 'undefined') window.BB_BUNDLE_IMAGES = {};
    const V = (typeof BB_VARIANTS !== 'undefined') ? BB_VARIANTS : {};
    const types = ['single', 'double', 'triple'];
    await Promise.all(types.map(async function(type) {
      if (BB_BUNDLE_IMAGES[type]) return;           /* già impostata dal Theme Editor */
      const variantId = V.bundles && V.bundles[type];
      if (!variantId) return;
      try {
        const res = await fetch('/variants/' + variantId + '.js');
        if (!res.ok) return;
        const data = await res.json();
        /* featured_image sul variant, oppure fallback al product.featured_image */
        const img = (data.featured_image && data.featured_image.src)
                 || (data.product && data.product.featured_image && data.product.featured_image.src);
        if (img) BB_BUNDLE_IMAGES[type] = img.startsWith('//') ? 'https:' + img : img;
      } catch (e) { /* silente */ }
    }));
  }

  function updateModalMedia(strapKey, buckleKey) {
    if (!_bbMedia) return;
    const belt     = state.belts[state.currentBelt - 1];
    const length   = (belt && belt.length) ? belt.length.replace('cm', '') : '130';
    const comboKey = strapKey + '__' + length + '__' + buckleKey;
    const combo    = (_bbMedia.combinations && _bbMedia.combinations[comboKey]) || {};
    const strap    = STRAPS[strapKey]  || {};
    const buckle   = BUCKLES[buckleKey] || {};

    /* Worn photo */
    const wornImg    = document.getElementById('bb-worn-img');
    const wornHolder = document.getElementById('bb-worn-placeholder');
    if (wornImg) {
      const src = combo.worn || (wornImg.dataset.fallback !== 'undefined' ? wornImg.dataset.fallback : '') || '';
      if (src) {
        wornImg.src          = src;
        wornImg.style.display = '';
        if (wornHolder) wornHolder.style.display = 'none';
      } else {
        wornImg.style.display = 'none';
        if (wornHolder) wornHolder.style.display = '';
      }
    }

    /* Video 360° */
    const video       = document.getElementById('bb-video-360');
    const videoHolder = document.getElementById('bb-video-placeholder');
    if (video) {
      const src = combo.video || (video.dataset.fallback !== 'undefined' ? video.dataset.fallback : '') || '';
      if (src) {
        if (video.getAttribute('src') !== src) { video.setAttribute('src', src); video.load(); }
        video.style.display = '';
        if (videoHolder) videoHolder.style.display = 'none';
      } else {
        video.style.display = 'none';
        if (videoHolder) videoHolder.style.display = '';
      }
    }

    /* Captions */
    const cap = document.getElementById('bb-modal-caption-text');
    if (cap) cap.textContent = length + 'cm · ' + (buckle.name || '—') + ' · ' + (strap.name || '—');
    const vcap = document.getElementById('bb-modal-video-caption');
    if (vcap) vcap.textContent = (buckle.name || '—') + ' — ' + (strap.name || '—');
  }

  /* ── Render helpers ─────────────────────────────────────── */
  function renderLengthButtons(belt) {
    const container = document.getElementById('bb-length-selector');
    if (!container) return;
    container.innerHTML = LENGTHS.map(l => `
      <button class="bb-length-btn ${belt.length === l ? 'is-selected' : ''}"
              data-length="${l}">${l}</button>`).join('');
    container.querySelectorAll('.bb-length-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.belts[state.currentBelt - 1].length = btn.dataset.length;
        renderLengthButtons(state.belts[state.currentBelt - 1]);
        updateBeltPreview();
      });
    });
  }

  /* Buckle SVG placeholders — landscape silhouettes of different buckle styles */
  const BUCKLE_SVGS = {
    'buckle-1': `<svg viewBox="0 0 120 80" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="18" width="100" height="44" rx="6" fill="#c8c0b0" stroke="#999" stroke-width="1.5"/>
      <rect x="22" y="26" width="76" height="28" rx="3" fill="#e8e2d8" stroke="#aaa" stroke-width="1"/>
      <rect x="54" y="14" width="12" height="52" rx="3" fill="#b0a898" stroke="#888" stroke-width="1"/>
      <circle cx="60" cy="40" r="4" fill="#888"/>
      <rect x="14" y="35" width="10" height="10" rx="2" fill="#aaa"/>
    </svg>`,
    'buckle-2': `<svg viewBox="0 0 120 80" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="20" width="104" height="40" rx="8" fill="#d0c8b8" stroke="#999" stroke-width="1.5"/>
      <rect x="20" y="28" width="80" height="24" rx="4" fill="#e8e0d0" stroke="#bbb" stroke-width="1"/>
      <rect x="56" y="16" width="8" height="48" rx="2" fill="#b8b0a0" stroke="#999" stroke-width="1"/>
      <rect x="10" y="30" width="14" height="20" rx="4" fill="#c0b8a8" stroke="#aaa" stroke-width="1"/>
      <path d="M17 30 v20" stroke="#888" stroke-width="1.5"/>
    </svg>`,
    'buckle-3': `<svg viewBox="0 0 120 80" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="22" width="96" height="36" rx="5" fill="#c0b8a8" stroke="#999" stroke-width="1.5"/>
      <rect x="26" y="30" width="68" height="20" rx="2" fill="#ddd8cc" stroke="#bbb" stroke-width="1"/>
      <circle cx="60" cy="40" r="10" fill="#c8c0b0" stroke="#aaa" stroke-width="1.5"/>
      <circle cx="60" cy="40" r="4" fill="#aaa"/>
      <rect x="56" y="16" width="8" height="12" rx="2" fill="#b0a898"/>
      <rect x="56" y="52" width="8" height="12" rx="2" fill="#b0a898"/>
    </svg>`,
    'buckle-4': `<svg viewBox="0 0 120 80" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 30 Q10 20 20 20 L100 20 Q110 20 110 30 L110 50 Q110 60 100 60 L20 60 Q10 60 10 50 Z" fill="#c8c0b0" stroke="#999" stroke-width="1.5"/>
      <rect x="24" y="28" width="72" height="24" rx="3" fill="#e0d8c8" stroke="#bbb" stroke-width="1"/>
      <rect x="54" y="14" width="12" height="52" rx="4" fill="#b8b0a0" stroke="#999" stroke-width="1"/>
      <rect x="14" y="32" width="8" height="16" rx="2" fill="#aaa"/>
      <rect x="16" y="28" width="4" height="24" rx="1" fill="#999"/>
    </svg>`,
  };

  /* ── Scroll-driven selection helper (must appear before carousel fns) ── */
  const _carouselCtrl = { buckle: { ctrl: null }, strap: { ctrl: null } };

  function attachScrollSelection(container, itemSel, dataAttr, ctrlRef, onSelect) {
    if (ctrlRef.ctrl) ctrlRef.ctrl.abort();
    ctrlRef.ctrl = new AbortController();
    const { signal } = ctrlRef.ctrl;
    let timer = null;
    function pickLeftmost() {
      const items = container.querySelectorAll(itemSel);
      if (!items.length) return;
      const cLeft = container.getBoundingClientRect().left;
      let closest = null, bestDist = Infinity;
      items.forEach(el => {
        const d = Math.abs(el.getBoundingClientRect().left - cLeft);
        if (d < bestDist) { bestDist = d; closest = el; }
      });
      if (closest) {
        items.forEach(i => i.classList.remove('is-selected'));
        closest.classList.add('is-selected');
        onSelect(closest.dataset[dataAttr]);
      }
    }
    container.addEventListener('scroll', () => {
      clearTimeout(timer);
      timer = setTimeout(pickLeftmost, 80);
    }, { passive: true, signal });
  }

  /* Buckle carousel — centered cover-flow, infinite loop */
  function renderBuckleCarousel(belt) {
    const container = document.getElementById('bb-buckle-carousel');
    if (!container) return;
    let keys      = getBuckleKeys();
    if (window.BB_AVAIL_MODE === 'hide') keys = keys.filter(k => isBuckleAvailable(k));
    const defKey  = belt.buckle || getDefaultBuckle();
    let selIdx    = keys.indexOf(defKey);
    if (selIdx < 0) selIdx = 0;
    if (!belt.buckle) { state.belts[state.currentBelt - 1].buckle = keys[selIdx]; }

    const STEP    = 162;   /* px between item centres */
    const MAX_VIS = 2;     /* items shown each side */
    const N       = keys.length;

    /* Infinite layout: use shortest-path wrap for each item's rel position */
    function applyBuckleLayout(idx) {
      container.querySelectorAll('.bb-carousel__item').forEach((el, i) => {
        const rel = wrapRel(i, idx, N);
        const abs = Math.abs(rel);
        const sc  = abs === 0 ? 1.00 : abs === 1 ? 0.72 : abs === 2 ? 0.56 : 0.44;
        const op  = abs > MAX_VIS ? 0 : 1;   /* fully opaque when visible */
        el.style.transform     = `translateX(calc(-50% + ${rel * STEP}px)) scale(${sc})`;
        el.style.opacity       = String(op);
        el.style.zIndex        = String(10 - abs);
        el.style.pointerEvents = abs > MAX_VIS ? 'none' : 'auto';
        el.classList.toggle('is-selected', rel === 0);
      });
    }

    function updateBuckleNavButtons(idx) {
      const lbl = document.getElementById('bb-buckle-nav-label');
      /* Buttons never disabled in infinite mode */
      const prev = document.getElementById('bb-buckle-prev');
      const next = document.getElementById('bb-buckle-next');
      if (prev) prev.disabled = false;
      if (next) next.disabled = false;
      if (lbl)  lbl.textContent = `${idx + 1} / ${N}`;
    }

    function selectBuckle(newIdx) {
      selIdx = ((newIdx % N) + N) % N;
      const key = keys[selIdx];
      state.belts[state.currentBelt - 1].buckle = key;
      applyBuckleLayout(selIdx);
      updateBuckleNavButtons(selIdx);
      updateBeltPreview();
      const b2 = state.belts[state.currentBelt - 1];
      if (b2.strap) updateModalMedia(b2.strap, key);
      /* Preload strap-combo photos for this buckle in background */
      preloadComboPhotosForBuckle(key, b2.length);
      /* Update inline label in section header */
      var nameEl = document.getElementById('bb-buckle-name-inline');
      if (nameEl) nameEl.textContent = BUCKLES[key] ? BUCKLES[key].name : '';
      updateComboBar();
    }

    container.innerHTML = keys.map((key) => {
      const b      = BUCKLES[key];
      const avail  = isBuckleAvailable(key);
      const imgUrl = _bbMedia && _bbMedia.buckles && _bbMedia.buckles[key];
      const thumb  = imgUrl
        ? `<img src="${imgUrl}" alt="${b.name}">`
        : (BUCKLE_SVGS[key] || BUCKLE_SVGS['buckle-1']);
      const badge  = (!avail && window.BB_AVAIL_MODE === 'grey') ? '<div class="bb-unavail-badge">Non<br>Disponibile</div>' : '';
      const cls    = !avail ? ' bb-carousel__item--unavailable' : '';
      return `<div class="bb-carousel__item${cls}" data-buckle="${key}">
        <div class="bb-carousel__thumb">
          ${thumb}
          ${badge}
        </div>
      </div>`;
    }).join('');

    applyBuckleLayout(selIdx);
    updateBuckleNavButtons(selIdx);
    /* ── Set initial buckle name in section label ── */
    (function() { var el = document.getElementById('bb-buckle-name-inline'); if (el) el.textContent = BUCKLES[keys[selIdx]] ? BUCKLES[keys[selIdx]].name : ''; })();

    /* AbortController — cleans up all listeners when carousel is re-rendered */
    if (_carouselCtrl.buckle.ctrl) _carouselCtrl.buckle.ctrl.abort();
    _carouselCtrl.buckle.ctrl = new AbortController();
    const { signal: bSig } = _carouselCtrl.buckle.ctrl;

    /* Prev / Next buttons — always enabled (infinite) */
    const prevBtn = document.getElementById('bb-buckle-prev');
    const nextBtn = document.getElementById('bb-buckle-next');
    if (prevBtn) prevBtn.addEventListener('click', () => selectBuckle(selIdx - 1), { signal: bSig });
    if (nextBtn) nextBtn.addEventListener('click', () => selectBuckle(selIdx + 1), { signal: bSig });

    /* Touch swipe — ghost-click guard prevents the synthetic 'click' that browsers
     * fire after touchend from accidentally selecting an adjacent item */
    let _sx = 0, _sy = 0, _sw = false, _buckleJustSwiped = false;
    container.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX; _sy = e.touches[0].clientY; _sw = false;
    }, { passive: true, signal: bSig });
    container.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - _sx);
      const dy = Math.abs(e.touches[0].clientY - _sy);
      if (dx > dy && dx > 8) _sw = true;
    }, { passive: true, signal: bSig });
    container.addEventListener('touchend', e => {
      if (!_sw) return;
      const dx = e.changedTouches[0].clientX - _sx;
      _buckleJustSwiped = true;
      setTimeout(() => { _buckleJustSwiped = false; }, 400);
      if (dx < -20) selectBuckle(selIdx + 1);
      else if (dx > 20) selectBuckle(selIdx - 1);
      _sw = false;
    }, { passive: true, signal: bSig });

    /* Tap a side item to bring it to centre — swipe guard prevents ghost clicks */
    container.querySelectorAll('.bb-carousel__item').forEach((el, i) => {
      el.addEventListener('click', () => {
        if (_buckleJustSwiped) return;
        const rel = wrapRel(i, selIdx, N);
        if (rel !== 0) selectBuckle(selIdx + rel);
      }, { signal: bSig });
    });
  }

  /* Strap carousel — centered cover-flow, full-bleed, infinite loop */
  function renderStrapCarousel(belt) {
    const container = document.getElementById('bb-strap-carousel');
    if (!container) return;
    const strapLength = belt.length ? belt.length.replace('cm', '') : '130';
    let keys       = getStrapKeys();
    if (window.BB_AVAIL_MODE === 'hide') keys = keys.filter(k => isStrapAvailable(k, strapLength));
    const defKey     = belt.strap || getDefaultStrap();
    let selIdx       = keys.indexOf(defKey);
    if (selIdx < 0) selIdx = 0;
    if (!belt.strap) { state.belts[state.currentBelt - 1].strap = keys[selIdx]; }

    const MAX_VIS = 2;
    const N       = keys.length;

    /* STEP is computed from container width so it scales across devices */
    function getStep() { return Math.round((container.offsetWidth || 320) * 0.55); }

    container.innerHTML = keys.map(key => {
      const s     = STRAPS[key];
      const avail = isStrapAvailable(key, strapLength);
      const photo = _bbMedia && _bbMedia.straps && _bbMedia.straps[key] && _bbMedia.straps[key][strapLength];
      const vis   = photo
        ? `<img class="bb-strap-item__thumb" src="${photo}" alt="${s.name}">`
        : `<div class="bb-strap-item__bar" style="background:${s.hex};"></div>`;
      const badge = (!avail && window.BB_AVAIL_MODE === 'grey') ? '<div class="bb-unavail-badge">Non<br>Disponibile</div>' : '';
      const cls   = !avail ? ' bb-strap-item--unavailable' : '';
      return `<div class="bb-strap-item${cls}" data-strap="${key}">${vis}${badge}<span class="bb-strap-item__name">${s.name}</span></div>`;
    }).join('');

    /* Infinite layout: shortest-path wrap for each item */
    function applyLayout(idx) {
      const STEP = getStep();
      container.querySelectorAll('.bb-strap-item').forEach((item, i) => {
        const rel = wrapRel(i, idx, N);
        const abs = Math.abs(rel);
        const sc  = abs === 0 ? 1.00 : abs === 1 ? 0.72 : abs === 2 ? 0.54 : 0.42;
        const op  = abs > MAX_VIS ? 0 : 1;   /* fully opaque when visible */
        item.classList.toggle('is-selected', rel === 0);
        item.style.transform     = `translateX(calc(-50% + ${rel * STEP}px)) scale(${sc})`;
        item.style.opacity       = String(op);
        item.style.zIndex        = String(10 - abs);
        item.style.pointerEvents = abs > MAX_VIS ? 'none' : 'auto';
      });
    }

    applyLayout(selIdx);
    updateExternalLabel(selIdx);   /* set initial inline name on first render */

    if (_carouselCtrl.strap.ctrl) _carouselCtrl.strap.ctrl.abort();
    _carouselCtrl.strap.ctrl = new AbortController();
    const { signal } = _carouselCtrl.strap.ctrl;

    function updateExternalLabel(idx) {
      const lbl = document.getElementById('bb-strap-color-name');
      if (lbl) lbl.textContent = STRAPS[keys[idx]] ? STRAPS[keys[idx]].name : '';
      /* Also update inline label in section header */
      var nameEl = document.getElementById('bb-strap-name-inline');
      if (nameEl) nameEl.textContent = STRAPS[keys[idx]] ? STRAPS[keys[idx]].name : '';
    }

    function updateNavButtons(idx) {
      const prev = document.getElementById('bb-strap-prev');
      const next = document.getElementById('bb-strap-next');
      const lbl  = document.getElementById('bb-strap-nav-label');
      /* Never disabled — infinite loop */
      if (prev) prev.disabled = false;
      if (next) next.disabled = false;
      if (lbl)  lbl.textContent = `${idx + 1} / ${N}`;
    }

    function selectStrap(newIdx) {
      selIdx = ((newIdx % N) + N) % N;
      state.belts[state.currentBelt - 1].strap = keys[selIdx];
      applyLayout(selIdx);
      updateExternalLabel(selIdx);
      updateNavButtons(selIdx);
      updateBeltPreview();
      const b2 = state.belts[state.currentBelt - 1];
      if (b2.buckle) updateModalMedia(keys[selIdx], b2.buckle);
      /* Preload buckle-combo photos for this strap in background */
      preloadComboPhotos(keys[selIdx], b2.length);
      updateComboBar();
    }

    /* Set initial state */
    updateExternalLabel(selIdx);
    updateNavButtons(selIdx);

    /* Touch swipe — ghost-click guard prevents synthetic clicks after swipe */
    let _sx = 0, _sy = 0, _sw = false, _strapJustSwiped = false;
    container.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX; _sy = e.touches[0].clientY; _sw = false;
    }, { passive: true, signal });
    container.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - _sx);
      const dy = Math.abs(e.touches[0].clientY - _sy);
      if (dx > dy && dx > 8) _sw = true;
    }, { passive: true, signal });
    container.addEventListener('touchend', e => {
      if (!_sw) return;
      const dx = e.changedTouches[0].clientX - _sx;
      _strapJustSwiped = true;
      setTimeout(() => { _strapJustSwiped = false; }, 400);
      if (dx < -20) selectStrap(selIdx + 1);
      else if (dx > 20) selectStrap(selIdx - 1);
      _sw = false;
    }, { passive: true, signal });

    /* Click to select any peeking item — wrap-aware, swipe guard */
    container.querySelectorAll('.bb-strap-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        if (_strapJustSwiped) return;
        const rel = wrapRel(i, selIdx, N);
        if (rel !== 0) selectStrap(selIdx + rel);
      }, { signal });
    });

    /* Arrow button navigation — always enabled (infinite) */
    const prevBtn = document.getElementById('bb-strap-prev');
    const nextBtn = document.getElementById('bb-strap-next');
    if (prevBtn) prevBtn.addEventListener('click', () => selectStrap(selIdx - 1), { signal });
    if (nextBtn) nextBtn.addEventListener('click', () => selectStrap(selIdx + 1), { signal });
  }

  /* Belt preview: show combo photo or coloured strip representing the strap */
  function updateBeltPreview() {
    const belt = state.belts[state.currentBelt - 1];
    const preview = document.getElementById('bb-belt-preview-img');
    if (!preview) return;
    const strap = belt.strap ? STRAPS[belt.strap] : null;
    const canvas = document.getElementById('bb-belt-canvas');

    /* Helper: show a new photo in the hero preview area.
     * Uses setTimeout(50ms) so the browser actually paints the fade-out frame
     * before the new image loads — works correctly even for cached images. */
    const _loadId = ++_previewLoadId;
    function showPreviewPhoto(url) {
      if (!url) return;
      if (canvas) canvas.style.display = 'none';
      preview.removeAttribute('loading');
      preview.onerror = null;
      preview.style.display = '';
      /* Step 1: fade out (paint frame committed after 50ms) */
      preview.style.transition = 'opacity 0.12s ease-out';
      preview.style.opacity    = '0.15';
      setTimeout(() => {
        if (_previewLoadId !== _loadId) return; /* cancelled by newer call */
        /* Step 2: load new image (may be from cache — that is fine) */
        const img = new Image();
        const apply = () => {
          if (_previewLoadId !== _loadId) return;
          preview.src = url;
          requestAnimationFrame(() => {
            preview.style.transition = 'opacity 0.3s ease-in';
            preview.style.opacity    = '1';
          });
        };
        img.onload  = apply;
        img.onerror = apply;   /* show even if load fails */
        img.src = url;
        /* If already cached, onload may not fire — force apply via rAF */
        if (img.complete) requestAnimationFrame(apply);
      }, 50);
    }

    /* 0 — SKU-based variant image.
     *     BB_SKU_IMAGES is a JS object built by Liquid iterating the belt combo product variants.
     *     SKU format confirmed by merchant: COLORE-LUNGHEZZA-NOMEFIBBIA (es. NERO-130-CLASSIC).
     *     We build the same canonical key from the current belt state and look it up directly. */
    if (window.BB_SKU_IMAGES && belt.strap && belt.buckle) {
      const strapLen   = belt.length ? belt.length.replace('cm', '') : '130';
      const strapName  = belt.strap.replace('strap-', '').toUpperCase();   /* NERO, MARRONE … */
      const buckleData = BUCKLES[belt.buckle];
      const buckleName = buckleData ? buckleData.name.toUpperCase() : '';  /* CLASSIC, SILVER … */
      /* Canonical key matches the Shopify SKU format: COLORE-LUNGHEZZA-NOMEFIBBIA */
      const candidateKey = strapName + '-' + strapLen + '-' + buckleName;
      let variantImg = window.BB_SKU_IMAGES[candidateKey];
      /* Fallback: case-insensitive scan if exact match fails */
      if (!variantImg) {
        const lower = candidateKey.toLowerCase();
        for (const [sku, img] of Object.entries(window.BB_SKU_IMAGES)) {
          if (sku.toLowerCase() === lower) { variantImg = img; break; }
        }
      }
      /* Second fallback: partial token match (handles different separators or ordering) */
      if (!variantImg) {
        const tokenOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').split('-').filter(Boolean);
        const need = [strapName.toLowerCase(), strapLen, buckleName.toLowerCase()];
        for (const [sku, img] of Object.entries(window.BB_SKU_IMAGES)) {
          const t = tokenOf(sku);
          if (need.every(n => t.includes(n))) { variantImg = img; break; }
        }
      }
      if (variantImg) {
        showPreviewPhoto(variantImg);
        if (belt.strap) updateModalMedia(belt.strap, belt.buckle);
        return;
      }
    }

    /* 1 — Per-combination photo from media config */
    if (_bbMedia && belt.strap && belt.buckle) {
      const strapLen = belt.length ? belt.length.replace('cm', '') : '130';
      const comboKey = belt.strap + '__' + strapLen + '__' + belt.buckle;
      const combo = _bbMedia.combinations && _bbMedia.combinations[comboKey];
      if (combo && combo.photo) {
        showPreviewPhoto(combo.photo);
        updateModalMedia(belt.strap, belt.buckle);
        return;
      }
    }

    /* 2 — Strap-only photo (no buckle-specific) */
    if (_bbMedia && belt.strap) {
      const strapLen   = belt.length ? belt.length.replace('cm', '') : '130';
      const strapPhoto = _bbMedia.straps && _bbMedia.straps[belt.strap] && _bbMedia.straps[belt.strap][strapLen];
      if (strapPhoto) {
        showPreviewPhoto(strapPhoto);
        if (belt.buckle) updateModalMedia(belt.strap, belt.buckle);
        return;
      }
    }

    // If a theme image URL is set via data attribute, use it
    const baseUrl = preview.closest('[data-belt-preview-base]')
      ? preview.closest('[data-belt-preview-base]').dataset.beltPreviewBase
      : null;

    if (baseUrl && belt.buckle && belt.strap) {
      // Attempt dynamic image path using Shopify CDN naming convention
      preview.src = `${baseUrl}-${belt.buckle}-${belt.strap}.jpg`;
      preview.onerror = () => { preview.src = ''; preview.alt = 'Anteprima non disponibile'; };
    } else if (strap) {
      // Fallback: solid colour rectangle as visual indicator
      preview.style.display = 'none';
      if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = 340;
        canvas.height = 100;
        // Strap
        ctx.fillStyle = strap.hex;
        ctx.roundRect(10, 30, 320, 40, 8);
        ctx.fill();
        // Buckle visual hint
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 3;
        ctx.strokeRect(150, 20, 40, 60);
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(belt.buckle ? BUCKLES[belt.buckle].name.split(' ')[1] || '' : '', 170, 58);
        canvas.style.display = 'block';
      }
    }
  }

  /* ── Validate current belt ──────────────────────────────── */
  function validateCurrentBelt() {
    const belt = state.belts[state.currentBelt - 1];
    if (!belt) { showToast('Errore: nessuna cintura configurata.'); return false; }
    /* Auto-apply defaults instead of blocking the user if values are somehow still null */
    if (!belt.length) belt.length = LENGTHS[0];
    if (!belt.buckle) belt.buckle = getDefaultBuckle();
    if (!belt.strap)  belt.strap  = getDefaultStrap();
    return true;
  }

  /* ── Advance from composer ──────────────────────────────── */
  /* ── Confetti + success overlay ──────────────────────────── */
  function showBeltSuccess(onComplete) {
    var beltNum   = state.currentBelt;
    var total     = state.totalBelts;
    var isLast    = beltNum >= total;

    var title = isLast
      ? (total === 1
          ? 'Cintura configurata con successo!'
          : 'Perfetto! Tutte le ' + total + ' cinture sono pronte.')
      : 'Cintura ' + beltNum + ' aggiunta al set!';
    var sub = isLast
      ? 'Ora puoi procedere al riepilogo e aggiungere il bundle al carrello.'
      : 'Continua con la cintura ' + (beltNum + 1) + ' di ' + total + '.';

    /* overlay */
    var ov = document.createElement('div');
    ov.className = 'bb-success-overlay';
    ov.innerHTML =
      '<canvas class="bb-confetti-canvas"></canvas>' +
      '<div class="bb-success-card">' +
        '<div class="bb-success-icon">🎉</div>' +
        '<div class="bb-success-title">' + title + '</div>' +
        '<div class="bb-success-sub">'   + sub   + '</div>' +
      '</div>';
    document.body.appendChild(ov);

    /* confetti canvas */
    var cv = ov.querySelector('.bb-confetti-canvas');
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
    var ctx = cv.getContext('2d');

    var colors = ['#c9970a','#e8b923','#f5d26e','#ffffff','#111111','#b8800b','#d4bc94'];
    var particles = [];
    for (var i = 0; i < 90; i++) {
      particles.push({
        x:     Math.random() * cv.width,
        y:     -20 - Math.random() * 120,
        w:     5  + Math.random() * 7,
        h:     3  + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 3.5 + Math.random() * 5,
        angle: Math.random() * Math.PI * 2,
        spin:  (Math.random() - 0.5) * 0.18,
        drift: (Math.random() - 0.5) * 2.4
      });
    }

    var rafId, start = Date.now();

    function tick() {
      var elapsed = Date.now() - start;
      ctx.clearRect(0, 0, cv.width, cv.height);

      particles.forEach(function(p) {
        p.y     += p.speed;
        p.x     += p.drift;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, (cv.height - p.y) / 60);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      /* fade out after 1.6s */
      if (elapsed > 1600) {
        ov.style.opacity = Math.max(0, 1 - (elapsed - 1600) / 600).toString();
      }

      if (elapsed < 2200) {
        rafId = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(rafId);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        onComplete();
      }
    }
    requestAnimationFrame(tick);
  }

  function addToSet() {
    if (!validateCurrentBelt()) return;
    state.belts[state.currentBelt - 1].done = true;

    showBeltSuccess(function() {
      if (state.currentBelt < state.totalBelts) {
        state.currentBelt += 1;
        renderComposer();
      } else if (state._editMode) {
        // Save edited belt back into the pending bundle it came from
        const em = state._editMode;
        state.pendingBundles[em.bundleIdx].belts[em.beltInBundle] = JSON.parse(JSON.stringify(state.belts[0]));
        // Restore the active bundle state that was saved before edit started
        state.bundleType  = em.savedType;
        state.totalBelts  = em.savedTotalBelts;
        state.currentBelt = em.savedCurrentBelt;
        state.belts       = em.savedBelts;
        state._editMode   = null;
        showReview();
      } else {
        showReview();
      }
    });
  }

  /* ── Belt mockup helpers ──────────────────────────────── */
  function beltMockupSVG(hex) {
    const safe = hex || '#888888';
    return `<svg viewBox="0 0 260 64" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%;">
      <rect x="0" y="20" width="260" height="24" rx="3" fill="${safe}"/>
      <rect x="0" y="20" width="260" height="7" rx="3" fill="rgba(255,255,255,.14)"/>
      <circle cx="218" cy="32" r="2.5" fill="rgba(0,0,0,.28)"/>
      <circle cx="200" cy="32" r="2.5" fill="rgba(0,0,0,.28)"/>
      <circle cx="182" cy="32" r="2.5" fill="rgba(0,0,0,.28)"/>
      <rect x="122" y="16" width="14" height="32" rx="2.5" fill="${safe}" stroke="rgba(0,0,0,.22)" stroke-width="1.5"/>
      <rect x="126" y="20" width="6" height="24" rx="1.5" fill="rgba(0,0,0,.18)"/>
      <rect x="28" y="12" width="70" height="40" rx="5" fill="#8b7355"/>
      <rect x="32" y="16" width="62" height="32" rx="3" fill="#a0885f"/>
      <rect x="33" y="27" width="60" height="10" rx="2" fill="${safe}" opacity=".65"/>
      <rect x="62" y="10" width="4" height="44" rx="2" fill="#5a4430"/>
    </svg>`;
  }

  var _bvgId = 0;
  function bundleVisualSVG(belts) {
    var uid = 'bsv' + (++_bvgId);
    var n = belts.length;
    var bh = 18; var gap = 22;
    var svgH = n * gap + bh + 8;
    var bands = '';
    belts.forEach(function(b, i) {
      var hex = (STRAPS[b.strap] || {}).hex || '#888';
      var y = 4 + i * gap;
      bands += '<rect x="4" y="' + y + '" width="82" height="' + bh + '" rx="4" fill="' + hex + '" filter="url(#' + uid + ')"/>'
             + '<rect x="4" y="' + y + '" width="82" height="6" rx="4" fill="rgba(255,255,255,.16)"/>'
             + '<rect x="20" y="' + (y + 4) + '" width="8" height="' + (bh - 8) + '" rx="2" fill="rgba(0,0,0,.15)"/>';
    });
    return '<svg viewBox="0 0 90 ' + svgH + '" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:' + svgH + 'px;">'
         + '<defs><filter id="' + uid + '" x="-10%" y="-20%" width="120%" height="160%">'
         + '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".3"/>'
         + '</filter></defs>'
         + bands
         + '</svg>';
  }

  function getBeltImgURL(belt) {
    const base = BB_VARIANTS.belt_preview_base_url;
    if (!base || !belt.strap || !belt.buckle) return null;
    const bNum = belt.buckle.replace('buckle-', '');
    return base + '-' + bNum + '-' + belt.strap + '.jpg';
  }

  /* Restituisce la miglior URL foto per una cintura:
     1. combo photo da _bbMedia  (combinazione pelle + fibbia)
     2. strap photo da _bbMedia  (solo pelle)
     3. URL base configurato nel tema
     4. null → SVG colorato di fallback */
  function getBeltPhotoURL(belt) {
    const lengthNum = (belt.length || '130cm').replace('cm', '').trim();
    if (_bbMedia) {
      /* 1 — combinazione specifica fibbia + pelle */
      if (belt.strap && belt.buckle) {
        const comboKey = belt.strap + '__' + lengthNum + '__' + belt.buckle;
        const combo = _bbMedia.combinations && _bbMedia.combinations[comboKey];
        if (combo && combo.photo) return combo.photo;
      }
      /* 2 — foto pelle (qualsiasi fibbia) */
      if (belt.strap) {
        const strapSet = _bbMedia.straps && _bbMedia.straps[belt.strap];
        if (strapSet) {
          const photo = strapSet[lengthNum] || strapSet['130'] || Object.values(strapSet)[0];
          if (photo) return photo;
        }
      }
    }
    /* 3 — base URL configurato nel Tema */
    return getBeltImgURL(belt);
  }

  /* Ritorna il markup dell'immagine/mockup cintura (img tag oppure SVG) */
  function beltVisualHTML(belt, alt) {
    const strap = STRAPS[belt.strap] || {};
    const photo = getBeltPhotoURL(belt);
    if (photo) {
      return '<img src="' + photo + '" alt="' + (alt || 'Cintura') + '"'
           + ' style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
    }
    return beltMockupSVG(strap.hex);
  }

  /* Markup per l'immagine del bundle (foto prodotto da Shopify o SVG stack) */
  function bundleHeroHTML(bundleType, belts, opts) {
    opts = opts || {};
    const w   = opts.width  || '80px';
    const h   = opts.height || '80px';
    const src = (typeof BB_BUNDLE_IMAGES !== 'undefined') && BB_BUNDLE_IMAGES && BB_BUNDLE_IMAGES[bundleType];
    if (src) {
      return '<img src="' + src + '" alt="' + bundleType + '"'
           + ' style="width:' + w + ';height:' + h + ';object-fit:cover;border-radius:8px;"'
           + ' onerror="this.style.display=\'none\'">';
    }
    return bundleVisualSVG(belts);
  }

  /* ── Review screen ──────────────────────────────────────── */
  function showReview() {
    const container = document.getElementById('bb-review-belts');
    if (!container) return;

    // All bundles: pending + current
    const allBundles = state.pendingBundles.concat([{
      type:  state.bundleType,
      belts: state.belts,
    }]);
    // Flatten ALL belts — all rows carry bundle/belt indices for individual editing
    let globalBeltNum = 0;
    const allBeltRows = [];
    allBundles.forEach(function(bundle, bundleIdx) {
      const isCurrentBundle = bundleIdx === allBundles.length - 1;
      bundle.belts.forEach(function(belt, beltIdxInBundle) {
        globalBeltNum++;
        allBeltRows.push({
          belt:            belt,
          globalNum:       globalBeltNum,
          bundleIdx:       bundleIdx,
          beltIdxInBundle: beltIdxInBundle,       // 0-based index within its bundle
          beltNumInBundle: beltIdxInBundle + 1,   // 1-based (used by composer)
          isCurrentBundle: isCurrentBundle,
        });
      });
    });

    const totalBelts = allBeltRows.length;
    const beltWord   = totalBelts === 1 ? 'cintura inclusa' : (totalBelts + ' cinture incluse');

    // Tier: 1→single, 2→double, 3→triple, 4→infinity base, 5+→infinity+extra
    const tierKeys = ['single', 'double', 'triple', 'infinity'];
    let tierPrice, tierName;
    if (totalBelts <= 4) {
      const tierBundle = BUNDLES[tierKeys[totalBelts - 1]] || BUNDLES.infinity;
      tierPrice = parseFloat(tierBundle.price.toFixed(2));
      tierName  = tierBundle.name;
    } else {
      tierPrice = parseFloat((BUNDLES.infinity.price + (totalBelts - 4) * BUNDLES.infinity.extra).toFixed(2));
      tierName  = BUNDLES.infinity.name;
    }
    const canAddMore = true; // always — infinity tier is unlimited

    // Header title
    const bundleTitle = document.getElementById('bb-review-title');
    if (bundleTitle) bundleTitle.textContent = 'Riepilogo bundle';

    // ── Single unified hero — upgrades as belts are added ─────
    let html = '<div class="bb-review__bundle-hero">'
      + '<div class="bb-review__bundle-visual">'
      + bundleHeroHTML(state.bundleType, state.belts, { width: '80px', height: '80px' })
      + '</div>'
      + '<div class="bb-review__bundle-info">'
      + '<div class="bb-review__bundle-name">' + tierName + '</div>'
      + '<div class="bb-review__bundle-price">€ ' + tierPrice.toFixed(2).replace('.', ',') + '</div>'
      + '<div class="bb-review__bundle-sub">' + beltWord + '</div>'
      + '</div></div>';

    // ── All belt cards — all have Modifica button ─────────────
    allBeltRows.forEach(function(row) {
      const strap      = STRAPS[row.belt.strap]   || {};
      const buckle     = BUCKLES[row.belt.buckle] || {};
      const mockupHTML = beltVisualHTML(row.belt, 'Cintura ' + row.globalNum);
      html += '<div class="bb-review__card">'
        + '<div class="bb-review__card-mockup">' + mockupHTML + '</div>'
        + '<div class="bb-review__card-body">'
        + '<div class="bb-review__card-num">Cintura #' + row.globalNum + '</div>'
        + '<div class="bb-spec-grid">'
        + '<div class="bb-spec-row"><span class="bb-spec-key">Colore pelle</span>'
        + '<span class="bb-spec-val"><span class="bb-swatch" style="background:' + (strap.hex || '#ccc') + '"></span>' + (strap.name || '—') + '</span></div>'
        + '<div class="bb-spec-row"><span class="bb-spec-key">Fibbia</span>'
        + '<span class="bb-spec-val">' + (buckle.name || '—') + '</span></div>'
        + '<div class="bb-spec-row"><span class="bb-spec-key">Passante</span>'
        + '<span class="bb-spec-val"><span class="bb-swatch" style="background:' + (strap.hex || '#ccc') + '"></span>' + (strap.name || '—') + '</span></div>'
        + '<div class="bb-spec-row"><span class="bb-spec-key">Lunghezza</span>'
        + '<span class="bb-spec-val">' + (row.belt.length || '—') + '</span></div>'
        + '</div>'
        + '<button class="bb-review__card-edit"'
        + ' data-bundle-idx="' + row.bundleIdx + '"'
        + ' data-belt-in-bundle="' + row.beltIdxInBundle + '"'
        + ' data-is-current="' + (row.isCurrentBundle ? '1' : '0') + '"'
        + ' data-belt-num="' + row.beltNumInBundle + '"'
        + '>✏ Modifica</button>'
        + '</div></div>';
    });

    // ── "Add another" button — shows next tier name OR extra cost ─
    if (canAddMore) {
      let addBtnLabel;
      if (totalBelts < 4) {
        // Approaching infinity — show the next tier name and its price
        const nextTierBundle = BUNDLES[tierKeys[totalBelts]];
        addBtnLabel = '+ Aggiungi 1 altro — ' + nextTierBundle.name
          + ' a €' + nextTierBundle.price.toFixed(2).replace('.', ',');
      } else {
        // Already in infinity tier — show extra-per-belt cost
        addBtnLabel = '+ Aggiungi 1 altro (+€'
          + BUNDLES.infinity.extra.toFixed(2).replace('.', ',') + ' · Infinity)';
      }
      html += '<button class="bb-review__add-bundle-btn" id="bb-add-another-bundle">'
        + addBtnLabel
        + '</button>';
    }

    container.innerHTML = html;

    // Edit buttons — current bundle belts go straight to composer,
    //               pending bundle belts enter edit mode (state saved/restored)
    container.querySelectorAll('[data-bundle-idx]').forEach(function(el) {
      el.addEventListener('click', function() {
        const bundleIdx    = parseInt(el.dataset.bundleIdx, 10);
        const beltInBundle = parseInt(el.dataset.beltInBundle, 10);
        const isCurrent    = el.dataset.isCurrent === '1';
        const beltNum      = parseInt(el.dataset.beltNum, 10);

        if (isCurrent) {
          // Belt belongs to the active bundle — just navigate the composer
          state.currentBelt = beltNum;
          renderComposer();
          showScreen('composer');
        } else {
          // Belt belongs to a pending bundle — save state, enter edit mode
          const pendingBundle = state.pendingBundles[bundleIdx];
          const beltToEdit    = JSON.parse(JSON.stringify(pendingBundle.belts[beltInBundle]));
          state._editMode = {
            bundleIdx:        bundleIdx,
            beltInBundle:     beltInBundle,
            savedType:        state.bundleType,
            savedTotalBelts:  state.totalBelts,
            savedCurrentBelt: state.currentBelt,
            savedBelts:       JSON.parse(JSON.stringify(state.belts)),
          };
          state.belts       = [beltToEdit];
          state.totalBelts  = 1;
          state.currentBelt = 1;
          renderComposer();
          showScreen('composer');
        }
      });
    });

    // "Add another" → save current bundle, always add exactly 1 new belt
    const addBtn = container.querySelector('#bb-add-another-bundle');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        state.pendingBundles.push({
          type:  state.bundleType,
          belts: JSON.parse(JSON.stringify(state.belts)),
        });
        state.bundleType  = 'single'; // always 1 belt at a time
        state.totalBelts  = 1;
        state.currentBelt = 1;
        state.belts       = [newBeltConfig()];
        renderComposer();
        showScreen('composer');
      });
    }

    // Tier price in the bottom total
    const totalEl = document.getElementById('bb-review-total');
    if (totalEl) totalEl.textContent = '€ ' + tierPrice.toFixed(2).replace('.', ',');

    renderProgress();
    showScreen('review');
  }

  /* ── Add bundle to cart ─────────────────────────────────── */
  function addBundleToCart() {
    // Tier price based on TOTAL BELT COUNT across all bundles
    const allBeltSets  = state.pendingBundles.concat([{ type: state.bundleType, belts: state.belts }]);
    const totalBelts   = allBeltSets.reduce(function(sum, b) { return sum + b.belts.length; }, 0);
    const tierKeys  = ['single', 'double', 'triple', 'infinity'];
    const tierPrice = totalBelts <= 4
      ? parseFloat(((BUNDLES[tierKeys[totalBelts - 1]] || BUNDLES.infinity).price).toFixed(2))
      : parseFloat((BUNDLES.infinity.price + (totalBelts - 4) * BUNDLES.infinity.extra).toFixed(2));

    // Push pending bundles with price = 0 (tier price is on the final entry)
    state.pendingBundles.forEach(function(bundle, i) {
      state.cartBundles.push({
        id:    Date.now() + i,
        type:  bundle.type,
        belts: JSON.parse(JSON.stringify(bundle.belts)),
        price: 0,
        qty:   1,
      });
    });

    // Push current bundle — carries the full tier price for the order
    state.cartBundles.push({
      id:    Date.now() + state.pendingBundles.length,
      type:  state.bundleType,
      belts: JSON.parse(JSON.stringify(state.belts)),
      price: tierPrice,
      qty:   1,
    });

    state.pendingBundles = [];
    renderCart();
    showScreen('cart');
  }

  /* ── Cart screen ────────────────────────────────────────── */
  function renderCart() {
    const container = document.getElementById('bb-cart-bundles');
    if (!container) return;

    if (state.cartBundles.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:#888;">
          <p style="font-size:15px;">Il tuo carrello è vuoto.</p>
          <button class="bb-btn-secondary" style="margin-top:16px;width:auto;padding:10px 24px;"
                  onclick="BundleBuilder.showScreen('selector')">Inizia a comporre</button>
        </div>`;
      updateCartTotal();
      return;
    }

    
    let html = '';
    state.cartBundles.forEach(function(bundle) {
      const label = (BUNDLES[bundle.type] || BUNDLES.single).name;
      const beltWord = bundle.belts.length === 1 ? '1 cintura' : (bundle.belts.length + ' cinture');
      html += '<div class="bb-cart__bundle" data-bundle-id="' + bundle.id + '">'
        + '<div class="bb-cart__bundle-header">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<div style="flex-shrink:0;width:52px;height:52px;border-radius:8px;overflow:hidden;background:rgba(0,0,0,.05);">'
        + bundleHeroHTML(bundle.type, bundle.belts, { width: '52px', height: '52px' })
        + '</div><div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--bb-dark);">' + label + '</div>'
        + '<div style="font-size:11px;color:var(--bb-mid);">' + beltWord + '</div>'
        + '</div></div>'
        + '<span style="color:var(--bb-accent);font-weight:700;font-size:16px;">€ '
        + (bundle.price * bundle.qty).toFixed(2).replace('.', ',') + '</span>'
        + '</div>'
        + '<div class="bb-cart__bundle-body">'
        + bundle.belts.map(function(belt, i) {
            const strap = STRAPS[belt.strap] || {};
            const buckle = BUCKLES[belt.buckle] || {};
            const mockupHTML = beltVisualHTML(belt, 'Cintura ' + (i + 1));
            return '<div class="bb-cart__belt-card">'
              + '<div class="bb-cart__belt-mockup">' + mockupHTML + '</div>'
              + '<div class="bb-cart__belt-info">'
              + '<div class="bb-cart__belt-num">Cintura #' + (i + 1) + '</div>'
              + '<div class="bb-cart__belt-specs">'
              + '<span class="bb-cart__belt-spec"><span class="bb-swatch" style="background:' + (strap.hex||'#ccc') + '"></span><strong>' + (strap.name||'—') + '</strong></span>'
              + '<span class="bb-cart__belt-spec">Fibbia: <strong>' + (buckle.name||'—') + '</strong></span>'
              + '<span class="bb-cart__belt-spec">Passante: <strong>' + (strap.name||'—') + '</strong></span>'
              + '<span class="bb-cart__belt-spec">Taglia: <strong>' + (belt.length||'—') + '</strong></span>'
              + '</div></div></div>';
          }).join('')
        + '<div class="bb-cart__qty" style="margin-top:12px;">'
        + '<button class="bb-cart__qty-btn" data-action="dec" data-id="' + bundle.id + '">−</button>'
        + '<span class="bb-cart__qty-num" id="qty-' + bundle.id + '">' + bundle.qty + '</span>'
        + '<button class="bb-cart__qty-btn" data-action="inc" data-id="' + bundle.id + '">+</button>'
        + '<span class="bb-cart__remove" data-remove="' + bundle.id + '">Rimuovi</span>'
        + '</div></div></div>';
    });
    container.innerHTML = html;

    /* Quantity controls */
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const bundle = state.cartBundles.find(b => b.id === id);
        if (!bundle) return;
        if (btn.dataset.action === 'inc') bundle.qty++;
        else { bundle.qty--; if (bundle.qty < 1) bundle.qty = 1; }
        const numEl = document.getElementById('qty-' + id);
        if (numEl) numEl.textContent = bundle.qty;
        updateCartTotal();
      });
    });

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.remove, 10);
        state.cartBundles = state.cartBundles.filter(b => b.id !== id);
        renderCart();
      });
    });

    updateCartTotal();
  }

  function updateCartTotal() {
    const total = state.cartBundles.reduce((sum, b) => sum + b.price * b.qty, 0);
    const el = document.getElementById('bb-cart-total');
    if (el) el.textContent = `€ ${total.toFixed(2)}`;
  }

  /* ── Confirm / checkout screen ──────────────────────────── */
  function showConfirm() {
    const container = document.getElementById('bb-confirm-bundles');
    if (!container) return;

    const total = state.cartBundles.reduce(function(sum, b) { return sum + b.price * b.qty; }, 0);

    let html = '';
    state.cartBundles.forEach(function(bundle) {
      const label  = (BUNDLES[bundle.type] || BUNDLES.single).name;
      const beltsHTML = bundle.belts.map(function(belt, i) {
        const strap  = STRAPS[belt.strap]  || {};
        const buckle = BUCKLES[belt.buckle] || {};
        return '<div class="bb-confirm__belt-line">'
          + '<span class="bb-swatch" style="background:' + (strap.hex || '#ccc') + '"></span>'
          + 'Cintura ' + (i + 1) + ': ' + (belt.length || '—') + ' · ' + (buckle.name || '—') + ' · ' + (strap.name || '—')
          + '</div>';
      }).join('');
      html += '<div class="bb-confirm__bundle">'
        + '<div class="bb-confirm__bundle-photo">'
        + bundleHeroHTML(bundle.type, bundle.belts, { width: '80px', height: '80px' })
        + '</div>'
        + '<div class="bb-confirm__bundle-detail">'
        + '<div class="bb-confirm__bundle-title">' + label + ' × ' + bundle.qty + '</div>'
        + beltsHTML
        + '<div class="bb-confirm__bundle-price">€ ' + (bundle.price * bundle.qty).toFixed(2).replace('.', ',') + '</div>'
        + '</div></div>';
    });

    container.innerHTML = html;

    const totalEl = document.getElementById('bb-confirm-total');
    if (totalEl) totalEl.textContent = '€ ' + total.toFixed(2).replace('.', ',');

    showScreen('confirm');
  }

  /* ── Shopify cart submission ─────────────────────────────── */
  async function proceedToCheckout() {
    /*
     * Each belt component is a separate SKU line item:
     *   - Strap: 18 variants (9 colours × 2 lengths: 130cm / 150cm)
     *   - Buckle: 4 variants (one per style)
     * Plus hidden logistics items (warranty card, NFC card, belt box)
     * added with properties prefixed by "_" so Shopify hides them
     * from customer-facing cart/email but shows them in admin orders.
     *
     * Set all variant IDs via window.BB_VARIANTS (injected by Liquid section).
     */
    const V         = window.BB_VARIANTS || {};
    const bundleV   = V.bundles   || {};
    const strapV    = V.straps    || {};
    const buckleV   = V.buckles   || {};
    const logisticV = V.logistics || {};

    const items = [];

    state.cartBundles.forEach(bundle => {
      const qty = bundle.qty || 1;

      /* 1. Bundle product (visible line item, priced) */
      const bundleVarKey = bundle.type;
      if (bundleV[bundleVarKey]) {
        const compositionSummary = bundle.belts.map(function(b, idx) {
          const s = STRAPS[b.strap] || {};
          const k = BUCKLES[b.buckle] || {};
          return 'Cintura ' + (idx + 1) + ': ' + (b.length || '') + ' · Fibbia ' + (k.name || '') + ' · Pelle ' + (s.name || '');
        }).join(' | ');
        items.push({ id: bundleV[bundleVarKey], quantity: qty,
          properties: { 'Composizione': compositionSummary } });
      }


      /* 3. Component SKUs per cintura (€0, picking list logistica) +
            logistica per cintura: 1 box, 1 garanzia, 1 NFC card ognuna */
      bundle.belts.forEach(function(belt, i) {
        const beltLabel  = 'Cintura ' + (i + 1);
        const lengthNum  = (belt.length || '130cm').replace('cm', '').trim();
        const strapV_key = lengthNum;   /* all same-length straps share one variant ID */
        const strapInfo  = STRAPS[belt.strap]  || {};
        const buckleInfo = BUCKLES[belt.buckle] || {};

        /* Cintura SKU — pelle + lunghezza */
        if (strapV[strapV_key]) {
          items.push({
            id: strapV[strapV_key],
            quantity: qty,
            properties: {
              '_cintura':   beltLabel,
              '_pos':       String(i + 1),   /* unique key prevents Shopify from merging same-variant belts */
              'Pelle':      strapInfo.name || '',
              'Lunghezza':  belt.length || '',
              '_bundle':    bundle.type,
            },
          });
        }

        /* Fibbia SKU */
        if (buckleV[belt.buckle]) {
          items.push({
            id: buckleV[belt.buckle],
            quantity: qty,
            properties: {
              '_cintura':    beltLabel,
              '_pos':        String(i + 1),   /* unique key prevents merge */
              'Modello':     buckleInfo.name || '',
              '_sku':        belt.buckle,
              '_bundle':     bundle.type,
            },
          });
        }

        /* ── Logistica per singola cintura ─────────────────────
           Ogni cintura ha il proprio box, garanzia e NFC card.
           Properties con "_" nascoste al cliente ma visibili in
           Shopify Admin e nelle app di picking/logistica.       */
        [
          { key: 'warranty', label: 'Garanzia Card', sku: 'warranty-card' },
          { key: 'nfc',      label: 'NFC Card',      sku: 'nfc-card'      },
          { key: 'box',      label: 'Belt Box',       sku: 'belt-box'      },
        ].forEach(function(item) {
          if (logisticV[item.key]) {
            items.push({
              id: logisticV[item.key],
              quantity: qty,
              properties: {
                '_cintura':   beltLabel,
                '_logistics': item.label,
                '_sku':       item.sku,
                '_bundle':    bundle.type,
              },
            });
          }
        });
      });
    });

    /* Rimuovi item con variant ID non configurati (0 o falsy) — Shopify rifiuta l'intera
       richiesta con 422 se anche un solo ID è 0. Questo succede finché il merchant non
       ha configurato i variant ID nel Theme Editor. */
    const validItems = items.filter(function(item) { return item.id && item.id !== 0; });

    /* Se nessun variant ID è configurato, vai direttamente alla conferma */
    if (!validItems.length) { showConfirmed(); return; }

    try {
      const resp = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validItems }),
      });
      if (resp.ok) {
        showConfirmed();
      } else {
        const errData = await resp.json().catch(function() { return {}; });
        console.error('[BundleBuilder] Cart error:', errData);
        showToast('Errore nell\'aggiunta al carrello. Riprova.');
      }
    } catch {
      /* In ambienti non-Shopify, simula il successo */
      showConfirmed();
    }
  }

  function showConfirmed() {
    const container = document.getElementById('bb-confirmed-summary');
    if (!container) return;

        let html = '';
    state.cartBundles.forEach(bundle => {
      const label = (BUNDLES[bundle.type] || BUNDLES.single).name;
      html += `<div style="margin-bottom:6px;"><strong>${label} × ${bundle.qty}</strong><br>`;
      bundle.belts.forEach((belt, i) => {
        const strap  = STRAPS[belt.strap] || {};
        const buckle = BUCKLES[belt.buckle] || {};
        html += `<span style="font-size:12px;color:#555;">Cintura #${i + 1}: ${belt.length || '—'} · ${buckle.name || '—'} · ${strap.name || '—'}</span><br>`;
      });
      html += '</div>';
    });
    container.innerHTML = html;

    const orderNum = document.getElementById('bb-order-number');
    if (orderNum) orderNum.textContent = '#' + Math.floor(10000 + Math.random() * 90000);

    showScreen('confirmed');
  }

  /* ── Modals ─────────────────────────────────────────────── */
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('is-open');
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('is-open');
  }

  /* ── Toast notification ─────────────────────────────────── */
  function showToast(msg) {
    let toast = document.getElementById('bb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bb-toast';
      toast.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:#333;color:#fff;padding:10px 20px;border-radius:8px;
        font-size:13px;z-index:9999;opacity:0;transition:opacity .3s;
        max-width:300px;text-align:center;`;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
  }

  /* ── SVG helpers ─────────────────────────────────────────── */
  function svgCheck() {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  }

  /* ── Init ───────────────────────────────────────────────── */
  async function init() {
    const wrap = document.getElementById('bb-root');
    if (!wrap) return;

    /* Load per-combination media config + bundle product images */
    await fetchMedia();
    fetchBundleImages();   /* async, non blocking — images ready before user reaches review */

    /* Debug: log available variant SKUs when BB_SKU_IMAGES is loaded */
    if (window.BB_SKU_IMAGES) {
      console.log('[BundleBuilder] BB_SKU_IMAGES loaded:', Object.keys(window.BB_SKU_IMAGES).length, 'varianti');
      console.log('[BundleBuilder] SKU esempi:', Object.keys(window.BB_SKU_IMAGES).slice(0, 5));
    }

    /* Warm up combo-photo cache for all 4 buckles on the default strap so
     * the preview flips instantly even before the user enters the composer.
     * Uses the first strap key as the default (nero). */
    const _initStrapKeys  = Object.keys(STRAPS);
    const _initBuckleKeys = Object.keys(BUCKLES);
    if (_initStrapKeys.length && _initBuckleKeys.length) {
      /* Preload all combos for the first strap (9 buckles × 2 lengths = 18 imgs) */
      preloadComboPhotos(_initStrapKeys[0], '130cm');
      preloadComboPhotos(_initStrapKeys[0], '150cm');
    }

    /* Bundle card select */
    wrap.querySelectorAll('[data-select-bundle]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectBundleType(btn.dataset.selectBundle);
      });
    });

    /* "Inizia a comporre" CTA */
    wrap.querySelectorAll('[data-action="start"]').forEach(btn => {
      btn.addEventListener('click', startComposing);
    });

    /* Composer CTA */
    const composerCta = wrap.querySelector('[data-action="add-to-set"]');
    if (composerCta) composerCta.addEventListener('click', addToSet);

    /* Back from composer */
    const composerBack = wrap.querySelector('[data-action="composer-back"]');
    if (composerBack) {
      composerBack.addEventListener('click', () => {
        if (state._editMode) {
          // Cancel the individual belt edit — restore saved bundle state and go to review
          const em = state._editMode;
          state.bundleType  = em.savedType;
          state.totalBelts  = em.savedTotalBelts;
          state.currentBelt = em.savedCurrentBelt;
          state.belts       = em.savedBelts;
          state._editMode   = null;
          showReview();
        } else if (state.currentBelt > 1) {
          // Go back to previous belt within the same bundle
          state.currentBelt -= 1;
          renderComposer();
        } else if (state.pendingBundles.length > 0) {
          // Composing 2nd/3rd bundle — restore previous bundle and return to review
          const prev = state.pendingBundles.pop();
          state.bundleType  = prev.type;
          state.totalBelts  = (BUNDLES[prev.type] || BUNDLES.single).belts;
          state.currentBelt = state.totalBelts;
          state.belts       = JSON.parse(JSON.stringify(prev.belts));
          showReview();
        } else {
          showScreen('selector');
        }
      });
    }

    /* Review — back */
    const reviewBack = wrap.querySelector('[data-action="review-back"]');
    if (reviewBack) reviewBack.addEventListener('click', () => {
      state.currentBelt = state.totalBelts;
      renderComposer();
      showScreen('composer');
    });

    /* Review — add to cart */
    const reviewCta = wrap.querySelector('[data-action="add-to-cart"]');
    if (reviewCta) reviewCta.addEventListener('click', addBundleToCart);

    /* Cart — back */
    const cartBack = wrap.querySelector('[data-action="cart-back"]');
    if (cartBack) cartBack.addEventListener('click', () => showScreen('review'));

    /* Cart — proceed */
    const cartCta = wrap.querySelector('[data-action="go-confirm"]');
    if (cartCta) cartCta.addEventListener('click', showConfirm);

    /* Confirm — pay */
    const confirmCta = wrap.querySelector('[data-action="checkout"]');
    if (confirmCta) confirmCta.addEventListener('click', proceedToCheckout);

    /* Confirmed — continue shopping */
    const continueShopping = wrap.querySelector('[data-action="continue"]');
    if (continueShopping) continueShopping.addEventListener('click', () => {
      state.cartBundles    = [];
      state.belts          = [];
      state.bundleType     = null;
      state.currentBelt    = 1;
      state.pendingBundles = [];
      state._editMode      = null;
      showScreen('selector');
    });

    /* Vedi indossata */
    wrap.querySelectorAll('[data-action="vedi-indossata"]').forEach(btn => {
      btn.addEventListener('click', () => openModal('bb-modal-indossata'));
    });
    /* Vedi 360° */
    wrap.querySelectorAll('[data-action="vedi-360"]').forEach(btn => {
      btn.addEventListener('click', () => openModal('bb-modal-360'));
    });

    /* Vedi Riepilogo — vai direttamente alla schermata review */
    wrap.querySelectorAll('[data-action="vedi-riepilogo"]').forEach(btn => {
      btn.addEventListener('click', () => showReview());
    });

    /* Modal closes */
    wrap.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    /* Nav clicks */
    wrap.querySelectorAll('[data-nav]').forEach(item => {
      item.addEventListener('click', () => {
        const target = item.dataset.nav;
        if (target === 'selector') showScreen('selector');
        else if (target === 'review') {
          if (state.belts.length > 0 && state.cartBundles.length === 0) showReview();
          else showScreen('review');
        }
        else if (target === 'cart') renderCart(), showScreen('cart');
      });
    });

    /* Start on selector */
    showScreen('selector');
    /* Check inventory availability from Shopify — re-renders carousels if needed */
    initAvailability();
  }

  /* ── Availability fetch — queries Shopify for each configured variant ── */
  async function initAvailability() {
    if (!window.BB_VARIANTS) return;
    const ids = [];
    Object.values(window.BB_VARIANTS.buckles || {}).forEach(id => { if (id && id !== 0) ids.push(id); });
    Object.values(window.BB_VARIANTS.straps  || {}).forEach(id => { if (id && id !== 0) ids.push(id); });
    if (!ids.length) return;
    try {
      const results = await Promise.all(
        ids.map(id =>
          fetch('/variants/' + id + '.js', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(v => v ? { id, available: Boolean(v.available) } : null)
            .catch(() => null)
        )
      );
      let changed = false;
      results.forEach(r => {
        if (!r) return;
        if (_bbAvailability[r.id] !== r.available) changed = true;
        _bbAvailability[r.id] = r.available;
      });
      /* Re-render carousels only if something changed */
      if (changed) renderComposer();
    } catch (e) { /* fail silently — items remain available */ }
  }

  /* Public API */
  window.BundleBuilder = { showScreen, selectBundleType, startComposing, openModal, closeModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
