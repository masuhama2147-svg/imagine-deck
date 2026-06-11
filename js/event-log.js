/* event-log.js — Firestore の公開(published)イベントから開催ログカードを自動生成
   ＋ 検索 / 種別 / 年月フィルタ。0件のときは HTML のデモカードをそのまま残す。 */
import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const TYPE_LABEL = { event: "イベント", exhibition: "展示", workshop: "ワークショップ", academic: "学術", maintenance: "メンテナンス" };

const state = { search: "", tag: "all", month: "" };

/* ---- 安全な要素生成（文字列はテキストノード＝XSSなし） ---- */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") n.className = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
}
const fmtDate = (d) => (d || "").replace(/-/g, ".");

function cardEl(id, ev) {
  const type = ev.type || "event";
  const media = el("div", { class: "c-event-card__media" });
  if (ev.photoUrl) media.appendChild(el("img", { src: ev.photoUrl, alt: "", loading: "lazy" }));
  else media.classList.add("is-img-missing");

  const body = el("div", { class: "c-event-card__body" },
    el("div", { class: "c-event-card__meta" },
      el("span", { class: `c-tag c-tag--${type}` }, TYPE_LABEL[type] || type),
      el("span", {}, fmtDate(ev.date))),
    el("h3", { class: "c-event-card__title" }, ev.title || "（無題）"),
    el("p", { class: "c-event-card__excerpt" }, ev.excerpt || ""),
    el("div", { class: "c-event-card__footer" },
      el("span", {}, ev.participants != null && ev.participants !== "" ? `参加 ${ev.participants}名` : ""),
      el("span", {}, ev.organizer ? `主催: ${ev.organizer}` : "")));

  return el("a", {
    class: "c-event-card m-lift",
    href: `event-detail.html?id=${encodeURIComponent(id)}`,
    dataset: {
      tags: ev.tags || type,
      date: ev.date || "",
      search: `${ev.title || ""} ${ev.excerpt || ""} ${ev.organizer || ""}`,
    },
  }, media, body);
}

function applyFilter() {
  const cards = document.querySelectorAll("#event-grid .c-event-card");
  let visible = 0;
  cards.forEach((card) => {
    const tags = (card.dataset.tags || "").toLowerCase().split(/\s+/).filter(Boolean);
    const date = card.dataset.date || "";
    const title = card.querySelector(".c-event-card__title")?.textContent?.toLowerCase() || "";
    const excerpt = card.querySelector(".c-event-card__excerpt")?.textContent?.toLowerCase() || "";
    const haystack = [card.dataset.search || "", title, excerpt].join(" ").toLowerCase();
    let show = true;
    if (state.tag && state.tag !== "all" && !tags.includes(state.tag)) show = false;
    if (show && state.month && !date.startsWith(state.month)) show = false;
    if (show && state.search && !haystack.includes(state.search.toLowerCase())) show = false;
    card.style.display = show ? "" : "none";
    if (show) visible++;
  });
  const empty = document.getElementById("event-empty");
  if (empty) empty.classList.toggle("is-active", visible === 0);
}

async function loadFromFirestore() {
  const grid = document.getElementById("event-grid");
  if (!grid) return;
  try {
    const snap = await getDocs(query(collection(db, "events"), where("status", "==", "published")));
    if (snap.empty) return; // 公開イベントが無ければ既存デモカードを残す
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    grid.replaceChildren();
    list.forEach((ev) => grid.appendChild(cardEl(ev.id, ev)));
  } catch (e) {
    console.warn("[event-log] Firestore 読み込み失敗。デモカードを表示します:", e);
  }
}

function initFilters() {
  const searchInput = document.getElementById("event-search");
  const monthSelect = document.getElementById("event-month-filter");
  const tagWrap = document.getElementById("event-tag-filter");
  searchInput?.addEventListener("input", (e) => { state.search = e.target.value.trim(); applyFilter(); });
  monthSelect?.addEventListener("change", (e) => { state.month = e.target.value; applyFilter(); });
  tagWrap?.querySelectorAll(".c-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      tagWrap.querySelectorAll(".c-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      state.tag = chip.dataset.tag || "all";
      applyFilter();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initFilters();
  await loadFromFirestore();
  applyFilter();
});
