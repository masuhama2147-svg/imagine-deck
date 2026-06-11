/* carousel.js — Apple-Store-style horizontal showcase with autoplay */

function initCarousel(root) {
  const track = root.querySelector('[data-carousel-track]');
  if (!track) return;
  const slides = Array.from(track.children);
  if (slides.length < 2) return;

  const dotsWrap = root.querySelector('[data-carousel-dots]');
  const playBtn = root.querySelector('[data-carousel-play]');
  const prevBtn = root.querySelector('[data-carousel-prev]');
  const nextBtn = root.querySelector('[data-carousel-next]');
  const labelEl = playBtn?.querySelector('[data-label]');
  const iconEl = playBtn?.querySelector('[data-icon]');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = 0;
  let timer = null;
  let playing = false;

  // ----- dots -----
  const dots = [];
  if (dotsWrap) {
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'c-carousel__dot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', `${i + 1} 番目へ`);
      d.addEventListener('click', () => { stop(); goTo(i); });
      dotsWrap.appendChild(d);
      dots.push(d);
    });
  }

  function step() {
    // distance between consecutive slides (slide width + gap)
    return slides.length > 1 ? (slides[1].offsetLeft - slides[0].offsetLeft) : slides[0].offsetWidth;
  }
  function setActive(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    dots.forEach((d, di) => d.classList.toggle('is-active', di === current));
  }
  function goTo(i, smooth = true) {
    const idx = (i + slides.length) % slides.length;
    track.scrollTo({ left: idx * step(), behavior: smooth && !prefersReduced ? 'smooth' : 'auto' });
    setActive(idx);
  }

  function start() {
    if (prefersReduced) { goTo(current + 1); return; }
    playing = true;
    root.classList.add('is-playing');
    if (playBtn) playBtn.setAttribute('aria-pressed', 'true');
    if (labelEl) labelEl.textContent = '停止';
    if (iconEl) iconEl.textContent = '❚❚';
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 3200);
  }
  function stop() {
    playing = false;
    root.classList.remove('is-playing');
    if (playBtn) playBtn.setAttribute('aria-pressed', 'false');
    if (labelEl) labelEl.textContent = '自動再生';
    if (iconEl) iconEl.textContent = '▶';
    clearInterval(timer);
  }

  playBtn?.addEventListener('click', () => (playing ? stop() : start()));
  nextBtn?.addEventListener('click', () => { stop(); goTo(current + 1); });
  prevBtn?.addEventListener('click', () => { stop(); goTo(current - 1); });

  // keep dots in sync with manual scroll / swipe
  let st;
  track.addEventListener('scroll', () => {
    clearTimeout(st);
    st = setTimeout(() => setActive(Math.round(track.scrollLeft / step())), 110);
  }, { passive: true });

  // pause autoplay when the carousel leaves the viewport
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      if (!visible) clearInterval(timer);
      else if (playing) { clearInterval(timer); timer = setInterval(() => goTo(current + 1), 3200); }
    }, { threshold: 0.25 }).observe(root);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
});
