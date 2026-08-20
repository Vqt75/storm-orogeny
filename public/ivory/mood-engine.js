// STORM — Shared project mood solicitation engine (Tectonic bridge 8B.1)
// Decides only WHEN a quiet nudge may be shown. It never opens the UI,
// persists a response, or knows an API endpoint.

const DEFAULTS = Object.freeze({
  minActiveMs: 25000,
  maxActiveMs: 40000,
  quietMs: 1500,
  fallbackExposureMs: 35000,
  minScrollExposure: 0.55,
  introMs: 3200,
  tickMs: 500
});

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function createMoodSolicitationEngine(options = {}) {
  const win = options.window || globalThis.window;
  const doc = options.document || (win && win.document);
  // Sur une origine restreinte (Safari privé, origine opaque, iframe
  // sandboxée), lire win.localStorage/win.sessionStorage lève une
  // exception au moment même d'accéder à la propriété — pas seulement
  // à l'appel de getItem/setItem. Ce repli ne doit donc jamais accéder
  // directement à win.localStorage sans protection, même comme
  // simple valeur par défaut.
  const safeStorageRef = getter => { try { return getter(); } catch { return null; } };
  const storage = options.storage || (win && safeStorageRef(() => win.localStorage));
  const sessionStorage = options.sessionStorage || (win && safeStorageRef(() => win.sessionStorage));
  const config = Object.freeze({ ...DEFAULTS, ...(options.config || {}) });
  const prefix = options.storageKeyPrefix || 'storm_mood';
  const nudgeKey = `${prefix}_nudge_shown`;
  const thresholdKey = `${prefix}_attention_threshold`;
  const legacyNudgeKey = options.legacyNudgeKey || 'xyz_mood_intro_shown';
  const hasAnswered = typeof options.hasAnswered === 'function' ? options.hasAnswered : () => false;
  const isBusy = typeof options.isBusy === 'function' ? options.isBusy : () => false;
  const onNudge = typeof options.onNudge === 'function' ? options.onNudge : () => {};

  let ticker = null;
  let started = false;
  let cleaned = false;
  let activeMs = 0;
  let lastTick = 0;
  let lastInteractionAt = Date.now();
  let lastScrollY = 0;
  let scrollExposurePx = 0;
  let meaningfulInteractions = 0;
  let nudged = false;
  let pageFocused = typeof doc?.hasFocus === 'function' ? doc.hasFocus() : true;

  const safeGet = (store, key) => {
    try { return store && store.getItem ? store.getItem(key) : null; }
    catch { return null; }
  };
  const safeSet = (store, key, value) => {
    try { if (store && store.setItem) store.setItem(key, value); }
    catch { /* storage may be unavailable */ }
  };

  const hasNudgedToday = () => {
    const today = todayStamp();
    return safeGet(storage, nudgeKey) === today || safeGet(storage, legacyNudgeKey) === today;
  };
  const markNudgedToday = () => safeSet(storage, nudgeKey, todayStamp());

  const attentionThreshold = () => {
    const stored = Number(safeGet(sessionStorage, thresholdKey));
    if (stored >= config.minActiveMs && stored <= config.maxActiveMs) return stored;
    const threshold = Math.round(config.minActiveMs + Math.random() * (config.maxActiveMs - config.minActiveMs));
    safeSet(sessionStorage, thresholdKey, String(threshold));
    return threshold;
  };

  const noteInteraction = () => { pageFocused = true; lastInteractionAt = Date.now(); };
  const onWindowFocus = () => { pageFocused = true; lastInteractionAt = Date.now(); };
  const onWindowBlur = () => { pageFocused = false; };
  const onScroll = () => {
    const y = Number(win.scrollY || 0);
    const viewport = Math.max(Number(win.innerHeight || 1), 1);
    scrollExposurePx += Math.min(Math.abs(y - lastScrollY), viewport * 0.75);
    lastScrollY = y;
    noteInteraction();
  };
  const onMeaningfulClick = event => {
    const target = event && event.target;
    if (target && target.closest && target.closest('[data-tct-mood-fab], [data-tct-mood-panel]')) return;
    if (target && target.closest && target.closest('a, button, [role="button"], [data-tct-route], [data-tab]')) meaningfulInteractions += 1;
    noteInteraction();
  };

  const isActivelyAttending = () => {
    if (!doc || !win) return false;
    const visible = doc.visibilityState === 'visible';
    const focused = pageFocused;
    const adminOpen = Boolean(doc.body && doc.body.classList && doc.body.classList.contains('storm-admin-open'));
    return visible && focused && !adminOpen;
  };
  const hasMeaningfulExposure = () => {
    const viewport = Math.max(Number(win.innerHeight || 1), 1);
    return scrollExposurePx >= viewport * config.minScrollExposure || meaningfulInteractions >= 1 || activeMs >= config.fallbackExposureMs;
  };
  const isCalmMoment = () => {
    const active = doc && doc.activeElement;
    const typing = Boolean(active && ((typeof active.matches === 'function' && active.matches('input, textarea, select')) || active.isContentEditable));
    const modalOpen = Boolean(doc && doc.querySelector && doc.querySelector('[aria-modal="true"]:not([hidden]), .modal.open, .studio-modal.open'));
    return !typing && !modalOpen && !isBusy() && (Date.now() - lastInteractionAt) >= config.quietMs;
  };

  const cleanup = () => {
    if (cleaned || !win || !doc) return;
    cleaned = true;
    win.removeEventListener('focus', onWindowFocus);
    win.removeEventListener('blur', onWindowBlur);
    win.removeEventListener('scroll', onScroll);
    win.removeEventListener('wheel', noteInteraction);
    win.removeEventListener('touchmove', noteInteraction);
    doc.removeEventListener('click', onMeaningfulClick);
    doc.removeEventListener('keydown', noteInteraction);
    if (ticker != null) win.clearInterval(ticker);
    ticker = null;
  };

  const start = () => {
    if (started || !win || !doc) return;
    started = true;
    if (hasAnswered() || hasNudgedToday()) return;

    const reducedMotion = Boolean(typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const thresholdMs = attentionThreshold();
    lastTick = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
    lastScrollY = Number(win.scrollY || 0);

    win.addEventListener('focus', onWindowFocus);
    win.addEventListener('blur', onWindowBlur);
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('wheel', noteInteraction, { passive: true });
    win.addEventListener('touchmove', noteInteraction, { passive: true });
    doc.addEventListener('click', onMeaningfulClick, { passive: true });
    doc.addEventListener('keydown', noteInteraction, { passive: true });

    ticker = win.setInterval(() => {
      const now = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
      const delta = Math.min(now - lastTick, 1000);
      lastTick = now;
      if (isActivelyAttending()) activeMs += Math.max(0, delta);
      if (activeMs < thresholdMs || !hasMeaningfulExposure() || !isCalmMoment()) return;
      if (nudged || hasAnswered() || hasNudgedToday()) return;
      let shown = false;
      try { shown = onNudge({ reducedMotion, introMs: config.introMs }) !== false; }
      catch { shown = false; }
      if (!shown) return;
      nudged = true;
      markNudgedToday();
      cleanup();
    }, config.tickMs);
  };

  return { start, stop: cleanup, hasNudgedToday, config };
}

export { createMoodSolicitationEngine, DEFAULTS };
