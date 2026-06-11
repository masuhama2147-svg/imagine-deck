<!-- Tesla-inspired design system + progressive-disclosure UX. Owner directive: make it like tesla.com/ja_jp, step-by-step disclosure, keep prior good parts. 作成 2026-06-04. -->

# テスラ流 Imagine Deck デザインシステム & 段階的開示UX

**公式ドキュメント | 2026-06-04**
**愛媛大学ミュージアム 交流スペース公式サイト（旧：Imagine Deck）**

---

## 1. デザイン原則 — テスラ式ミニマリズム

本ドキュメントは、**Tesla公式サイト** (https://www.tesla.com/ja_jp) の設計言語を Imagine Deck に適応させるマスターリファレンスです。6つの中核原則に基づいています：

| 原則 | 説明 |
|------|------|
| **ミニマル色彩** | 白/黒/グレイ + 紫(#8b168f)単一アクセントのみ。装飾グラデーション撤廃。 |
| **画像主役制** | 各セクションは大判画像(60–80% viewport幅) + 最小テキスト(1–3行) + 1CTAのみ。 |
| **1画面1メッセージ** | 全ビューポートパネル(85svh) で1つの視覚的物語。セクション間は清潔なスクロール遷移。 |
| **紫アクセント専用** | 主要CTA・フォーカスリング・進捗バーのみ #8b168f 使用。他は黒/グレイ/白。 |
| **静かなモーション** | スクロール開示: fade + 20px上移動を800msかけて（bounce/spring無し）。パララックス深度 ≤0.04。ホバー: shadow + opacity shift 0.9–0.95。 |
| **段階的開示** | 予約フロー: ステップごとに必須情報のみ表示。詳細説明・条件付きフィールドは「詳細」expand や focus時に just-in-time ガイダンス表示。 |

---

## 2. デザイントークン再調整（css/base.css）

### 2-1 色彩規律 — Ink/White + Single Accent

**現状（L26–43 の semantic色）:**
```css
--color-primary: #8b168f (purple)
--color-primary-light: #f7e8f8 (pale lavender)
--color-primary-soft: #e8d5f2 (softer lavender)
--color-primary-dark: #6b1370 (darker purple)
--color-accent: #f4a93a (gold)
--color-accent-light: #f4d96a (lighter gold)
--color-bg: #f7f7f4 (beige)
--color-surface: #ffffff (white)
--color-text: #1a1a1a (dark)
--color-text-muted: #5b6470 (gray)
--color-text-soft: #a0a5ab (lighter gray)
--color-border: #d4d4d0 (light border)
```

**改定（テスラ式シンプル化）:**
```css
/* アクセント（紫）: CTA・フォーカス・進捗のみ */
--color-primary: #8b168f (keep as-is)

/* 背景・サーフェス: グレイスケール化 */
--color-primary-light: #f5f5f5 (← #f7e8f8 から neutral gray へ)
--color-primary-soft: #fafafa (← #e8d5f2 から lighter gray へ)
--color-primary-dark: #1a1a1a (← #6b1370 から near-black へ, type用)

/* 金色削減: 極少数のCTA/tag のみ */
--color-accent: #8b168f (← #f4a93a から purple へ統一, or削除して --color-primary を再利用)
--color-accent-light: remove （装飾gradient削減）

/* 背景統一: 白基調 */
--color-bg: #ffffff (← #f7f7f4 から pure white へ)
--color-surface: #ffffff (keep as-is)

/* テキスト: 高コントラスト保持 */
--color-text: #1a1a1a (keep as-is)
--color-text-muted: #6b7280 (← #5b6470 から若干ライト, より読みやすく)
--color-text-soft: #9ca3af (← #a0a5ab から統一色へ)

/* ボーダー: ウルトラライト */
--color-border: #e5e5e0 (← #d4d4d0 から薄く, 1pxで十分)
```

**カラーパレット影響マップ:**
- `.c-feature` 背景: white (← --color-primary-light 削除)
- `.c-button--primary` 背景: #8b168f (keep), ホバー opacity 0.9 (shadow削除)
- `.c-button--secondary` 背景: white, border: 1px #ccc (← no gradient)
- `.l-section--accent` 背景: #f5f5f5 (← --color-primary-light 使用, 装飾なし)
- `.c-card` shadow: 0 1px 3px rgba(0,0,0,0.08) (← 影最小化)
- `.c-alert` border-left: 3px --color-primary (keep)
- すべてのグラデーション overlay: 削除または単色へ (例: `.p-hero::before` 紫/金メッシュ削除 → linear-gradient rgba(0,0,0,0.3–0.5) のみ)

---

### 2-2 タイプ・スケール（流動型 + 日本語最適化）

**現状:**
```css
--fs-hero: clamp(3rem, 9vw, 4.75rem)
--fs-h1: clamp(2rem, 5vw, 3.5rem)
--fs-h2: clamp(1.5rem, 3vw, 2.5rem)
--fs-h3: 1.25rem
--fs-body: 1rem
--lh-body: 1.7
```

**改定（テスラ式シンプル + 日本語可読性）:**
```css
/* Hero: テスラ参考に縮小 */
--fs-hero: clamp(2.5rem, 6vw, 4rem) (← 3.5–4rem の狭い幅, 4.75rem削除)

/* H1–H3: 段階比を1.3x に統一（テスラ: 1.4–1.5x） */
--fs-h1: clamp(2rem, 4.5vw, 3rem)
--fs-h2: clamp(1.5rem, 3vw, 2.25rem)
--fs-h3: clamp(1.125rem, 2vw, 1.375rem) (← 1.25rem fixed → fluid)

/* Body: 16px 中心キープ（iOS自動zoom回避） */
--fs-body: clamp(0.95rem, 1vw, 1.0625rem) (← 1rem → 15–17px範囲, 日本語フロー読みに最適)

/* 行高: 日本語段落 readable → 1.75以上 */
--lh-body: 1.75 (← 1.7)
--lh-heading: 1.2 (← default 1.5 で tight化, 見出し空間圧縮)

/* NEW: テキスト幅制限（日本語読み） */
--measure: 68ch (英語参考)
--measure-cjk: 40ch (← 日本語目安: 1行 40字前後, 40字=約600px / 15px font)
```

**適用:水平方向:**
```css
/* articles, p.c-section__body に適用 */
max-width: var(--measure-cjk);
text-wrap: balance; /* h1–h3 に */
text-wrap: pretty; /* p に */
```

---

### 2-3 スペーシング & ラディ（テスラ式タイト化）

**現状:**
```css
--space-1: 4px
--space-2: 8px
--space-3: 16px
--space-4: 24px
--space-5: 32px
--space-6: 48px
--space-7: 64px

--radius-sm: 10px
--radius-md: 16px
--radius-lg: 24px
--radius-xl: 32px
--radius-pill: 999px
```

**改定:**
```css
/* スペーシング: デフォルト spacing-4(24px) → spacing-3(16px) へ */
--space-1: 4px (keep)
--space-2: 8px (keep)
--space-3: 16px (default gap/margin)
--space-4: 24px (large spacing)
--space-5: 32px (section margin, 削減候補)
--space-6: 48px (削除または極少使用)
--space-7: 64px (削除)

/* ラディ: テスラ参考に縮小 */
--radius-sm: 6px (← 10px)
--radius-md: 8px (← 16px)
--radius-lg: 12px (← 24px)
--radius-xl: 16px (← 32px, 最大値)
--radius-pill: 6px (← ほぼ 998px を廃止, CTA・hero のみ 999px keep)

/* セクション padding: 垂直方向をタイト化 */
--l-section-padding: clamp(48px, 8vw, 80px) (← clamp(56px, 10vw, 112px))
```

---

### 2-4 シャドウ規律（テスラ最小化）

**削除対象:**
- `.c-card` box-shadow (L76)
- `.c-button--primary` box-shadow (L32)
- `.c-feature` 全shadow
- `.p-hero__visual` drop-shadow (L98–146)

**保持対象 (hover のみ):**
```css
.c-card:hover {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08); /* subtle lift */
}

.c-button--primary:hover {
  opacity: 0.9; /* shadow instead of lift */
  /* remove: transform: translateY(-1px) */
}
```

---

## 3. タイポグラフィ戦略 — 仙台型セリフ+清朝サンスの使い分け

### 3-1 フォント選定

**現状:**
```css
--font-sans: 'Noto Sans JP', -apple-system, …
--font-display: 'Zen Old Mincho', …
```

**改定: テスラ式クリーン + 日本語感性**

| 用途 | フォント | 理由 |
|------|---------|------|
| **UI本体** (h1–h3, body, nav, label, input) | `--font-sans: Noto Sans JP` | テスラ参考: Gotham/Neue Haas Grotesk。清潔性、スキャンして読める、モダン。 |
| **ブレスライン** (h1 decoration, hero tagline, 1–2文のみ) | `--font-display: Zen Old Mincho` | 日本の伝統美（仙台型セリフ）。感情的な瞬間のみ。 |
| **統計数値** (.c-stat__value) | `--font-display: Zen Old Mincho, bold` | 強調値、emotional accent。 |
| **すべてそれ以外** | `--font-sans: Noto Sans JP` | 削除: セリフの乱用。 |

**実装:**

```css
/* base.css L47–54 を修正 */
body {
  font-family: var(--font-sans);
  font-weight: 400;
}

h1, h2, h3 {
  font-family: var(--font-sans);
  font-weight: 700;
  line-height: var(--lh-heading); /* 1.2 */
}

/* hero title のみセリフ許可（L56 改定） */
.p-hero__title {
  font-family: var(--font-display); /* Zen Old Mincho */
  font-size: var(--fs-hero);
  font-weight: 700;
  color: #ffffff;
}

.p-hero__title .t-eyebrow {
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* ラベル・フォームテキスト: 常にサンス */
label, input, select, textarea, .c-field-label {
  font-family: var(--font-sans);
  font-weight: 500 /* 600 */;
}

.c-stat__value {
  font-family: var(--font-display); /* Zen Old Mincho */
  font-weight: 700;
  font-size: var(--fs-h2);
}
```

**日本語可読性最適化:**
- `font-feature-settings: "palt"` → 日本語字間 auto-adjust（Noto Sans JP ネイティブ対応）
- `letter-spacing: 0.01em` 以下（日本語は不要, 欧文みたいな大きなletter-spacingは逆効果）
- `text-rendering: optimizeLegibility` → 日本語フロー読み時の段落リーダビリティ

---

### 3-2 ウェイト・色彩ヒエラルキー（色で判断しない）

**テスラ原則:** 階層は**ウェイト + サイズ**のみ。色は情報, not hierarchy。

```css
/* h1: 700, fs-hero */
h1 { font-weight: 700; font-size: var(--fs-h1); color: #1a1a1a; }

/* h2: 700, fs-h2 */
h2 { font-weight: 700; font-size: var(--fs-h2); color: #1a1a1a; }

/* h3: 700, fs-h3 (← 600 から 700 へ) */
h3 { font-weight: 700; font-size: var(--fs-h3); color: #1a1a1a; }

/* body: 400 (regular) */
body { font-weight: 400; color: #1a1a1a; }

/* label, small.muted: 600, --color-text-muted */
label { font-weight: 600; color: #1a1a1a; }
.c-field-help { font-weight: 400; color: var(--color-text-muted); font-size: 0.875rem; }

/* 紫アクセントの禁止: テキストカラーには使用しない */
/* REMOVE: h1.accent { color: #8b168f; } */
```

---

## 4. レイアウト & コンポーネント — 5層CSS + .l-panel 新規追加

### 4-1 Full-Viewport Panel System (.l-panel)

**新規クラス追加: layout.css の末尾に（L325 以降）**

```css
/* Full-viewport section with scroll-snap (Tesla-style discretely scrolled sections) */
.l-panel {
  position: relative;
  min-height: 100svh; /* svh: address-bar hide/show に対応 */
  display: grid;
  place-items: center;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  padding-block: var(--header-height) 0; /* header下から始まる */
}

.l-panel--hero {
  background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
}

.l-panel--accent {
  background: #f5f5f5;
}

.l-panel--dark {
  background: #1a1a1a;
  color: #ffffff;
}

/* 親コンテナに scroll-snap enable */
html {
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
}
```

**採用対象:**
- `index.html` hero section (.p-hero → .l-panel--hero)
- `reserve.html` hero section
- `calendar.html` hero section
- Optional: `index.html` about / features sections に .l-panel--accent を試験的に適用（既存は .l-section のまま）

**キープ:**
- 既存 `.l-section` は 細い padding rhythm sections に使用継続（full-viewport 不要な page は維持）

---

### 4-2 ナビゲーション条件縮小（layout.css L54–207 改定）

**Header 構造（ミニマルテスラ風）:**

```css
.l-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px; /* ← 72px から削減 */
  background: #ffffff;
  z-index: 100;
  border-bottom: 1px solid transparent;
  transition: border-color 150ms ease-out;
}

/* On scroll, strengthen bottom border (no backdrop blur, shadow minimal) */
body.is-scrolled .l-header {
  border-bottom-color: #e5e5e0;
  /* remove: backdrop-filter: blur(…) */
  /* add optional: box-shadow: 0 1px 3px rgba(0,0,0,0.04); */
}

.l-header__brand-mark {
  width: 28px; /* ← 32px */
  height: 28px;
  background: #ffffff;
  border-radius: 4px; /* ← 6px */
  color: #8b168f;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.l-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.l-header__brand small {
  display: none; /* ← モバイル非表示 */
  font-size: 0.65rem;
}

@media (min-width: 768px) {
  .l-header__brand small {
    display: inline;
  }
}

.l-nav {
  display: flex;
  align-items: center;
  gap: 12px; /* ← 14px から削減 */
}

.l-nav a {
  font-size: 0.9rem; /* ← 1rem から削減, 0.9rem */
  font-weight: 500;
  color: #1a1a1a;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 150ms, color 150ms;
}

.l-nav a:hover {
  background-color: transparent; /* ← no bg shift */
  color: #8b168f; /* ← text color shift のみ */
}

.l-nav a:focus-visible {
  outline: 2px solid #8b168f;
  outline-offset: 3px;
}

/* Header CTA button (if present): de-emphasize or hide on mobile */
.l-header__cta {
  display: none;
}

@media (min-width: 768px) {
  .l-header__cta {
    display: block;
  }
}

.l-header__cta .c-button {
  min-height: 40px; /* ← 48px desktop, 縮小 */
  padding: 10px 20px;
  font-size: 0.9rem;
}
```

---

### 4-3 CTA ボタン・ピル再設計（components.css L6–69）

```css
/* Primary button: rectangular, purple, no shadow */
.c-button--primary {
  background: #8b168f;
  color: #ffffff;
  border: none;
  border-radius: 6px; /* ← 999px pill から削減 */
  padding: 14px 28px;
  min-height: 48px; /* touch target */
  font-size: 1rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 150ms ease-out;
  box-shadow: none; /* ← remove shadow */
}

.c-button--primary:hover {
  opacity: 0.9;
  /* remove: transform: translateY(-1px) */
}

.c-button--primary:focus-visible {
  outline: 2px solid #8b168f;
  outline-offset: 2px;
}

/* Secondary button: outline, white, thin border */
.c-button--secondary {
  background: #ffffff;
  color: #1a1a1a;
  border: 1px solid #ccc; /* ← #d4d4d0 から #ccc へ */
  border-radius: 6px;
  padding: 14px 28px;
  min-height: 48px;
  font-size: 1rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 150ms ease-out;
  box-shadow: none;
}

.c-button--secondary:hover {
  border-color: #8b168f;
  color: #8b168f;
}

.c-button--secondary:focus-visible {
  outline: 2px solid #8b168f;
  outline-offset: 2px;
}

/* Ghost button: transparent, border on dark bg */
.c-button--ghost {
  background: transparent;
  color: #ffffff;
  border: 1px solid #ffffff;
  border-radius: 6px;
  padding: 14px 28px;
  min-height: 48px;
  font-weight: 600;
}

.c-button--ghost:hover {
  opacity: 0.9;
}

/* NEW: Small button variant (for secondary/dense layouts) */
.c-button--sm {
  min-height: 36px;
  padding: 10px 16px;
  font-size: 0.875rem;
}

/* NEW: Large button variant (for prominent CTA) */
.c-button--lg {
  min-height: 56px;
  padding: 16px 32px;
  font-size: 1.125rem;
}

/* Hero buttons only: KEEP pill shape */
.m-pill {
  border-radius: 999px;
}

.m-pill:hover {
  transform: translateY(-1px); /* Hero only: subtle lift OK */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

### 4-4 カード・コンポーネント（components.css L71–1281, 装飾削減）

```css
/* Card: pure white, thin border, no shadow at rest */
.c-card {
  background: #ffffff;
  border: 1px solid #e5e5e0;
  border-radius: var(--radius-md); /* 8px */
  padding: 20px;
  transition: all 150ms ease-out;
}

.c-card:hover {
  /* remove: box-shadow: var(--shadow-card); transform: translateY(-3px); */
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08); /* subtle only */
}

/* Feature card: remove radial gradient header, use solid top border */
.c-feature {
  /* remove: ::before radial gradient (L115) */
}

.c-feature::before {
  /* DELETE this pseudo-element */
}

.c-feature {
  border-top: 3px solid #8b168f;
  /* instead of padding-top: 170px; image header */
}

.c-feature__img {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* Event card: remove gradient overlay, keep stark image */
.c-event-card {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.c-event-card__img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.c-event-card__overlay {
  /* remove: background: linear-gradient(180deg, transparent, rgba(0,0,0,0.8)); */
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.4) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
  color: #ffffff;
}

/* Tag: solid fills only (no gradient) */
.c-tag {
  background: #f5f5f5; /* or #8b168f for event-type tags */
  color: #1a1a1a;
  border: none;
  border-radius: 4px; /* ← pill から削減 */
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.c-tag--event {
  background: #8b168f;
  color: #ffffff;
}

/* Alert: border-left only (no shadow) */
.c-alert {
  border-left: 3px solid #8b168f;
  background: #f5f5f5;
  padding: 12px 16px;
  border-radius: 0; /* or 4px if desired */
  /* remove: box-shadow */
}

.c-alert--info {
  border-left-color: #8b168f;
  background: #f5f5f5;
}

.c-alert--warning {
  border-left-color: #d97706;
  background: #fef3c7;
}

.c-alert--error {
  border-left-color: #dc2626;
  background: #fee2e2;
}
```

---

### 4-5 フォーム・エラーメッセージング（components.css L449–696 既存良 + 改定）

```css
/* Error summary: top-of-form alert, sticky on mobile */
.c-error-summary {
  role: 'alert';
  aria-live: 'assertive';
  background: #fee2e2;
  border: 1px solid #dc2626;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
  color: #dc2626;
}

.c-error-summary h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.c-error-summary h3::before {
  content: '⚠';
  font-size: 1.25rem;
}

.c-error-summary ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.c-error-summary li {
  margin-bottom: 4px;
}

.c-error-summary a {
  color: #dc2626;
  text-decoration: underline;
}

.c-error-summary a:hover {
  text-decoration: none;
}

/* Inline field error: appears on blur + pristine=false */
.c-error-message {
  display: none;
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 4px;
}

.c-error-message::before {
  content: '⚠ ';
}

.c-field.has-error .c-error-message {
  display: block;
}

.c-field.has-error input,
.c-field.has-error select,
.c-field.has-error textarea {
  border-color: #dc2626;
  background-color: #fff5f5;
}

/* Field hint: on focus only */
.c-field-hint {
  display: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin-top: 4px;
  font-style: italic;
}

.c-field:focus-within .c-field-hint {
  display: block;
}

/* Input base: 16px minimum (no iOS auto-zoom) */
input,
select,
textarea {
  font-family: var(--font-sans);
  font-size: 16px; /* CRITICAL: no smaller */
  border: 1px solid #d4d4d0;
  border-radius: 6px;
  padding: 12px;
  background: #ffffff;
  color: #1a1a1a;
  transition: border-color 150ms, background-color 150ms;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid #8b168f;
  outline-offset: 2px;
  border-color: #8b168f;
}

/* Required indicator */
.c-field--required label::after {
  content: ' *';
  color: #dc2626;
  font-weight: 700;
}
```

---

### 4-6 Stepper (予約フロー) & 進捗バー（components.css L577–620）

```css
/* Stepper: sticky at top on mobile, visible progress */
.c-stepper {
  position: sticky;
  top: var(--header-height);
  z-index: 50;
  background: #ffffff;
  border-bottom: 1px solid #e5e5e0;
}

.c-stepper__list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.c-stepper__list::-webkit-scrollbar {
  display: none;
}

.c-stepper__item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  font-size: 0.875rem;
  color: #6b7280;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
  transition: all 150ms ease-out;
}

.c-stepper__item.is-current {
  color: #8b168f;
  border-bottom-color: #8b168f;
  font-weight: 700;
  background: #f5f5f5;
}

.c-stepper__item.is-completed {
  color: #4b5563;
}

/* Desktop: show label + number */
.c-stepper__label {
  display: none;
}

@media (min-width: 768px) {
  .c-stepper__label {
    display: inline;
  }
}

/* Progress bar */
.c-progress {
  height: 3px;
  background: #e5e5e0;
  border-radius: 0;
  overflow: hidden;
}

.c-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #8b168f 0%, #8b168f 100%);
  transition: width 300ms ease-out;
}
```

---

## 5. 段階的開示UX — Ergonomic Progressive Disclosure

### 5-1 原則

**テスラ注文フロー参考:**
- 1ステップ = 1主要選択肢のみ
- その選択が次のステップ表示を unlock
- ガイダンス・詳細説明は「詳細」expand か focus/hover時に just-in-time 表示
- エラーは1つずつ（全エラー list は表示しない）
- 費用・選択内容は常に visible（sticky bar, 又は confirm step で再表示）

### 5-2 予約フロー（reserve.html, js/reservation.js） — 6 ステップ改定

**ステップ構成（現状）:**
1. 日時選択
2. 主催者情報（親展: affiliation, purpose-type など）
3. 利用内容（費用含む）
4. 利用箇所
5. 詳細（SNS, 関連URL, etc）
6. 確認

**改定: Progressive Disclosure 統合**

#### Step 1: 日時選択

```html
<div class="c-step-card" data-step="1">
  <header class="c-step-card__head">
    <h2 tabindex="-1" aria-current="step">ステップ 1 / 6</h2>
    <p class="c-step-card__title">日時を選択</p>
    <small class="c-step-card__help">まず予約可能な日時を確認します。重複をチェックします。</small>
  </header>
  
  <div class="c-form-group">
    <label for="date">ご利用予定日</label>
    <input type="date" id="date" name="date" required aria-required="true" />
  </div>
  
  <div class="c-form-group">
    <label for="start-time">開始時刻</label>
    <input type="time" id="start-time" name="start-time" required />
  </div>
  
  <div class="c-form-group">
    <label for="end-time">終了時刻</label>
    <input type="time" id="end-time" name="end-time" required />
    <small class="c-field-hint" hidden>例: 14:00</small>
  </div>
  
  <!-- 「詳細」expand: optional -->
  <details class="c-expand">
    <summary class="c-expand__summary">なぜ日時が最初か？</summary>
    <div class="c-expand__content">
      <p>キャンセル率が高い時間帯を避けるためです。内部システムでは日時で自動抽選を行っています。</p>
    </div>
  </details>
  
  <div class="c-step-card__actions">
    <button type="button" class="c-button c-button--secondary" data-prev hidden>← 戻る</button>
    <button type="button" class="c-button c-button--primary" data-next>ステップ 2 へ →</button>
  </div>
</div>
```

#### Step 2: 主催者情報 & 費用ゲート

```html
<div class="c-step-card" data-step="2" hidden>
  <header class="c-step-card__head">
    <h2 tabindex="-1" aria-current="step">ステップ 2 / 6</h2>
    <p class="c-step-card__title">主催者情報</p>
    <small class="c-step-card__help">予約者の所属と利用目的を選択します。目的によって料金が変わります。</small>
  </header>
  
  <!-- EARLY: Affiliation choice (最初) -->
  <div class="c-form-group">
    <label>ご所属</label>
    <div class="c-radio-group">
      <label class="c-radio">
        <input type="radio" name="affiliation" value="internal" required />
        学内利用（愛媛大学）
      </label>
      <label class="c-radio">
        <input type="radio" name="affiliation" value="external" required />
        学外主催
      </label>
    </div>
  </div>
  
  <!-- ご一緒に出ます: aria-live 政策 + 費用表示 -->
  <div class="c-fee-alert" aria-live="polite" aria-atomic="true">
    <!-- dynamically populated by JS on affiliation change -->
  </div>
  
  <!-- Affiliation selected → 次フィールド reveal -->
  <div class="c-form-group" data-reveal-if="affiliation:selected">
    <label for="purpose">利用目的</label>
    <select id="purpose" name="purpose" required>
      <option value="">選択してください</option>
      <option value="exhibition">展示</option>
      <option value="workshop">ワークショップ</option>
      <option value="event">イベント</option>
      <option value="self-study">自習</option>
    </select>
  </div>
  
  <!-- External + Exhibition → 警告: 21日ルール -->
  <div class="c-alert c-alert--warning" 
       data-reveal-if="affiliation:external,purpose:exhibition" hidden>
    <strong>注意:</strong> 学外展示は<strong>連続21日間</strong>（3週間）の公開が必須です。壁面のみ利用可（樹脂製の棚・展示台は不可）。
  </div>
  
  <details class="c-expand" data-reveal-if="affiliation:selected">
    <summary class="c-expand__summary">費用について</summary>
    <div class="c-expand__content">
      <p><strong>学内利用:</strong> 無料</p>
      <p><strong>学外展示:</strong> 15,080円 / 21日間（壁面のみ）</p>
      <p>ご返金は致しません。ご了承ください。</p>
    </div>
  </details>
  
  <div class="c-step-card__actions">
    <button type="button" class="c-button c-button--secondary" data-prev>← ステップ 1 へ</button>
    <button type="button" class="c-button c-button--primary" data-next>ステップ 3 へ →</button>
  </div>
</div>
```

**JavaScript 実装（js/reservation.js）:**

```javascript
// Step 2: Affiliation change listener
document.querySelectorAll('input[name="affiliation"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const affiliation = e.target.value;
    const feeAlert = document.querySelector('.c-fee-alert');
    
    if (affiliation === 'internal') {
      feeAlert.textContent = '学内利用: 無料です。';
      feeAlert.style.color = '#059669'; // green success
    } else if (affiliation === 'external') {
      feeAlert.textContent = '学外主催（展示）: 15,080円 / 21日間（壁面展示のみ）';
      feeAlert.style.color = '#8b168f'; // purple accent
    }
    
    // Reveal conditional fields
    updateFieldVisibility('affiliation', affiliation);
  });
});

// Conditional field reveal logic
function updateFieldVisibility(fieldName, value) {
  document.querySelectorAll('[data-reveal-if]').forEach(el => {
    const conditions = el.getAttribute('data-reveal-if').split(',');
    const shouldShow = conditions.every(cond => {
      const [field, expectedValue] = cond.split(':');
      if (field === 'affiliation') return document.querySelector(`input[name="affiliation"]:checked`)?.value === expectedValue;
      if (field === 'purpose') return document.querySelector(`select[name="purpose"]`).value === expectedValue;
      return true;
    });
    
    el.hidden = !shouldShow;
    if (shouldShow && el.querySelector('input, select, textarea')) {
      el.querySelector('input, select, textarea').focus();
    }
  });
}
```

#### Step 3–5: 利用内容・箇所・詳細（カスケード reveal）

```html
<!-- Step 3: 利用内容 (cost, catering など) -->
<div class="c-step-card" data-step="3" hidden>
  <header class="c-step-card__head">
    <h2 tabindex="-1" aria-current="step">ステップ 3 / 6</h2>
    <p class="c-step-card__title">利用内容</p>
  </header>
  
  <!-- Previous selection recap -->
  <div class="c-form-summary">
    <p><strong>所属:</strong> <span id="summary-affiliation"></span></p>
    <p><strong>目的:</strong> <span id="summary-purpose"></span></p>
    <p><strong>料金:</strong> <span id="summary-fee" aria-live="polite"></span></p>
  </div>
  
  <div class="c-form-group">
    <label for="catering">ケータリング</label>
    <select id="catering" name="catering">
      <option value="none">不要</option>
      <option value="snacks">軽食（1,500円 / 人）</option>
      <option value="full">弁当（3,000円 / 人）</option>
    </select>
  </div>
  
  <!-- Catering = snacks → reveal detail field -->
  <div class="c-form-group" data-reveal-if="catering:snacks" hidden>
    <label for="catering-detail">軽食詳細（例: 人数, アレルギー）</label>
    <textarea id="catering-detail" name="catering-detail"></textarea>
  </div>
  
  <!-- ... more fields ... -->
  
  <div class="c-step-card__actions">
    <button type="button" class="c-button c-button--secondary" data-prev>← ステップ 2 へ</button>
    <button type="button" class="c-button c-button--primary" data-next>ステップ 4 へ →</button>
  </div>
</div>

<!-- Step 4–5 similar structure -->
```

#### Step 6: 確認（全情報表示 + 費用最終確認）

```html
<div class="c-step-card" data-step="6" hidden>
  <header class="c-step-card__head">
    <h2 tabindex="-1" aria-current="step">ステップ 6 / 6</h2>
    <p class="c-step-card__title">ご予約確認</p>
  </header>
  
  <div class="c-confirm-summary">
    <h3>ご予約内容</h3>
    
    <div class="c-confirm-section">
      <dt>日時</dt>
      <dd id="confirm-datetime"></dd>
    </div>
    
    <div class="c-confirm-section">
      <dt>ご所属</dt>
      <dd id="confirm-affiliation"></dd>
    </div>
    
    <div class="c-confirm-section">
      <dt>目的</dt>
      <dd id="confirm-purpose"></dd>
    </div>
    
    <!-- ... more fields ... -->
    
    <!-- PROMINENT: 料金情報（最終確認） -->
    <div class="c-confirm-section c-confirm-section--highlight">
      <dt>ご利用料金</dt>
      <dd id="confirm-fee" style="font-weight: 700; font-size: 1.25rem; color: #8b168f;"></dd>
    </div>
    
    <p class="c-confirm-note">
      上記の内容でよろしいですか？<br />
      「予約リクエストを送信する」をクリックすると、確認メールが送信されます。
    </p>
  </div>
  
  <div class="c-step-card__actions">
    <button type="button" class="c-button c-button--secondary" data-prev>← 詳細に戻る</button>
    <button type="submit" class="c-button c-button--primary">予約リクエストを送信する</button>
  </div>
</div>
```

### 5-3 エラーメッセージング戦略

**設計:**
1. **blur時に個別 validate** （pristine でなければ error をセット）
2. **error 時は inline message + 赤枠** （early praise / late blame）
3. **送信試行時に一覧表示** （.c-error-summary, role=alert, aria-live=assertive）
4. **フォーカス管理** （error focus は .c-step-card__title に自動）

**実装例（js/reservation.js）:**

```javascript
// Blur validation
document.querySelector('input[name="date"]').addEventListener('blur', (e) => {
  const value = e.target.value.trim();
  const field = e.target;
  
  if (!field.hasAttribute('data-pristine')) {
    field.setAttribute('data-pristine', 'false');
  }
  
  if (!value) {
    setError('date', '日付を選択してください');
  } else {
    clearError('date');
  }
});

// Input: clear error on change (early praise)
document.querySelector('input[name="date"]').addEventListener('input', (e) => {
  if (!e.target.hasAttribute('data-pristine') || e.target.getAttribute('data-pristine') === 'false') {
    clearError('date');
  }
});

function setError(fieldName, message) {
  const field = document.querySelector(`[name="${fieldName}"]`);
  const wrapper = field.closest('.c-form-group');
  const errorMsg = wrapper.querySelector('.c-error-message');
  
  wrapper.classList.add('has-error');
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', `error-${fieldName}`);
  
  if (!errorMsg) {
    const div = document.createElement('div');
    div.className = 'c-error-message';
    div.id = `error-${fieldName}`;
    div.textContent = message;
    wrapper.appendChild(div);
  } else {
    errorMsg.textContent = message;
  }
}

function clearError(fieldName) {
  const field = document.querySelector(`[name="${fieldName}"]`);
  const wrapper = field.closest('.c-form-group');
  
  wrapper.classList.remove('has-error');
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');
  
  const errorMsg = wrapper.querySelector('.c-error-message');
  if (errorMsg) errorMsg.remove();
}

// Submission validation
document.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const errors = validateStep(currentStep);
  
  if (errors.length > 0) {
    // Show error summary
    const summary = document.querySelector('.c-error-summary');
    summary.innerHTML = `<h3>エラーがあります</h3><ul>${errors.map(err => `<li><a href="#${err.fieldName}">${err.message}</a></li>`).join('')}</ul>`;
    summary.style.display = 'block';
    
    // Focus first error
    const firstField = document.querySelector(`[name="${errors[0].fieldName}"]`);
    firstField.focus();
  } else {
    // Proceed
    showStep(currentStep + 1);
  }
});
```

---

### 5-4 Just-in-Time フィールド・ヒント

**HTML パターン:**

```html
<div class="c-form-group">
  <label for="sns">SNS / Web サイト</label>
  <input type="url" id="sns" name="sns" placeholder="https://example.com" />
  <small class="c-field-hint" hidden>例: Instagram, Twitter, 公式サイトのURL。複数ある場合はカンマ区切り。</small>
</div>
```

**CSS:**

```css
.c-field-hint {
  display: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin-top: 4px;
  font-style: italic;
}

.c-form-group:focus-within .c-field-hint {
  display: block;
}
```

### 5-5 モバイル Safe-Area 対応

**HTML:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

**CSS（reserve.html, mobile ≤767px）:**

```css
.c-step-card__actions {
  position: sticky;
  bottom: 0;
  background: #ffffff;
  border-top: 1px solid #e5e5e0;
  padding: 12px var(--gutter) calc(12px + env(safe-area-inset-bottom));
  display: flex;
  gap: 8px;
}

.c-step-card__actions .c-button {
  flex: 1;
  min-height: 44px; /* mobile coarse pointer: smaller OK on sticky bar */
}
```

---

## 6. ページ別リビルド計画 — Tesla 式ミニマル化

### 6-1 既存 6ページ

| ページ | 現状 | 改定（テスラ式） |
|--------|------|-----------------|
| **index.html** | Hero + 4 section + CTA banner | Full-viewport hero (.l-panel) + about 白card化 + features grid→carousel検討 + event preview + CTA banner (全 gradient削除, 紫accent only) |
| **reserve.html** | 6-step form | Hero .l-panel化 + progressive disclosure (affiliation→fee早期表示, conditional reveal, just-in-time help) + step title focus |
| **guidelines.html** | Hero + 3 rule cards + footer | Hero minimal + 3 cards (border+title only, white bg, no gradient) + expandable rule detail + footer CTA |
| **calendar.html** | Hero + calendar grid + sidebar | Hero minimal + calendar grid (c-calendar styling tighten, no extra shadow) + sidebar legend/controls clean inputs |
| **event-log.html** | Hero + filter chips + event grid | Hero minimal + filter chips (rectangular buttons, not rounded) + event card shadow→border化 + search/sort minimal |
| **event-detail.html** | Hero image + content + related | Full-bleed hero image + clean content (no gradient sidebar) + related events minimal cards |

### 6-2 計画中 3ページ（Phase 2以降）

| ページ | 用途 | 構成 |
|--------|------|------|
| **login.html** | 認証: email/password | Hero: white + dark text, minimal. Form: 2 field, primary button, signup link. Client-side validation (red border on error). |
| **signup.html** | 認証: register | Same as login, + name + affiliation radio, + agree checkbox. |
| **mypage.html** | Post-login: user dashboard | Hero: greeting (やあ, [name])。Sections: my reservations (table), attended events (grid), profile edit (form). All components per pattern 8 (minimal cards, no shadow). |

**Future (未定義):**
- members.html — 利用者一覧 (table)
- admin.html — 管理画面 (CMS-like, TBD)
- agreement.html — 利用規約 (static, clean typography)

---

### 6-3 ページごとのビジュアル施策

#### index.html

```html
<!-- Hero: .l-panel--hero + image + white text -->
<section class="l-panel l-panel--hero" id="hero">
  <img src="/assets/hero.jpg" alt="Museum interior" class="l-panel__bg" />
  <div class="l-panel__content">
    <h1 class="p-hero__title">Imagine the Future</h1>
    <p class="p-hero__sub">創造する未来図</p>
    <div class="l-hero__actions">
      <a href="/reserve.html" class="c-button c-button--primary m-pill">予約する</a>
      <a href="/event-log.html" class="c-button c-button--secondary">過去イベント</a>
    </div>
  </div>
</section>

<!-- About: .l-section white card -->
<section class="l-section">
  <div class="l-container">
    <h2>About</h2>
    <p>One-line mission statement (no gradient decoration)</p>
  </div>
</section>

<!-- Features: .l-section with card grid (simplified) -->
<section class="l-section">
  <div class="l-container">
    <h2>Features</h2>
    <div class="c-feature-grid">
      <!-- 4 cards, minimal styling -->
    </div>
  </div>
</section>

<!-- CTA Banner: minimal dark -->
<section class="l-section l-section--dark">
  <div class="l-container">
    <h2>Ready to Join?</h2>
    <p>今すぐ予約</p>
    <a href="/reserve.html" class="c-button c-button--lg c-button--ghost">予約を始める</a>
  </div>
</section>
```

#### reserve.html

```html
<!-- Hero: .l-panel + form inside -->
<section class="l-panel l-panel--hero">
  <div class="l-container">
    <h1>ご予約</h1>
    <p>Imagine Deck をご利用いただくにあたり...</p>
  </div>
</section>

<!-- Form: main section with stepper + steps -->
<section class="l-section">
  <div class="l-container">
    <!-- .c-stepper (sticky top) -->
    <!-- 6x .c-step-card with progressive disclosure -->
  </div>
</section>
```

#### guidelines.html

```html
<section class="l-panel l-panel--hero">
  <div class="l-container">
    <h1>ご利用ガイドライン</h1>
  </div>
</section>

<section class="l-section">
  <div class="l-container">
    <div class="c-card-grid">
      <!-- 3 rule cards: border-top + title + expandable detail -->
    </div>
  </div>
</section>
```

---

## 7. これまでの良所の継承 — Keep / Change Matrix

### 7-1 **KEEP: デザイン基礎基盤**

| 項目 | 継承内容 | ファイル |
|------|--------|--------|
| **5層CSS建築** | base.css (token) → layout → components → pages → motion の分離構造。BEM命名規則。 | css/* |
| **レスポンシブ理論** | dvh/svh, clamp() fluid typography, safe-area-inset, 48px touch target, ch-measure, text-wrap. | design-spec 2-1~2-12 参照 |
| **6-step 予約 skeleton** | stepper UI, progress bar, aria-live+error-summary, step navigation. ロジック保持. | reserve.html, js/reservation.js |
| **Firebase架構** | firestore emulator, collections (reservations, users), security rules (TBD). | docs/specs/2026-06-04-imagine-deck-firebase-architecture.md |
| **Accessibility** | aria-current, :focus-visible, skip-nav, semantic HTML, form label-input pairs. | base.css, components.css |
| **モーション指標** | scroll-reveal (fade + translate), ease-out-quart, stagger 100–150ms. Tween.js or native CSS. | motion.css |
| **Logo & Brand** | Purple #8b168f (official), logo wordmark 1400x491. | /assets/logo/imagine-deck-logo.png |

### 7-2 **CHANGE: テスラ適応化**

| 項目 | 現状 | 改定 | 理由 |
|------|------|------|------|
| **色彩パレット** | 10 semantic color (primary light/soft/dark, accent light, etc) | 6-color grayscale + purple accent only | テスラ最小化: 白/黒/グレイ + 紫 |
| **Box-shadow** | .c-card, .c-button に習慣的 shadow | Hover時のみ minimal shadow (0 1px 6px rgba) | 装飾削減, stark simplicity |
| **ボタン形状** | Border-radius: 999px (pill) 全部 | border-radius: 6px (rectangular) except hero | テスラ: geometric sans + minimal radius |
| **グラデーション** | .m-mesh (hero背景), .c-feature::before, overlay等 | すべて削除または単色化 | 宙の静けさ, 画像主役 |
| **タイポグラフィ** | Zen Old Mincho (見出し), Noto Sans JP (body) | 全UI: Noto Sans JP; Zen: hero title + stat値のみ | テスラ + 日本語可読: sans-serif first |
| **セクション高さ** | 柔軟 .l-section padding rhythm | .l-panel (full-viewport 85svh snap-scroll) option 追加 | テスラ: discrete visual sections |
| **ヘッダー形状** | 72px sticky, backdrop blur, CTA button prominent | 64px sticky, white bg, nav link+button de-emphasized | ミニマル chrome |
| **段階的開示** | form に実装なし（すべてフィールド visible） | Step毎に help text/警告/条件reveal | Tesla order flow model |

---

## 8. ファイル別実装マップ — 実施順序

### 8-1 CSS ファイル群（優先順位 High）

**css/base.css** (L1–150, tokens + reset)
- [ ] L26–43: color token 再調整（6色化, 金色削減）
- [ ] L47–54: font-family, Zen Old Mincho scoping
- [ ] L55–65: fs (hero, h1–h3, body), lh (1.75), text-wrap
- [ ] L64–69: radius (6/8/12/16px, pill廃止), measure tokens NEW
- [ ] L70–80: shadow token (minimal hover のみ）
- [ ] L81–101: container, space-1–7 再検討

**css/layout.css** (L1–350)
- [ ] L17–22: section padding clamp(48px, 8vw, 80px)
- [ ] L54–207: header/nav（height 64px, border+shadow minimal, nav link font 0.9rem, CTA de-emphasize）
- [ ] L325+: NEW .l-panel + .l-panel--hero/.l-panel--accent/.l-panel--dark classes
- [ ] L250+: footer padding increase（clamp(48px, 8vw, 80px)）

**css/components.css** (L1–1281)
- [ ] L6–69: .c-button（rectangular 6px, shadow削除, hover opacity only）
- [ ] L6–69: NEW .c-button--sm, .c-button--lg variants
- [ ] L71–103: .c-card（border only, shadow削除, hover minimal）
- [ ] L105–171: .c-feature（top-border 3px, 背景gradient削除）
- [ ] L200–244: .c-tag, .c-alert（solid色 only）
- [ ] L449–696: form fields（font-size 16px enforce, error messaging, hint）
- [ ] L577–620: .c-stepper（sticky top, border-bottom only）
- [ ] L1070–1139: .c-event-card（overlay gradient minimal化）

**css/pages.css** (L1–450)
- [ ] L6–152: .p-hero（overlay simplified, gradient stripe削除, text white only）
- [ ] L250–350: section background gradient削除（white/f5f5f5 only）
- [ ] L401–415: .m-pill（hero CTA only, pill keep）

**css/motion.css** (L1–400)
- [ ] L261, 270: 100vh → 100svh (address-bar対応)
- [ ] scroll-reveal: translate 28px → 20px, duration 700ms → 800ms (slower calm)
- [ ] parallax depth 0.06 → 0.04 (subtle)

---

### 8-2 HTML ファイル群

**index.html**
- [ ] L1–5: viewport meta `viewport-fit=cover` 確認
- [ ] Hero section: .p-hero → .l-panel l-panel--hero 変更, gradient overlay simple化
- [ ] About/Features/CTA: section 背景色 white/.f5f5f5 に統一
- [ ] CTA buttons: .m-pill hero only, other は rectangular

**reserve.html**
- [ ] L1–5: viewport-fit=cover
- [ ] Hero: .l-panel--hero
- [ ] Step 2: affiliation を最初に, fee aria-live panel 追加
- [ ] Step 2–5: data-reveal-if, [hidden] attribute 追加（conditional fields）
- [ ] Step 6: confirm fee row 表示
- [ ] Form group: c-field-hint, c-expand (details/summary) 構造追加
- [ ] Button labels: '次へ' → 'ステップ 3 へ →' 具体化

**guidelines.html**
- [ ] Hero: .l-panel--hero
- [ ] Rule cards: .c-card, border-top 3px purple, expandable 詳細

**calendar.html**
- [ ] Hero: .l-panel--hero
- [ ] Calendar grid: c-calendar styling refinement

**event-log.html**
- [ ] Hero: .l-panel--hero
- [ ] Event cards: shadow削除, border細線化
- [ ] Filter chips: rectangular buttons

**event-detail.html**
- [ ] Hero: full-bleed image, minimal overlay
- [ ] Content: clean sans font, no gradient sidebar
- [ ] Related: minimal cards

---

### 8-3 JavaScript ファイル群

**js/reservation.js**
- [ ] validateField(): blur時 pristine チェック, setError/clearError コール
- [ ] updateFieldVisibility(fieldName, value): [data-reveal-if] selector match, hidden toggle
- [ ] setError/clearError: inline message + aria-invalid + 赤border
- [ ] showStep(): h2.focus() + scrollIntoView, aria-live announce
- [ ] buildConfirmSummary(): fee row追加（affiliation + purpose based）
- [ ] Affiliation change listener: aria-live fee-alert update

**js/main.js** (or existing app.js)
- [ ] scroll-snap-type: y mandatory on html (motion.css check OR js)
- [ ] .is-scrolled class on header (existing logic OK)
- [ ] hint visibility on focus/blur (per 5-4)

---

### 8-4 設定・デプロイファイル

**docs/specs/2026-06-04-imagine-deck-redesign-design.md** (参考)
- This master doc, 保持 / 更新

**.claude/settings.json** (if exists)
- Add allowlist for common read-only bash/MCP calls (reduce permission prompts)

**firebase.json, .firebaserc, .env.local**
- NO CHANGE: Firebase emulator config stays (owner-gated deploy rule)

---

## 最終チェックリスト — デプロイ前の QA

### 色彩QA
- [ ] Hero: white text on dark image overlay (contrast: 4.5:1 minimum)
- [ ] Body text: #1a1a1a on #ffffff (AA WCAG)
- [ ] Button text: white on #8b168f (AA WCAG)
- [ ] Error message: #dc2626 + ⚠ icon (non-color cue)
- [ ] No scattered gold (#f4a93a): CTA button 1–2個のみ

### レスポンシブQA
- [ ] 375px mobile: hero 画像 CLS なし, text wrap, button 48px touch target
- [ ] 768px tablet: nav horizontal expand, sidebar visible
- [ ] 1024px desktop: max-width constraint, image scaling
- [ ] 1440px+ ultrawide: text line-length ≤ 68ch, image max-width 90vw
- [ ] All: viewport-fit=cover, env(safe-area-inset) working (notch test on iPhone)

### タイポQA
- [ ] h1–h3: Noto Sans JP 700, text-wrap: balance
- [ ] Body: Noto Sans JP 400, lh 1.75, max-width 40ch (Japanese)
- [ ] input: font-size 16px minimum (iOS auto-zoom off)
- [ ] Button text: 1–3 words max (action-specific labels)

### アクセシビリティQA
- [ ] Stepper: aria-current='step' on .is-current
- [ ] Error summary: role='alert', aria-live='assertive'
- [ ] Form labels: for/id pair all fields
- [ ] Focus rings: purple #8b168f, 2px outline, 2px offset
- [ ] Skip nav: 存在, :focus-visible visible, keyboard 1st link
- [ ] Tab order: logical, no tabindex='-1' abuse

### モーションQA
- [ ] scroll-reveal: fade + translate 20px, 800ms, ease-out
- [ ] Parallax: depth 0.04 max (subtle, not bouncy)
- [ ] Button hover: opacity 0.9, no lift（hero pill only exception）
- [ ] No auto-play animation or hero loop（image static）
- [ ] 3G slow throttle: 無jarring motion

### 段階的開示QA（reserve.html）
- [ ] Step 1: date/start/end のみ, help 1行のみ
- [ ] Step 2: affiliation radio → fee aria-live announce immediately
- [ ] Step 2: affiliation external + purpose exhibition → warning alert reveal
- [ ] Step 3: catering snacks → detail field reveal
- [ ] Step 5 blur: inline error message appear, input focus lost時 disappeared
- [ ] Step 6: fee row表示, 全情報 recap
- [ ] Back button: previous step にジャンプ, 入力値保持

### FirebaseQA（owner確認後）
- [ ] Emulator: reservations collection create OK
- [ ] Security rules: client read/write allowed (test phase)
- [ ] Deploy lock: owner only (non-owner push→blocked）

---

## 付録 A. テスラ参考サイト分析（実URL）

**Primary Reference:**
- Tesla Japan: https://www.tesla.com/ja_jp
  - Full-viewport hero section + 1 message + CTA
  - Minimal header 60px (white bg, minimal nav)
  - Scrollable sections with discrete visual breaks
  - Rectangular buttons (6–8px radius), no pill shape
  - Typography: Gotham-like sans (Noto Sans JP equivalent)
  - Color: black text + white bg + accent red (CTA only)
  - No scattered gradients or decorative shapes
  - Large product images, 60–80% viewport width
  - Subtle parallax, no spring/bounce animation
  - Error/form: minimal validation, just-in-time help

---

## 付録 B. 計測単位・定数一覧

| 定数 | 値 | 用途 |
|------|-----|------|
| **Header Height** | 64px | sticky header height, viewport offset |
| **Touch Target** | 48px min | button, input, interactive elements |
| **Gutter** | var(--space-4) = 24px | section padding horizontal |
| **Section Padding** | clamp(48px, 8vw, 80px) | top/bottom between sections |
| **Panel Height** | 100svh | full-viewport.l-panel |
| **Container Max** | 1280px (or 1400px) | content max-width |
| **Measure Text** | 40ch (CJK) | Japanese prose line-width |
| **Border Radius** | 6px (default), 8px (card), 999px (hero-pill) | corner rounding |
| **Font Size Base** | 16px | iOS auto-zoom off, body base |
| **Line Height Body** | 1.75 | readability |
| **Letter Spacing** | ≤0.01em | minimal for Japanese |
| **Scroll Reveal** | 800ms ease-out | animation duration |
| **Parallax Depth** | 0.04 | subtle movement |
| **Shadow Hover** | 0 1px 6px rgba(0,0,0,0.08) | minimal card lift |
| **Purple Accent** | #8b168f | primary CTA, focus, accent |
| **Gold/Accent** | removed | no secondary color (テスラ: single accent) |

---

## 最後に — 実装の心構え

This master design document serves as **Single Source of Truth** for Imagine Deck's Tesla-inspired redesign. The 6 core principles (minimal color, image-driven, single message, purple accent, calm motion, progressive disclosure) guide every decision:

1. **Simplify first:** If a design element doesn't serve information or action, remove it.
2. **Test at 3 breakpoints:** Mobile (375px), tablet (768px), desktop (1024px+).
3. **Embrace whitespace:** Sections with 80–120px padding (clamp) are not wasteful—they're active design.
4. **Typography hierarchy = weight + size, NOT color:** Color is data/status, not hierarchy.
5. **Reveal step-by-step:** Never dump all instructions upfront; show just-in-time guidance.
6. **Move fast on color/tokens, test motion last:** CSS refactor is quick; motion QA is meticulous.

**Non-breaking improvements:**
- All changes fit within existing 5-layer CSS architecture.
- No new files; no breaking changes to Firebase or HTML structure.
- Accessibility features (aria-*, :focus-visible, skip-nav) preserved + enhanced.
- 6-step wizard skeleton stays; only visual styling + progressive disclosure logic added.

**Success Criteria (per owner):**
- ✅ Site feels clean, Tesla-like, easy to understand.
- ✅ Reservation flow is ergonomic; cost transparency at early step.
- ✅ Mobile ≥ 375px renders beautifully, no CLS, 48px touch targets.
- ✅ Images dominate, text is sparse and purposeful.
- ✅ Motion is calm, not distracting.
- ✅ All pages navigate smoothly via scroll (not clicks through modals).

---

**Document Version:** 1.0 | **Date:** 2026-06-04 | **Status:** Ready for Implementation Phase 1

---

**本ドキュメントは Claude Code / Claude Opus 4.8 により生成されました。**
**Master Design Document © Ehime University Museum, 2026. All rights reserved.**