/* calendar.js — month calendar with event dots (DOM-built; no innerHTML for data) */

import { openModal } from './main.js';

const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const TYPE_LABEL = {
  event: 'イベント',
  exhibition: '展示',
  workshop: 'ワークショップ',
  academic: '学術',
  maintenance: 'メンテナンス',
};

let eventsCache = null;

async function loadEvents() {
  if (eventsCache) return eventsCache;
  try {
    const res = await fetch('data/events.json');
    if (!res.ok) throw new Error('events.json fetch failed');
    const data = await res.json();
    eventsCache = data.reserved || [];
  } catch (e) {
    eventsCache = [];
  }
  return eventsCache;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSunday(d) { return d.getDay() === 0; }
const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23',
  '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-23',
  '2026-10-12', '2026-11-03', '2026-11-23',
]);
function isHoliday(d) { return HOLIDAYS_2026.has(formatDate(d)); }
function isClosed(d) { return isSunday(d) || isHoliday(d); }

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') {
      Object.entries(v).forEach(([dk, dv]) => { node.dataset[dk] = dv; });
    } else if (k === 'on') {
      Object.entries(v).forEach(([ev, fn]) => node.addEventListener(ev, fn));
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(node.style, v);
    } else if (k in node) {
      node[k] = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

class Calendar {
  constructor(root, options = {}) {
    this.root = root;
    this.full = options.full ?? root.hasAttribute('data-full');
    this.onSelectDate = options.onSelectDate || null;
    const today = new Date();
    this.viewYear = today.getFullYear();
    this.viewMonth = today.getMonth();
    this.events = [];
    this.selectedDate = null;
    this.init();
  }

  async init() {
    this.events = await loadEvents();
    this.render();
  }

  prev() {
    if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear--; }
    else this.viewMonth--;
    this.render();
  }
  next() {
    if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear++; }
    else this.viewMonth++;
    this.render();
  }

  eventsOnDate(dateStr) { return this.events.filter(e => e.date === dateStr); }

  render() {
    const root = this.root;
    while (root.firstChild) root.removeChild(root.firstChild);

    const y = this.viewYear, m = this.viewMonth;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startCol = first.getDay();
    const totalDays = last.getDate();
    const totalCells = Math.ceil((startCol + totalDays) / 7) * 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Header
    const head = el('header', { class: 'c-calendar__head' },
      el('h3', { class: 'c-calendar__title' }, `${y} 年 ${m + 1} 月`),
      el('div', { class: 'c-calendar__nav' },
        el('button', { type: 'button', 'aria-label': '前の月', on: { click: () => this.prev() } }, '‹'),
        el('button', { type: 'button', 'aria-label': '次の月', on: { click: () => this.next() } }, '›'),
      )
    );

    // Weekday labels
    const weeks = el('div', { class: 'c-calendar__weeks', 'aria-hidden': 'true' });
    WEEK_LABELS.forEach((w, i) => {
      const style = i === 0 ? 'color:var(--color-error)' : i === 6 ? 'color:var(--color-info)' : '';
      const dn = el('div', {}, w);
      if (style) dn.setAttribute('style', style);
      weeks.appendChild(dn);
    });

    // Grid
    const grid = el('div', { class: 'c-calendar__grid' });

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startCol + 1;
      const isOtherMonth = dayNum < 1 || dayNum > totalDays;
      const cellDate = new Date(y, m, dayNum);
      const dateStr = formatDate(cellDate);
      const events = this.eventsOnDate(dateStr);
      const closed = isClosed(cellDate);
      const past = cellDate < today && !this.full;
      const isToday = formatDate(today) === dateStr;
      const isSelected = this.selectedDate === dateStr;

      const classes = [
        'c-calendar__day',
        isOtherMonth ? 'is-other' : '',
        closed || past ? 'is-disabled' : '',
        events.length ? 'has-events' : '',
        isToday ? 'is-today' : '',
        isSelected ? 'is-selected' : '',
      ].filter(Boolean).join(' ');

      const dotsWrap = el('span', { class: 'c-calendar__dots' });
      events.slice(0, 4).forEach(ev => {
        dotsWrap.appendChild(el('span', { class: `c-calendar__dot c-calendar__dot--${ev.type}` }));
      });

      const ariaLabel = `${y}年${m + 1}月${cellDate.getDate()}日${closed ? '（休館日）' : ''}${events.length ? `、${events.length}件のイベント` : ''}`;

      const btn = el('button', {
        type: 'button',
        class: classes,
        'aria-label': ariaLabel,
        disabled: (closed || isOtherMonth) ? 'disabled' : null,
        dataset: { date: dateStr },
      },
        el('span', {}, String(cellDate.getDate())),
        dotsWrap,
      );

      if (!closed && !isOtherMonth) {
        btn.addEventListener('click', () => {
          this.selectedDate = dateStr;
          if (this.onSelectDate) this.onSelectDate(dateStr, this.eventsOnDate(dateStr));
          this.render();
        });
      }
      grid.appendChild(btn);
    }

    const wrap = el('div', { class: 'c-calendar' }, head, weeks, grid);
    root.appendChild(wrap);
  }

  setSelected(dateStr) {
    this.selectedDate = dateStr;
    const [y, m] = dateStr.split('-').map(Number);
    this.viewYear = y;
    this.viewMonth = m - 1;
    this.render();
  }
}

/* ---------- 選択した日の開催内容を描画（フル/予約フォーム共通） ---------- */
function renderDayInto(container, dateStr, events, { heading = false } = {}) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const [y, m, d] = dateStr.split('-').map(Number);
  const closed = isClosed(new Date(y, m - 1, d));
  if (heading) {
    container.appendChild(el('div', { class: 'c-day-events__head' }, `${m} 月 ${d} 日の予約状況`));
  }
  if (closed) {
    container.appendChild(el('div', { class: 'c-alert c-alert--warning' },
      el('span', { class: 'c-alert__icon', 'aria-hidden': 'true' }, '⚠'),
      el('div', {}, 'この日は休館日です。Imagine Deck の利用はできません。')));
  } else if (events.length === 0) {
    container.appendChild(el('div', { class: 'c-alert c-alert--success' },
      el('span', { class: 'c-alert__icon', 'aria-hidden': 'true' }, '✓'),
      el('div', {}, 'この日はまだ予約が入っていません。終日空いています。')));
  } else {
    const list = el('div', { class: 'c-day-events__list' });
    events.forEach((ev) => {
      list.appendChild(el('div', { class: 'c-day-events__item' },
        el('div', { class: 'c-day-events__meta' },
          el('span', { class: `c-tag c-tag--${ev.type}` }, TYPE_LABEL[ev.type] || ev.type),
          el('strong', {}, `${ev.start} – ${ev.end}`)),
        el('div', { class: 'c-day-events__title' }, ev.title),
        el('div', { class: 'c-day-events__org' }, `主催: ${ev.organizer}`)));
    });
    container.appendChild(list);
  }
  return closed;
}

/* ---------- Full calendar wiring ---------- */
function initFullCalendar() {
  const elRoot = document.querySelector('#full-calendar[data-calendar]');
  if (!elRoot) return;
  const modal = document.getElementById('day-modal');
  const titleEl = document.getElementById('day-modal-title');
  const bodyEl = document.getElementById('day-modal-body');

  new Calendar(elRoot, {
    full: true,
    onSelectDate(dateStr, events) {
      const [y, m, d] = dateStr.split('-').map(Number);
      titleEl.textContent = `${y} 年 ${m} 月 ${d} 日`;
      const closed = renderDayInto(bodyEl, dateStr, events);
      if (!closed) {
        bodyEl.appendChild(el('a', {
          class: 'c-button c-button--primary c-button--block',
          style: { marginTop: '18px' },
          href: `reserve.html?date=${dateStr}`,
        }, 'この日で予約する →'));
      }
      openModal(modal);
    },
  });
}

/* ---------- Reserve page calendar wiring ---------- */
function initReserveCalendar() {
  const elRoot = document.querySelector('#reserve-calendar[data-calendar]');
  if (!elRoot) return;
  const dateInput = document.getElementById('date');
  const dayPanel = document.getElementById('reserve-day-events');
  const showDay = (dateStr, events) => {
    if (!dayPanel) return;
    renderDayInto(dayPanel, dateStr, events, { heading: true });
    dayPanel.hidden = false;
  };
  const cal = new Calendar(elRoot, {
    onSelectDate(dateStr, events) {
      dateInput.value = dateStr;
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      showDay(dateStr, events); // 選んだ日の開催内容を表示
    },
  });
  window.__reserveCalendar = cal;

  const params = new URLSearchParams(window.location.search);
  const qDate = params.get('date');
  if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
    setTimeout(() => {
      cal.setSelected(qDate);
      dateInput.value = qDate;
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      showDay(qDate, cal.eventsOnDate(qDate));
    }, 120);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initFullCalendar();
  initReserveCalendar();
});

export { Calendar, isClosed, formatDate, loadEvents, el };
