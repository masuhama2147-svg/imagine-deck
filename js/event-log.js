/* event-log.js — search, tag filter, year-month filter (DOM-only, no innerHTML for data) */

const state = {
  search: '',
  tag: 'all',
  month: '',
};

function applyFilter() {
  const cards = document.querySelectorAll('#event-grid .c-event-card');
  let visibleCount = 0;
  cards.forEach(card => {
    const tags = (card.dataset.tags || '').toLowerCase().split(/\s+/).filter(Boolean);
    const date = card.dataset.date || '';
    const search = (card.dataset.search || '').toLowerCase();
    const title = card.querySelector('.c-event-card__title')?.textContent?.toLowerCase() || '';
    const excerpt = card.querySelector('.c-event-card__excerpt')?.textContent?.toLowerCase() || '';
    const haystack = [search, title, excerpt].join(' ');

    let show = true;
    if (state.tag && state.tag !== 'all') {
      if (!tags.includes(state.tag)) show = false;
    }
    if (show && state.month) {
      if (!date.startsWith(state.month)) show = false;
    }
    if (show && state.search) {
      const q = state.search.toLowerCase();
      if (!haystack.includes(q)) show = false;
    }
    card.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  const empty = document.getElementById('event-empty');
  if (empty) empty.classList.toggle('is-active', visibleCount === 0);
}

function init() {
  const searchInput = document.getElementById('event-search');
  const monthSelect = document.getElementById('event-month-filter');
  const tagWrap = document.getElementById('event-tag-filter');

  if (!searchInput && !monthSelect && !tagWrap) return;

  searchInput?.addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    applyFilter();
  });
  monthSelect?.addEventListener('change', (e) => {
    state.month = e.target.value;
    applyFilter();
  });
  tagWrap?.querySelectorAll('.c-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      tagWrap.querySelectorAll('.c-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.tag = chip.dataset.tag || 'all';
      applyFilter();
    });
  });

  applyFilter();
}

document.addEventListener('DOMContentLoaded', init);
