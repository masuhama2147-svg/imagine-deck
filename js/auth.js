/* auth.js — ログイン/新規登録/役割判定 と ヘッダーの認証表示 */
import { auth, db, ADMIN_EMAIL } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const UNIV = /@([a-z0-9-]+\.)*ehime-u\.ac\.jp$/i;

export function roleOf(user) {
  if (!user || !user.email) return "guest";
  const e = user.email.toLowerCase();
  if (e === ADMIN_EMAIL) return "staff";
  if (UNIV.test(e)) return "university";
  return "external";
}
export function roleLabel(role) {
  return { staff: "管理者", university: "大学関係者", external: "学外の方", guest: "ゲスト" }[role] || role;
}

/* ---- actions ---- */
export async function signUp({ name, email, password, sector, organization }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  const role = roleOf(cred.user);
  const sec = (role === "staff" || role === "university") ? "academia" : (sector || "other");
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid, email, displayName: name || "", role, sector: sec,
    organization: organization || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  try { await sendEmailVerification(cred.user); } catch (_) {}
  return cred.user;
}
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOutUser = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

/* 日本語エラーメッセージ */
export function authErrorMessage(code) {
  return ({
    "auth/invalid-email": "メールアドレスの形式が正しくありません。",
    "auth/missing-password": "パスワードを入力してください。",
    "auth/weak-password": "パスワードは6文字以上にしてください。",
    "auth/email-already-in-use": "このメールアドレスは既に登録されています。ログインしてください。",
    "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
    "auth/too-many-requests": "試行回数が多すぎます。しばらくしてからお試しください。",
  })[code] || "エラーが発生しました。時間をおいて再度お試しください。";
}

/* ログイン後の遷移先を検証（オープンリダイレクト対策：同一オリジンの相対パスのみ許可） */
export function safeNext(raw, fallback = "index.html") {
  if (!raw) return fallback;
  if (raw.startsWith("/") || raw.startsWith("\\") || raw.includes(":") || raw.includes("..")) return fallback;
  if (!/^[a-zA-Z0-9_\-./?=&%]+$/.test(raw)) return fallback;
  return raw;
}

/* ---- header アカウントメニュー（全ページ共通・全ロール同じUI） ----
   ログイン中は右上にアバターアイコンを表示。クリックでメニューが開き、
   そこで初めて「管理者/大学関係者/学外の方」の役割が分かる（本文には出さない）。 */
const inAdmin = () => location.pathname.includes("/admin/");
const homeHref = () => (inAdmin() ? "../index.html" : "index.html");
const loginHref = () => (inAdmin() ? "../login.html" : "login.html");
const adminHref = () => (inAdmin() ? "index.html" : "admin/index.html");

function closeAccountMenu(menu) {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  const btn = menu.closest(".l-auth__menu-wrap")?.querySelector("[data-account-toggle]");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

/* 外側クリック / Esc は document に「一度だけ」登録（再描画のたびに増えるリークを防ぐ） */
let accountGlobalsWired = false;
function wireAccountGlobals() {
  if (accountGlobalsWired) return;
  accountGlobalsWired = true;
  document.addEventListener("click", (e) => {
    document.querySelectorAll("[data-account-menu]:not([hidden])").forEach((menu) => {
      const wrap = menu.closest(".l-auth__menu-wrap");
      if (wrap && !wrap.contains(e.target)) closeAccountMenu(menu);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll("[data-account-menu]:not([hidden])").forEach((menu) => {
      const btn = menu.closest(".l-auth__menu-wrap")?.querySelector("[data-account-toggle]");
      closeAccountMenu(menu);
      if (btn) btn.focus();
    });
  });
}

function buildAccountMenu(slot, { name, email, role }) {
  const initial = escapeHtml((email || name || "?").trim().charAt(0).toUpperCase());
  const adminItem = role === "staff"
    ? `<a class="l-auth__menu-item" href="${adminHref()}">承認・管理画面へ</a>`
    : "";
  slot.innerHTML =
    `<div class="l-auth__menu-wrap">` +
      `<button type="button" class="l-auth__avatar" data-account-toggle aria-haspopup="true" aria-expanded="false" aria-label="アカウント">` +
        `<span class="l-auth__avatar-letter">${initial}</span>` +
      `</button>` +
      `<div class="l-auth__menu" data-account-menu hidden>` +
        `<div class="l-auth__menu-head">` +
          `<span class="l-auth__menu-name">${escapeHtml(name || email)}</span>` +
          (name ? `<span class="l-auth__menu-email">${escapeHtml(email)}</span>` : "") +
          `<span class="l-auth__menu-role l-auth__menu-role--${role}">${roleLabel(role)}</span>` +
        `</div>` +
        adminItem +
        `<button type="button" class="l-auth__menu-item" data-logout>ログアウト</button>` +
      `</div>` +
    `</div>`;
  slot.hidden = false;

  const btn = slot.querySelector("[data-account-toggle]");
  const menu = slot.querySelector("[data-account-menu]");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    document.querySelectorAll("[data-account-menu]:not([hidden])").forEach(closeAccountMenu);
    menu.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) { const first = menu.querySelector("a,button"); if (first) first.focus(); }
  });
  // ログアウトは menu 内で直接 wire（renderHeaderAuth / renderAuthPreview どちらでも機能する）
  const logoutBtn = menu.querySelector("[data-logout]");
  if (logoutBtn) logoutBtn.addEventListener("click", async () => {
    try { await signOutUser(); } catch (_) {}
    location.href = homeHref();
  });
  wireAccountGlobals();
}

function renderHeaderAuth(user) {
  document.querySelectorAll("[data-auth-slot]").forEach((slot) => {
    if (user) {
      buildAccountMenu(slot, { name: user.displayName || "", email: user.email || "", role: roleOf(user) });
    } else {
      slot.innerHTML = `<a class="l-auth__btn" href="${loginHref()}">ログイン</a>`;
      slot.hidden = false;
    }
  });
}

/* ローカルのプレビュー表示用：実ログインなしでアカウントメニューを描画 */
export function renderAuthPreview(role) {
  const email = role === "staff" ? "k520185k@mails.cc.ehime-u.ac.jp"
    : role === "university" ? "taro@stu.ehime-u.ac.jp" : "guest@example.com";
  document.querySelectorAll("[data-auth-slot]").forEach((slot) => buildAccountMenu(slot, { name: "", email, role }));
}

/* ---- helpers for protected pages ---- */
export function onAuth(cb) { return onAuthStateChanged(auth, cb); }
export function requireAuth({ staffOnly = false } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) { location.href = "login.html?next=" + encodeURIComponent(location.pathname.replace(/^\//, "")); return; }
      if (staffOnly && roleOf(user) !== "staff") { location.href = "index.html"; return; }
      resolve(user);
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* プレビュー（?preview=...）中、内部リンクに preview を引き継ぎ、遷移してもログイン状態を維持する */
function persistPreviewLinks(preview) {
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    // 同一サイトの .html リンク（外部URL・既存クエリ・アンカー無しのもの）にのみ付与
    if (/^(?!https?:)[\w./-]+\.html$/.test(href)) {
      a.setAttribute("href", `${href}?preview=${encodeURIComponent(preview)}`);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // ローカル/プレビュー環境（localhost・preview channel・github.io）では ?preview= でログイン状態を再現
  const previewHost = ["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.includes("--") || location.hostname.endsWith(".github.io");
  const preview = previewHost ? new URLSearchParams(location.search).get("preview") : null;
  if (preview && ["external", "university", "staff"].includes(preview)) {
    renderAuthPreview(preview);   // 全ページでヘッダーを「ログイン中」表示
    persistPreviewLinks(preview); // クリック遷移してもログイン状態を維持
    return;
  }
  if (preview) return; // 想定外の値：本番認証もせず素の状態のまま
  onAuthStateChanged(auth, renderHeaderAuth);
});
