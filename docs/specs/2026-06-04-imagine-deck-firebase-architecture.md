> 注記（重要）: 本書はあくまで**設計**です。`firestore.rules` 等のコードファイルはまだリポジトリに作成していません（設計ワークフロー中に一時生成された `firestore.rules` は約束どおり削除済み。承認後の実装段階で正式に作成します）。本書はモバイル/PC最適化の設計書 `2026-06-04-imagine-deck-redesign-design.md` の**アーキテクチャ部分を置き換える**改訂版です（デザイン最適化・予約フォームUXの中身はそのまま継続採用）。

---

# Imagine Deck — Firebase ローカルアプリ化 改訂アーキテクチャ設計

- 作成日: 2026-06-04 / ステータス: 設計（実装前）／オーナー確認待ち
- 対象: Imagine Deck 公式サイト（愛媛大学ミュージアム 交流・知的ハブ）
- 前提となる方針転換: 旧「Phase 1 = 純静的」は**破棄**。本書が上位。サイトを **Firebase アプリ化し、Firebase Emulator Suite で完全ローカルに構築・実行**する（実 Firebase プロジェクト不要・課金不要・オフライン動作）。
- 既存設計の継続: モバイル/PC 最適化と予約フォーム UX は `docs/specs/2026-06-04-imagine-deck-redesign-design.md` をそのまま採用。本書はそこに **Firebase レイヤを最小改変で重ねる**。
- 検証根拠: 本書の構成は実コード（`js/calendar.js` の `loadEvents()`/`el()`、`js/reservation.js` の `initSubmit()` L524-、`js/main.js` のヘッダ初期化、`reserve.html` L93 `data-endpoint=""`、`data/events.json` の `reserved[]`、（設計済みの）`firestore.rules` の内容）と突き合わせ済み。
- 重要な前提確認: 本マシンは `firebase-tools 14.11.2` / `node v25.9.0` は導入済みだが **Java 未導入**（`java -version` が "Unable to locate a Java Runtime"）。Firestore/Auth エミュレータは JVM アプリのため、**着手前に JDK（Temurin 17 か 21 推奨）導入が必須**。

---

## 1. 全体アーキテクチャ

### 方針
- フロントは **buildless 継続**：バンドラ・npm install なし。HTML + ネイティブ ES モジュール（`js/*.js`）+ 5層 CSS（base/layout/components/pages/motion）を維持。
- Firebase は **モジュラー Web SDK v12.14.0（v11+ モジュラー API。現行安定版）** を gstatic CDN から ESM で読み込む。`importmap` で `firebase/app` 等の bare specifier を CDN URL に解決し、**バージョンは1か所だけ**で管理。
- ローカル実行は **Emulator Suite（Auth + Firestore + Functions + Hosting + UI）**。Hosting エミュレータが従来の `python -m http.server` を置き換え、リポジトリルートをそのまま配信するので既存の相対パス・ESM がそのまま動く。

### ページ ⇄ Firebase の流れ（テキスト図）

```
ブラウザ（http://127.0.0.1:5000 = Hosting エミュレータ配信）
  │  index.html / reserve.html / calendar.html / event-log.html / members.html ...
  │  <script type="importmap"> firebase/* → https://www.gstatic.com/firebasejs/12.14.0/firebase-*.js
  │
  ├─ js/firebase.js（初期化シングルトン）
  │     initializeApp({ projectId:'demo-imagine-deck', apiKey:'demo' })
  │     export auth / db / functions
  │     if (localhost|127.0.0.1) connect*Emulator(...)   ← dev のみ
  │
  ├─ js/auth.js        → Auth エミュレータ :9099（signup/login/logout, onAuthStateChanged）
  ├─ js/calendar.js    → Firestore エミュレータ :8080（events 読み取り）
  ├─ js/reservation.js → Firestore :8080（reservations 書き込み, 要ログイン）
  └─ （signup 時）Auth が beforeUserCreated ブロッキング関数を発火
                      → Functions エミュレータ :5001 で role 判定（メールドメイン）
                      → Firestore に users/{uid} プロフィール作成
```

### dev（エミュレータ）と将来の実プロジェクトの差

| | 今（ローカル・本構成） | 将来 実プロジェクト（参考・今は不要） |
|---|---|---|
| プロジェクトID | `demo-imagine-deck`（`demo-` 接頭辞でSDKが完全オフライン化） | 実IDに差し替え |
| 接続先 | `connect*Emulator()` で 127.0.0.1 のエミュレータ | CDN configの実エンドポイント |
| 切替方法 | `js/firebase.js` の `location.hostname` 判定（dev=localhost/127.0.0.1） | 同ファイルがそのまま prod 分岐 |
| ブロッキング関数 | エミュレータでは Identity Platform アップグレード**不要** | 実プロジェクトでは GCIP アップグレード**必須** |
| 課金 | **一切なし** | 従量課金が発生 |

**NO billing / NO real project の確認**：`demo-` 接頭辞のプロジェクトIDを使うと Emulator Suite は資格情報・SDK config ダウンロードを一切行わず完全オフラインで動く（出典: https://firebase.google.com/docs/emulator-suite/connect_and_prototype）。実 Firebase プロジェクトの作成・課金設定・認証情報は不要。

---

## 2. ローカル構築の手順と構成ファイル

### 前提（インストール）
1. **Node.js**（導入済み: v25.9.0）
2. **firebase-tools**（導入済み: 14.11.2。`npm i -g firebase-tools` で更新可）
3. **JDK（Temurin 17 か 21）= 必須・未導入**。Firestore/Auth エミュレータは JVM 上で動くため、無いと `firebase emulators:start` が "Unable to locate a Java Runtime" で失敗する。
4. `functions/` で一度だけ `npm install`（**リポジトリ唯一の npm install**。フロントは buildless 維持）。

### 構成ファイル

**`firebase.json`**（emulators ブロック + デフォルトポート）
```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "functions/**", "scripts/**",
               "firestore.rules", "firestore.indexes.json",
               ".emulator-data/**", "docs/**", "*.md"],
    "cleanUrls": true
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "functions": { "source": "functions" },
  "emulators": {
    "auth":      { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting":   { "port": 5000 },
    "ui":        { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```
ポートはすべて Firebase 公式デフォルト（hub は 4400）。`hosting.public:"."` でリポジトリルートを配信し、既存 HTML/CSS/JS/`data/events.json` がそのまま動く。`ignore` で `functions/` 等が公開されないようにする（出典: https://firebase.google.com/docs/emulator-suite/install_and_configure）。

**`.firebaserc`**
```json
{ "projects": { "default": "demo-imagine-deck" } }
```
`demo-` 接頭辞で完全オフライン化。`firebase use` は demo プロジェクトを選べないので `.firebaserc` に固定（必要なら `--project demo-imagine-deck`）。

**`firestore.rules`** — §4 に掲載（実装時に作成。users/{uid}.role を権威とする版）。

**`firestore.indexes.json`**
```json
{
  "indexes": [
    { "collectionGroup": "events", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "date", "order": "ASCENDING" } ] },
    { "collectionGroup": "reservations", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "uid", "order": "ASCENDING" },
                  { "fieldPath": "createdAt", "order": "DESCENDING" } ] }
  ],
  "fieldOverrides": []
}
```
エミュレータはインデックス不要だが prod パリティのため記載。

**`functions/`**（Node。Functions エミュレータで実行）— `package.json` と `index.js` は §3 に掲載。

**`js/firebase.js`**（初期化 + emulator 接続。localhost 判定）
```js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp({ projectId: 'demo-imagine-deck', apiKey: 'demo', authDomain: 'localhost' });
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

const isDev = ['localhost', '127.0.0.1', ''].includes(location.hostname);
if (isDev) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
```
`connect*Emulator()` は各 `get*()` 直後・他の SDK 呼び出しより前に同期実行。ホストは `localhost` でなく **`127.0.0.1` で統一**（IPv6/CORS 不整合回避）。ES モジュールのシングルトン性により多重接続は自動的に防止される（出典: https://firebase.google.com/docs/emulator-suite/connect_auth, https://firebase.google.com/docs/web/alt-setup）。

**全 HTML の `<head>`（module スクリプトより前）に importmap**
```html
<script type="importmap">{ "imports": {
  "firebase/app":       "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js",
  "firebase/auth":      "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js",
  "firebase/firestore": "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js",
  "firebase/functions": "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js"
}}</script>
```
（importmap が懸念なら `js/firebase.js` で gstatic フル URL を直接 import しても等価。Safari は 16.4+ で対応。）

### 実行とシード

**起動**
```bash
firebase emulators:start --import=./.emulator-data --export-on-exit
```
起動後、サイトは **http://127.0.0.1:5000**、Emulator UI は **http://127.0.0.1:4000**。`file://` では ESM/importmap が動かないため必ず Hosting エミュレータ URL で開く。

**シード（events を `data/events.json` から投入 + デモユーザ作成）**
```bash
firebase emulators:exec --import=./.emulator-data "node scripts/seed-events.mjs"
```
`scripts/seed-events.mjs` は `firebase-admin` をエミュレータに向け（`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`）、`admin.initializeApp({ projectId:'demo-imagine-deck' })` 後に:
- `data/events.json` の `reserved[]` を `events` コレクションへ（`ownerUid:'staff-seed'`, organizer から `sector` 推定, `createdAt`）。
- デモユーザ2名を作成：`taro@ehime-u.ac.jp`（pw `password`, role=university/sector=academia）と `partner@example.co.jp`（pw `password`, role=external/sector=industry）。
- **重要**：Admin SDK で作成したユーザはエミュレータでブロッキング関数を**発火しない**（firebase-tools #6235）ため、`admin.auth().setCustomUserClaims()` で claim を明示設定し、`users/{uid}` と `users_public/{uid}` を直接書く（admin 書き込みはルールをバイパス）。
- 冪等化（events 既存ならスキップ）。

`package.json`（ルート・scripts のみ・任意）
```json
{ "scripts": {
    "emu":  "firebase emulators:start --import=./.emulator-data --export-on-exit",
    "seed": "firebase emulators:exec --import=./.emulator-data 'node scripts/seed-events.mjs'" } }
```

`.gitignore` 追記: `functions/node_modules/`, `.emulator-data/`, `firebase-debug.log`, `firestore-debug.log`, `ui-debug.log`, `.firebase/`。

---

## 3. アカウントと役割（メール＋ドメイン自動判定）

### 認証フロー（email + password）
- **signup**（`signup.html` + `js/signup.js`）: `createUserWithEmailAndPassword` → `updateProfile(displayName)` → **`await user.getIdToken(true)`（強制リフレッシュで role claim を反映）** → `setDoc(doc(db,'users',uid), {...})` → `sendEmailVerification(user)` → mypage へ。
- **login**（`login.html` + `js/login.js`）: `signInWithEmailAndPassword`。`auth/wrong-password` 等を日本語化。`sendPasswordResetEmail` リンクも用意（メールは Auth Emulator UI に表示）。
- **logout**: 共有 `js/auth.js` の `signOut(auth)`。

### ドメイン → role 自動判定（Cloud Function カスタムクレーム）
`functions/index.js` の **2nd-gen ブロッキング関数 `beforeUserCreated`**（`firebase-functions/v2/identity`）が `event.data.email` を検査し、`@*.ehime-u.ac.jp` / `ehime-u.ac.jp` なら `role:'university'`、それ以外は `role:'external'` を **customClaims** として返す。ブロッキング関数はサインアップと**同期**で claim を最初の ID トークンに焼き込むため、「ログインしたが role が無い」窓が生じない（出典: https://firebase.google.com/docs/auth/extend-with-blocking-functions）。クライアントの `createUserWithEmailAndPassword` はエミュレータでも発火する（発火しないのは Admin SDK 作成ユーザのみ＝シード経路。§2参照）。

```js
const { beforeUserCreated, beforeUserSignedIn } = require('firebase-functions/v2/identity');
const UNIV = /@([a-z0-9-]+\.)*ehime-u\.ac\.jp$/i;

exports.assignRoleOnCreate = beforeUserCreated((event) => {
  const email = (event.data?.email || '').toLowerCase();
  const isUniv = UNIV.test(email);
  return { customClaims: { role: isUniv ? 'university' : 'external', universityVerified: false } };
});

// 次回サインイン時、ehime-u かつ emailVerified なら 学 を「検証済み」へ昇格
exports.promoteOnVerify = beforeUserSignedIn((event) => {
  const u = event.data;
  if (UNIV.test((u?.email || '').toLowerCase()) && u?.emailVerified) {
    return { customClaims: { role: 'university', universityVerified: true } };
  }
});
```

`functions/package.json`
```json
{ "name": "functions", "engines": { "node": "20" }, "main": "index.js", "type": "commonjs",
  "dependencies": { "firebase-admin": "^13", "firebase-functions": "^6" } }
```

### なりすまし注意と推奨対応
**`beforeUserCreated` 時点ではメール未検証**（password アカウントの `email_verified` は false）なので、ドメインだけでは **誰でも `someone@ehime-u.ac.jp` を打って role=university を取得できる**。対応:
- **role は即時付与**（オンボーディングを止めない）が、**`universityVerified:false`** を別 claim で持つ。
- サインアップ時に `sendEmailVerification` を送り、**`beforeUserSignedIn` で `emailVerified` を再評価して `universityVerified:true` に昇格**。
- 「**検証済み 学**」バッジ・「無料利用の確定」など信用が要る表示は **`universityVerified` でゲート**。未検証 university は権威扱いしない。
- エミュレータでは検証リンクが Auth UI / Functions ログに出るので**オフラインで完全テスト可能**。

### プロフィール `users/{uid}`
`{ uid, email(非公開), displayName, role('university'|'external'|'staff'), sector('academia'|'industry'|'government'|'other'), organization, createdAt, updatedAt }`。signup.js がクライアントで作成（sector の 産/官 選択はフォーム入力）。**role/sector の整合はセキュリティルールが強制**（クライアントの自己申告を信用しない）。signup フォームは ehime-u メール検出時に sector ピッカーを隠して `academia` 固定（UX用。サーバ側ルールが最終強制）。

---

## 4. データモデルとセキュリティルール

### コレクション

**`users/{uid}`**（フルプロフィール・非公開）
`uid, email(PRIVATE), displayName, role, sector, organization, createdAt, updatedAt`。読みは本人 + staff のみ。

**`users_public/{uid}`**（公開射影・メンバー可視化用）
`{ uid, displayName, sector, organization, role }` のみ。**email/連絡先は持たない**。`read:true / write:false`（Function/admin のみ書き込み＝クライアントが sector/role を偽装できない）。`users` の sector/displayName 変更は Function トリガで `users_public` にミラーする（無いと公開バッジが遅延）。

**`events/{id}`**（`data/events.json` からシード）
`date('YYYY-MM-DD'), type('event'|'exhibition'|'workshop'|'academic'|'maintenance'), title, organizer, start('HH:MM'), end('HH:MM'), ownerUid, sector, createdAt`。**既存 events.json と同じ形＋ sector/ownerUid** なので calendar 描画と `el()` は無改変。Public read。

**`reservations/{id}`**（6ステップフォーム payload + システム項目）
フォーム: `date, startTime, endTime, orgName, studentName, studentEmail, staffName, staffEmail, purposeType, reserveType, audience, academic, capacity, fee('free'|'paid' = **ラベルのみ**), catering, area[], purpose, eventDetail, sns, relatedUrl, notes, files[]({name,size,type} のメタのみ)`。システム: `uid, role, sector, status('pending'|'confirmed'|'cancelled'), createdAt, updatedAt`。
**料金は表示専用**：`amountPaid`/`paymentId`/`charge`/`transactionId` 等の課金フィールドは**一切保存しない**（ルールでも拒否）。`status:'pending'` で作成し、`confirmed`/`cancelled` への遷移は staff のみ＝既存の「運営から内容確認のご連絡」コピーと一致。

### セキュリティルール（実装時に作成する `firestore.rules`（下記が確定版の内容））
role の権威は **`users/{uid}.role`（admin SDK で書かれる）**。custom claim は fast-path だが、エミュレータの claim 伝播バグ（#5044, #5327）に左右されないようルールは users doc を権威にする。

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function uid() { return request.auth.uid; }
    function userRole() {
      return isSignedIn()
        ? get(/databases/$(database)/documents/users/$(uid())).data.role : null;
    }
    function isStaff() {
      return isSignedIn() && ((request.auth.token.staff == true) || userRole() == 'staff');
    }
    function isOwner(rsc) { return isSignedIn() && rsc.data.uid == uid(); }
    function incomingIsOwn() { return isSignedIn() && request.resource.data.uid == uid(); }

    match /users/{userId} {
      allow read: if isStaff() || (isSignedIn() && userId == uid());
      allow create: if isSignedIn() && userId == uid()
                    && request.resource.data.uid == uid()
                    && request.resource.data.role in ['university', 'external']
                    && request.resource.data.sector in ['academia','industry','government','other'];
      allow update: if isSignedIn() && userId == uid()
                    && request.resource.data.role == resource.data.role   // role はクライアント不変
                    && request.resource.data.uid == resource.data.uid
                    && request.resource.data.sector in ['academia','industry','government','other'];
      allow delete: if isStaff();
    }

    match /users_public/{userId} {
      allow read: if true;        // メンバー一覧 + 産学官バッジ用
      allow write: if false;      // Functions のみ（admin はルールをバイパス）
    }

    match /events/{eventId} {
      allow read: if true;
      allow create: if isStaff() || incomingIsOwn();
      allow update, delete: if isStaff() || isOwner(resource);
    }

    match /reservations/{resId} {
      allow read: if isStaff() || isOwner(resource);
      allow list: if isStaff() || isSignedIn();   // 非staff は .where('uid','==',uid) 必須
      allow create: if incomingIsOwn()
                    && request.resource.data.status == 'pending'
                    && request.resource.data.keys().hasAll(['uid','date','status','createdAt'])
                    && !request.resource.data.keys().hasAny(['amountPaid','paymentId','charge','transactionId']);
      allow update: if isStaff()
                    || (isOwner(resource) && resource.data.status == 'pending'
                        && request.resource.data.uid == resource.data.uid
                        && request.resource.data.status in ['pending','cancelled']);
      allow delete: if isStaff();
    }
  }
}
```
**料金=表示専用の二重担保**：ルールの課金フィールド `hasAny([...])` 拒否 + クライアントの `collectFormData()` は fee ラベルのみマッピング。出典: https://firebase.google.com/docs/firestore/solutions/role-based-access, https://firebase.google.com/docs/firestore/enterprise/security/rules-fields。

---

## 5. 既存フロントエンドへの統合（最小改変）

| 対象 | 現状 | 改変 |
|---|---|---|
| `js/calendar.js` `loadEvents()`（L16-27） | `fetch('data/events.json')` → `data.reserved` | `import { db } from './firebase.js'; const snap = await getDocs(query(collection(db,'events'), orderBy('date'))); eventsCache = snap.docs.map(d => ({ id:d.id, ...d.data() }))`。**返す形 `{date,type,title,organizer,start,end}` を維持**するので `Calendar` 描画・`el()`・`eventsOnDate()`・`isClosed()`・`reservation.js` の overlap 判定は無改変。`loadEvents()`/`el()` の export 署名も不変。 |
| `js/reservation.js` `initSubmit()`（L524-, とくに L547-565 の endpoint POST） | `data-endpoint` 空 = demo / 値ありで FormData POST | **要ログイン**：`auth.currentUser` が null なら `login.html?next=reserve.html` へ。署名後は `addDoc(collection(db,'reservations'), { ...collectFormData()マップ, uid, role, sector, status:'pending', createdAt: serverTimestamp() })`。`amountPaid` 等は付けない。**既存の全ステップ `validateStep()`・確認 UI・成功/失敗 `el()` アラートはそのまま**流用。 |
| `reserve.html` L93 | `<form id="reserve-form" data-endpoint="" novalidate>` | `data-endpoint` は dead code 化（削除 or 残置）。Step3 に role 別料金表示を追加（次行）。 |
| 料金表示（Step3 利用内容） | 静的コピー | `auth.currentUser` の role で **外部=15,080円（必須・壁面展示21日/3週間）／大学=無料** を**情報として**出し分け。決済なし・transaction 記録なし。本格展示/ブリーフィングは従来どおりミュージアム窓口へ誘導（DB 書き込みとは別フローで残す）。 |
| `js/main.js`（DOMContentLoaded・L95-100） | ヘッダ初期化のみ | 新規 `js/auth.js` を全ページ読み込み。`onAuthStateChanged` でヘッダの `[data-auth-slot]`（未署名=ログイン/新規登録リンク、署名済=表示名 + sector バッジ + ログアウト）を描画。`reserve`/`mypage`/`members` の `requireAuth()` ガードもここ経由。 |
| `js/event-log.js` | ハードコード組織 | 各カードに organizer の sector から **学/産/官 バッジ**を描画（§6）。 |
| ヘッダ markup（`index.html` L37 `l-header__cta` 隣 / L42 `#mobile-nav`） | 予約 CTA のみ | `<div class="l-header__auth" data-auth-slot hidden></div>` を追加。モバイル nav にもミラー。 |

---

## 6. 産学官連携の可視化

### 何を可視化するか（マッチング**ではない**）
本プロダクトの目的は Imagine Deck の収益ではなく **産学官連携**＝外部（産/官）と大学（学）の接続。スコープは「**所属の可視化**（プロフィール + 可視性）」に限定し、直接コンタクト/マッチング機能は作らない。

- **イベントログのバッジ**：`event-log.html` の各カードと `calendar` の日別モーダルで、organizer の `sector` に応じた色付き **学/産/官 バッジ**を表示（`events.sector` 由来）。
- **メンバー/参加者一覧（`members.html`）**：`users_public` を読んで displayName + role ラベル + sector バッジを一覧表示。sector（学/産/官/all）でフィルタ。「誰がどのセクターから関わっているか」を一望でき、連携の入り口になる。

### sector モデル
`academia`(学) / `industry`(産) / `government`(官) /（必要なら `other`）。`role=='university'` ⇒ sector は `academia` 強制。`role=='external'` ⇒ 産 か 官 を選択。色は既存トークンを流用し**色だけに依存しない（字形＋色）**：学=primary `#8b168f`、産=accent `#f4a93a`、官=info 系。`css/components.css` に `.c-sector-badge` + 修飾子（`--academia/--industry/--government`）を追加し、`.l-header__auth` レイアウトを既存 `.c-button` サイズで構成（buildless 5層維持）。

### プライバシ
- **email は非公開**：`users/{uid}`（email 含む）は本人 + staff のみ読める。
- **公開は displayName / sector / organization / role のみ**：別コレクション `users_public/{uid}` に射影し、`read:true / write:false`。これにより email が公開ドキュメントに混ざらず、クライアントが自分の sector/role を偽装できない（Function/admin のみ書く）。連絡先は一切公開しない＝「可視化はするが直接マッチングはしない」を担保。

---

## 7. ファイル別 実装マップ

| ファイル | 区分 | 内容 |
|---|---|---|
| `firebase.json` | 新規・config | emulators ブロック + ポート、hosting=`.`、firestore/functions 配線 |
| `.firebaserc` | 新規・config | `default: demo-imagine-deck` |
| `firestore.rules` | 新規・security-rules | §4 の内容。users/{uid}.role 権威・課金フィールド拒否 |
| `firestore.indexes.json` | 新規・config | events.date / reservations(uid,createdAt) |
| `functions/index.js` | 新規・function | `beforeUserCreated`(role) + `beforeUserSignedIn`(universityVerified 昇格) |
| `functions/package.json` | 新規・config | firebase-admin ^13 / firebase-functions ^6、node20 |
| `scripts/seed-events.mjs` | 新規・seed | events.json 投入 + デモユーザ + claim 明示設定 |
| `js/firebase.js` | 新規・module | init + `connect*Emulator`（localhost 判定） |
| `js/auth.js` | 新規・module | `onAuthStateChanged` ヘッダ制御、`requireAuth()`、`getRoleAndSector()` |
| `js/signup.js` / `signup.html` | 新規 | email/pw + sector ピッカー（ehime-u 検出で 学 固定）、token 強制リフレッシュ→users 作成→検証メール |
| `js/login.js` / `login.html` | 新規 | サインイン + 日本語エラー + パスワードリセット |
| `js/mypage.js` / `account/mypage.html` | 新規 | 保護ページ。プロフィール編集（external のみ sector 可変）、自分の予約一覧、検証再送、ログアウト |
| `members.html`(+ `js/members.js`) | 新規 | `users_public` 一覧 + 学/産/官 バッジ + sector フィルタ |
| `js/calendar.js` | 既存・改 | `loadEvents()` を Firestore 読みに（形維持） |
| `js/reservation.js` | 既存・改 | `initSubmit()` を要ログイン + `reservations` 書き込みに（検証/確認UI 流用）、Step3 料金出し分け |
| `js/main.js` | 既存・改 | `js/auth.js` 連携・ルートガード |
| `js/event-log.js` / `event-log.html` | 既存・改 | sector バッジ描画 |
| `reserve.html` | 既存・改 | auth バナー + Step3 料金表示、`data-endpoint` 廃止 |
| 全 HTML `<head>` | 既存・改 | importmap + `data-auth-slot` + `js/auth.js` 読み込み |
| `css/components.css` | 既存・改 | `.c-sector-badge` / `.l-header__auth`（5層維持） |

**既存リデザインとの合成**：新規ページ（login/signup/mypage/members）はすべて既存 `.c-field/.c-input/.c-button` と 5層 CSS・タイポグラフィ・カラー（primary `#8b168f` / accent `#f4a93a`、Noto Sans JP + Zen Old Mincho）に乗せる。予約フォーム UX は `docs/specs/2026-06-04-imagine-deck-redesign-design.md` の設計を変えず、送信先だけ Firestore に差し替える。

---

## 8. ビルド順序（基盤先行型を踏襲）

| 段階 | 内容 | 検証チェックリスト |
|---|---|---|
| **S0 Firebase 基盤** | JDK 導入 → `firebase.json`/`.firebaserc`/`functions/`/`js/firebase.js`/importmap → `emulators:start` → seed | エミュレータが全種起動／http://127.0.0.1:5000 で既存ページ表示／Emulator UI(4000) に seeded events が見える |
| **S1 デザイン基盤** | 旧 spec のモバイル/PC 最適化・共通ヘッダ/フッタ・予約フォーム UX を実装 | 既存 6 ページがレスポンシブで崩れない／Lighthouse/可読性確認 |
| **S2 認証 + プロフィール + ヘッダ状態** | signup/login/logout、`beforeUserCreated`、users/{uid}、`js/auth.js` ヘッダ slot | `taro@ehime-u.ac.jp`→role=university、`partner@example.co.jp`→external（**ドメインで正しく判定**）／署名後ヘッダに表示名 + sector バッジ／検証メールが Auth UI に出る |
| **S3 予約 → Firestore + 料金表示** | `reservation.js` 書き込み・要ログイン・Step3 料金出し分け | 未署名は login へ誘導／署名後送信で `reservations` に doc 生成（**課金フィールド無し**を Emulator UI で確認）／external 15,080円・大学 無料の表示／既存 validate/確認 UI 動作 |
| **S4 産学官 可視化** | event-log/calendar の sector バッジ、`members.html`、`users_public` ミラー | バッジが学/産/官で正しく出る／members 一覧が `users_public` を読み email を**出さない**／sector フィルタ動作 |

各段は前段の検証通過を前提に進める（基盤先行型）。

---

## 9. リスク・注意

- **JDK 必須（着手ブロッカー）**：本マシンは Java 未導入。`emulators:start` とルールコンパイルが動かない。最初に Temurin 17/21 を入れる。
- **ブロッキング関数のエミュレータ挙動**：Admin SDK 作成ユーザは `beforeUserCreated`/`beforeUserSignedIn` を**発火しない**（#6235）。seed は `setCustomUserClaims()` で claim を明示設定し users/users_public を直書きする。クライアントの `createUserWithEmailAndPassword` は発火するので通常サインアップは正常。
- **custom claim の伝播 = トークンリフレッシュ必須**：claim は ID トークンに乗るため、サインアップ直後は `getIdToken(true)`/`getIdTokenResult(true)` で**強制更新してから** role を読む。さもないと最初の書き込みで `request.auth.token.role` が null。加えてエミュレータには claim 伝播バグ（#5044 空claim, #5327 文字列化）があるため、**ルールは users/{uid}.role を権威**にして claim 不調に依存しない設計にしてある。
- **本番のブロッキング関数要件**：実プロジェクトでは Identity Platform へのアップグレードが必須（エミュレータでは不要）。ローカル専用の今は無関係だが、将来デプロイ時の前提として記録。必要なら callable `assignRole`（`request.auth` を信頼して role を再計算）をエスケープハッチに。
- **buildless ESM / importmap**：importmap はモダンブラウザ必須（Safari 16.4+）。古い Safari を狙うなら `js/firebase.js` で gstatic フル URL を直接 import に切替（バージョン管理箇所が1つ増えるだけ）。`file://` では ESM/importmap が動かないので必ず Hosting エミュレータ URL で開く。
- **`connect*Emulator` のタイミング/二重呼び出し**：必ず最初の SDK 操作より前に1回だけ。Firestore は初回使用後の設定変更で例外。`js/firebase.js` のシングルトンで担保。ホストは `127.0.0.1` で統一し `connectAuthEmulator` は `http://` を付ける（localhost/127.0.0.1 混在は CORS/cookie 問題の元）。
- **ルールの落とし穴**：(1) `reservations` の `allow list` は行制限しないので、非 staff のクエリは必ず `.where('uid','==',auth.uid)` を付ける（付けないと per-doc read で拒否）。(2) `userRole()` は `get()` を行う＝ローカルは無償だが prod では read 課金。スケール時は claim へ移行。(3) 課金禁止は `hasAny([...])` の**拒否リスト**で実装。新たな課金系フィールドを足すならリストも更新（または許可リスト化）。(4) `users_public` の鮮度：`users` 更新を Function でミラーしないと公開バッジが遅延。
- **`loadEvents()` の非同期化**：`fetch` から `getDocs` に変わっても `Calendar.init()` が `await loadEvents()` してから `render()` する流れは不変。availability 判定はこの配列に依存するので await 漏れに注意。
- **ファイル添付**：`reservations.files` は `{name,size,type}` のメタのみ保存（Cloud Storage は今回スコープ外）。実ファイル保存が必要になったら Storage を別途追加。
- **GitHub Pages デプロイは置換**：従来の静的 GitHub Pages 配信は本 Firebase アプリ（当面ローカル Hosting エミュレータ）に**置き換えられる**。GitHub Pages に置いても `js/firebase.js` の dev 分岐が効かず（存在しない）prod に接続できないだけで害はないが、正規の起動口は http://127.0.0.1:5000。`README.md` の旧 URL 記述は更新が必要。
- **SDK バージョン**：要件「v11+」に対し現行 gstatic は 12.14.0（v12 もモジュラー API で v11 と同一）。CDN URL は**全 firebase-*.js で同一バージョン**に固定（混在は実行時破綻）。`latest` は gstatic がホストしないので明示ピン。firebase-tools(CLI) は SDK と独立採番（現行 14.x/15.x）。
- **料金=表示専用の徹底**：15,080円を「請求/支払額」として保存するフィールド・コレクションを作らない。コピーは静的 HTML に留め、取引を示唆しない。

参照ファイル（すべて絶対パス）：`firestore.rules`（実装時に作成）、`/Users/koyamatakuto/Downloads/Imagine Deck_LP/js/calendar.js`、`/Users/koyamatakuto/Downloads/Imagine Deck_LP/js/reservation.js`、`/Users/koyamatakuto/Downloads/Imagine Deck_LP/js/main.js`、`/Users/koyamatakuto/Downloads/Imagine Deck_LP/data/events.json`、`/Users/koyamatakuto/Downloads/Imagine Deck_LP/docs/specs/2026-06-04-imagine-deck-redesign-design.md`。
---

## 10. 管理者画面（追補・確定）

- **管理者アカウント**: `k520185k@mails.cc.ehime-u.ac.jp` を管理者（`role: 'staff'`）とする。ehime-u 配下のため通常は university 判定だが、`functions/index.js` の管理者許可リスト `ADMINS` を**ドメイン判定より先に評価**し `role:'staff', staff:true` を付与。seed でも同アドレスの `users/{uid}.role='staff'` を作成（ルールの権威は users doc）。
- **役割判定の最終仕様**: ADMINS該当 → `staff` ／ `@*.ehime-u.ac.jp` → `university` ／ それ以外 → `external`。
- **管理範囲（フル管理）**:
  1. 予約管理 — `reservations` の一覧・詳細、`status` を `pending → confirmed / cancelled` に変更
  2. 開催ログ＝イベント管理 — `events` の CRUD（スクショのカードを追加/編集/削除：type/date/title/organizer/start/end/sector）
  3. メンバー管理 — `users_public` 一覧・役割/所属（学/産/官）確認
  4. 集計ダッシュボード — 予約件数・イベント数・メンバー数・セクタ別内訳
- **UI 方針**: サイトの世界観（5層CSS・トークン・#8b168f/#f4a93a・Noto Sans JP/Zen Old Mincho）を踏襲しつつ、一覧/編集・削除・承認ボタン/フィルタ/フォームを備えた専用レイアウト。公開「開催ログ」と視覚的に地続き。
- **アクセス制御**: `admin/` 配下は `js/auth.js` の `requireStaff()` でガード（staff 以外はトップへ）。Firestore ルールは staff に events 書込・reservations 全 read・status 遷移を許可済み。
- **新規ファイル**: `admin/index.html`（ダッシュボード＋タブ: 予約/イベント/メンバー）, `js/admin.js`（CRUD・status遷移・集計）。`css/components.css` に管理用 `.c-admin-*`（テーブル/ツールバー/バッジ）を追加（5層維持）。
- **ビルド順序への追加**: **S5 = 管理者画面**（S2 認証・S3 予約・S4 可視化の後）。seed 済みの管理者でログイン → `/admin` → 予約/イベント操作を検証。
- **JDK 状態**: `openjdk@21`(21.0.11) を Homebrew で導入済み。`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`。エミュレータ起動時に PATH/JAVA_HOME を設定。

### 保留事項（オーナーが後ほど具体指示）
- "Imagine Deck" の表記・ブランディング文言の調整。
- 他大学サービスとの**横展開**で「つなぐ箇所」（連携ポイント）の具体仕様。
