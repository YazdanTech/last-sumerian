(() => {
  const track = document.querySelector('[data-hero-track]');
  const stage = document.querySelector('[data-hero-stage]');
  const video = document.querySelector('[data-hero-video]');
  const scene1 = document.querySelector('[data-scene="1"]');
  const scene2 = document.querySelector('[data-scene="2"]');
  const content = document.querySelector('[data-hero-content]');
  const items = [...document.querySelectorAll('[data-reveal]')];
  const title = document.querySelector('[data-title]');
  const actions = document.querySelector('[data-actions]');
  const hint = document.querySelector('[data-scroll-hint]');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeIn = x => x * x * x;
  const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

  const SAND = [243, 230, 200], GOLD = [217, 164, 65], RUST = [176, 84, 38];

  /* ---------- split scene 1 into words ---------- */
  document.querySelectorAll('[data-split]').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/)
      .map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
  });

  /* ---------- timeline (seconds of video) ---------- */
  const T = {
    s1Out: [2.9, 4.0],      // text 1 fades/shifts colour, gone at 4s
    s2In:  [8.0, 10.8],     // text 2 flies in from far
    s2Out: [12.8, 14.0],    // text 2 passes the camera, gone at 14s
    shade: [20, 23],
    reveal: { start: 22, stagger: 0.55, dur: 1.3 }
  };

  function hide(el, hidden) { el.style.visibility = hidden ? 'hidden' : 'visible'; }

  function render(t) {
    /* scene 1 */
    const p1 = easeInOut(seg(t, ...T.s1Out));
    const col = p1 < .5 ? mix(SAND, GOLD, p1 * 2) : mix(GOLD, RUST, (p1 - .5) * 2);
    scene1.style.opacity = 1 - p1;
    scene1.style.filter = `blur(${p1 * 14}px)`;
    scene1.style.transform = `translate3d(0, ${-p1 * 24}px, 0) scale(${1 + p1 * .06})`;
    scene1.style.color = `rgb(${col})`;
    hide(scene1, p1 >= 1);

    /* scene 2 */
    const inn = easeOut(seg(t, ...T.s2In));
    const out = easeIn(seg(t, ...T.s2Out));
    const scale = (0.06 + 0.94 * inn) * (1 + out * 8);
    const op = clamp(inn * 2.4) * (1 - seg(t, 13.0, 14.0));
    scene2.style.opacity = op;
    scene2.style.filter = `blur(${(1 - inn) * 10 + out * 10}px)`;
    scene2.style.transform = `scale(${scale})`;
    hide(scene2, op < .002);

    /* final content, staggered */
    items.forEach((el, i) => {
      const s = T.reveal.start + i * T.reveal.stagger;
      const p = easeOut(seg(t, s, s + T.reveal.dur));
      el.style.opacity = p;
      el.style.transform = `translate3d(0, ${(1 - p) * 28}px, 0)`;
      el.style.filter = p < 1 ? `blur(${(1 - p) * 10}px)` : 'none';
      if (el === title) el.style.letterSpacing = `${(0.34 - 0.22 * p).toFixed(3)}em`;
    });
    actions.inert = seg(t, T.reveal.start + 4 * T.reveal.stagger, 26) < .6;
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
    current = Math.abs(diff) < 0.002 ? target : current + diff * 0.05;

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
    video.play().then(() => video.pause()).catch(() => {});
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