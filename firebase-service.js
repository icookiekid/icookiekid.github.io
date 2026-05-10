// ver29_개인블로그_분리구조_20260511_002249 · Firebase 로그인/동기화 + 공통 기능 · 최종 생성일자 2026-05-11 00:22:49 KST
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

window.BLOG = window.BLOG || { modules: {}, registerModule(name, api) { this.modules[name] = api; } };

// Firebase 설정값 입력 위치
// Firebase 웹 앱 등록 화면에서 받은 firebaseConfig를 아래에 그대로 붙여넣으세요.
// npm, Firebase CLI 없이 GitHub Pages에서 CDN 방식으로 작동합니다.
const firebaseConfig = {
  apiKey: "AIzaSyDz72TLiwFFXKYLnfc8YLdp24iPMJBxj78",
  authDomain: "icookiekid-gpt.firebaseapp.com",
  projectId: "icookiekid-gpt",
  storageBucket: "icookiekid-gpt.firebasestorage.app",
  messagingSenderId: "1059572182395",
  appId: "1:1059572182395:web:cf28784aa3bcf2cfb221de"
};

const STORAGE_KEY = "personal_blog_single_index_v29";
const MENU_KEY = "personal_blog_menu_order_v29";
const seedLottoResults = [];

const defaultData = {
  diary: [],
  memos: [],
  ledger: [],
  records: [],
  profile: {
    name: "나의 개인 공간",
    intro: "일기, 메모, 가계부, 기록, 로또 자료를 한 곳에 모으는 개인블로그입니다.",
    github: "https://icookiekid.github.io/",
    email: ""
  },
  lottoResults: seedLottoResults,
  menuOrder: ["home", "diary", "memo", "ledger", "archive", "profile", "lotto", "firebase"],
  updatedAt: new Date().toISOString()
};

let state = loadLocalData();
let app = null;
let auth = null;
let db = null;
let currentUser = null;
let cloudSaveTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function loadLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return structuredClone(defaultData);
    return {
      ...structuredClone(defaultData),
      ...saved,
      profile: { ...defaultData.profile, ...(saved.profile || {}) },
      lottoResults: Array.isArray(saved.lottoResults) && saved.lottoResults.length ? saved.lottoResults : seedLottoResults
    };
  } catch (error) {
    console.warn("로컬 데이터 읽기 오류", error);
    return structuredClone(defaultData);
  }
}

function saveLocalData(shouldCloudSave = true) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(MENU_KEY, JSON.stringify(state.menuOrder || defaultData.menuOrder));
  renderAll();
  if (shouldCloudSave) scheduleCloudSave();
}

function setStatus(element, type, title, message) {
  if (!element) return;
  element.className = `status-box ${type || ""}`.trim();
  element.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[m]));
}

function formatDate(value) { return value || "날짜 없음"; }
function today() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}
function formatMoney(value) { return Number(value || 0).toLocaleString("ko-KR") + "원"; }
function methodLabel(method) {
  if (method === "card") return "카드";
  if (method === "transfer") return "계좌이체";
  return "현금";
}
async function fileToDataUrl(input) {
  const file = input?.files && input.files[0];
  if (!file) return "";
  if (file.size > 850 * 1024) alert("사진 용량이 큽니다. Firestore 안정성을 위해 850KB 이하 사진을 권장합니다.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ctx = {
  get state() { return state; },
  set state(next) { state = next; },
  $, $$, uid, today, formatDate, formatMoney, methodLabel, escapeHtml, fileToDataUrl, saveLocalData, setStatus
};
window.BLOG.core = ctx;

function goPage(page) {
  $$(".page").forEach((section) => section.classList.remove("active"));
  const target = $(`#page-${page}`) || $("#page-home");
  target.classList.add("active");
  $$('[data-go]').forEach((btn) => btn.classList.toggle("active", btn.dataset.go === page));
  $("#topMenu")?.classList.remove("open");
  $("#mobileMenuBtn")?.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-go]");
    if (btn) goPage(btn.dataset.go);
  });
  $("#mobileMenuBtn")?.addEventListener("click", () => {
    const menu = $("#topMenu");
    const isOpen = menu.classList.toggle("open");
    $("#mobileMenuBtn").setAttribute("aria-expanded", String(isOpen));
  });
  $("#resetMenuOrderBtn")?.addEventListener("click", () => {
    state.menuOrder = [...defaultData.menuOrder];
    saveLocalData();
    applyMenuOrder();
  });
  applyMenuOrder();
  initMenuDrag();
}

function applyMenuOrder() {
  const menu = $("#topMenu");
  if (!menu) return;
  const savedOrder = state.menuOrder || JSON.parse(localStorage.getItem(MENU_KEY) || "null") || defaultData.menuOrder;
  const buttons = new Map($$("#topMenu button[data-menu]").map((btn) => [btn.dataset.menu, btn]));
  savedOrder.forEach((key) => { if (buttons.has(key)) menu.appendChild(buttons.get(key)); });
  $$("#topMenu button[data-menu]").forEach((btn) => { if (!savedOrder.includes(btn.dataset.menu)) menu.appendChild(btn); });
}

function initMenuDrag() {
  const menu = $("#topMenu");
  if (!menu) return;
  let dragged = null;
  menu.addEventListener("dragstart", (event) => {
    dragged = event.target.closest("button[data-menu]");
    if (!dragged) return;
    dragged.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  menu.addEventListener("dragend", () => {
    dragged?.classList.remove("dragging");
    dragged = null;
    state.menuOrder = $$("#topMenu button[data-menu]").map((btn) => btn.dataset.menu);
    saveLocalData();
  });
  menu.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!dragged) return;
    const after = getDragAfterElement(menu, event.clientX, event.clientY);
    if (!after) menu.appendChild(dragged); else menu.insertBefore(dragged, after);
  });
}
function getDragAfterElement(container, x, y) {
  const elements = $$("#topMenu button[data-menu]:not(.dragging)");
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2 + Math.abs(x - box.left) * 0.05;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function initCoreForms() {
  ["diaryDate", "recordDate"].forEach((id) => { const el = $(`#${id}`); if (el) el.value = today(); });

  $("#diaryForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const photo = await fileToDataUrl($("#diaryPhoto"));
    state.diary.unshift({ id: uid(), date: $("#diaryDate").value, mood: $("#diaryMood").value, title: $("#diaryTitle").value, body: $("#diaryBody").value, photo, createdAt: new Date().toISOString() });
    event.target.reset();
    $("#diaryDate").value = today();
    saveLocalData();
  });
  $("#clearDiaryFormBtn")?.addEventListener("click", () => { $("#diaryForm").reset(); $("#diaryDate").value = today(); });

  $("#recordForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const photo = await fileToDataUrl($("#recordPhoto"));
    state.records.unshift({ id: uid(), category: $("#recordCategory").value, date: $("#recordDate").value, title: $("#recordTitle").value, body: $("#recordBody").value, photo, createdAt: new Date().toISOString() });
    event.target.reset();
    $("#recordDate").value = today();
    saveLocalData();
  });

  $("#profileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.profile = { name: $("#profileName").value, intro: $("#profileIntro").value, github: $("#profileGithub").value, email: $("#profileEmail").value };
    document.title = state.profile.name || "나의 개인 공간";
    saveLocalData();
  });
}

function renderAll() {
  renderDiary();
  window.BLOG.modules.memo?.render?.(ctx);
  window.BLOG.modules.ledger?.render?.(ctx);
  renderRecords();
  renderProfile();
  window.BLOG.modules.ledger?.updateCardSelectState?.(ctx);
}

function renderDiary() {
  const box = $("#diaryList");
  if (!box) return;
  box.innerHTML = state.diary.length ? state.diary.map((item) => `
    <article class="list-item">
      <div class="meta">${escapeHtml(formatDate(item.date))} · ${escapeHtml(item.mood || "기분 미입력")}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body).replace(/\n/g, "<br>")}</p>
      ${item.photo ? `<img class="thumb" src="${item.photo}" alt="일기 사진">` : ""}
      <div class="actions"><button class="btn btn-small btn-danger" type="button" data-delete="diary" data-id="${item.id}">삭제</button></div>
    </article>`).join("") : `<div class="empty">아직 저장된 일기가 없습니다.</div>`;
}

function renderRecords() {
  const box = $("#recordList");
  if (!box) return;
  box.innerHTML = state.records.length ? state.records.map((item) => `
    <article class="list-item">
      <div class="meta">${escapeHtml(item.category)} · ${escapeHtml(formatDate(item.date))}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body).replace(/\n/g, "<br>")}</p>
      ${item.photo ? `<img class="thumb" src="${item.photo}" alt="기록 사진">` : ""}
      <div class="actions"><button class="btn btn-small btn-danger" type="button" data-delete="records" data-id="${item.id}">삭제</button></div>
    </article>`).join("") : `<div class="empty">아직 저장된 기록이 없습니다.</div>`;
}

function renderProfile() {
  const p = state.profile || defaultData.profile;
  const view = $("#profileView");
  if ($("#profileName")) {
    $("#profileName").value = p.name || "";
    $("#profileIntro").value = p.intro || "";
    $("#profileGithub").value = p.github || "";
    $("#profileEmail").value = p.email || "";
  }
  if (view) {
    view.innerHTML = `<article class="list-item"><h3>${escapeHtml(p.name || "나의 개인 공간")}</h3><p>${escapeHtml(p.intro || "소개글이 없습니다.").replace(/\n/g, "<br>")}</p><p class="small">GitHub: ${escapeHtml(p.github || "")}</p><p class="small">Email: ${escapeHtml(p.email || "")}</p></article>`;
  }
  document.title = p.name || "나의 개인 공간";
}

function initDeleteButtons() {
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-delete]");
    if (!btn) return;
    const key = btn.dataset.delete;
    const id = btn.dataset.id;
    if (!Array.isArray(state[key])) return;
    if (!confirm("삭제하시겠습니까?")) return;
    state[key] = state[key].filter((item) => item.id !== id);
    saveLocalData();
  });
}

function isFirebaseConfigReady() {
  const values = Object.values(firebaseConfig || {});
  return firebaseConfig.apiKey && firebaseConfig.projectId && values.every((value) => typeof value === "string" && value.trim() && !value.includes("여기에_"));
}
function initFirebase() {
  if (!isFirebaseConfigReady()) {
    setStatus($("#firebaseStatus"), "warn", "Firebase 설정값 필요", "firebase-service.js 안의 const firebaseConfig 값을 실제 값으로 교체해주세요.");
    setStatus($("#homeSyncStatus"), "warn", "로컬 저장 모드", "현재는 이 브라우저에만 저장됩니다. firebaseConfig 입력 후 로그인하면 Firestore 동기화가 됩니다.");
    return;
  }
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setStatus($("#firebaseStatus"), "good", "Firebase 초기화 완료", "Authentication과 Firestore를 사용할 준비가 되었습니다.");
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        setStatus($("#authStatus"), "good", "로그인 중", `${user.email} 계정으로 로그인했습니다.`);
        setStatus($("#homeSyncStatus"), "good", "Firestore 동기화 가능", `${user.email} 계정 데이터와 동기화할 수 있습니다.`);
        await loadFromCloud(false);
      } else {
        setStatus($("#authStatus"), "warn", "로그아웃 상태", "회원가입 또는 로그인 후 Firestore 동기화를 사용할 수 있습니다.");
        setStatus($("#homeSyncStatus"), "warn", "로컬 저장 모드", "로그인 전에는 이 브라우저에만 저장됩니다.");
      }
    });
  } catch (error) {
    console.error(error);
    setStatus($("#firebaseStatus"), "bad", "Firebase 초기화 실패", error.message || "설정값을 다시 확인해주세요.");
  }
}
function userDocRef() {
  if (!db || !currentUser) return null;
  return doc(db, "users", currentUser.uid, "blogData", "main");
}
async function saveToCloud(showMessage = true) {
  const ref = userDocRef();
  if (!ref) {
    if (showMessage) setStatus($("#cloudStatus"), "warn", "저장 불가", "먼저 Firebase 설정값 입력 후 로그인해주세요.");
    return;
  }
  try {
    await setDoc(ref, { ...state, cloudUpdatedAt: serverTimestamp() }, { merge: true });
    if (showMessage) setStatus($("#cloudStatus"), "good", "Firestore 저장 완료", "현재 로컬 데이터가 Firestore에 저장되었습니다.");
  } catch (error) {
    console.error(error);
    if (showMessage) setStatus($("#cloudStatus"), "bad", "Firestore 저장 실패", error.message || "보안 규칙과 설정값을 확인해주세요.");
  }
}
async function loadFromCloud(showMessage = true) {
  const ref = userDocRef();
  if (!ref) {
    if (showMessage) setStatus($("#cloudStatus"), "warn", "가져오기 불가", "먼저 Firebase 설정값 입력 후 로그인해주세요.");
    return;
  }
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const cloud = snap.data();
      delete cloud.cloudUpdatedAt;
      state = { ...structuredClone(defaultData), ...cloud, profile: { ...defaultData.profile, ...(cloud.profile || {}) } };
      ctx.state = state;
      saveLocalData(false);
      applyMenuOrder();
      if (showMessage) setStatus($("#cloudStatus"), "good", "Firestore 가져오기 완료", "Firestore 데이터를 이 브라우저로 불러왔습니다.");
    } else {
      await saveToCloud(false);
      if (showMessage) setStatus($("#cloudStatus"), "good", "새 데이터 생성", "Firestore에 기존 데이터가 없어 현재 로컬 데이터를 새로 저장했습니다.");
    }
  } catch (error) {
    console.error(error);
    if (showMessage) setStatus($("#cloudStatus"), "bad", "Firestore 가져오기 실패", error.message || "보안 규칙과 설정값을 확인해주세요.");
  }
}
function scheduleCloudSave() {
  if (!currentUser || !db) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveToCloud(false), 900);
}
function initAuthButtons() {
  $("#signUpBtn")?.addEventListener("click", async () => {
    if (!auth) { setStatus($("#authStatus"), "warn", "Firebase 설정 필요", "먼저 firebaseConfig 값을 입력해주세요."); return; }
    try {
      const email = $("#authEmail").value.trim();
      const pw = $("#authPassword").value;
      await createUserWithEmailAndPassword(auth, email, pw);
      setStatus($("#authStatus"), "good", "회원가입 완료", "계정이 생성되었고 로그인되었습니다.");
    } catch (error) { setStatus($("#authStatus"), "bad", "회원가입 실패", error.message); }
  });
  $("#signInBtn")?.addEventListener("click", async () => {
    if (!auth) { setStatus($("#authStatus"), "warn", "Firebase 설정 필요", "먼저 firebaseConfig 값을 입력해주세요."); return; }
    try {
      const email = $("#authEmail").value.trim();
      const pw = $("#authPassword").value;
      await signInWithEmailAndPassword(auth, email, pw);
      setStatus($("#authStatus"), "good", "로그인 완료", "Firestore 동기화를 사용할 수 있습니다.");
    } catch (error) { setStatus($("#authStatus"), "bad", "로그인 실패", error.message); }
  });
  $("#signOutBtn")?.addEventListener("click", async () => {
    if (!auth) return;
    await signOut(auth);
    setStatus($("#authStatus"), "warn", "로그아웃 완료", "이제 로컬 저장 모드로 작동합니다.");
  });
  $("#saveCloudBtn")?.addEventListener("click", () => saveToCloud(true));
  $("#loadCloudBtn")?.addEventListener("click", () => loadFromCloud(true));
}

function boot() {
  initNavigation();
  initCoreForms();
  window.BLOG.modules.memo?.init?.(ctx);
  window.BLOG.modules.ledger?.init?.(ctx);
  initDeleteButtons();
  initAuthButtons();
  renderAll();
  initFirebase();
  window.BLOG.modules.ledger?.updateCardSelectState?.(ctx);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
