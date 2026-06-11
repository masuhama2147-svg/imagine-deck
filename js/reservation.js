/* reservation.js — 6-step reservation form (DOM-built; no innerHTML for data)
   ・予約はログイン必須（未ログインはログイン/新規登録へ誘導）
   ・メールアドレスで学内(無料)／学外(有料)を自動判別して表示
   ・送信時は Firestore の reservations に保存（reportReminderSent:false で終了後メール連携） */

import { loadEvents, el } from './calendar.js';
import { auth, db } from './firebase.js';
import { onAuth, roleOf, renderAuthPreview } from './auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js';
import { sendEmailVerification } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';
import { openModal } from './main.js';

const HOURLY_RATE = 1160;     // 学外：1時間あたり（円）
const EXHIBITION_FEE = 15080; // 展示特例：準備+撤去 計13時間分（円）

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
  user: null,
  role: 'guest',
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
  'teacher-consent': '担当教員の了解',
  'purpose-type': '利用目的タイプ',
  'purpose-other': '簡単な内容（その他）',
  'reserve-type': '予約形態',
  audience: '参加形態',
  academic: '学術イベントかどうか',
  capacity: 'のべ参加人数',
  catering: '飲食',
  area: '利用箇所',
  'project-name': '企画名',
  purpose: '利用目的',
  'event-detail': 'イベント詳細',
  sns: 'SNS リンク',
  'related-url': '関連 URL',
  files: '添付資料',
  notes: '備考',
};

const FIELDS_BY_STEP = {
  1: ['date', 'start-time', 'end-time'],
  2: ['org-name', 'student-name', 'student-email', 'staff-name', 'staff-email', 'teacher-consent'],
  3: ['purpose-type', 'purpose-other', 'reserve-type', 'audience', 'academic', 'capacity', 'catering'],
  4: ['area'],
  5: ['project-name', 'purpose', 'event-detail', 'sns', 'related-url', 'notes'],
};

const PURPOSE_LABEL = { exhibition: '展示', event: 'イベント・発表・交流', workshop: 'ワークショップ', other: 'その他' };
const RESERVE_LABEL = { shared: '通常利用（共有）', exclusive: '専有利用（貸切）' };
const AUDIENCE_LABEL = { public: '一般公開', campus: '学内のみ', closed: '関係者のみ' };
const ACADEMIC_LABEL = { academic: '学術イベント', 'non-academic': '学術以外' };
const CATERING_LABEL = { none: 'なし', snacks: '軽食あり（要相談・専任教員同席）' };
const AREA_LABEL = { wall: '壁面', 'floor-all': 'フロア全体（カウンター含む）' };

/* ---------- 料金（学内無料／学外有料）ヘルパー ---------- */
function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(end).split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}
function yen(n) { return '¥' + Number(n || 0).toLocaleString('ja-JP'); }

/* 学外の方だけ、STEP1 に料金案内（仮予約・2段階手続き＋概算）を表示する。
   役割（管理者/大学関係者/学外）の表示はヘッダーのアカウントメニューに集約し、本文には出さない。 */
function renderFeeEstimate() {
  const box = document.getElementById('fee-estimate');
  if (!box) return;
  if (state.role !== 'external') { box.hidden = true; box.replaceChildren(); box.className = ''; return; }
  const start = document.getElementById('start-time')?.value;
  const end = document.getElementById('end-time')?.value;
  const h = hoursBetween(start, end);
  // STEP1 は簡潔な気づきだけ（詳しい料金・仮予約・2段階手続きは確認画面⑥で強調表示）
  box.className = 'c-fee-line';
  const feeChildren = [el('span', { class: 'c-fee-line__label' }, '施設使用料 ・ 学外（仮予約）')];
  if (h) {
    feeChildren.push(el('p', { class: 'c-fee-line__amount' },
      `${yen(Math.round(h * HOURLY_RATE))} `,
      el('small', {}, `概算（${h}時間 × ${yen(HOURLY_RATE)}）`)));
  } else {
    feeChildren.push(el('p', { class: 'c-fee-line__hint' }, '日時を選ぶと概算を表示します'));
  }
  feeChildren.push(el('p', { class: 'c-fee-line__sub' }, '学外の方は利用希望日の56日前までにお申し込みください。詳しい手続き（承認 → 事務局が請求書をご連絡 → お支払い）は確認画面でご案内します。'));
  box.replaceChildren(...feeChildren);
  box.hidden = false;
}

function prefillFromUser(user) {
  const emailInput = document.getElementById('student-email');
  if (emailInput && !emailInput.value) emailInput.value = user.email || '';
}

/* ---------- ログイン必須ゲート（予約はログイン必須＋メール確認必須） ---------- */
let agreementInitialized = false;
function initAuthGate() {
  const gate = document.getElementById('reserve-login-gate');
  const verifyGate = document.getElementById('reserve-verify-gate');
  const agreement = document.getElementById('reserve-agreement');
  const formSection = document.getElementById('reserve-form-section');
  const hideGated = () => {
    if (agreement) agreement.hidden = true;
    if (formSection) formSection.style.display = 'none';
  };
  // 認証状態が分かるまでは規約・フォームを隠す（ちらつき防止）
  hideGated();

  // 【ローカル開発専用プレビュー】 localhost のみ有効。本番ドメインでは location.hostname が
  // 一致しないため決して発動しない。?preview=external / university / staff で各ユーザー版を
  // ログインなしで即確認できる（表示確認用。送信はエミュレータのログインが必要）。
  // localhost、または Firebase プレビューchannel（ホスト名に "--" を含む）でのみ有効。本番(.web.app直)では発動しない。
  const previewHost = ['localhost', '127.0.0.1'].includes(location.hostname) || location.hostname.includes('--') || location.hostname.endsWith('.github.io');
  const preview = previewHost ? new URLSearchParams(location.search).get('preview') : null;
  if (preview && ['external', 'university', 'staff'].includes(preview)) {
    state.user = { displayName: '', email: '', emailVerified: true };
    state.role = preview;
    if (gate) gate.hidden = true;
    if (verifyGate) verifyGate.hidden = true;
    if (agreement) agreement.hidden = false;
    renderAuthPreview(preview);  // ヘッダーのアカウントメニュー（役割はここで分かる）
    renderFeeEstimate();          // 学外のみ STEP1 に料金案内
    if (!agreementInitialized) { initAgreementGate(); agreementInitialized = true; }
    return; // 実際の認証監視はスキップ（プレビュー表示のみ）
  }

  onAuth((user) => {
    state.user = user || null;
    state.role = user ? roleOf(user) : 'guest';
    // 未ログイン → ログイン誘導
    if (!user) {
      if (gate) gate.hidden = false;
      if (verifyGate) verifyGate.hidden = true;
      hideGated();
      return;
    }
    // ログイン済みだがメール未確認 → 確認を促す
    if (!user.emailVerified) {
      if (gate) gate.hidden = true;
      if (verifyGate) verifyGate.hidden = false;
      hideGated();
      setupVerifyGate(user);
      return;
    }
    // ログイン済み＋メール確認済み → 予約可能（役割表示はヘッダーのアカウントメニュー）
    if (gate) gate.hidden = true;
    if (verifyGate) verifyGate.hidden = true;
    if (agreement) agreement.hidden = false;
    renderFeeEstimate();
    prefillFromUser(user);
    if (!agreementInitialized) { initAgreementGate(); agreementInitialized = true; }
  });
}

function setupVerifyGate(user) {
  const reload = document.getElementById('reload-after-verify');
  const resend = document.getElementById('resend-verify');
  const result = document.getElementById('resend-result');
  if (reload && !reload.dataset.wired) {
    reload.dataset.wired = '1';
    reload.addEventListener('click', () => location.reload());
  }
  if (resend && !resend.dataset.wired) {
    resend.dataset.wired = '1';
    resend.addEventListener('click', async () => {
      resend.disabled = true;
      try {
        await sendEmailVerification(user);
        if (result) {
          result.textContent = '確認メールを再送しました。受信箱（迷惑メールも）をご確認のうえ、リンクを開いてから「確認した（再読み込み）」を押してください。';
          result.hidden = false;
        }
      } catch (e) {
        if (result) { result.textContent = '再送に失敗しました：' + (e?.message || e); result.hidden = false; }
      }
      setTimeout(() => { resend.disabled = false; }, 30000);
    });
  }
}

function initFeeWatchers() {
  ['start-time', 'end-time'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', renderFeeEstimate);
  });
  document.querySelectorAll('[name="purpose-type"]').forEach((r) => r.addEventListener('change', renderFeeEstimate));
}

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

  // 担当教員の了解（チェック必須）
  if (name === 'teacher-consent') {
    return els[0].checked ? null : '担当教員の了解の確認にチェックしてください。';
  }
  // 「その他」の簡単な内容は、利用目的タイプ=その他 のときだけ必須
  if (name === 'purpose-other') {
    const pt = form.querySelector('[name="purpose-type"]:checked')?.value;
    if (pt !== 'other') return null;
    return value ? null : '「その他」を選んだ場合は簡単な内容を入力してください。';
  }

  // Required check
  const required = first.hasAttribute('required') || first.closest('[aria-required="true"]');
  if (required) {
    if (Array.isArray(value) ? value.length === 0 : !value) {
      const verb = isCheckboxOrRadio ? '選択' : '入力';
      return `${FIELD_LABELS[name] || name}を${verb}してください。`;
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
    if (!Number.isFinite(n) || n < 1) return '延べ参加人数は 1 以上の数字で入力してください。';
  }
  if (name === 'event-detail' && value.length < 100) {
    return `イベント詳細は100文字以上で入力してください（現在 ${value.length} 文字）。`;
  }
  // 学外の方は、利用希望日の56日前までに申し込む必要がある（事務処理・請求のため）
  if (name === 'date' && state.role === 'external') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sel = new Date(`${value}T00:00:00`);
    const diffDays = Math.round((sel - today) / 86400000);
    if (Number.isFinite(diffDays) && diffDays < 56) {
      return `学外の方は、利用希望日の56日前までにお申し込みください（選択日は約 ${diffDays} 日後）。`;
    }
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
              const target = document.getElementById(err.name)
                || document.querySelector(`[name="${err.name}"]:not([disabled])`)
                || document.querySelector(`[name="${err.name}"]`);
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

  // 学外の方：確認画面(STEP6)の先頭に「料金・仮予約・2段階手続き」を強調表示する
  if (state.role === 'external') {
    const h = hoursBetween(data['start-time'], data['end-time']);
    const fee = el('div', { class: 'c-fee-notice c-fee-notice--paid', style: { marginBottom: '22px' } },
      el('p', { class: 'c-fee-notice__title' }, '施設使用料 ・ 学外（仮予約）'),
      el('p', { class: 'c-fee-notice__amount' },
        h ? `${yen(Math.round(h * HOURLY_RATE))} ` : '日時が未選択です',
        h ? el('small', {}, `概算（${h}時間 × ${yen(HOURLY_RATE)}）`) : null),
      el('p', { class: 'c-fee-notice__text' }, '学外の方は、利用希望日の56日前までにお申し込みください。送信後の流れ ── ①運営が申請を承認 → ②事務局が内容を確認し、請求書等をメールでご連絡 → ③お支払いで確定します。'),
    );
    if (data['purpose-type'] === 'exhibition') {
      fee.appendChild(el('p', { class: 'c-fee-notice__text' }, `※展示利用は準備・撤去で別途 ${yen(EXHIBITION_FEE)} が必須（展示会期中は無料）`));
    }
    wrap.appendChild(fee);
  }

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
  const h = hoursBetween(data['start-time'], data['end-time']);
  const roleLine = state.role === 'external' ? '学外（有料）'
    : (state.role === 'staff' ? '管理者' : '大学関係者（無料）');
  const feeLine = state.role === 'external'
    ? `${yen(Math.round(h * HOURLY_RATE))}（概算：${h}時間 × ${yen(HOURLY_RATE)}）`
    : (state.role === 'staff' ? '—（管理者）' : '無料（大学関係者）');
  const feeRows = [
    ['利用日', dateLabel],
    ['利用時間', timeLabel],
    ['料金区分', roleLine],
    ['施設使用料（概算）', feeLine],
  ];
  if (state.role === 'external' && data['purpose-type'] === 'exhibition') {
    feeRows.push(['展示特例', `別途 ${yen(EXHIBITION_FEE)}（準備・撤去 計13時間分）が必須`]);
  }
  wrap.appendChild(card('日時・料金', 1, feeRows));
  wrap.appendChild(card('主催者情報', 2, [
    ['主催者・団体名', data['org-name']],
    ['担当学生', `${data['student-name']}（${data['student-email']}）`],
    ['担当教員・職員', `${data['staff-name']}（${data['staff-email']}）`],
    ['担当教員の了解', (Array.isArray(data['teacher-consent']) ? data['teacher-consent'].length : data['teacher-consent']) ? '確認済み' : '未確認'],
  ]));
  const purposeTypeLabel = data['purpose-type'] === 'other'
    ? `その他（${data['purpose-other'] || '未入力'}）`
    : (PURPOSE_LABEL[data['purpose-type']] || '');
  wrap.appendChild(card('利用内容', 3, [
    ['利用目的タイプ', purposeTypeLabel],
    ['予約形態', RESERVE_LABEL[data['reserve-type']] || ''],
    ['参加形態', AUDIENCE_LABEL[data['audience']] || ''],
    ['学術かどうか', ACADEMIC_LABEL[data['academic']] || ''],
    ['のべ参加人数', data.capacity ? `${data.capacity} 名` : ''],
    ['飲食', CATERING_LABEL[data.catering] || ''],
  ]));
  wrap.appendChild(card('利用箇所', 4, [
    ['利用箇所', AREA_LABEL[data.area] || data.area || ''],
  ]));
  const fileLabel = state.uploadedFiles.length
    ? state.uploadedFiles.map(f => `${f.name}（${formatBytes(f.size)}）`).join(', ')
    : '添付なし';
  wrap.appendChild(card('詳細・添付資料', 5, [
    ['企画名', data['project-name']],
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
  const cards = Array.from(document.querySelectorAll('.c-choice-card'));
  // ラジオは「変更があったカード」しか change が飛ばないため、変更時は全カードを再同期して
  // 前に選ばれていたカードの“選択済み”表示が残らない（=複数選択に見えない）ようにする。
  const syncAll = () => cards.forEach((card) => {
    const input = card.querySelector('input');
    if (input) card.classList.toggle('is-selected', input.checked);
  });
  cards.forEach((card) => {
    const input = card.querySelector('input');
    if (input) input.addEventListener('change', syncAll);
  });
  syncAll();
}

/* ---------- 利用目的に連動した表示（その他欄／利用箇所／貸切制御） ---------- */
function syncPurposeDependents() {
  const pt = document.querySelector('[name="purpose-type"]:checked')?.value;
  const otherField = document.getElementById('purpose-other-field');
  if (otherField) otherField.hidden = pt !== 'other';
  if (pt !== 'other') clearError('purpose-other'); // 「その他」以外に切替えたら残ったエラーを消す
  const isExhibition = pt === 'exhibition';
  // 利用箇所：目的に応じて出し分け。選択肢が1つだけなら自動選択。
  document.querySelectorAll('[data-area-set]').forEach((set) => {
    const match = set.dataset.areaSet === (isExhibition ? 'exhibition' : 'other');
    set.hidden = !match;
    const radios = set.querySelectorAll('input[name="area"]');
    radios.forEach((r) => {
      r.disabled = !match;
      if (!match && r.checked) r.checked = false;
    });
    if (match && pt && radios.length === 1 && !radios[0].checked) radios[0].checked = true;
  });
  // 展示は壁面のみ・貸切不可 → 予約形態の「専有(貸切)」を無効化して「共有」に固定
  applyExhibitionReserveLock(isExhibition);
  // 選択カードの見た目を全同期（前の選択が残らないように）
  document.querySelectorAll('.c-choice-card').forEach((card) => {
    const i = card.querySelector('input'); if (i) card.classList.toggle('is-selected', i.checked);
  });
  renderFeeEstimate();
}

function applyExhibitionReserveLock(isExhibition) {
  const exclusive = document.querySelector('[name="reserve-type"][value="exclusive"]');
  const shared = document.querySelector('[name="reserve-type"][value="shared"]');
  const hint = document.querySelector('[data-area-hint]');
  if (isExhibition) {
    if (exclusive) { exclusive.disabled = true; if (exclusive.checked) exclusive.checked = false; }
    if (shared) shared.checked = true;
    if (hint) { hint.textContent = '展示は「壁面のみ・貸切不可」です。予約形態は自動的に「通常利用（共有）」になります。'; hint.hidden = false; }
  } else {
    if (exclusive) exclusive.disabled = false;
    if (hint) { hint.hidden = true; hint.textContent = ''; }
  }
}

function initConditionalForm() {
  document.querySelectorAll('[name="purpose-type"]').forEach((r) => r.addEventListener('change', syncPurposeDependents));
  syncPurposeDependents();
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

    // 予約はログイン必須。万一ログインが切れていたらログインへ。
    const user = auth.currentUser;
    if (!user) { location.href = 'login.html?next=reserve.html'; return; }

    const submitBtn = form.querySelector('[data-submit]');
    submitBtn.setAttribute('disabled', 'disabled');
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.textContent = '送信しています…';

    const data = collectFormData();
    const role = roleOf(user);
    const feeType = role === 'external' ? 'paid' : 'free';
    const hrs = hoursBetween(data['start-time'], data['end-time']);
    const estimatedFee = feeType === 'paid' ? Math.round(hrs * HOURLY_RATE) : 0;

    // Firestore に保存する予約データ（ルールで uid==auth.uid が必須）
    const reservation = {
      uid: user.uid,
      reserverEmail: user.email || '',
      status: 'pending',
      reportReminderSent: false, // ← 終了30分後の自動メール対象フラグ
      role, feeType, estimatedFee, hours: hrs,
      date: data.date || '',
      startTime: data['start-time'] || '',
      endTime: data['end-time'] || '',
      orgName: data['org-name'] || '',
      studentName: data['student-name'] || '',
      studentEmail: data['student-email'] || '',
      staffName: data['staff-name'] || '',
      staffEmail: data['staff-email'] || '',
      projectName: data['project-name'] || '',
      purposeType: data['purpose-type'] || '',
      purposeOther: data['purpose-type'] === 'other' ? (data['purpose-other'] || '') : '',
      reserveType: data['reserve-type'] || '',
      audience: data.audience || '',
      academic: data.academic || '',
      capacity: Number(data.capacity) || null,
      catering: data.catering || '',
      area: data.area || '',
      teacherConsent: Array.isArray(data['teacher-consent']) ? data['teacher-consent'].length > 0 : !!data['teacher-consent'],
      purpose: data.purpose || '',
      eventDetail: data['event-detail'] || '',
      sns: data.sns || '',
      relatedUrl: data['related-url'] || '',
      notes: data.notes || '',
      attachments: (state.uploadedFiles || []).map(f => ({ name: f.name, size: f.size, type: f.type })),
      createdAt: serverTimestamp(),
    };

    let success = false;
    let errorMsg = '';
    try {
      await addDoc(collection(db, 'reservations'), reservation);
      success = true;
    } catch (err) {
      success = false;
      errorMsg = '送信に失敗しました：' + (err?.message || err);
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
            el('strong', {}, '予約リクエストを送信しました。'),
            el('p', { style: { marginTop: '6px', fontWeight: '400' } }, '運営（イマジン・デッキ運営会議）が内容を確認し、仮承認の可否をご連絡します。学外の方は別途「施設一時使用申込書」のご提出が必要です。終了後には開催報告のご案内メールをお送りします。'),
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

/* ---------- Agreement gate (rules must be agreed before the form) ---------- */
function initAgreementGate() {
  const agree = document.getElementById('agree-terms');
  const proceed = document.getElementById('agree-proceed');
  const formSection = document.getElementById('reserve-form-section');
  if (!agree || !proceed || !formSection) return;
  formSection.style.display = 'none';                 // JS-driven gate (cache-proof)
  agree.addEventListener('change', () => { proceed.disabled = !agree.checked; });
  proceed.addEventListener('click', () => {
    if (!agree.checked) return;
    formSection.style.display = '';                    // reveal
    formSection.classList.add('is-revealed');
    proceed.textContent = '予約フォームへ ↓';
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t = document.getElementById('step1-title');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
  });
}

/* ---------- Rules points: auto-open each card as it scrolls into view (mobile) ---------- */
function initRulesAutoOpen() {
  const points = document.querySelectorAll('.c-rules__point');
  if (!points.length) return;
  if (!('IntersectionObserver' in window)) {
    points.forEach(p => p.classList.add('is-open'));   // fallback: open all
    return;
  }
  // Open when the card enters the central "reading band", close cleanly when it leaves
  // → only the card(s) in focus are expanded (minimal at-a-glance information).
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => e.target.classList.toggle('is-open', e.isIntersecting));
  }, { rootMargin: '-8% 0px -45% 0px', threshold: 0 });
  points.forEach(p => io.observe(p));
}

/* ---------- 施設の様子ギャラリー（写真クリックでライトボックス拡大） ---------- */
function initSpaceGallery() {
  const lb = document.getElementById('space-lightbox');
  const lbImg = document.getElementById('space-lightbox-img');
  const lbCap = document.getElementById('space-lightbox-cap');
  if (!lb || !lbImg) return;
  const open = (fig) => {
    const img = fig.querySelector('img');
    if (!img) return;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    if (lbCap) lbCap.textContent = fig.querySelector('figcaption')?.textContent || '';
    openModal(lb);
  };
  document.querySelectorAll('[data-lightbox]').forEach((fig) => {
    fig.addEventListener('click', () => open(fig));
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(fig); }
    });
  });
}

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initRulesAutoOpen();
  if (document.getElementById('reserve-form')) {
    fillTimeSelects();
    initChoiceCards();
    initFileDrop();
    initNav();
    initAvailability();
    initFeeWatchers();
    initConditionalForm();
    initSpaceGallery();
    initSubmit();
    updateStepper();
  }
  // ログイン状態に応じて「ログインゲート / 料金バナー / 規約・フォーム」を出し分け
  initAuthGate();
});
