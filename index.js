(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Fixed stage background ---------- */

  const initStage = () => {
    const layers = $$('.stage-layer');
    const triggers = $$('[data-stage]');
    if (!layers.length || !triggers.length) return;

    const setActiveLayer = (key) => {
      layers.forEach((layer) => {
        const isActive = layer.dataset.stageFor === key;
        layer.classList.toggle('is-active', isActive);

        const video = $('video', layer);
        if (!video) return;
        if (isActive) {
          video.preload = 'auto';
          video.play().catch(() => { });
        } else {
          video.pause();
        }
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveLayer(entry.target.dataset.stage);
        });
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    );

    triggers.forEach((trigger) => observer.observe(trigger));
    setActiveLayer('hero');
  };

  /* ---------- Hero video: pause when off screen ---------- */

  const initHeroVideo = () => {
    const video = $('.hero-video');
    if (!video) return;

    if (prefersReducedMotion) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => { });
      else video.pause();
    });
    observer.observe(video);
  };

  const initProductionsSnap = () => {
    const section = $('#original-productions');
    const scroller = $('.productions-scroller');
    if (!section || !scroller) return;

    let lastY = window.scrollY;
    let dir = 0; // 1 = down, -1 = up
    let snapping = false;
    let timer;
    let touchStartY = 0;

    const check = () => {
      if (snapping) return;

      const vh = window.innerHeight;
      const r = section.getBoundingClientRect();
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visible <= vh * 0.1 || Math.abs(r.top) < 2) return;

      const fromTop = r.top > 0 && dir === 1;
      const fromBottom = r.top < 0 && dir === -1;
      if (!fromTop && !fromBottom) return;

      snapping = true;
      section.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      setTimeout(() => { snapping = false; }, 700);
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 90);
    };

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y !== lastY) dir = y > lastY ? 1 : -1;
      lastY = y;
      schedule();
    }, { passive: true });

    scroller.addEventListener('wheel', (e) => {
      dir = e.deltaY > 0 ? 1 : -1;
      schedule();
    }, { passive: true });

    scroller.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    scroller.addEventListener('touchend', (e) => {
      const endY = e.changedTouches[0].clientY;
      if (Math.abs(endY - touchStartY) > 5) dir = touchStartY > endY ? 1 : -1;
      schedule();
    }, { passive: true });

    scroller.addEventListener('scroll', schedule, { passive: true });
  };

  /* ---------- Productions scroller: release scroll at edges ---------- */

  const initProductionsScroller = () => {
    const scroller = $('.productions-scroller');
    if (!scroller) return;
    scroller.style.overscrollBehavior = 'auto';
  };

  /* ---------- Dialogs (trailer + image viewer) ---------- */

  const initDialogs = () => {
    const trailerDialog = $('#dialog-trailer');
    const imageDialog = $('#dialog-image');
    if (!trailerDialog || !imageDialog) return;

    const trailerFrame = $('.dialog-trailer-frame', trailerDialog);
    trailerFrame.referrerPolicy = 'strict-origin-when-cross-origin';
    const fullImage = $('.dialog-image-full', imageDialog);

    const openDialog = (dialog) => {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    };

    const closeDialog = (dialog) => {
      if (dialog.open) dialog.close();
    };

    const withAutoplay = (src) => `${src}${src.includes('?') ? '&' : '?'}autoplay=1&rel=0&origin=${encodeURIComponent(location.origin)}`;

    $$('.production-trailer-button').forEach((button) => {
      button.addEventListener('click', () => {
        const src = button.dataset.trailerSrc;
        if (!src) return;
        trailerFrame.src = withAutoplay(src);
        openDialog(trailerDialog);
      });
    });

    $$('.gallery-button, .orbit-button').forEach((button) => {
      button.addEventListener('click', () => {
        const thumb = $('img', button);
        const src = button.dataset.fullSrc || (thumb && thumb.src);
        if (!src) return;
        fullImage.src = src;
        fullImage.alt = thumb ? thumb.alt : '';
        openDialog(imageDialog);
      });
    });

    [trailerDialog, imageDialog].forEach((dialog) => {
      $('.dialog-close', dialog).addEventListener('click', () => closeDialog(dialog));

      dialog.addEventListener('click', (event) => {
        if (event.target === dialog || event.target === $('.dialog-body', dialog)) {
          closeDialog(dialog);
        }
      });

      dialog.addEventListener('close', () => {
        document.body.style.overflow = '';
        if (dialog === trailerDialog) trailerFrame.src = '';
        if (dialog === imageDialog) fullImage.src = '';
      });
    });
  };

  /* ---------- Stats count-up ---------- */

  const formatCount = (value, keepPlus) => {
    let text;
    if (value >= 1000000) {
      text = `${parseFloat((value / 1000000).toFixed(1))}M`;
    } else if (value >= 1000) {
      text = `${Math.round(value / 1000)}K`;
    } else {
      text = String(Math.round(value));
    }
    return keepPlus ? `${text}+` : text;
  };

  const initCountUp = () => {
    const counters = $$('[data-count-to]');
    if (!counters.length) return;

    const animate = (element) => {
      const target = Number(element.dataset.countTo);
      const keepPlus = element.textContent.trim().endsWith('+');
      if (!target || prefersReducedMotion) return;

      const duration = 1800;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = formatCount(target * eased, keepPlus && progress === 1);
        if (progress < 1) requestAnimationFrame(tick);
        else element.textContent = formatCount(target, keepPlus);
      };

      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach((counter) => observer.observe(counter));
  };

  /* ---------- Brands marquee: duplicate for seamless loop ---------- */

  const initMarquee = () => {
    const marquee = $('.brands-marquee');
    if (!marquee) return;

    $$('.brands-marquee-item', marquee).forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      $('img', clone).alt = '';
      marquee.appendChild(clone);
    });
  };

  /* ---------- Expertise scroller: keyboard support ---------- */

  const initExpertiseScroller = () => {
    const section = document.querySelector('.expertise');
    if (!section) return;

    const slides = [...section.querySelectorAll('.expertise-slide')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ticking = false;

    const update = () => {
      ticking = false;
      if (reduced) return;
      const vh = window.innerHeight;
      slides.forEach((slide, i) => {
        const next = slides[i + 1];
        if (!next) return;
        const p = Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / vh));
        slide.style.transform = `scale(${1 - p * 0.12})`;
        slide.style.filter = `blur(${p * 10}px) brightness(${1 - p * 0.5})`;
      });
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    section.querySelectorAll('[data-expertise-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rect = section.getBoundingClientRect();
        const top = window.scrollY + rect.top;
        const bottom = window.scrollY + rect.bottom;
        const y = btn.dataset.expertiseNav === 'up'
          ? top - window.innerHeight   // section top at bottom of screen
          : bottom;                    // section bottom at top of screen
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      });
    });
  };

  /* ---------- Init ---------- */

  const init = () => {
    initStage();
    initHeroVideo();
    initProductionsScroller();
    initDialogs();
    initCountUp();
    initProductionsSnap();
    initMarquee();
    initExpertiseScroller();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }


})();



