/* functions/index.js — Imagine Deck の自動処理（Cloud Functions 2nd gen）
   役割: イベント終了(予約の date + endTime, 日本時間)から30分後に、
        主催者へ「開催報告フォームのご記入のお願い」メールを自動送信。
        本文に 愛媛大学ミュージアム・ポータルサイト の案内も入れる。
   送信基盤: SendGrid（APIキーは Secret 経由）。キー未設定時は送信せずログのみ（DRY-RUN）。 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const FROM_EMAIL = "k520185k@mails.cc.ehime-u.ac.jp"; // SendGridで認証済みの送信元
const PORTAL_URL = "https://portal.museum.ehime-u.ac.jp/";
const SITE_URL = "https://imagine-deck-v1-47b08.web.app";

exports.sendEventReportReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    secrets: [SENDGRID_API_KEY],
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const snap = await db
      .collection("reservations")
      .where("reportReminderSent", "==", false)
      .get();

    let sent = 0;
    for (const doc of snap.docs) {
      const r = doc.data();
      const endMs = eventEndMillis(r);
      if (endMs == null) continue;
      const minsSinceEnd = (now - endMs) / 60000;
      const WINDOW_MAX = 7 * 24 * 60; // 終了後7日まではリトライ対象
      // まだ終了30分前 → 次回以降
      if (minsSinceEnd < 30) continue;
      // 終了後7日を超えても未送信 → 期限切れとして打ち切り（無限再クエリ防止・警告ログ）
      if (minsSinceEnd >= WINDOW_MAX) {
        await doc.ref.update({ reportReminderSent: true, reportReminderSkipped: true });
        logger.warn("reminder overdue; skipped", doc.id);
        continue;
      }
      // 宛先は「認証済みの予約者メール」を最優先（なりすまし・無関係宛への送信を防止）
      const to = r.reserverEmail || r.studentEmail || r.staffEmail || r.email;
      if (!to) continue;
      try {
        await sendReminder(to, r);
        await doc.ref.update({
          reportReminderSent: true,
          reportReminderAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        sent++;
      } catch (e) {
        logger.error("reminder send failed", doc.id, e);
      }
    }
    logger.info(`event report reminders sent: ${sent}`);
  }
);

/** 予約の date(YYYY-MM-DD) + endTime(HH:MM) を日本時間として UTC ミリ秒に変換 */
function eventEndMillis(r) {
  if (!r || !r.date || !r.endTime) return null;
  const [Y, M, D] = String(r.date).split("-").map(Number);
  const [h, m] = String(r.endTime).split(":").map(Number);
  if ([Y, M, D, h, m].some((n) => Number.isNaN(n))) return null;
  return Date.UTC(Y, M - 1, D, h - 9, m, 0, 0); // JST(UTC+9) → UTC
}

async function sendReminder(to, r) {
  const org = r.orgName || "ご担当者";
  const subject = "【イマジン・デッキ】開催報告のご記入のお願い";
  const text = `${org} 様

イマジン・デッキをご利用いただき、ありがとうございました。
開催の様子を「開催ログ」に掲載するため、下記の開催報告フォームのご記入にご協力ください。

▼ 開催報告フォーム（写真・参加人数・概要など）
${SITE_URL}/submit-event.html

愛媛大学ミュージアムの最新情報や他の催しは、ポータルサイトをご覧ください。
▼ 愛媛大学ミュージアム・ポータルサイト
${PORTAL_URL}

今後ともイマジン・デッキをよろしくお願いいたします。
— イマジン・デッキ運営`;

  const html = `<div style="font-family:'Helvetica Neue',sans-serif;line-height:1.85;color:#1a1a1a">
  <p>${escapeHtml(org)} 様</p>
  <p>イマジン・デッキをご利用いただき、ありがとうございました。<br>
  開催の様子を「開催ログ」に掲載するため、下記の<strong>開催報告フォーム</strong>のご記入にご協力ください。</p>
  <p><a href="${SITE_URL}/submit-event.html" style="display:inline-block;background:#8b168f;color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:700">開催報告フォームを開く →</a></p>
  <p>愛媛大学ミュージアムの最新情報や他の催しは、ポータルサイトをご覧ください。<br>
  <a href="${PORTAL_URL}" style="color:#8b168f">愛媛大学ミュージアム・ポータルサイト ↗</a></p>
  <p style="color:#666;margin-top:24px">— イマジン・デッキ運営</p>
</div>`;

  const key = SENDGRID_API_KEY.value();
  if (!key) {
    logger.info(`[DRY-RUN: SENDGRID_API_KEY 未設定] ${to} 宛に送信予定: ${subject}`);
    return;
  }
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(key);
  await sgMail.send({ to, from: FROM_EMAIL, subject, text, html });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
