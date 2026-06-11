# Imagine Deck リデザイン設計ドキュメント

- 作成日: 2026-06-04
- ステータス: 設計（実装前）／オーナー確認待ち
- 対象: Imagine Deck 公式サイト（純静的・GitHub Pages）
- 進め方: **基盤先行型**（全ページ共通の土台 → 予約フォーム → 料金表/白地カード）
- 根拠: 5並列リサーチ（モバイル理論／PC可読性／フォームUX／参考サイト解剖／コードベース対応付け）。記述は実コードと突き合わせ検証済み。

## 0. 確定要件・意思決定（ブレストで合意）

- **Phase 分割**: Phase 1 = 静的のまま（デザイン刷新＋スマホ/PC最適化＋料金表明示＋ノーバックエンドのメール運用）。Phase 2 = 将来バックエンド（オンライン決済＋サイト内メッセージング）。
- **料金**: 学外の主催者は壁面展示 21日間（3週間）= **15,080円（必須）**。学内（学生・教職員）は **無料**。
- **やりとり**: メールベース（Formspree 等でフォーム送信 → スタッフへ通知 → 個別返信）。
- **本格イベント / 展示説明会**: サイトで完結させず **ミュージアム窓口へ誘導**。
- **白背景写真**: **展示作品の写真のみ** product-shot 化（`object-fit:contain`）。世界観ヒーロー等は現状維持（`object-fit:cover`）。
- **実装順序**: 基盤先行型（推奨）。

---

# Imagine Deck サイト改善・教科書ドキュメント
## スマホ＆PC を 2025–2026 年のデザイン理論で「正しく・読みやすく」する実装ガイド

対象：Imagine Deck（愛媛大学ミュージアム交流スペース公式サイト）／純静的サイト（HTML + vanilla JS ESモジュール + 5層CSS）／GitHub Pages。
前提：PHASE 1 は静的のまま。視覚リデザイン＋スマホ/PC最適化＋料金表の明示＋ノーバックエンドの問い合わせ/予約送信（メール運用）。決済・本格イベントはミュージアム窓口へオフライン誘導。PHASE 2 で決済バックエンド＋サイト内メッセージング。

このドキュメントの記述は、実際のコード（`css/base.css` のトークン、`css/motion.css` の `100vh`、6ページすべての viewport meta、`reserve.html` の `data-endpoint=""` と入力属性）を確認したうえで書いています。引用している行番号・値は現物と一致しています。

---

## 1. 結論サマリ（効果が大きい順 / 最優先8手）

1. **全6ページの viewport meta に `viewport-fit=cover` を追加**（現状6ページすべて `width=device-width,initial-scale=1` のみ）。これがないと、`reserve.html` と `components.css` がすでに使っている `env(safe-area-inset-bottom)` が iOS Safari で常に 0 に解決され、固定アクションバーがホームバー下に潜る。**1行 × 6ファイルで効く最重要修正。** ※ `maximum-scale` / `user-scalable=no` は絶対に足さない（WCAG 1.4.4 違反）。
2. **`css/motion.css` の `100vh` を `100svh` に置換**（L261 `.m-stage__pin`、L270 `.m-stage__slide`）。モバイルで `100vh` は大ビューポート＝アドレスバー表示時に画面より高くなり、初回描画でコンテンツが切れる/スクロール跳ねが起きる。
3. **予約フォームに 学内/学外（affiliation）分岐を最初に置き、15,080円（21日間・壁面展示）を選択直後とStep6確認で必ず表示**。学内は無料。想定外コストは離脱の最大要因（Baymard）なので、料金は「選んだ瞬間」と「送信前」の二度見せる。
4. **`reserve.html` の `data-endpoint=""` を Formspree のフォームURLに設定し、AJAX送信で `Accept: application/json` を付与**。送信処理は既にエンドポイント駆動（`js/reservation.js` L547）。これだけでメール運用の問い合わせ/予約が「いま」動く。
5. **料金・ルールを `c-fee-table`（本物の `<table>`）で明示**。学内=無料／学外=15,080円・21日間（3週間）壁面展示。価格を `--fs-h2` の太さ＋`--color-primary`（#8b168f）で視覚的アンカーに。決済・本格展示は窓口というアラートを併記。
6. **可読幅（measure）を px から ch へ**。`--container-prose: 720px`（base.css L90）に加え `--measure: 68ch`（和文主体は ~40ch）を導入。1440px超でも1行が長くなりすぎない。見出しに `text-wrap: balance`、本文に `text-wrap: pretty`。
7. **全画像に width/height（または aspect-ratio）を付与し CLS を潰す**。LCPになるヒーロー画像は `loading="eager" fetchpriority="high"`、下層サムネは `loading="lazy" decoding="async"`。`<picture>`＋AVIF/WebP＋srcset/sizes でモバイル転送量を 30–50% 削減。
8. **タッチターゲットを 44–48px に統一**。`components.css` に残る 42px（L602付近）・40px（L911付近）を底上げし、`@media (pointer: coarse)` で触覚デバイス時だけ拡大。`:hover` は `@media (hover: hover) and (pointer: fine)` でガードし、必ず `:focus-visible` と対にする。

---

## 2. スマホ最適化の理論と実装

### 2-1. safe-area を実際に効かせる（viewport-fit）
- **理論**：`env(safe-area-inset-*)` は `viewport-fit=cover` がないと iOS Safari で全部 0 になる。現状コードは insets を使っているのに meta 側が未対応＝完全な no-op。
- **実装**：6ページ（`index/reserve/guidelines/calendar/event-log/event-detail.html` の L5）を
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` に変更。
- **やってはいけない**：入力フォーカス時のズーム対策に `maximum-scale=1`/`user-scalable=no` を足すこと。ズーム禁止は WCAG 1.4.4 / 1.4.10 違反。ズーム対策は「入力 font-size を16px以上」で行う（2-3）。

### 2-2. `100vh` をやめて `svh`（必要箇所だけ `dvh`）
- **理論**：`svh`/`lvh`/`dvh` は 2025年6月に Baseline Widely Available。`100vh` はモバイルで large viewport を指すため、アドレスバー表示の初回描画でコンテンツが切れる。
- **実装**：`css/motion.css`
  - L261 `.m-stage__pin { height: calc(100vh - var(--header-height,72px) - 48px); }` → `100svh` に。
  - L270 `.m-stage__slide { min-height: 100vh; }` → `min-height: 100svh;`。
  - 旧ブラウザ用に直上に `100vh` のフォールバック行を残してよい。`dvh` はツールバー追従が必要な要素にだけ（再レイアウトでジャンクするため限定使用）。

### 2-3. clamp() の流体タイポ（ズームで必ず拡大する形）
- **理論**：vw だけのフォントサイズはブラウザズームで拡大せず WCAG 1.4.4 失格。`clamp(MIN_rem, PREFERRED_vw, MAX_rem)` の形を守る。本文は16px（1rem）を下限に（小さいと iOS が入力フォーカスで自動ズーム＋Lighthouse の legible font 監査に落ちる）。
- **現状**：`--fs-hero: clamp(2.5rem, 6.5vw, 4.75rem)`（base.css L55）は正しい手本。一方 `--fs-h3: 1.25rem`（L58）・`--fs-body: 1rem`（L59）・`--fs-small: 0.9rem`（L60）は固定値で、中間幅で段差が出る。
- **実装**：`css/base.css` で utopia.fyi（360px→1200px、比率 ~1.2モバイル/1.25–1.333デスクトップ）から `--fs-h3` / `--fs-small` / `--fs-body` を rem ベースの `clamp()` に。本文下限は `1rem` を死守。`.c-input` / `textarea` / `select` は明示的に `font-size: 1rem`（16px）以上（`components.css`）。

### 2-4. CLS を殺す（width/height + aspect-ratio）
- **理論**：intrinsic 寸法がない画像はロード時に場所を確保できず Cumulative Layout Shift（目標 CLS ≤ 0.1）。
- **実装**：`index.html`（L232/250/268 付近）と `event-log.html` の各 `<img>` に実ピクセルの `width=""` `height=""` を付与し、`decoding="async"` も。`base.css` の `img{max-width:100%;height:auto}` が比率を維持。トリミングするカード（展示/イベントサムネ）は wrapper か img に `aspect-ratio` + `object-fit:cover`。

### 2-5. LCP 優先と遅延ロードの使い分け
- **理論**：LCP < 2.5s。ヒーロー/初出の大画像が LCP 要素になるので遅延ロード禁止。
- **実装**：above-the-fold のヒーロー画像（`<img>` の場合）に `loading="eager"` + `fetchpriority="high"`、可能なら `<head>` に `<link rel="preload" as="image" fetchpriority="high">`。下層サムネ（現状の event サムネは正しく `loading="lazy"`）はそのまま、`decoding="async"` を追加。

### 2-6. レスポンシブ画像配信（srcset/sizes + 近代フォーマット）
- **理論**：単一 .jpg のままだとモバイルがデスクトップ級JPEGをDLし LCP を悪化。AVIF/WebP で 30–50% 削減。
- **実装**：
  ```html
  <picture>
    <source type="image/avif" srcset="img-480.avif 480w, img-960.avif 960w, img-1440.avif 1440w" sizes="(min-width:1024px) 33vw, 100vw">
    <source type="image/webp" srcset="img-480.webp 480w, img-960.webp 960w, img-1440.webp 1440w" sizes="(min-width:1024px) 33vw, 100vw">
    <img src="img-960.jpg" width="960" height="600" loading="lazy" decoding="async" alt="">
  </picture>
  ```
  `sizes` はカードレイアウトの 768/1024 ブレークポイントに合わせる。

### 2-7. タッチターゲット 44–48px、coarse pointer で拡大
- **理論**：WCAG 2.2 SC2.5.8 は 24×24 最小だが、実用は iOS 44 / Android 48。親指ゾーンでのタップ精度は 96% vs ストレッチゾーン 61%。
- **実装**：`css/components.css` の `min-width:42px`（L602付近）・`width/height:40px`（L911付近、カレンダー nav 等）を ≥44px に。さらに：
  ```css
  @media (pointer: coarse) {
    .c-calendar__nav button, .c-icon-button, .c-nav__link, .c-choice-card, .c-input { min-height: 48px; }
    /* 隣接ターゲット間に 8px 以上の余白 */
  }
  ```
  マウス/デスクトップUIは肥大させず、触覚デバイス時だけ拡大。

### 2-8. hover をタッチで「貼り付かせない」
- **理論**：タッチで `:hover` はタップ後に sticky 状態として残る。hover でしか出ない情報（オーバーレイ・キャプション）はタッチで到達不能になる。
- **実装**：装飾/reveal-on-hover を `@media (hover: hover) and (pointer: fine){ }` で包む。すべての `:hover` に `:focus-visible` を併記。カードのキャプションなどは resting 状態でも読める/押せるようにする（`:focus-within` でも同じ持ち上げを）。

### 2-9. モバイルキーボード最適化（type / inputmode / autocomplete）
- **現状（良い点）**：email は `type=email inputmode=email autocomplete=email`（reserve.html L166/180）で正しい。capacity は `type=number inputmode=numeric`（L309）で妥当。
- **不足**：電話フィールドがない。URL（`#sns` L459 / `#related-url` L466）に `inputmode="url"` がない。氏名・団体名に autocomplete トークンがない。
- **実装**：
  - 連絡先電話：`<input type="tel" inputmode="tel" autocomplete="tel" autocorrect="off">`
  - `#sns` / `#related-url` に `inputmode="url"` 追加
  - `#org-name` に `autocomplete="organization"`、`#student-name` / `#staff-name` に `autocomplete="name"`（和文フォームは姓名分割しないのが無難）
  - 新規ノーバックエンド問い合わせフォームも同基準で。

### 2-10. モバイルは1行1入力・単一カラム
- **理論**：narrow画面ではユーザは Next/Prev を使わず各フィールドを個別タップ。複数カラムは走査・完了が困難（Baymard）。
- **実装**：768px 未満でフォーム行を `grid-template-columns: 1fr` / `flex-direction: column` に。電話番号・日付など単一の論理エンティティを複数ボックスに割らない（`css/pages.css` のフォーム用メディアクエリ）。

### 2-11. 親指ゾーンの固定アクションバー（既存パターンを活かす）
- **現状（良い点）**：reserve フォームは ≤767px で `.c-step-card__actions` を固定ボトムバー化し `env(safe-area-inset-bottom)`（`components.css` L649付近 / `pages.css` L378付近）を使用済み。式は正しい。
- **実装**：2-1 の `viewport-fit=cover` を入れて初めて効く。primary（次へ/送信）は full-width・≥48px・視覚的に支配的、secondary（戻る）は下か小さく。`padding-bottom: calc(12px + env(safe-area-inset-bottom))`。

### 2-12. 横スクロール漏れと reduced-motion
- **実装**：`100vw` より `100%` を優先（スクロールバー分の溢れ防止）。`.m-marquee`（`width:max-content`, motion.css L277付近）が body を広げないか確認、必要なら上位 wrapper に `overflow-x: clip`。320px 幅で横スクロールが出ないことを実機確認。`base.css` の既存 `prefers-reduced-motion` リセットは維持。

---

## 3. PC（大画面）の可読性と実装

### 3-1. 可読幅（measure）を ch で固定し、和文は ~40字
- **理論**：欧文45–75字（理想66）、WCAG 1.4.8 は欧文80/和文40字。px の `--container-prose: 720px`（base.css L90）はフォント/言語で実効字数がブレ、1440px超で長くなりすぎる。**ch は「0」の送り幅＝全角は約2倍**なので、66ch 欧文 ≒ 33–40 全角の行になる点に注意。
- **実装**：`css/base.css` に `--measure: 68ch;` と `--measure-cjk: 40ch;` を追加。`.u-measure{max-width:var(--measure)}` ユーティリティを作り、`.p-eventdetail__section p` / `.p-guideline-section p` / `.t-lead` に適用。和文主体段落は `max-width: 40ch`。

### 3-2. text-wrap：見出し balance / 本文 pretty
- **実装**：`css/base.css`
  ```css
  h1,h2,h3,h4,.p-hero__title,.l-section__head h2,.p-eventdetail__title,.p-cta-banner h2 { text-wrap: balance; }
  p,.t-lead,.c-card__body,.p-guideline-section p { text-wrap: pretty; }
  ```
  `balance` は Chromium ≤6行 / Firefox ≤10行までしか効かないので、長い本文段落には使わず `pretty` を使う。

### 3-3. 和文タイポを palt から一歩進める（chws・行間・kinsoku）
- **現状**：`body { font-feature-settings: "palt" }`（base.css L119）。palt は全グリフを詰めるため約物が過剰圧縮されがち。
- **実装**：`body { font-feature-settings: "palt" 1, "chws" 1; }`（chws＝JIS的な約物カーニング、近代 Noto 対応）。`--lh-body: 1.7`（L62）は維持。和文見出しが2行以上に折り返す箇所は `line-height` を 1.2 から 1.3–1.4 へ緩める（`--lh-heading-cjk` トークン化）。和文 prose に `line-break: strict;`、可能なら `hanging-punctuation: allow-end;`。

### 3-4. モジュラースケール（Perfect Fourth ~1.333）に統一
- **理論**：現状のステップ（hero 4.75rem / h1 3rem / h2 2.25rem / h3 1.25rem → body 1rem）は単一比率に乗っておらず、h3→body の段差が大きく h2→h3 が小さい。
- **実装**：`--fs-body: 1rem` 起点に 1.333 比で再計算、h3 と body の間に小見出し用ステップを1つ追加。utopia.fyi で `clamp()` ペア生成。`--fs-hero` は editorial outlier として別格でよい。

### 3-5. 8ptリズムと owl セレクタ
- **実装**：`guidelines.html` / `index.html` の `style="margin-bottom:32px;..."` などインライン上書きを修飾クラスに置換（8ptグリッドとリズムを壊している）。prose フローは既存の `.u-stack` / `.u-stack-lg`（`margin-top: var(--space-3/5)`）で。セクションの縦リズムは `--space` トークンと `.l-section` の `clamp()` padding-block を維持。

### 3-6. ページ骨格は Grid、1次元の部品行は flex（現状を維持）
- **実装**：reserve の `1fr 320px`、guidelines の `280px 1fr`、calendar の `1.2fr 1fr` は Grid のまま。超ワイドで本文列が伸びすぎないよう `minmax(0,1fr)`：
  `.p-guidelines{ grid-template-columns: 280px minmax(0,1fr); }`。`.c-stepper__list` / `.p-eventlog-toolbar__row` / `.c-step-card__actions` は flex のまま。

### 3-7. コンテナクエリで部品を自己レスポンシブに
- **理論**：container query は Baseline（2023/2月）、2025年で十分使える。同じカードが「ワイドな3連グリッド」と「狭いサイドバー」両方に出るので、ビューポート基準では片方に最適化できない。
- **実装**：`.p-eventlog-grid` / `.l-grid` / `.p-reserve-layout__aside` に `container-type: inline-size`。`.c-event-card` / `.c-feature` / `.c-stat` / `.c-choice-card` の内部を `@container (min-width: 22rem){ }` + `cqi` 単位で書く。ページ全体の1→2カラム切替の `@media (min-width:1024px)` は残す。加算的・低リスク。

### 3-8. measure は固定、選んだ帯だけ full-bleed
- **理論**：1920px で 1200px 中央1列＋巨大余白は未完成に見え、本文全幅は読めない。中央に measure、ヒーロー/ダークCTA/写真帯だけ edge-to-edge。
- **実装**：`css/layout.css` の `.l-container` を content-grid 化：
  ```css
  .l-container{
    display:grid;
    grid-template-columns:[full-start] minmax(var(--gutter),1fr) [content-start] min(var(--container-max),100%) [content-end] minmax(var(--gutter),1fr) [full-end];
  }
  .l-container > * { grid-column: content; }
  .l-section--dark, .p-cta-banner, .p-section-photo { grid-column: full; }
  ```
  カードグリッドだけ `--container-wide`（~1320–1440px）を別途許してよい。prose は広げない。

### 3-9. CTA配置（Z/Fパターン）
- **理論**：視覚的なランディング（index hero / CTAバナー）は Z 走査で右下が高コンバージョン位置、テキスト主体（guidelines / event-detail）は F 走査で左上＋最初の2スイープ内。
- **実装**：index は hero の視覚/CTA重心を ≥1024px で右下に寄せる（`.p-hero__visual` は既に右アンカー、その近くに「予約」二次導線）。`.p-cta-banner` の primary は ≥768px で右カラム（正しい Z）。guidelines / event-detail は予約/問い合わせCTAをフッタだけでなく「高く・左に」。

### 3-10. キーボード操作（focus-visible / WCAG 2.2）
- **現状（良い点）**：`:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 2px }`（紫 #8b168f は明背景で高コントラスト）。
- **実装**：WCAG 2.2 の 2.4.11（Focus Not Obscured）/ 2.4.13（Focus Appearance：≥2px・≥3:1）対応で、sticky ヘッダ/モバイル sticky stepper にフォーカスが隠れないよう、`.c-step-card` とページ内アンカーに `scroll-margin-top: calc(var(--header-height) + 16px)`（`.p-guideline-section` には既存、横展開）。選択中 choice-card の purple-soft 背景に対し紫アウトラインが 3:1 を保つか確認。

### 3-11. リード文・イントロを短い measure で中央寄せ
- **実装**：`.l-section__head .t-lead` を `max-width: 640px` から `clamp(40ch, 50vw, 60ch)` へ。単独 prose 段落は `.l-container--prose` で包む。

---

## 4. 予約フォームを「しやすく」する（6ステップ最適化）

### 4-0. すでに良くできている点（壊さない）
- ステップ一覧 `#stepper` を1–6で常時表示し `is-current`/`is-done` と進捗バー、`aria-live="polite"` の `#reserve-step-status`（NN/g 推奨）。
- エラーは「サマリ（`c-error-summary`、各エラーへのアンカー＋`tabindex=-1`/focus/scrollIntoView）＋フィールド直近メッセージ（`c-error-message`、`aria-invalid`）」の二段構え（NN/g の理想形）。
- 各ラジオ/チェック群を `<fieldset><legend>` + `role="radiogroup" aria-required` で正しくグルーピング。
- 送信は `data-endpoint` 駆動（`reservation.js` L547）：FormData を組み、配列とファイルを append、`res.ok` 成功、空エンドポイント時は擬似成功にフォールバック。送信中は `disabled`+`aria-busy`+「送信しています…」、失敗時は再送信ボタン。
- メッセージの日本語トーンが良い（例「想定人数は 1〜100 で入力してください。」）。
- **ウィザード形式は正解**。展示予約は年1–2回の高コミットメント・非熟練タスク＝NN/g がウィザードを推奨する典型。**1ページに潰さない。**

### 4-1. 学内/学外（affiliation）分岐を「最初」に置く
- **理由**：料金（学外15,080円/学内無料）も窓口誘導も決める identity 質問。後ろ（Step5等）に置くと努力が無駄になる。
- **実装（reserve.html）**：Step2 先頭（または新しい早期ステップ）に
  ```html
  <fieldset class="c-field">
    <legend class="c-field__label c-field__label--required">ご利用区分</legend>
    <div role="radiogroup" aria-required="true">
      <!-- c-choice-card: name="affiliation" value="internal"（学内：学生・教職員） -->
      <!-- c-choice-card: name="affiliation" value="external"（学外の主催者） -->
    </div>
  </fieldset>
  <div class="c-alert c-alert--info" aria-live="polite" hidden><!-- 15,080円 / 無料 のメッセージ --></div>
  ```

### 4-2. 料金は「選んだ瞬間」と「確認画面」で必ず見せる
- 学外 + 展示 を選んだ瞬間、`aria-live="polite"` パネルに「展示料金：15,080円（必須・21日間/3週間 壁面展示）」。学内なら「学内利用は無料です」。
- `buildConfirmSummary()`（Step6）に「ご利用料金」行を追加：external+exhibition→「15,080円（必須・21日間/3週間 壁面展示）」、internal→「無料（学内利用）」。
- **想定外コストは離脱の最大要因（Baymard）。送信時に初出ししない。**

### 4-3. 21日ルールの文脈表示＆窓口へのオフランプ
- Step3 で `purpose-type="exhibition"`（特に external）のとき `c-alert--info`：
  「本格的な展示・展示説明会はミュージアム窓口での対応となります。壁面展示は21日間（3週間）単位です。」＋問い合わせフォーム/窓口へのリンク。
- 大規模 想定人数 や public + 学術イベントには「この規模は事前にご相談ください」と問い合わせ導線。`[hidden]` ブロックを change ハンドラでトグル。

### 4-4. Step3 の過負荷を progressive disclosure で軽くする
- 現状 Step3 は必須ラジオ7群＋人数で最重。
- `fee="paid"` のとき「金額・用途」1行入力を表示（備考に押し込まない）。`catering="snacks"` のとき「軽食の内容」1行を表示。「学術ですか」は purpose-type が event/exhibition のときだけ表示（自習に不要）。
- 注意：reveal した required フィールドは `aria-expanded` で開閉し、フォーカス移動 or `aria-live` で通知。`validateStep` は**表示中の required のみ**検証（hidden required でブロックしない）。

### 4-5. インライン検証（blur で初出し、input で消す）
- 現状は `data-next` クリック時のみ `validateStep()`。
- `reservation.js`：現ステップ各フィールドに blur リスナーを足し `validateField(name)` + setError/clearError（pristine&空はスキップ）。既にエラーがあるフィールドは input で再検証し、直った瞬間に消す（早く褒め、遅く叱る）。`data-next` の `validateStep(n)` は前進ゲートとして維持。

### 4-6. フォーカス管理（ステップ移動 / エラー時 / 送信後）
- `showStep(n)`：un-hide 後に新ステップの `h2.c-step-card__title`（`tabindex="-1"` 付与）へフォーカス。既存の aria-live と `block:'start'` scrollIntoView は維持。
- 各 `c-error-summary` に `role="alert"` を追加（出現時に読み上げ）。
- 送信成功時：`#submit-result` に `role="status" tabindex="-1"` を付け scrollIntoView 後に `.focus()`。

### 4-7. ボタンラベルを行動明示に
- NN/g：素の Next/Previous は情報の手がかりが弱い。Step5「確認画面へ進む →」は良い手本。横展開：Step1「主催者情報へ →」/ Step2「利用内容へ →」/ Step3「利用箇所へ →」/ Step4「詳細へ →」。テキストは HTML 直書きで `reservation.js` は送信ボタンラベル以外を上書きしないので純粋な HTML 編集。

### 4-8. セッション復元（中断対応）
- change/Next ごとに `collectFormData()`（File を除く）を `sessionStorage` に保存。`DOMContentLoaded` で blob があれば「前回の入力を復元しますか？」を出して再投入＋`initChoiceCards` 同期。ファイルは復元不可なので再添付を促す。長期PII保持を避けるため localStorage ではなく sessionStorage。

### 4-9. ノーバックエンド送信（Formspree）の配線
- `reserve.html` L93 の `data-endpoint=""` を `https://formspree.io/f/XXXX` に。
- `initSubmit` の fetch に `headers: { 'Accept': 'application/json' }`（これがないと Formspree は JSON を返さずリダイレクトしようとし、既存の `res.ok` 成功分岐が崩れる）。
- 返信用に `fd.append('_replyto', data['student-email'])`、件名に `_subject` を append（スタッフが直接返信できるメール運用）。
- ボタン再有効化を finally 相当に（途中 throw でも stuck しない）。現状の添付制限（各10MB/合計30MB）は Formspree（各25MB/合計100MB）より厳しいだけなので維持可。確認コピー「送信後、運営スタッフから確認メールが届きます。支払いが必要な場合はその時点でお知らせします。」を加える。

### 4-10. 新規フィールドは「5箇所すべて」に登録
- `affiliation` / `fee_amount` / `catering_detail` を **`FIELD_LABELS`・`FIELDS_BY_STEP`・`validateField`・`collectFormData`・`buildConfirmSummary`** すべてに追加。1つ漏れると検証・確認画面・送信ペイロードのどれかが静かに壊れる。

### 4-11. エラーは色だけに頼らない
- `components.css` で `c-error-message` に `::before` の ⚠ グリフ（`aria-hidden`）か SVG を付け、赤だけに依存しない（色覚多様性対応）。reveal した条件フィールドには左に #8b168f のアクセントボーダーで「あなたの選択で出た」ことを示す。

---

## 5. 料金・展示ルールの見せ方

### 5-1. `c-fee-table` コンポーネント（本物の table）
- **理由**：「学内=無料 / 学外=15,080円・21日間」は最重要の意思決定情報。表データはスクリーンリーダー/キーボードのため `<table>` セマンティクスで。
- **実装（components.css、`.c-calendar` 後 L1020付近）**：
  - `<table>` に `<th scope="col">`／`<th scope="row">`。価格を `--fs-h2` の太さ＋`--color-primary` でアンカー。
  - デスクトップ（≥768px）：通常の表。モバイル（<768px）：各 `<tr>` をカード化（`flex-direction:column`）、`<td data-label="...">` + `::before` でラベル表示。
  - 幅は `--measure` に収め 1440px+ で間延びさせない。
  - 直下に `c-alert--info`：「決済・本格的な展示・展示説明会はミュージアム窓口で対応します（オフライン）」。
- 表内容の骨子：

| 区分 | 料金 | 期間/条件 |
|---|---|---|
| 学内（学生・教職員） | **無料** | 通常利用 |
| 学外の主催者（展示） | **15,080円** | 21日間（3週間）壁面展示・必須 |
| イベント/ワークショップ等 | 要相談 | ミュージアム窓口へ |

### 5-2. サイドバー文言を実数に合わせる
- `reserve.html` L538 の `<li>学外主催者は有料（要見積）</li>` を
  「学外主催者は展示が有料：15,080円／21日間（3週間・壁面展示）／学内は無料」に更新（サイドバーとフォーム内ロジックの一致）。

### 5-3. 料金の発見可能性
- 予約フォームに辿り着く前に見えるよう、guidelines に「ご利用案内/料金」を1ブロックで集約（時間・料金・休館・利用ルールを一望／京大ミュージアムの「ご利用案内」型）。index からも導線。

### 5-4. 白背景の展示作品カード（product-shot）
- **オーナー指示**：白背景の product-shot は**展示/作品写真のみ**。世界観ヒーロー画像は現状維持。
- **実装**：`.c-card--exhibition`（components.css、`.c-card` 後 L85付近）
  ```css
  .c-card--exhibition{ background:#fff; border:1px solid var(--color-border); }
  .c-card--exhibition .media{ aspect-ratio: 4/5; } /* or 1/1 */
  .c-card--exhibition img{ width:100%; height:100%; object-fit: contain; } /* 白地に作品を収める */
  ```
  キャプションは `--measure` で字数制限。**世界観/`.p-hero`/`.l-page-hero` には絶対に適用しない**（こちらは `object-fit: cover` のまま）。エディトリアル写真は `cover`、白地 product-shot は `contain`。

---

## 6. 参考にすべき Web サイト（構造的・デザイン的に真似る）

> 重要：真似るのは**パターン（構造・余白リズム・型）であって、素材やコピーではありません**。掲載サイトの画像/文言を流用しないこと。MUUUUU.ORG / Awwwards は「発見・ベンチマーク用」で、参照前に各サイトが現存するか確認すること。

### TOP3（最速で clone-and-adapt すべき）
1. **金沢21世紀美術館 — https://www.kanazawa21.jp/**（美術館）
   - 構造：トップの並び「注目展 → 展覧会（最新3・会期＋有料/無料）→ イベント → お知らせ → コンセプト → 会員 → アメニティ → SNS」を index の背骨に。チケット/予約CTAを上部に常設。
   - **借りる最重要パターン：カードに有料/無料バッジをインライン表示**。これがそのまま「学内=無料 / 学外=15,080円」を一目で見せる手本。予約CTAを上部に2つ（壁面予約／問い合わせ）。
2. **アーティゾン美術館 — https://www.artizon.museum/**（予約ハンドオフ）
   - **静的サイト＋外部予約の最良の前例＝PHASE 1 そのもの**。落ち着いたエディトリアルな枠を保ち、実際の予約は明確にラベルされた外部ハンドオフ（/ticket/）に。コンセプト帯「創造の体感」を世界観ブロックの手本に（ヒーローは現状維持、白地 product-shot は展示一覧だけ）。
3. **吉田企画 — https://yoshidakikaku.jp/**（エディトリアル／既存ベースライン）
   - **番号付きセクション（SERVICE01/02/03）**を Imagine Deck の4機能（KINOU01–04、既存 `.t-eyebrow` で英字 eyebrow）に転用。寛容なセクション余白リズムと「1つの明確なCTA」ファネル。ニュートラルな chrome に紫 #8b168f を**唯一のアクセント**として注す。

### その他の参考
4. **京都大学総合博物館 — https://www.museum.kyoto-u.ac.jp/**（大学博物館）
   - 「ご利用案内」1ページ集約型（時間・料金・休館・ルールを先頭で一望）。Imagine Deck の guidelines + 料金表の型。本文に明朝アクセント＋UIはサンセリフ＝既存の Zen Old Mincho（display）+ Noto Sans JP（body）の学術レジスターを裏付け。
5. **森美術館 — https://www.mori.art.museum/en/**（美術館）
   - 外部予約ハンドオフ（Buy Tickets→外部）が PHASE 1 の核。トライブロック「main features」（壁面を予約／問い合わせ／ガイドライン）を採用。**アクセント色はCTAのみ**の規律（#f4a93a / #8b168f の節度を補強）。一貫したカード比率（450×225）。
6. **Baymard Institute — https://baymard.com/blog/checkout-flow-average-form-fields**（フォームUXの根拠）
   - 可視フィールド総数を絞る、任意フィールドはトグルの裏、氏名は1フィールド、学内/学外を最初に置いて料金を即提示。フォーム再設計のエビデンス基盤。
7. **NN/g Wizards — https://www.nngroup.com/articles/wizards/**（ウィザード設計の権威）
   - ステップ一覧＋現在地強調、厳密な順序、各ステップ自己完結、保存/再開、行動明示ラベル、送信前の確認/要約。`components.css` の既存 stepper を活かす根拠。
8. **MUUUUU.ORG — https://muuuuu.org/**（日本Webデザインギャラリー）
   - 「elegant + ニュートラル配色 + ブランド/コンセプトサイト」でフィルタし、現行（2025–2026）の生きた日本語レイアウトの**セクションリズム/タイポ**を発掘。素材は採らない。
9. **Awwwards — https://www.awwwards.com/inspiration/exhibition-page / https://www.awwwards.com/websites/Japan/**
   - event-detail / event-log の型（大見出し・日付メタ帯・本文＋引用・画像ギャラリー・関連リンク／フィルタ一覧）と scroll-reveal の振り付け（`motion.js` の IntersectionObserver reveal）を原則として参照。

---

## 7. ファイル別・実装マップ（ビルドチェックリスト）

### HTML（6ページ）
| ファイル | 変更 |
|---|---|
| `index.html` L5 / `reserve.html` L5 / `guidelines.html` L5 / `calendar.html` L5 / `event-log.html` L5 / `event-detail.html` L5 | viewport meta に `viewport-fit=cover` を追加（`maximum-scale`/`user-scalable=no` は付けない） |
| `index.html` | hero/LCP `<img>` に `loading="eager" fetchpriority="high"`、下層 `<img>`（L232/250/268付近）に `width`/`height`/`decoding="async"`、`<picture>`+AVIF/WebP+srcset/sizes。セクション見出しのインライン style を修飾クラス化。hero CTA重心を ≥1024px で右下へ。`.p-cta-banner` primary を右カラム維持 |
| `event-log.html` | 6枚の `<img>` に `width`/`height`/`aspect-ratio`、`decoding="async"`、`<picture>`+srcset/sizes（`loading="lazy"` は維持） |
| `guidelines.html` | `.l-section__head` のインライン style を修飾クラス化、prose を `.l-container--prose` で包む、`c-fee-table` を設置、予約/問い合わせCTAを高く・左に、ページ内アンカーに `scroll-margin-top` |
| `event-detail.html` | `.p-eventdetail__section p` に `text-wrap:pretty` + ch-measure、記事冒頭にCTA、展示/作品写真のみ白地 `object-fit:contain`（世界観ヒーローは不変）。`.p-eventdetail` 幅を 880px インラインからトークンへ |
| `reserve.html` | Step2先頭に `affiliation`（学内/学外）radiogroup＋`aria-live` 料金パネル。Step3に条件 `[hidden]`（金額・用途／軽食の内容／21日ルール＆窓口アラート）。`data-next` ラベルを行動明示。`#sns`/`#related-url` に `inputmode="url"`、`#org-name` に `autocomplete="organization"`、`#student-name`/`#staff-name` に `autocomplete="name"`、連絡先電話に `type=tel inputmode=tel autocomplete=tel`。各 `c-error-summary` に `role="alert"`、各 `h2.c-step-card__title` に `tabindex="-1"`、各 radiogroup に `role="radiogroup"` 確認。L538 サイドバー文言を「15,080円／21日間／学内無料」に。L93 `data-endpoint` に Formspree URL。確認/送信後コピー追加 |

### JS
| ファイル | 変更 |
|---|---|
| `js/reservation.js` | `affiliation`/`fee_amount`/`catering_detail` を `FIELD_LABELS`・`FIELDS_BY_STEP`・`validateField`（required・表示中のみ）・`collectFormData`・`buildConfirmSummary` に追加。`buildConfirmSummary` に「ご利用料金」行。条件 reveal（fee/catering/exhibition）と `aria-expanded`＋reveal時フォーカス。blur インライン検証＋input でエラー解除。`showStep(n)` で見出しへフォーカス。`initSubmit` で `Accept: application/json`・`_replyto`/`_subject` append・finally で再有効化・成功時 `#submit-result` を `role=status tabindex=-1` で focus。sessionStorage 保存/復元 |

### CSS
| ファイル | 変更 |
|---|---|
| `css/base.css` | `--fs-h3`/`--fs-small`/`--fs-body` を rem ベース `clamp()`（1.333比、utopia）に、body 下限 1rem。`--measure: 68ch` / `--measure-cjk: 40ch` / `--lh-heading-cjk` 追加。`.u-measure` 追加。`body { font-feature-settings: "palt" 1, "chws" 1; }`。和文 prose に `line-break:strict`。h1–h4 `text-wrap:balance`、p/lead/card-body `text-wrap:pretty` |
| `css/layout.css` | `.l-container` を content-grid（full/content トラック）化し `.l-section--dark`/`.p-cta-banner`/`.p-section-photo` を `grid-column:full`。`.l-section__head .t-lead` を `clamp(40ch,50vw,60ch)`。`.p-guidelines`/`.p-calendar-layout` 本文列 `minmax(0,1fr)`。`.l-container` padding-inline を `max(clamp(20px,5vw,40px), env(safe-area-inset-left/right))`。長文 prose に `max-width: var(--container-prose)` |
| `css/components.css` | `.c-input`/`textarea`/`select` を `font-size:1rem`（≥16px）。42px（L602付近）/40px（L911付近）を ≥44px。`@media (pointer:coarse)` でターゲット拡大＋8px余白。装飾 hover を `@media (hover:hover) and (pointer:fine)`、`:hover` に `:focus-visible`/`:focus-within` 併記。カードグリッドに `container-type:inline-size`＋`@container`/`cqi`。`c-fee-table`（レスポンシブ table）。`.c-card--exhibition`（白地・aspect-ratio・`object-fit:contain`）。`.c-error-message` に非色キュー。条件フィールドの左アクセントボーダー。`.c-step-card`/ページ内ターゲットに `scroll-margin-top: calc(var(--header-height)+16px)`。`.c-stepper` に safe-area padding。固定アクションバー primary を full-width・≥48px |
| `css/pages.css` | フォーム複数列を <768px で `grid-template-columns:1fr`（単一エンティティを分割しない）。`.p-eventdetail__section p`/`.p-guideline-section p` を ch-measure。375px ブレークポイント追加（ラベル/カード折返し）。固定バーの `env(safe-area-inset-bottom)` 式は維持（meta対応後に発効） |
| `css/motion.css` | L261 `.m-stage__pin` height を `100svh` 計算に、L270 `.m-stage__slide` を `min-height:100svh`（`100vh` フォールバック行は上に残す）。`.m-marquee` が body を広げないか確認、必要なら wrapper に `overflow-x:clip` |

### 画像処理（共通）
- 全 `<img>` に実寸 `width`/`height`（or wrapper `aspect-ratio`+`object-fit`）。LCP=eager+fetchpriority high、下層=lazy+decoding async。`<picture>` で AVIF/WebP＋jpg、`srcset/sizes` を 768/1024 に整合。展示/作品のみ白地 product-shot（`object-fit:contain`）、世界観/ヒーローは不変（`object-fit:cover`）。

---

## 8. 段階計画（PHASE 1 / PHASE 2）

### PHASE 1（いま・静的のまま）
- **インフラ**：GitHub Pages のまま。バックエンドなし。
- **送信経路**：`reserve.html` の `data-endpoint` を Formspree に設定 → AJAX（`Accept: application/json`）→ スタッフへメール → 手動返信。問い合わせフォームも同方式。`_replyto` に申請者メールを入れスタッフが直接返信。
- **料金**：学外展示は 15,080円（21日間・3週間 壁面）必須／学内は無料、を `c-fee-table` とフォーム分岐で明示。**決済はオフライン**（メール＋窓口）。本格展示・展示説明会・大規模イベントはミュージアム窓口へ誘導。
- **最適化**：本ドキュメント 2〜5 章（viewport-fit / svh / 流体タイポ / CLS対策 / タッチ44–48px / ch-measure / text-wrap / focus / 6ステップUX / 料金表 / 白地カード）をすべて実施。
- **完了基準**：320px で横スクロールなし、200%/400%ズームで本文拡大、CLS≤0.1・LCP<2.5s・INP≤200ms、iOS で入力フォーカス時に自動ズームしない、固定バーがホームバー下に潜らない、学外+展示で 15,080円 が選択直後と確認画面に出る。

### PHASE 2（将来・バックエンド）
- **オンライン決済**：学外15,080円の在席決済（フォーム分岐ロジックはPHASE 1で既に料金を算出しているので、`fee_amount` をそのまま決済額に接続）。
- **サイト内メッセージング**：メール手動返信を、サイト内の予約者⇄スタッフのスレッド型コミュニケーションへ。
- **本格イベント/展示の在席ハンドリング**：いまは窓口へ誘導しているフローを、空き枠カレンダー予約・本格展示の申込み管理として取り込む。
- **移行のしやすさ**：PHASE 1 で `affiliation`/`fee_amount`/`catering_detail` を含む構造化データ（`collectFormData`）と確認画面を作っておくことが、そのまま PHASE 2 の API ペイロード設計になる。エンドポイント駆動の送信実装（`data-endpoint`）も自前バックエンドURLに差し替えるだけで移行可能。

---

参照したコード上の事実（すべて現物確認済み）：viewport meta は6ページとも `width=device-width,initial-scale=1` のみ（`viewport-fit` 無し）／`css/base.css` L55–60・L89–90・L119 のトークン値は記載どおり／`css/motion.css` L261・L270 は `100vh`／`reserve.html` L93 `data-endpoint=""`（`reservation.js` L547 で参照）／email は inputmode・autocomplete 設定済みだが URL（L459/466）は inputmode 無し／サイドバー L538 は「学外主催者は有料（要見積）」。

---

## 9. 実装シーケンス（基盤先行型・合意済み）

### ステップ1：全ページ共通の基盤（低リスク・加算的・最優先）
- 6ページの viewport meta に `viewport-fit=cover`（`maximum-scale`/`user-scalable=no` は付けない）
- `css/motion.css` L261/270 の `100vh` → `100svh`（フォールバック行は残す）
- `css/base.css`：`--fs-h3`/`--fs-small`/`--fs-body` を `clamp()` 流体化（body 下限 1rem）、`--measure: 68ch`/`--measure-cjk: 40ch` 追加、`text-wrap` balance/pretty、`font-feature-settings:"palt" 1,"chws" 1`
- `css/layout.css`：`.l-container` を content-grid 化（中央 measure＋選んだ帯だけ full-bleed）、padding-inline に safe-area
- `css/components.css`：`.c-input`/`textarea`/`select` を `font-size:1rem`、42/40px のターゲットを ≥44px、`@media(pointer:coarse)` で拡大、`:hover` を `@media(hover:hover)` でガードし `:focus-visible` 併記、`scroll-margin-top`、コンテナクエリ
- 画像：全 `<img>` に `width`/`height`(or `aspect-ratio`)、`<picture>`+AVIF/WebP+srcset/sizes、LCP=eager+fetchpriority/下層=lazy+decoding async
- **完了基準**：320px で横スクロールなし／200%・400%ズームで本文拡大／CLS≤0.1・LCP<2.5s・INP≤200ms／iOS で入力フォーカス時に自動ズームしない／固定バーがホームバー下に潜らない

### ステップ2：予約フォーム（`reserve.html` + `js/reservation.js`）
- 学内/学外（affiliation）分岐を最初に → 15,080円を「選択直後」と「Step6確認画面」で提示。学内は無料
- 21日ルールの文脈表示＆本格展示・説明会は窓口へオフランプ
- Step3 を progressive disclosure（有料時のみ金額欄／軽食時のみ内容欄）、blur インライン検証、ステップ移動/送信後のフォーカス管理、ボタンを行動明示ラベルに、sessionStorage 復元
- 新フィールド（`affiliation`/`fee_amount`/`catering_detail`）を **5箇所すべて** に登録
- `data-endpoint` を Formspree URL に・`Accept: application/json`・`_replyto`/`_subject`・確認コピー追加
- URL欄に `inputmode="url"`、氏名/団体名に `autocomplete`、連絡先電話に `type=tel inputmode=tel autocomplete=tel`

### ステップ3：料金表・展示ルール・白地カード
- `c-fee-table`（本物の `<table>`・モバイルはカード化・価格を紫 #8b168f でアンカー）＋「決済・本格展示は窓口」アラート
- `reserve.html` L538 のサイドバー文言を実数（15,080円/21日間/学内無料）へ
- `guidelines.html` に「ご利用案内/料金」集約ブロック（京大ミュージアム型）
- `.c-card--exhibition`（白地・`object-fit:contain`）。世界観/ヒーローには適用しない

### 各ステップ共通の検証
- ローカル（http://127.0.0.1:4321）で 375 / 768 / 1024 / 1440 を確認
- Lighthouse（CWV）／手動キーボード操作（focus-visible）／`prefers-reduced-motion`

---

## 10. 参考サイト利用上の注意
真似るのは **パターン（構造・余白リズム・型）** であり、掲載サイトの画像・文言・独自素材は流用しない。Awwwards / MUUUUU.ORG はベンチマーク/発掘用。
