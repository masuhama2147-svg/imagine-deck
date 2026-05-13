# Imagine Deck

> 愛媛大学ミュージアム交流スペース「Imagine Deck」公式サイト

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-published-8b168f)](https://masuhama2147-svg.github.io/imagine-deck/)

Imagine Deck は、愛媛大学ミュージアムに新設された **「知的交流のハブ」** です。
研究成果の発信、社会教育への地域参加、学生の学習支援という 3 つの基本機能をさらに発展させ、
**「見る・触れる・考える・対話する」** という 4 つの新しい柱を中心に設計された交流スペースです。

このリポジトリは、Imagine Deck の公式 LP / 予約 / 開催ログ Web サイトの実装です。

---

## 公開 URL

- **本番**: <https://masuhama2147-svg.github.io/imagine-deck/>
- **GitHub Pages の更新**: `main` ブランチへの push 時に自動デプロイ

---

## 4 つのコア機能

| | 機能 | 概要 |
| --- | --- | --- |
| 1 | **オープンスペース機能** | 社会人大学院生など多様な人々が自習・対話できるコモンズ |
| 2 | **ショーケース機能** | 研究科・学部の成果をプロトタイプ／映像でインタラクティブ展示 |
| 3 | **ワークショップ & スタートアップ支援機能** | 学生主催 WS、PBL、起業支援 |
| 4 | **インタラクティブ体験** | 「見る・触れる・考える・対話する」多面的な体験 |

---

## サイト構成（6 ページ）

| ページ | パス | 目的 |
| --- | --- | --- |
| ホーム | `index.html` | サイトの全体像、4 機能、最新ログ、CTA |
| 予約 | `reserve.html` | 6 ステップ式予約フォーム（UX 強化） |
| ガイドライン | `guidelines.html` | 4 つのコア機能、目的、3 区分の利用ルール |
| カレンダー | `calendar.html` | 月別予約状況・空き状況確認 |
| 開催ログ | `event-log.html` | 過去イベントの一覧（検索／タグ／月絞り） |
| 開催ログ詳細 | `event-detail.html` | 1 イベントの詳細レポート |

---

## 技術スタック

- **HTML / CSS / Vanilla JavaScript**（フレームワーク非依存）
- CSS は 5 層構成: `base / layout / components / pages / motion`
- JS は ES Modules でモジュール分割: `main / reservation / calendar / event-log / motion`
- 外部ライブラリゼロ（フォントの Google Fonts のみ）
- WCAG 2.2 AA 準拠、`prefers-reduced-motion` 対応、375 / 768 / 1024 / 1440 で動作確認済み

---

## ファイル構成

```
.
├── index.html / reserve.html / guidelines.html / calendar.html / event-log.html / event-detail.html
├── css/
│   ├── base.css         # リセット + デザイントークン
│   ├── layout.css       # ヘッダー / フッター / グリッド
│   ├── components.css   # ボタン / カード / フォーム / ステッパー / カレンダー 等
│   ├── pages.css        # 各ページ固有のレイアウト
│   └── motion.css       # スクロール reveal / glass / mesh / arrow-link / spotlight
├── js/
│   ├── main.js          # ハンバーガー / モーダル / 共通
│   ├── reservation.js   # 6 ステップ式予約フォーム
│   ├── calendar.js      # 月カレンダー描画
│   ├── event-log.js     # 検索 / フィルター
│   └── motion.js        # Intersection Observer / magnetic / counter / parallax
├── data/
│   └── events.json      # 開催ログのデータソース
├── assets/
│   └── images/          # Hero / セクション / 4 機能 / フロー / 開催ログ画像
├── IMPLEMENTATION_PLAN.md   # 改築計画書（UX 強化版）
├── IMAGE_PROMPTS.md         # 背景画像の生成プロンプト集
└── README.md
```

---

## ローカルでの確認

依存パッケージ不要。任意の静的サーバーでルートを公開すれば動きます。

```sh
# Python 標準サーバー（推奨）
python3 -m http.server 8765 --bind 127.0.0.1

# その後ブラウザで:
# http://127.0.0.1:8765/index.html
```

---

## ライセンス・利用

愛媛大学ミュージアムの公式コンテンツを含むため、コードベースの自由利用は本リポジトリ管理者にお問い合わせください。

---

## 開発

実装の判断基準・予約フォーム UX の人間工学的原則は [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) を参照。
背景画像の再生成プロンプトは [IMAGE_PROMPTS.md](./IMAGE_PROMPTS.md) を参照。
