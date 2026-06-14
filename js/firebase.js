/* firebase.js — Firebase 接続の共通モジュール
   ・本番(ライブ)プロジェクト imagine-deck-v1-47b08（富田先生から引き継いだ、
     セキュリティ硬化済みのバックエンド：APIキー制限／クォータ／予算アラート／App Check）に接続
   ・localhost / 127.0.0.1 → Emulator Suite（安全なローカル検証用。App Check は使わない）
   ・App Check（reCAPTCHA v3）でフロントエンドを保護。万一失敗してもアプリは止めない（フェイルセーフ） */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyAf4VNtOyqF0uCefMVIhOma23tijYK_o-0",
  authDomain: "imagine-deck-v1-47b08.firebaseapp.com",
  projectId: "imagine-deck-v1-47b08",
  storageBucket: "imagine-deck-v1-47b08.firebasestorage.app",
  messagingSenderId: "182080455605",
  appId: "1:182080455605:web:95d85e62ec56c0170e8ffc",
};

// reCAPTCHA v3 サイトキー（imagine-deck-v1-47b08 の App Check に登録済み）
const RECAPTCHA_V3_SITE_KEY = "6LcTnRctAAAAAOlbdk13sP61JkbwvBCVgDjucTTz";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-northeast1");

/* ローカル開発時のみ Emulator に接続（本番データに触れず安全に試せる） */
export const USING_EMULATOR = ["localhost", "127.0.0.1"].includes(location.hostname);

/* App Check（reCAPTCHA v3）：本番ドメインでのみ初期化。
   ローカル(エミュレータ)では使わない。どんな環境でもランタイムエラーで
   アプリを止めないよう try/catch のフェイルセーフで包む（App Check は現在「助走期間」＝未強制）。 */
if (!USING_EMULATOR) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn("[App Check] 初期化をスキップしました:", e?.message || e);
  }
}

if (USING_EMULATOR) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8088);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  console.info("[firebase] Emulator に接続しました（ローカル検証モード）");
}

/* 管理者(承認者)の判定に使う公式メール */
export const ADMIN_EMAIL = "k520185k@mails.cc.ehime-u.ac.jp";
