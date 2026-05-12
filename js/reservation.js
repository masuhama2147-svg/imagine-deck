/* reservation.js — 6-step reservation form (DOM-built; no innerHTML for data) */

import { loadEvents, el } from './calendar.js';

const TOTAL_STEPS = 6;
const TIME_OPTS = [];
for (let h = 10; h <= 16; h++) {
  for (const mm of (h === 16 ? ['00', '30'] : ['00', '30'])) {
    TIME_OPTS.push(`${String(h).padStart(2, '0')}:${mm}`);
  }
}
// 10:00 to 16:30 inclusive

const state = {
  currentStep: 1,
  formData: {},
  validationErrors: {},
  uploadedFiles: [],
};

const STEP_LABELS = {
  1: '日時',
  2: '主催者情報',
  3: '利用内容',
  4: '利用箇所',
  5: '詳細・添付',
  6: '確認',
};

const FIELD_LABELS = {
  date: '利用したい日',
  'start-time': '開始時間',
  'end-time': '終了時間',
  'org-name': '主催者・団体名',
  'student-name': '担当学生 氏名',
  'student-email': '担当学生 メールアドレス',
  'staff-name': '担当教員・担当職員 氏名',
  'staff-email': '担当教員・担当職員 メールアドレス',
  'purpose-type': '利用目的タイプ',
  'reserve-type': '予約形態',
  audience: '参加形態',
  academic: '学術イベントかどうか',
  capacity: '想定人数',
  fee: '参加費',
  catering: '飲食',
  area: '利用箇所',
  purpose: '利用目的',
  'event-detail': 'イベント詳細',
  sns: 'SNS リンク',
  'related-url': '関連 URL',
  files: '添付資料',
  notes: '備考',
};

const FIELDS_BY_STEP = {
  1: ['date', 'start-time', 'end-time'],
  2: ['org-name', 'student-name', 'student-email', 'staff-name', 'staff-email'],
  3: ['purpose-type', 'reserve-type', 'audience', 'academic', 'capacity', 'fee', 'catering'],
  4: ['area'],
  5: ['purpose', 'event-detail', 'sns', 'related-url', 'notes'],
};

const PURPOSE_LABEL = { exhibition: '展示・発表', event: 'イベント・交流', workshop: 'ワークショップ', study: '自習・打ち合わせ' };
const RESERVE_LABEL = { shared: '通常利用（共有）', exclusive: '専有利用（貸切）' };
const AUDIENCE_LABEL = { public: '一般公開', campus: '学内のみ', closed: '関係者のみ' };
const ACADEMIC_LABEL = { academic: '学術イベント', 'non-academic': '学術以外', study: '自習・交流' };
const FEE_LABEL = { free: '無料', paid: '有料' };
const CATERING_LABEL = { none: 'なし', drinks: '飲み物のみ', snacks: '軽食あり（要相談）' };
const AREA_LABEL = {
  'wall-front': '壁面（入口側）',
  'wall-back': '壁面（奥）',
  'floor-front': 'フロア（入口側）',
  'floor-back': 'フロア（奥）',
  counter: 'カウンター',
  other: 'その他',
};

/* ---------- Time selects ---------- */
function fillTimeSelects() {
  const start = document.getElementById('start-time');
  const end = document.getElementById('end-time');
  if (!start || !end) return;
  const optEl = (v, label) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    return o;
  };
  start.appendChild(optEl('', '選択してください'));
  end.appendChild(optEl('', '選択してください'));
  TIME_OPTS.forEach(t => {
    if (t !== '16:30') start.appendChild(optEl(t, t)); // start cannot be 16:30
    if (t !== '10:00') end.appendChild(optEl(t, t));   // end cannot be 10:00
  });
}

/* ---------- Stepper UI ---------- */
function updateStepper() {
  const items = document.querySelectorAll('.c-stepper__item');
  items.forEach((item, i) => {
    const idx = i + 1;
    item.classList.remove('is-current', 'is-done', 'is-error');
    if (state.validationErrors[idx]?.length) item.classList.add('is-error');
    else if (idx < state.currentStep) item.classList.add('is-done');
    else if (idx === state.currentStep) item.classList.add('is-current');
  });
  const bar = document.getElementById('progress-bar');
  if (bar) {
    const pct = ((state.currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
    bar.style.width = `${pct}%`;
  }
  const status = document.getElementById('reserve-step-status');
  if (status) {
    status.textContent = `ステップ ${state.currentStep} / ${TOTAL_STEPS}：${STEP_LABELS[state.currentStep] || ''}`;
  }
}

/* ---------- Step visibility ---------- */
function showStep(n) {
  document.querySelectorAll('.p-reserve-step').forEach(s => {
    const stepNum = Number(s.dataset.step);
    if (stepNum === n) {
      s.removeAttribute('hidden');
      s.classList.add('is-current');
    } else {
      s.setAttribute('hidden', '');
      s.classList.remove('is-current');
    }
  });
  state.currentStep = n;
  updateStepper();
  // Scroll the step into view (top, but keep header visible)
  const cur = document.querySelector('.p-reserve-step.is-current');
  if (cur) {
    cur.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Build summary at step 6
  if (n === 6) buildConfirmSummary();
}

/* ---------- Validation ---------- */
function clearError(name) {
  const msg = document.querySelector(`[data-error-for="${name}"]`);
  if (msg) {
    msg.setAttribute('hidden', '');
    msg.textContent = '';
  }
  document.querySelectorAll(`[name="${name}"]`).forEach(el => el.removeAttribute('aria-invalid'));
}

function setError(name, message) {
  const msg = document.querySelector(`[data-error-for="${name}"]`);
  if (msg) {
    msg.textContent = message;
    msg.removeAttribute('hidden');
  }
  document.querySelectorAll(`[name="${name}"]`).forEach(el => el.setAttribute('aria-invalid', 'true'));
}

function validateField(name) {
  const form = document.getElementById('reserve-form');
  const els = form.querySelectorAll(`[name="${name}"]`);
  if (!els.length) return null;

  const first = els[0];
  let value;
  let isCheckboxOrRadio = false;
  if (first.type === 'checkbox') {
    value = Array.from(els).filter(e => e.checked).map(e => e.value);
    isCheckboxOrRadio = true;
  } else if (first.type === 'radio') {
    const checked = Array.from(els).find(e => e.checked);
    value = checked ? checked.value : '';
    isCheckboxOrRadio = true;
  } else {
    value = first.value.trim();
  }

  // Required check
  const required = first.hasAttribute('required') || first.closest('[aria-required="true"]');
  if (required) {
    if (Array.isArray(value) ? value.length === 0 : !value) {
      return `${FIELD_LABELS[name] || name}を入力してください。`;
    }
  }
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  // Type-specific
  if (first.type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'メールアドレスの形式が正しくありません。';
    }
  }
  if (first.type === 'url') {
    try { new URL(value); } catch { return 'URL の形式が正しくありません。'; }
  }
  if (name === 'capacity') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 100) return '想定人数は 1〜100 で入力してください。';
  }

  // Cross-field: time range
  if (name === 'end-time') {
    const start = form['start-time']?.value;
    const end = value;
    if (start && end && start >= end) {
      return '終了時間は開始時間より後にしてください。';
    }
  }

  return null;
}

function validateStep(n) {
  const fields = FIELDS_BY_STEP[n] || [];
  const errors = [];
  fields.forEach(name => {
    clearError(name);
    const err = validateField(name);
    if (err) {
      setError(name, err);
      errors.push({ name, message: err });
    }
  });
  state.validationErrors[n] = errors;

  // Render summary
  const stepEl = document.querySelector(`.p-reserve-step[data-step="${n}"]`);
  const summary = stepEl?.querySelector('[data-error-summary]');
  if (summary) {
    while (summary.firstChild) summary.removeChild(summary.firstChild);
    if (errors.length) {
      const heading = el('h3', {}, `入力内容にエラーがあります（${errors.length}件）`);
      const list = el('ul');
      errors.forEach(err => {
        const a = el('a', {
          href: `#${err.name}`,
          on: {
            click: (e) => {
              e.preventDefault();
              const target = document.getElementById(err.name) || document.querySelector(`[name="${err.name}"]`);
              target?.focus();
              target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
          },
        }, `${FIELD_LABELS[err.name] || err.name}: ${err.message}`);
        list.appendChild(el('li', {}, a));
      });
      summary.appendChild(heading);
      summary.appendChild(list);
      summary.removeAttribute('hidden');
      summary.setAttribute('tabindex', '-1');
      summary.focus();
    } else {
      summary.setAttribute('hidden', '');
    }
  }
  return errors.length === 0;
}

/* ---------- Collect form data ---------- */
function collectFormData() {
  const form = document.getElementById('reserve-form');
  const data = {};
  Object.values(FIELDS_BY_STEP).flat().forEach(name => {
    const els = form.querySelectorAll(`[name="${name}"]`);
    if (!els.length) return;
    const first = els[0];
    if (first.type === 'checkbox') {
      data[name] = Array.from(els).filter(e => e.checked).map(e => e.value);
    } else if (first.type === 'radio') {
      const c = Array.from(els).find(e => e.checked);
      data[name] = c ? c.value : '';
    } else {
      data[name] = first.value.trim();
    }
  });
  data.files = state.uploadedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }));
  state.formData = data;
  return data;
}

/* ---------- Confirm summary ---------- */
function buildConfirmSummary() {
  const wrap = document.getElementById('confirm-summary');
  if (!wrap) return;
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  const data = collectFormData();

  function card(title, stepNum, rows) {
    const head = el('div', { class: 'c-confirm-card__head' },
      el('h3', {}, title),
      el('a', {
        href: '#', class: 'c-confirm-card__edit',
        on: { click: (e) => { e.preventDefault(); showStep(stepNum); } },
      }, `修正する →`),
    );
    const dl = el('dl');
    rows.forEach(([k, v]) => {
      dl.appendChild(el('dt', {}, k));
      dl.appendChild(el('dd', {}, v || '（未入力）'));
    });
    return el('div', { class: 'c-confirm-card' }, head, dl);
  }

  const dateLabel = data.date ? data.date : '';
  const timeLabel = (data['start-time'] && data['end-time']) ? `${data['start-time']} 〜 ${data['end-time']}` : '';
  wrap.appendChild(card('日時', 1, [
    ['利用日', dateLabel],
    ['利用時間', timeLabel],
  ]));
  wrap.appendChild(card('主催者情報', 2, [
    ['主催者・団体名', data['org-name']],
    ['担当学生', `${data['student-name']}（${data['student-email']}）`],
    ['担当教員・職員', `${data['staff-name']}（${data['staff-email']}）`],
  ]));
  wrap.appendChild(card('利用内容', 3, [
    ['利用目的タイプ', PURPOSE_LABEL[data['purpose-type']] || ''],
    ['予約形態', RESERVE_LABEL[data['reserve-type']] || ''],
    ['参加形態', AUDIENCE_LABEL[data['audience']] || ''],
    ['学術かどうか', ACADEMIC_LABEL[data['academic']] || ''],
    ['想定人数', data.capacity ? `${data.capacity} 名` : ''],
    ['参加費', FEE_LABEL[data.fee] || ''],
    ['飲食', CATERING_LABEL[data.catering] || ''],
  ]));
  wrap.appendChild(card('利用箇所', 4, [
    ['利用箇所', (data.area || []).map(a => AREA_LABEL[a] || a).join(' / ')],
  ]));
  const fileLabel = state.uploadedFiles.length
    ? state.uploadedFiles.map(f => `${f.name}（${formatBytes(f.size)}）`).join(', ')
    : '添付なし';
  wrap.appendChild(card('詳細・添付資料', 5, [
    ['利用目的', data.purpose],
    ['イベント詳細', data['event-detail']],
    ['SNS リンク', data.sns],
    ['関連 URL', data['related-url']],
    ['備考', data.notes],
    ['添付資料', fileLabel],
  ]));
}

/* ---------- File upload UI ---------- */
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024;       // 10MB
const MAX_TOTAL = 30 * 1024 * 1024;      // 30MB

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderFileList() {
  const list = document.querySelector('[data-file-list]');
  if (!list) return;
  while (list.firstChild) list.removeChild(list.firstChild);
  state.uploadedFiles.forEach((f, idx) => {
    const item = el('li', { class: 'c-file-list__item' },
      el('span', {}, '📄'),
      el('span', { class: 'c-file-list__name' }, f.name),
      el('span', { class: 'c-file-list__size' }, formatBytes(f.size)),
      el('button', {
        type: 'button',
        class: 'c-file-list__remove',
        'aria-label': `${f.name} を削除`,
        on: {
          click: () => {
            state.uploadedFiles.splice(idx, 1);
            renderFileList();
          },
        },
      }, '×'),
    );
    list.appendChild(item);
  });
}

function addFiles(files) {
  const errMsg = document.querySelector('[data-error-for="files"]');
  if (errMsg) errMsg.setAttribute('hidden', '');
  const errors = [];
  Array.from(files).forEach(file => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: 対応していないファイル形式です。`);
      return;
    }
    if (file.size > MAX_SIZE) {
      errors.push(`${file.name}: 1 ファイル 10MB を超えています。`);
      return;
    }
    state.uploadedFiles.push(file);
  });
  const total = state.uploadedFiles.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL) {
    errors.push('合計サイズが 30MB を超えました。一部のファイルが追加されていません。');
    while (state.uploadedFiles.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) {
      state.uploadedFiles.pop();
    }
  }
  if (errors.length && errMsg) {
    errMsg.textContent = errors.join(' / ');
    errMsg.removeAttribute('hidden');
  }
  renderFileList();
}

function initFileDrop() {
  const drop = document.querySelector('[data-file-drop]');
  if (!drop) return;
  const input = drop.querySelector('input[type="file"]');
  const pickBtn = drop.querySelector('[data-file-pick]');

  pickBtn?.addEventListener('click', () => input?.click());
  drop.addEventListener('click', (e) => {
    if (e.target === drop || e.target.classList.contains('c-file-drop__title') || e.target.classList.contains('c-file-drop__hint') || e.target.classList.contains('c-file-drop__icon')) {
      input?.click();
    }
  });
  input?.addEventListener('change', () => {
    if (input.files) addFiles(input.files);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('is-dragover');
  }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });
}

/* ---------- Choice card visual sync ---------- */
function initChoiceCards() {
  document.querySelectorAll('.c-choice-card').forEach(card => {
    const input = card.querySelector('input');
    if (!input) return;
    const sync = () => {
      card.classList.toggle('is-selected', input.checked);
    };
    input.addEventListener('change', sync);
    sync();
  });
}

/* ---------- Step navigation ---------- */
function initNav() {
  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ok = validateStep(state.currentStep);
      if (!ok) return;
      const next = Math.min(TOTAL_STEPS, state.currentStep + 1);
      showStep(next);
    });
  });
  document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prev = Math.max(1, state.currentStep - 1);
      showStep(prev);
    });
  });
}

/* ---------- Live availability feedback (Step 1) ---------- */
function initAvailability() {
  const dateInput = document.getElementById('date');
  const start = document.getElementById('start-time');
  const end = document.getElementById('end-time');
  const fb = document.getElementById('availability-feedback');
  if (!dateInput || !fb) return;

  const update = async () => {
    const d = dateInput.value;
    const s = start?.value;
    const e = end?.value;
    while (fb.firstChild) fb.removeChild(fb.firstChild);
    if (!d) {
      fb.setAttribute('hidden', '');
      return;
    }
    const events = await loadEvents();
    const sameDay = events.filter(ev => ev.date === d);
    const overlap = (s && e) ? sameDay.filter(ev => !(e <= ev.start || s >= ev.end)) : [];

    let alertClass = 'c-alert--success';
    let icon = '✓';
    let msg;

    const [yy, mm, dd] = d.split('-').map(Number);
    const dateLabel = `${yy} 年 ${mm} 月 ${dd} 日`;

    if (sameDay.length === 0) {
      msg = `${dateLabel} は終日空いています。${(s && e) ? `${s} 〜 ${e} で予約に進めます。` : ''}`;
    } else if (overlap.length > 0) {
      alertClass = 'c-alert--warning';
      icon = '⚠';
      const conflicts = overlap.map(ev => `${ev.start}–${ev.end}「${ev.title}」`).join(', ');
      msg = `${dateLabel} の希望時間は予約と重複しています：${conflicts}`;
    } else if (s && e) {
      msg = `${dateLabel} ${s} 〜 ${e} は予約可能です。他の時間帯に既存予約があります（${sameDay.length}件）。`;
    } else {
      alertClass = 'c-alert--info';
      icon = 'ℹ︎';
      msg = `${dateLabel} には既存予約が ${sameDay.length} 件あります。開始・終了時間を選ぶと重複の有無を確認します。`;
    }

    fb.appendChild(
      el('div', { class: `c-alert ${alertClass}` },
        el('span', { class: 'c-alert__icon', 'aria-hidden': 'true' }, icon),
        el('div', {}, msg)
      )
    );
    fb.removeAttribute('hidden');
  };

  dateInput.addEventListener('change', update);
  start?.addEventListener('change', update);
  end?.addEventListener('change', update);
}

/* ---------- Submission ---------- */
function initSubmit() {
  const form = document.getElementById('reserve-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Validate all steps once more
    let ok = true;
    for (let i = 1; i <= 5; i++) {
      if (!validateStep(i)) { ok = false; }
    }
    if (!ok) {
      const firstErrorStep = [1, 2, 3, 4, 5].find(n => state.validationErrors[n]?.length);
      if (firstErrorStep) showStep(firstErrorStep);
      return;
    }

    const submitBtn = form.querySelector('[data-submit]');
    submitBtn.setAttribute('disabled', 'disabled');
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.textContent = '送信しています…';

    const data = collectFormData();
    const endpoint = form.dataset.endpoint || '';

    let success = !endpoint; // demo: no endpoint → simulate success
    let errorMsg = '';
    if (endpoint) {
      try {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (Array.isArray(v)) v.forEach(item => fd.append(k, typeof item === 'object' ? JSON.stringify(item) : item));
          else fd.append(k, v);
        });
        state.uploadedFiles.forEach(f => fd.append('files', f));
        const res = await fetch(endpoint, { method: 'POST', body: fd });
        success = res.ok;
        if (!success) errorMsg = `送信に失敗しました（HTTP ${res.status}）。`;
      } catch (err) {
        success = false;
        errorMsg = 'ネットワークエラーが発生しました。';
      }
    } else {
      // Demo mode: pause to simulate
      await new Promise(r => setTimeout(r, 800));
    }

    submitBtn.removeAttribute('disabled');
    submitBtn.removeAttribute('aria-busy');
    submitBtn.textContent = '予約リクエストを送信する';

    const result = document.getElementById('submit-result');
    if (!result) return;
    while (result.firstChild) result.removeChild(result.firstChild);

    if (success) {
      result.appendChild(
        el('div', { class: 'c-alert c-alert--success', style: { marginTop: '20px' } },
          el('span', { class: 'c-alert__icon', 'aria-hidden': 'true' }, '✓'),
          el('div', {},
            el('strong', {}, '送信が完了しました。'),
            el('p', { style: { marginTop: '6px', fontWeight: '400' } }, 'ご入力いただいたメールアドレスに受付確認メールを送信しました。数日以内に運営から内容確認のご連絡をいたします。'),
            el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' } },
              el('a', { class: 'c-button c-button--primary c-button--sm', href: 'event-log.html' }, '開催ログを見る'),
              el('a', { class: 'c-button c-button--ghost-dark c-button--sm', href: 'guidelines.html' }, 'ガイドラインを見る'),
            )
          )
        )
      );
      result.removeAttribute('hidden');
      // Reset form (optional)
      // form.reset(); state.uploadedFiles = []; renderFileList();
    } else {
      result.appendChild(
        el('div', { class: 'c-alert c-alert--error', style: { marginTop: '20px' } },
          el('span', { class: 'c-alert__icon', 'aria-hidden': 'true' }, '⚠'),
          el('div', {},
            el('strong', {}, '送信に失敗しました。'),
            el('p', { style: { marginTop: '6px', fontWeight: '400' } }, errorMsg || '時間をおいて再度お試しください。'),
            el('div', { style: { marginTop: '12px' } },
              el('button', {
                type: 'button',
                class: 'c-button c-button--primary c-button--sm',
                on: { click: () => form.requestSubmit() },
              }, '再送信する')
            )
          )
        )
      );
      result.removeAttribute('hidden');
    }
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('reserve-form')) return;
  fillTimeSelects();
  initChoiceCards();
  initFileDrop();
  initNav();
  initAvailability();
  initSubmit();
  updateStepper();
});
