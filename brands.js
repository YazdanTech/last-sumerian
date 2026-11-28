(() => {
  const section = document.querySelector('.section-transition-brands');
  const canvas = section.querySelector('.brands-hex-bg');
  const ctx = canvas.getContext('2d');

  const RATIO = 1.6;        // size step (higher = fewer hexagons)
  const COUNT = 5;          // approx. hexagons on screen
  const PERIOD = 6;         // seconds per shrink step
  const MAX_ALPHA = 0.8;
  const LINE_ALPHA = 0.35;  // line opacity at the outer edge
  const INNER = 0.6;        // inner stopper hexagon size (x MIN)
  const SEGMENTS = 48;      // line fade smoothness
  const LOGO_SCALE = 0.3;   // logo height relative to hexagon radius
  const LOGOS_PER_RING = 3; // logos on each logo hexagon (max 6)

  // pre-render logos once (grayscale + brighter) so no filter runs per frame
  const logos = [...section.querySelectorAll('.brands-marquee-logo')].map((el) => {
    const item = { cv: null };
    const im = new Image();
    im.onload = () => {
      const hh = 128;
      const ww = Math.max(1, Math.round(hh * im.naturalWidth / im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = ww; cv.height = hh;
      const c = cv.getContext('2d');
      c.filter = 'grayscale(1) brightness(2)';
      c.drawImage(im, 0, 0, ww, hh);
      item.cv = cv;
    };
    im.src = el.currentSrc || el.src;
    return item;
  });
  const N = logos.length;

  // pre-rendered static lines layer
  const lineCv = document.createElement('canvas');
  const lctx = lineCv.getContext('2d');

  let w, h, dpr, color, maxR, MIN, innerR;
  function resize() {
    const r = section.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    color = getComputedStyle(section).getPropertyValue('--color-primary-light').trim() || '#fff';
    maxR = Math.hypot(w, h) / 2 * 1.1;
    MIN = maxR / Math.pow(RATIO, COUNT);
    innerR = MIN * INNER;

    lineCv.width = canvas.width; lineCv.height = canvas.height;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, w, h);
    lctx.translate(w / 2, h / 2);
    lctx.strokeStyle = color;
    lctx.lineWidth = 1;
    const outerR = maxR * 1.6;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 3;
      const cx = Math.cos(a), cy = Math.sin(a);
      for (let s = 0; s < SEGMENTS; s++) {
        const t0 = s / SEGMENTS, t1 = (s + 1) / SEGMENTS;
        const d0 = innerR + (outerR - innerR) * t0;
        const d1 = innerR + (outerR - innerR) * t1;
        lctx.globalAlpha = LINE_ALPHA * Math.pow((t0 + t1) / 2, 1.5);
        lctx.beginPath();
        lctx.moveTo(cx * d0, cy * d0);
        lctx.lineTo(cx * d1, cy * d1);
        lctx.stroke();
      }
    }
    lctx.globalAlpha = 0.25;
    lctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 3;
      const x = Math.cos(a) * innerR, y = Math.sin(a) * innerR;
      k ? lctx.lineTo(x, y) : lctx.moveTo(x, y);
    }
    lctx.closePath();
    lctx.stroke();
  }
  new ResizeObserver(resize).observe(section);
  resize();

  const hexagon = (rad) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 3;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  };
  function drawLogos(rad, id) {
    if (!N) return;
    const lh = rad * LOGO_SCALE;
    // vertex indices: 0 top, 1 top-right, 2 bottom-right, 3 bottom, 4 bottom-left, 5 top-left
    const verts = id % 2 === 0 ? [0, 2, 4] : [1, 3, 5]; // up triangle / down triangle
    for (let j = 0; j < 3; j++) {
      const item = logos[(id * 3 + j) % N];
      if (!item.cv) continue;
      const a = -Math.PI / 2 + verts[j] * Math.PI / 3;
      const lw = lh * item.cv.width / item.cv.height;
      ctx.drawImage(item.cv, Math.cos(a) * rad - lw / 2, Math.sin(a) * rad - lh / 2, lw, lh);
    }
  }

  function draw(p, cycle) {
    ctx.clearRect(0, 0, w, h);

    ctx.globalAlpha = 1;
    ctx.drawImage(lineCv, 0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = color;

    // moving hexagons: big -> small, smaller = fainter; every other one carries logos
    for (let i = 0; ; i++) {
      const rad = MIN * Math.pow(RATIO, i - p);
      if (rad > maxR * 1.5) break;
      if (rad <= innerR) continue;
      const t = Math.min(1, rad / maxR);
      const tail = Math.min(1, Math.max(0, (rad - innerR) / (MIN - innerR)));
      const alpha = MAX_ALPHA * Math.pow(t, 1.2) * tail;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1 + t * 2.5;
      hexagon(rad);
      const id = i + cycle; // stable ring id
      ctx.globalAlpha = alpha;
      drawLogos(rad, id);
    }
    ctx.restore();
  }


  let p = 0, cycle = 0, last = performance.now();
  (function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    p += dt / PERIOD;
    if (p >= 1) { p -= 1; cycle++; }
    draw(p, cycle);
    requestAnimationFrame(loop);
  })(last);
})();