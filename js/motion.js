/* motion.js — Antigravity-style motion layer (vanilla, no GSAP)
   - Scroll reveal via IntersectionObserver
   - Headline mask reveal
   - Magnetic hover
   - Pointer spotlight position
   - Scroll progress bar
   - Number counters
   - Subtle parallax
   - Sticky-stage slide active state
*/

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. Scroll reveal (Intersection Observer) ---------- */
function initReveal() {
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  if (!targets.length) return;

  if (prefersReduced) {
    targets.forEach(t => t.classList.add('is-in-view'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.12,
  });

  targets.forEach(t => observer.observe(t));
}

/* ---------- 2. Headline mask reveal: split by <br> using DOM nodes only ---------- */
function wrapHeadlineMasks() {
  const heads = document.querySelectorAll('[data-mask-reveal]');
  heads.forEach((el) => {
    if (el.dataset.maskReady) return;

    // Group child nodes into "lines" separated by <br>
    const lines = [[]];
    Array.from(el.childNodes).forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        lines.push([]);
      } else {
        lines[lines.length - 1].push(node);
      }
    });

    // Clear element via DOM
    while (el.firstChild) el.removeChild(el.firstChild);

    lines.forEach((nodes, idx) => {
      const wrap = document.createElement('span');
      wrap.className = 'm-headline-mask';
      wrap.style.setProperty('--reveal-delay', `${idx * 90}ms`);
      const inner = document.createElement('span');
      nodes.forEach(n => inner.appendChild(n));
      wrap.appendChild(inner);
      el.appendChild(wrap);
      if (idx < lines.length - 1) el.appendChild(document.createElement('br'));
    });

    el.dataset.maskReady = '1';
  });
}

function initHeadlineMaskReveal() {
  wrapHeadlineMasks();
  const masks = document.querySelectorAll('.m-headline-mask');
  if (!masks.length) return;
  if (prefersReduced) {
    masks.forEach(m => m.classList.add('is-in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  masks.forEach(m => io.observe(m));
}

/* ---------- Pointer spotlight (set --mx / --my on hover) ---------- */
function initSpotlight() {
  if (prefersReduced) return;
  const targets = document.querySelectorAll('.m-spotlight');
  targets.forEach(el => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top)  / r.height) * 100;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    });
  });
}

/* ---------- 5. Scroll progress bar ---------- */
function initProgressBar() {
  if (prefersReduced) return;
  const bar = document.createElement('div');
  bar.className = 'm-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  let ticking = false;
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = `${pct}%`;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
}

/* ---------- 6. Number counter (data-counter) ---------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const animateOne = (el) => {
    const target = Number(el.dataset.counter);
    if (!Number.isFinite(target)) return;
    if (prefersReduced) {
      el.textContent = String(target);
      return;
    }
    const dur = Number(el.dataset.counterDur || 1200);
    const start = performance.now();
    const startVal = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      const v = Math.round(startVal + (target - startVal) * eased);
      el.textContent = String(v);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateOne(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => io.observe(c));
}

/* ---------- 7. Subtle parallax for [data-parallax] ---------- */
function initParallax() {
  if (prefersReduced) return;
  const els = document.querySelectorAll('[data-parallax]');
  if (!els.length) return;

  let ticking = false;
  const update = () => {
    els.forEach(el => {
      const speed = Number(el.dataset.parallax || 0.15);
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const offset = (elementCenter - viewportCenter) * -speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initHeadlineMaskReveal();
  initSpotlight();
  initProgressBar();
  initCounters();
  initParallax();
});
