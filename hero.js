(() => {
  const track = document.querySelector('[data-hero-track]');
  const stage = document.querySelector('[data-hero-stage]');
  const video = document.querySelector('[data-hero-video]');
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const content = document.querySelector('[data-hero-content]');
  const items = [...document.querySelectorAll('[data-reveal]')];
  const title = document.querySelector('[data-title]');
  const actions = document.querySelector('[data-actions]');
  const hint = document.querySelector('[data-scroll-hint]');

  const reduceMotion = false;
  // const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeIn = x => x * x * x;
  const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

  const SAND = [243, 230, 200], GOLD = [217, 164, 65], RUST = [176, 84, 38];

  let max = 1;
  const measure = () => { max = track.offsetHeight - innerHeight; };
  // in readScroll: const p = clamp(-track.getBoundingClientRect().top / max);
  addEventListener('resize', () => { measure(); readScroll(); });
  measure();

  /* ---------- split scenes into words ---------- */
  document.querySelectorAll('[data-split]').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/)
      .map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
  });

  /* ---------- timeline (seconds of video) ---------- */
  const STARTS = [1.5, 4.9, 8.3, 11.7, 15.1, 18.5, 21.9]; // start of each text
  const LEN = 2.9;                                        // length of each text

  const T = {
    shade: [20, 23],
    reveal: { start: 24.6, stagger: 0.55, dur: 1.3 }
  };

  function hide(el, hidden) { el.style.visibility = hidden ? 'hidden' : 'visible'; }

  function renderScene(el, s, t) {
    const e = s + LEN;
    if (t < s || t > e) {
      if (el._on !== false) { el.style.opacity = 0; el.style.visibility = 'hidden'; el._on = false; }
      return;
    }
    el._on = true;

    if (el.dataset.fx === 'a') {
      /* fade in, hold, then shift colour / rise / fade out */
      const inP = easeOut(seg(t, s, s + 0.9));
      const p1 = easeInOut(seg(t, e - 1.1, e));
      const col = p1 < .5 ? mix(SAND, GOLD, p1 * 2) : mix(GOLD, RUST, (p1 - .5) * 2);
      const op = inP * (1 - p1);
      el.style.opacity = op;
      el.style.transform = `translate3d(0, ${(1 - inP) * 20 - p1 * 24}px, le(${1 + p1 * .06})`;
      el.style.color = `rgb(${col})`;
      hide(el, op < .002);
    } else {
      /* fly in from far, pass the camera */
      const inn = easeOut(seg(t, s, s + 1.9));
      const out = easeIn(seg(t, s + 1.9, e));
      const scale = (0.06 + 0.94 * inn) * (1 + out * 3);
      const op = clamp(inn * 2.4) * (1 - seg(t, s + 2.0, e));
      el.style.opacity = op;
      el.style.transform = `scale(${scale})`;
      hide(el, op < .002);
    }
  }

  function render(t) {
    /* text scenes */
    scenes.forEach((el, i) => renderScene(el, STARTS[i], t));

    /* final content, staggered */
    items.forEach((el, i) => {
      const s = T.reveal.start + i * T.reveal.stagger;
      const p = easeOut(seg(t, s, s + T.reveal.dur));
      if (el._p === p) return;
      el._p = p;
      el.style.opacity = p;
      el.style.transform = `translate3d(0, ${(1 - p) * 28}px, 0)`;
      if (el === title) el.style.letterSpacing = `${(0.34 - 0.22 * p).toFixed(3)}em`;
    });
    actions.inert = seg(t, T.reveal.start + 4 * T.reveal.stagger, 28) < .6;
    content.style.pointerEvents = 'none';
    actions.style.pointerEvents = actions.inert ? 'none' : 'auto';

    /* shade + hint */
    stage.style.setProperty('--shade', (0.45 + 0.55 * seg(t, ...T.shade)).toFixed(3));
    hint.style.opacity = 1 - seg(t, 0.3, 1.5);
  }

  /* ---------- scroll scrubbing ---------- */
  let dur = 30, target = 0, current = 0, ticking = false;

  const setDur = () => { if (isFinite(video.duration) && video.duration > 1) dur = video.duration; };

  function readScroll() {
    const max = track.offsetHeight - innerHeight;
    const p = clamp(-track.getBoundingClientRect().top / max);
    target = p * (dur - 0.05);
    start();
  }

  function frame() {
    const diff = target - current;
    current = Math.abs(diff) < 0.002 ? target : current + diff * 0.1;

    if (!video.seeking && Math.abs(video.currentTime - current) > 0.025) {
      video.currentTime = current;
    }
    render(current);

    if (current !== target) requestAnimationFrame(frame);
    else ticking = false;
  }
  function start() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  /* iOS/Safari: unlock seeking on a muted video */
  function unlock() {
    video.play().then(() => video.pause()).catch(() => { });
    video.addEventListener('play', () => video.pause());
  }

  video.pause();
  video.addEventListener('loadedmetadata', () => { setDur(); unlock(); readScroll(); });
  video.addEventListener('durationchange', setDur);
  addEventListener('touchstart', unlock, { once: true, passive: true });

  if (reduceMotion) {
    render(dur);
    return;
  }

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', readScroll);
  addEventListener('orientationchange', readScroll);

  render(0);
  readScroll();
})();