/* main.js — global behaviors for all pages */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ----- Header scroll state ----- */
function initHeaderScroll() {
  const header = $('#site-header');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* ----- Mobile menu ----- */
function initMobileMenu() {
  const toggle = $('[data-menu-toggle]');
  const drawer = $('#mobile-nav');
  if (!toggle || !drawer) return;

  const close = () => {
    toggle.setAttribute('aria-expanded', 'false');
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
  };
  const open = () => {
    toggle.setAttribute('aria-expanded', 'true');
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    expanded ? close() : open();
  });
  drawer.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

/* ----- Smooth anchors ----- */
function initSmoothAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ----- Modal helper (used by calendar, etc) ----- */
export function openModal(modal) {
  if (!modal) return;
  modal.removeAttribute('hidden');
  // Allow CSS transition
  requestAnimationFrame(() => modal.classList.add('is-open'));
  // Focus first focusable
  const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  focusable?.focus();
  document.body.style.overflow = 'hidden';
}
export function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => modal.setAttribute('hidden', ''), 250);
}

function initModals() {
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-modal-close]');
    if (closer) {
      const modal = closer.closest('.c-modal');
      closeModal(modal);
    }
    if (e.target.classList?.contains('c-modal')) {
      closeModal(e.target);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.c-modal.is-open');
    if (open) closeModal(open);
  });
}

/* ----- Graceful image fallback (hide broken/placeholder images) ----- */
function initImageFallback() {
  $$('img').forEach(img => {
    const onErr = () => {
      img.style.visibility = 'hidden';
      const media = img.closest('[class*="__media"]');
      if (media) media.classList.add('is-img-missing');
    };
    img.addEventListener('error', onErr, { once: true });
    if (img.complete && img.naturalWidth === 0) onErr();
  });
}

/* ----- Init ----- */
document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initMobileMenu();
  initSmoothAnchors();
  initModals();
  initImageFallback();
});
