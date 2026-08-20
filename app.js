/* ============ Hoop Maths ============
   Multiplication practice styled as a basketball shootaround: vertical
   2-digit and 3-digit × 1-digit with carrying, 2-digit × 2-digit with a zero
   placeholder, a horizontal-partitioning task box, and the Magic Digits
   problem-solving puzzles.
   A ScupperLab production — vanilla JS, no dependencies, offline-first. */

"use strict";

/* ---------- persistence ---------- */
const STORE_KEY = "hoopmaths.v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {
    muted: false,
    carryHelper: true,
    career: { points: 0, games: 0, baskets: 0 },
    best: { two: 0, three: 0, mixed: 0 },
  };
}
const store = loadStore();
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

/* ---------- sound (tiny WebAudio synth) ---------- */
let audioCtx = null;
function ac() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  // iOS reports "interrupted" (not "suspended") after backgrounding/lock
  if (audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  return audioCtx;
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
});

function tone(freq, dur, type, vol, when = 0, glideTo = null) {
  const ctx = ac();
  if (!ctx || store.muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, vol, when = 0, lpFrom = 6000, lpTo = 600) {
  const ctx = ac();
  if (!ctx || store.muted) return;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(lpFrom, t0);
  filt.frequency.exponentialRampToValueAtTime(lpTo, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(gain).connect(ctx.destination);
  src.start(t0);
}

const sfx = {
  tap()    { tone(340, 0.05, "square", 0.06); },
  select() { tone(520, 0.05, "sine", 0.05); },
  swish()  { noiseBurst(0.35, 0.25, 0, 7000, 500); tone(880, 0.18, "sine", 0.08, 0.05, 1320); },
  rim()    { tone(140, 0.22, "triangle", 0.22, 0, 90); noiseBurst(0.1, 0.08, 0, 1200, 300); },
  miss()   { tone(220, 0.25, "sawtooth", 0.1, 0, 110); },
  fire()   { [660, 880, 1100].forEach((f, i) => tone(f, 0.12, "square", 0.07, i * 0.07)); },
  buzzer() { tone(95, 0.6, "square", 0.18); tone(97, 0.6, "square", 0.12); },
  cheer()  { noiseBurst(1.0, 0.12, 0, 3000, 1500); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, 0.1 + i * 0.12)); },
};

/* ---------- prize video (stored on-device only, via IndexedDB) ---------- */
let prizeAvailable = false;

function idbOpen() {
  return new Promise((res, rej) => {
    if (!("indexedDB" in window)) { rej(new Error("no idb")); return; }
    const r = indexedDB.open("hoopmaths-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("media");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const rq = db.transaction("media", "readonly").objectStore("media").get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function claimPrize() {
  let blob = null;
  try { blob = await idbGet("prize"); } catch (e) { /* no storage */ }
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const overlay = el("div", "video-overlay");
  const vid = document.createElement("video");
  vid.src = url;
  vid.controls = true;
  vid.autoplay = true;
  vid.playsInline = true;
  vid.setAttribute("playsinline", "");
  const close = el("button", "video-close", "✕");
  const cleanup = () => {
    try { vid.pause(); } catch (e) {}
    URL.revokeObjectURL(url);
    overlay.remove();
  };
  close.addEventListener("click", cleanup);
  vid.addEventListener("ended", () => setTimeout(cleanup, 800));
  overlay.append(vid, close);
  document.body.appendChild(overlay);
  vid.play().catch(() => {});
}

/* ---------- modes ---------- */
const MODES = {
  two:    { label: "2-digit",       sample: "63 × 9",  pts: 2, digits: [2] },
  three:  { label: "3-digit",       sample: "485 × 8", pts: 3, digits: [3] },
  mixed:  { label: "Mix it up",     sample: "2s & 3s",      pts: 0, digits: [2, 3] },
  double: { label: "Double digits", sample: "22 × 30",  pts: 4, digits: [22] },   // 22 = the 2x2 marker
};
const ROUND_LEN = 10;

/* ---------- problem generation ---------- */
function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

function columnCarries(a, b) {
  // carries produced by each column of a×b, right to left
  const digits = String(a).split("").reverse().map(Number);
  let carry = 0;
  const carries = [];
  for (const d of digits) {
    const p = d * b + carry;
    carry = Math.floor(p / 10);
    carries.push(carry);
  }
  return carries;
}

// 2-digit x 2-digit: two partial products then a sum
function makeDoubleProblem() {
  for (let tries = 0; tries < 60; tries++) {
    const a = randInt(12, 99);
    // ~35% of multipliers are a round ten (22 x 30) - the gentlest way in
    const b = Math.random() < 0.12 ? randInt(2, 9) * 10 : randInt(11, 99);
    if (b % 10 === 1 && Math.random() < 0.6) continue;    // x1 in the ones is a freebie
    const ones = b % 10, tens = Math.floor(b / 10);
    const pp1 = a * ones;
    const pp2 = a * tens * 10;
    return { a, b, ones, tens, pp1, pp2, product: a * b, nDigits: 22 };
  }
  return { a: 22, b: 30, ones: 0, tens: 3, pp1: 0, pp2: 660, product: 660, nDigits: 22 };
}

function makeProblem(nDigits) {
  if (nDigits === 22) return makeDoubleProblem();
  for (let tries = 0; tries < 60; tries++) {
    let a;
    if (nDigits === 2) {
      a = randInt(12, 99);
    } else {
      // ~30% deliberately include an internal zero (the place-value traps)
      if (Math.random() < 0.3) {
        a = randInt(1, 9) * 100 + (Math.random() < 0.5 ? randInt(1, 9) : 0);
        if (a % 100 === 0) a += randInt(1, 9);          // x0y form, e.g. 304
      } else {
        a = randInt(102, 999);
      }
    }
    const b = randInt(2, 9);
    if (a % 10 === 0 && Math.random() < 0.7) continue;   // mostly avoid ...0 × b
    // internal carries only — overflow out of the leftmost column isn't a carrying step
    const hasCarry = columnCarries(a, b).slice(0, -1).some((c) => c > 0);
    if (!hasCarry && Math.random() < 0.7) continue;      // most problems should carry
    return { a, b, product: a * b, nDigits };
  }
  return { a: nDigits === 2 ? 47 : 485, b: 8, product: (nDigits === 2 ? 47 : 485) * 8, nDigits };
}

function makeRound(modeId) {
  const mode = MODES[modeId];
  const seen = new Set();
  const problems = [];
  while (problems.length < ROUND_LEN) {
    const n = mode.digits[problems.length % mode.digits.length];
    const p = makeProblem(n);
    const key = p.a + "x" + p.b;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push(p);
  }
  if (modeId === "mixed") {
    for (let i = problems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [problems[i], problems[j]] = [problems[j], problems[i]];
    }
  }
  return problems;
}

/* ---------- game state ---------- */
const app = document.getElementById("app");
const fxLayer = document.getElementById("fx-layer");

let G = null;   // active game state

function newGame(modeId) {
  G = {
    modeId,
    problems: makeRound(modeId),
    idx: 0,
    score: 0,
    baskets: 0,
    streak: 0,
    bestStreak: 0,
    attempt: 1,
    revealed: false,
    rows: [],         // rows[r][i] = entered digit (strings, "" = empty), left→right
    carries: [],      // carry scratch values, left→right
    active: null,     // { kind: "answer"|"carry", r, i }
    firstProblem: true,
  };
  renderGame();
}

function curProblem() { return G.problems[G.idx]; }
function isDouble(p) { return p.nDigits === 22; }

// how many grid columns the sum needs (col 0 also carries the x sign)
function gridCols() {
  const p = curProblem();
  return isDouble(p) ? 4 : p.nDigits + 1;
}

// every editable row of the algorithm, top to bottom
function rowSpecs() {
  const p = curProblem();
  if (!isDouble(p)) return [{ value: p.product, label: "" }];
  return [
    { value: p.pp1, label: `${p.a} × ${p.ones}` },
    { value: p.pp2, label: `${p.a} × ${p.tens}0`, zeroPlaceholder: true },
    { value: p.product, label: "add" },
  ];
}
function rowCount() { return rowSpecs().length; }
function problemPts(p) { return isDouble(p) ? 4 : (p.nDigits === 2 ? 2 : 3); }

// expected digit of each cell in row r, left to right ("" = leading blank)
function expectedForRow(r) {
  const n = gridCols();
  const str = String(rowSpecs()[r].value);
  const pad = n - str.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(i < pad ? "" : str[i - pad]);
  return out;
}
function padForRow(r) { return gridCols() - String(rowSpecs()[r].value).length; }

/* ---------- screens ---------- */
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderHome() {
  G = null;
  COACH = null;
  HX = null;
  MD = null;
  app.innerHTML = "";
  const home = el("div", "home");

  const h1 = el("h1");
  h1.innerHTML = `<span class="ball-emoji">🏀</span> Hoop Maths`;
  home.appendChild(h1);
  home.appendChild(el("div", "tagline", "Solve it column by column… then SHOOT!"));

  const career = el("div", "career");
  [["Career points", store.career.points], ["Baskets", store.career.baskets], ["Games", store.career.games]]
    .forEach(([label, val]) => {
      const s = el("div", "stat");
      s.innerHTML = `<b>${val}</b><br>${label}`;
      career.appendChild(s);
    });
  home.appendChild(career);

  const row = el("div", "mode-row");
  for (const id of ["two", "three", "double", "mixed"]) {
    const m = MODES[id];
    const btn = el("button", "mode-btn");
    btn.appendChild(el("span", "mode-name", m.label));
    btn.appendChild(el("span", "mode-sample", m.sample));
    btn.appendChild(el("span", "mode-pts", id === "mixed" ? "2 & 3 pointers" : `${m.pts}-pointers`));
    btn.appendChild(el("span", "mode-best", store.best[id] ? `Best: ${store.best[id]}` : "Not played yet"));
    btn.addEventListener("click", () => { sfx.select(); newGame(id); });
    row.appendChild(btn);
  }
  home.appendChild(row);

  const boxRow = el("div", "box-row");
  const coachBtn = el("button", "coach-btn", "🎓 Coach's Clinic");
  coachBtn.addEventListener("click", () => { sfx.select(); renderCoach(); });
  const hxBtn = el("button", "coach-btn", "📐 Horizontal Multiplication");
  hxBtn.addEventListener("click", () => { sfx.select(); renderHorizontal(); });
  const mdBtn = el("button", "coach-btn", "🔍 Magic Digits");
  mdBtn.addEventListener("click", () => { sfx.select(); renderMagic(); });
  boxRow.append(coachBtn, hxBtn, mdBtn);
  home.appendChild(boxRow);

  const toggleRow = el("div", "toggle-row");
  const toggle = el("button", "toggle" + (store.carryHelper ? " on" : ""));
  toggle.setAttribute("aria-label", "Toggle carry boxes");
  toggle.addEventListener("click", () => {
    store.carryHelper = !store.carryHelper;
    toggle.classList.toggle("on", store.carryHelper);
    saveStore();
    sfx.tap();
  });
  toggleRow.appendChild(el("span", null, "Carry boxes"));
  toggleRow.appendChild(toggle);
  home.appendChild(toggleRow);

  // prize video setup (parents): stored only on this device, never uploaded
  const prizeRow = el("div", "prize-row");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "video/mp4,video/quicktime,video/*";
  fileInput.style.display = "none";
  const prizeBtn = el("button", "prize-btn",
    prizeAvailable ? "🎁 Prize ready — tap to change" : "🎁 Set prize video (parents)");
  const removeBtn = el("button", "prize-remove", "✕");
  removeBtn.style.display = prizeAvailable ? "inline-block" : "none";
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    try {
      await idbSet("prize", f);
      prizeAvailable = true;
      prizeBtn.textContent = "🎁 Prize ready — tap to change";
      removeBtn.style.display = "inline-block";
      sfx.cheer();
    } catch (e) {
      alert("Couldn't save the video on this device — check free storage and try again.");
    }
  });
  prizeBtn.addEventListener("click", () => { sfx.tap(); fileInput.click(); });
  removeBtn.addEventListener("click", async () => {
    try { await idbDel("prize"); } catch (e) {}
    prizeAvailable = false;
    prizeBtn.textContent = "🎁 Set prize video (parents)";
    removeBtn.style.display = "none";
    sfx.tap();
  });
  prizeRow.append(prizeBtn, removeBtn, fileInput);
  home.appendChild(prizeRow);

  home.appendChild(el("div", "scupperlab", "A ScupperLab production"));
  app.appendChild(home);
}

/* ---------- Coach's Clinic: animated walkthrough of 485 × 8 ---------- */
let COACH = null;

function coachSpot(cols) {
  const { topNodes, bNode } = COACH;
  topNodes.forEach((nd, i) => {
    nd.classList.toggle("spot", cols.includes(i));
    nd.classList.toggle("dimmed", cols.length > 0 && !cols.includes(i) && nd.textContent !== "");
  });
  bNode.classList.toggle("spot", cols.length > 0);
}

function coachBank(i, digit) {
  const cell = COACH.answerNodes[i];
  cell.textContent = digit;
  cell.classList.add("bank-in", "good");
  sfx.tap();
}

function coachAssist(fromCol, toCol, digit) {
  const fromR = COACH.topNodes[fromCol].getBoundingClientRect();
  const toR = COACH.carryNodes[toCol].getBoundingClientRect();
  const ball = el("div", "fly-ball assist-ball");
  const x0 = fromR.left + fromR.width / 2 - 15, y0 = fromR.top + fromR.height / 2 - 15;
  const x1 = toR.left + toR.width / 2 - 15, y1 = toR.top + toR.height / 2 - 15;
  ball.style.left = x0 + "px";
  ball.style.top = y0 + "px";
  fxLayer.appendChild(ball);
  const anim = ball.animate([
    { transform: "translate(0,0) scale(1)" },
    { transform: `translate(${(x1 - x0) * 0.5}px, ${Math.min(y1 - y0, 0) - 60}px) scale(.9)`, offset: 0.55 },
    { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(.8)` },
  ], { duration: 650, easing: "cubic-bezier(.3,0,.7,1)" });
  anim.onfinish = () => {
    ball.remove();
    const cNode = COACH.carryNodes[toCol];
    cNode.textContent = digit;
    cNode.classList.add("filled");
    sfx.select();
  };
}

/* Coach voiceover via the browser's built-in speech (offline, no audio files).
   Prefers an Australian English voice when the device has one. */
let COACH_VOICE = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => v.lang === "en-AU")
      || vs.find((v) => v.lang && v.lang.replace("_", "-").startsWith("en-AU"))
      || vs.find((v) => v.lang && v.lang.startsWith("en"))
      || null;
}
if ("speechSynthesis" in window) {
  try {
    speechSynthesis.addEventListener("voiceschanged", () => { COACH_VOICE = pickVoice(); });
  } catch (e) { /* older Safari */ }
  COACH_VOICE = pickVoice();
}
function speak(text) {
  if (store.muted || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (!COACH_VOICE) COACH_VOICE = pickVoice();
    if (COACH_VOICE) u.voice = COACH_VOICE;
    u.rate = 0.98;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  } catch (e) { /* captions still carry the lesson */ }
}
/* Recorded coach clips (audio/coach-0.m4a … coach-6.m4a). If a clip is
   missing or fails to play, fall back to speech synthesis. */
const coachClips = {};
let currentClip = null;
function playCoachLine(clipUrl, fallbackText) {
  if (store.muted) return;
  hushCoach();
  if (!clipUrl) { speak(fallbackText); return; }
  if (!coachClips[clipUrl]) {
    const a = new Audio(clipUrl);
    a.preload = "auto";
    coachClips[clipUrl] = a;
  }
  const clip = coachClips[clipUrl];
  try {
    clip.currentTime = 0;
    currentClip = clip;
    const p = clip.play();
    if (p && p.catch) p.catch(() => { currentClip = null; speak(fallbackText); });
  } catch (e) {
    currentClip = null;
    speak(fallbackText);
  }
}
function hushCoach() {
  if ("speechSynthesis" in window) { try { speechSynthesis.cancel(); } catch (e) {} }
  if (currentClip) { try { currentClip.pause(); } catch (e) {} currentClip = null; }
}

/* Two clinic chapters. Chapter 1 (47 × 8) has Dad's recorded clips
   (audio/coach-N.m4a); chapter 2 (485 × 8) uses coach2-N.m4a when recorded,
   falling back to speech until then. Player art: img/player-*.png */
const P1 = "img/player-1s.png", P10 = "img/player-10s.png", P100 = "img/player-100s.png";

const COACH_CHAPTERS = [
  {
    title: "Coach's Clinic 🏀", a: "47", b: "8", clipPrefix: "audio/coach-",
    steps: [
      { cap: "Every column is a player on your team. The ONES player always takes the first shot.",
        say: "Every column is a player on your team. The ones player always takes the first shot.",
        img: P1, run: () => coachSpot([2]) },
      { cap: "Ones shoots… 8 × 7 = 56!", bubble: "8 × 7 = 56",
        say: "Ones shoots. 8 times 7 is 56!",
        img: P1, run: () => coachSpot([2]) },
      { cap: "A player can only bank ONE digit. Bank the 6…", bubble: "56 → bank 6",
        say: "A player can only bank one digit. Bank the 6.",
        img: P1, run: () => coachBank(2, "6") },
      { cap: "…and pass the 5 as an ASSIST to the tens player.", bubble: "56 → bank 6, assist 5",
        say: "And pass the 5 as an assist to the tens player.",
        img: P1, run: () => coachAssist(2, 1, "5") },
      { cap: "Tens is the LAST player: 8 × 4 = 32… now ADD the assist: 32 + 5 = 37!", bubble: "8 × 4 = 32 + 5 = 37",
        say: "Tens is the last player. 8 times 4 is 32. Now add the assist: 32 plus 5 is 37!",
        img: P10, run: () => coachSpot([1]) },
      { cap: "The last player doesn't pass — they DUNK the whole number. SLAM!", bubble: "37 → dunk it all!",
        say: "The last player doesn't pass. They dunk the whole number. Slam!",
        img: P10, run: () => { coachBank(1, "7"); coachBank(0, "3"); coachSpot([]); sfx.swish(); } },
      { cap: "47 × 8 = 376. Shoot right to left, and ALWAYS add the assist. Your ball now!", bubble: "376 🏀",
        say: "47 times 8 is 376. Shoot right to left, and always add the assist. Your ball now!",
        img: null, run: () => sfx.cheer() },
    ],
  },
  {
    title: "3-Pointer Clinic 🏀🏀🏀", a: "485", b: "8", clipPrefix: "audio/coach2-",
    steps: [
      { cap: "The 3-pointer clinic: THREE players this time. Ones still shoots first!",
        say: "The 3-pointer clinic. Three players this time. Ones still shoots first!",
        img: P1, run: () => coachSpot([3]) },
      { cap: "Ones shoots… 8 × 5 = 40. Bank the 0, assist the 4!", bubble: "8 × 5 = 40 → bank 0, assist 4",
        say: "Ones shoots. 8 times 5 is 40. Bank the 0, assist the 4!",
        img: P1, run: () => { coachBank(3, "0"); coachAssist(3, 2, "4"); } },
      { cap: "Tens shoots… 8 × 8 = 64, plus the assist: 68!", bubble: "8 × 8 = 64 + 4 = 68",
        say: "Tens shoots. 8 times 8 is 64. Plus the assist makes 68!",
        img: P10, run: () => coachSpot([2]) },
      { cap: "Bank the 8, pass the 6 up the court.", bubble: "68 → bank 8, assist 6",
        say: "Bank the 8, pass the 6 up the court.",
        img: P10, run: () => { coachBank(2, "8"); coachAssist(2, 1, "6"); } },
      { cap: "Now the BIG number-100s player steps up: 8 × 4 = 32, plus the assist: 38!", bubble: "8 × 4 = 32 + 6 = 38",
        say: "Now the big hundreds player steps up. 8 times 4 is 32. Plus the assist makes 38!",
        img: P100, run: () => coachSpot([1]) },
      { cap: "Last player, no pass — DUNK the whole 38. BOOM!", bubble: "38 → dunk it all!",
        say: "Last player, no pass. Dunk the whole 38. Boom!",
        img: P100, run: () => { coachBank(1, "8"); coachBank(0, "3"); coachSpot([]); sfx.swish(); } },
      { cap: "485 × 8 = 3880. Same moves, one more player. Your ball!", bubble: "3880 🏀",
        say: "485 times 8 is 3880. Same moves, one more player. Your ball!",
        img: null, run: () => sfx.cheer() },
    ],
  },
];

function coachNext() {
  if (!COACH) return;
  const chapter = COACH_CHAPTERS[COACH.chapter];
  COACH.step++;
  if (COACH.step >= chapter.steps.length) { COACH = null; hushCoach(); renderHome(); return; }
  const s = chapter.steps[COACH.step];
  COACH.caption.textContent = s.cap;
  if (s.bubble) { COACH.bubble.textContent = s.bubble; COACH.bubble.style.visibility = "visible"; }
  // player portrait, synced with the voiceover
  if (s.img) {
    if (COACH.player.getAttribute("src") !== s.img) {
      COACH.player.src = s.img;
      COACH.player.classList.remove("player-pop");
      void COACH.player.offsetWidth;          // restart the pop animation
      COACH.player.classList.add("player-pop");
    }
    COACH.player.style.visibility = "visible";
  } else {
    COACH.player.style.visibility = "hidden";
  }
  playCoachLine(`${chapter.clipPrefix}${COACH.step}.m4a`, s.say || s.cap);
  s.run();
  if (COACH.step === chapter.steps.length - 1) {
    const hasNextChapter = COACH.chapter + 1 < COACH_CHAPTERS.length;
    COACH.nextBtn.textContent = "Got it — let's play! 🏀";
    if (hasNextChapter) {
      const nextCh = el("button", "big-btn primary", "3-Pointer Clinic ▶");
      const myChapter = COACH.chapter;
      nextCh.addEventListener("click", () => { sfx.select(); renderCoach(myChapter + 1); });
      COACH.nextBtn.parentElement.insertBefore(nextCh, COACH.nextBtn);
    }
    const replayChapter = COACH.chapter;
    const replay = el("button", "big-btn secondary", "↺ Again");
    replay.addEventListener("click", () => { sfx.tap(); renderCoach(replayChapter); });
    COACH.nextBtn.parentElement.appendChild(replay);
  }
}

function renderCoach(chapterIdx = 0) {
  G = null;
  COACH = null;
  hushCoach();
  app.innerHTML = "";
  const chapter = COACH_CHAPTERS[chapterIdx];
  const wrap = el("div", "coach");

  const back = el("button", "coach-back", "✕");
  back.setAttribute("aria-label", "Back to home");
  back.addEventListener("click", () => { COACH = null; hushCoach(); sfx.tap(); renderHome(); });
  wrap.appendChild(back);

  wrap.appendChild(el("h2", "coach-title", chapter.title));
  const caption = el("div", "coach-caption");
  wrap.appendChild(caption);
  const bubble = el("div", "calc-bubble");
  bubble.style.visibility = "hidden";
  bubble.textContent = "—";
  wrap.appendChild(bubble);

  // stage: player portrait beside the worked example
  const stage = el("div", "coach-stage");
  const player = document.createElement("img");
  player.className = "coach-player";
  player.alt = "";
  player.style.visibility = "hidden";
  stage.appendChild(player);

  const card = el("div", "problem-card coach-card");
  const grid = el("div", "digit-grid");
  const aStr = chapter.a;
  const n = aStr.length + 1;
  grid.style.gridTemplateColumns = `repeat(${n}, auto)`;
  const carryNodes = [], topNodes = [], answerNodes = [];
  for (let i = 0; i < n; i++) {
    const c = el("div", "carry-cell" + (i === n - 1 ? " hidden-cell" : ""));
    carryNodes.push(c);
    grid.appendChild(c);
  }
  for (let i = 0; i < n; i++) {
    const d = el("div", "top-digit", i === 0 ? "" : aStr[i - 1]);
    topNodes.push(d);
    grid.appendChild(d);
  }
  let bNode = null;
  for (let i = 0; i < n; i++) {
    if (i === 0) grid.appendChild(el("div", "times-sign", "×"));
    else if (i === n - 1) { bNode = el("div", "bottom-digit", chapter.b); grid.appendChild(bNode); }
    else grid.appendChild(el("div", "bottom-digit", ""));
  }
  grid.appendChild(el("div", "rule-line"));
  for (let i = 0; i < n; i++) {
    const cell = el("div", "answer-cell");
    answerNodes.push(cell);
    grid.appendChild(cell);
  }
  card.appendChild(grid);
  stage.appendChild(card);
  wrap.appendChild(stage);

  const controls = el("div", "coach-controls");
  const nextBtn = el("button", "shoot-btn coach-next", "Next ▶");
  nextBtn.addEventListener("click", () => { sfx.tap(); coachNext(); });
  controls.appendChild(nextBtn);
  wrap.appendChild(controls);

  app.appendChild(wrap);
  COACH = { chapter: chapterIdx, step: -1, caption, bubble, carryNodes, topNodes, answerNodes, bNode, nextBtn, player };
  coachNext();
}

function renderGame() {
  app.innerHTML = "";
  const game = el("div", "game");

  // scoreboard
  const sb = el("div", "scoreboard");
  const shotNo = el("div", "sb-item");
  shotNo.innerHTML = `Shot <b>${G.idx + 1}</b>/${ROUND_LEN}`;
  const score = el("div", "sb-item");
  score.innerHTML = `Score <b id="sb-score">${G.score}</b>`;
  const streak = el("div", "sb-item");
  streak.id = "sb-streak";
  streak.innerHTML = G.streak >= 3
    ? `<span class="onfire">🔥 ON FIRE ×${G.streak}</span>`
    : `Streak <b>${G.streak}</b>`;
  const quit = el("button", "quit-btn", "⏹ End");
  quit.addEventListener("click", () => {
    if (!quit.dataset.arm) {                 // two-tap confirm so one mis-tap can't end the round
      quit.dataset.arm = "1";
      quit.textContent = "End round?";
      setTimeout(() => {
        if (quit.isConnected) { delete quit.dataset.arm; quit.textContent = "⏹ End"; }
      }, 2000);
      sfx.tap();
      return;
    }
    if (G && (G.score > 0 || G.baskets > 0)) {   // bank what was earned in the partial round
      store.career.points += G.score;
      store.career.baskets += G.baskets;
      saveStore();
    }
    sfx.tap();
    renderHome();
  });
  sb.append(shotNo, score, streak, quit);
  game.appendChild(sb);

  // hoop
  const hoopZone = el("div", "hoop-zone");
  const hoop = el("div", "hoop");
  hoop.id = "hoop";
  hoop.appendChild(el("div", "backboard"));
  hoop.appendChild(el("div", "rim"));
  hoop.appendChild(el("div", "net"));
  hoopZone.appendChild(hoop);
  game.appendChild(hoopZone);

  // play area
  const play = el("div", "play-area");
  play.appendChild(buildProblemCard());

  const padZone = el("div", "pad-zone");
  const fb = el("div", "feedback-line");
  fb.id = "feedback";
  if (G.firstProblem && G.idx === 0) {
    const cp = curProblem();
    fb.textContent = isDouble(cp)
      ? `Line 2 starts with a 0 placeholder — tap "↓ Next line" between lines`
      : "Start with the ones column ➜ tap digits below";
  }
  padZone.appendChild(fb);
  padZone.appendChild(buildNumpad());
  if (rowCount() > 1) {
    const nl = el("button", "nextline-btn", "↓ Next line");
    nl.id = "nextline-btn";
    nl.addEventListener("click", () => { advanceRow(); sfx.tap(); });
    padZone.appendChild(nl);
  }
  const shoot = el("button", "shoot-btn", "SHOOT! 🏀");
  shoot.id = "shoot-btn";
  shoot.addEventListener("click", onShoot);
  padZone.appendChild(shoot);
  play.appendChild(padZone);

  game.appendChild(play);
  app.appendChild(game);
  paintActive();
}

function ruleLine() {
  const l = el("div", "rule-line");
  l.style.gridColumn = "1 / -1";
  return l;
}

function buildProblemCard() {
  const p = curProblem();
  const n = gridCols();
  const nRows = rowCount();
  const dbl = isDouble(p);
  const specs = rowSpecs();

  G.rows = Array.from({ length: nRows }, () => Array(n).fill(""));
  G.carries = Array(n).fill("");
  G.active = { kind: "answer", r: 0, i: n - 1 };
  G.lastRow = 0;
  G.justAdvanced = false;
  G.attempt = 1;
  G.revealed = false;
  G.awaitNext = null;                 // null | "auto" (basket) | "manual" (revealed miss)
  G.clearUndo = null;

  const card = el("div", "problem-card");
  card.id = "problem-card";
  const grid = el("div", "digit-grid");
  grid.style.gridTemplateColumns = dbl ? `auto repeat(${n}, auto)` : `repeat(${n}, auto)`;
  const gutter = (text, cls) => grid.appendChild(el("div", "gutter" + (cls ? " " + cls : ""), text || ""));

  // carry scratch boxes (none over the ones column)
  if (store.carryHelper) {
    if (dbl) gutter("");
    for (let i = 0; i < n; i++) {
      const c = el("div", "carry-cell" + (i === n - 1 ? " hidden-cell" : ""));
      c.dataset.kind = "carry"; c.dataset.r = "c"; c.dataset.i = String(i);
      if (i < n - 1) c.addEventListener("click", () => selectCell("carry", "c", i));
      grid.appendChild(c);
    }
  }

  // the top number, right-aligned
  const aStr = String(p.a), aPad = n - aStr.length;
  if (dbl) gutter("");
  for (let i = 0; i < n; i++) grid.appendChild(el("div", "top-digit", i < aPad ? "" : aStr[i - aPad]));

  // the multiplier, right-aligned, with the × sign in the gutter
  const bStr = String(p.b), bPad = n - bStr.length;
  if (dbl) gutter("×", "gutter-sign");
  for (let i = 0; i < n; i++) {
    if (!dbl && i === 0) { grid.appendChild(el("div", "times-sign", "×")); continue; }
    grid.appendChild(el("div", "bottom-digit", i < bPad ? "" : bStr[i - bPad]));
  }

  grid.appendChild(ruleLine());

  for (let r = 0; r < nRows; r++) {
    if (dbl && r === nRows - 1) grid.appendChild(ruleLine());   // second rule, above the sum
    if (dbl) gutter(specs[r].label, "gutter-label");
    for (let i = 0; i < n; i++) {
      const cell = el("div", "answer-cell");
      cell.dataset.kind = "answer"; cell.dataset.r = String(r); cell.dataset.i = String(i);
      // the tens line always starts with a 0 in the ones column — ghost it so he copies it
      if (specs[r].zeroPlaceholder && i === n - 1) cell.classList.add("ph-zero");
      cell.addEventListener("click", () => selectCell("answer", r, i));
      grid.appendChild(cell);
    }
  }

  card.appendChild(grid);
  return card;
}

function buildNumpad() {
  const pad = el("div", "numpad");
  // ⌫ (recoverable) sits beside 0; clear-all C lives in the far corner
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C"];
  for (const k of keys) {
    const btn = el("button", "key" + (k === "C" || k === "⌫" ? " util" : ""), k);
    btn.addEventListener("click", () => onKey(k));
    pad.appendChild(btn);
  }
  return pad;
}

/* ---------- cell interaction ---------- */
function cellNode(kind, r, i) {
  return app.querySelector(`[data-kind="${kind}"][data-r="${r}"][data-i="${i}"]`);
}

function setActiveAnswer(r, i) {
  G.active = { kind: "answer", r, i };
  G.lastRow = r;
  G.justAdvanced = false;
}

function selectCell(kind, r, i) {
  if (G.revealed) return;
  if (kind === "answer") { setActiveAnswer(r, i); }
  else {
    // remember the line he came from so the caret can return to it
    if (G.active && G.active.kind === "answer") G.lastRow = G.active.r;
    G.active = { kind, r, i };
    G.justAdvanced = false;
  }
  paintActive();
  sfx.select();
}

function paintActive() {
  app.querySelectorAll(".answer-cell, .carry-cell").forEach((c) => c.classList.remove("active"));
  if (!G.active) return;
  const node = cellNode(G.active.kind, G.active.r, G.active.i);
  if (node) node.classList.add("active");
}

function setCell(kind, r, i, val) {
  if (kind === "answer") G.rows[r][i] = val; else G.carries[i] = val;
  const node = cellNode(kind, r, i);
  if (node) node.textContent = val;
}

// rightmost still-empty answer cell in row r (-1 if the row is full)
function rightmostEmptyAnswer(r) {
  const n = gridCols();
  for (let j = n - 1; j >= 0; j--) if (G.rows[r][j] === "") return j;
  return -1;
}

// move down to the next line of working (multi-row modes)
function advanceRow() {
  if (!G || G.revealed) return;
  const n = gridCols();
  const nRows = rowCount();
  if (G.justAdvanced) { G.justAdvanced = false; paintActive(); return; }  // already dropped a line
  const cur = (G.active && typeof G.active.r === "number") ? G.active.r
            : (typeof G.lastRow === "number" ? G.lastRow : 0);
  if (cur >= nRows - 1) {
    setFeedback("That's the last line — hit SHOOT when you're happy", "");
    return;
  }
  setActiveAnswer(cur + 1, n - 1);
  paintActive();
}

function onKey(k) {
  if (G.revealed) return;
  const n = gridCols();
  const nRows = rowCount();

  if (k === "C") {
    const hasContent = G.rows.some((row) => row.some((v) => v !== "")) || G.carries.some((v) => v !== "");
    if (!hasContent && G.clearUndo) {
      G.clearUndo.rows.forEach((row, r) => row.forEach((v, i) => setCell("answer", r, i, v)));
      G.clearUndo.carries.forEach((v, i) => setCell("carry", "c", i, v));
      G.clearUndo = null;
      setFeedback("Undone!", "good");
    } else if (hasContent) {
      G.clearUndo = { rows: G.rows.map((row) => [...row]), carries: [...G.carries] };
      for (let r = 0; r < nRows; r++) for (let i = 0; i < n; i++) setCell("answer", r, i, "");
      for (let i = 0; i < n; i++) setCell("carry", "c", i, "");
      clearMarks();
      setFeedback("Cleared — press C again to undo", "");
    }
    setActiveAnswer(0, n - 1);
    paintActive();
    sfx.tap();
    return;
  }

  if (!G.active) return;
  const { kind, r, i } = G.active;

  if (k === "⌫") {
    if (kind === "answer" && G.rows[r][i] === "" && i === n - 1 && r > 0) {
      const prev = r - 1;                            // empty ones cell: hop up a line
      const j = G.rows[prev].findIndex((v) => v !== "");
      setActiveAnswer(prev, j >= 0 ? j : n - 1);
      if (j >= 0) setCell("answer", prev, j, "");
    } else if (kind === "answer" && G.rows[r][i] === "" && i < n - 1) {
      setActiveAnswer(r, i + 1);                     // step back toward the ones column
      setCell("answer", r, i + 1, "");
    } else {
      setCell(kind, r, i, "");
    }
    const nd = cellNode(G.active.kind, G.active.r, G.active.i);
    if (nd) nd.classList.remove("good", "bad");
    paintActive();
    sfx.tap();
    return;
  }

  // digit
  setCell(kind, r, i, k);
  const cur = cellNode(kind, r, i);
  if (cur) cur.classList.remove("good", "bad");
  if (kind === "answer") {
    if (i > 0) {
      setActiveAnswer(r, i - 1);
    } else if (r < nRows - 1) {
      setActiveAnswer(r + 1, n - 1);                       // drop to the next line of working
      G.justAdvanced = true;                               // so "Next line" doesn't skip a line
    }
  } else {
    // carry scratch: return to the rightmost unfinished cell of the line he came from
    const back = typeof G.lastRow === "number" ? G.lastRow : 0;
    const j = rightmostEmptyAnswer(back);
    setActiveAnswer(back, j >= 0 ? j : n - 1);
  }
  paintActive();
  sfx.tap();
}

function clearMarks() {
  app.querySelectorAll(".answer-cell").forEach((c) => c.classList.remove("good", "bad"));
}

function onShoot() {
  if (!G) return;
  const shootBtn = document.getElementById("shoot-btn");
  if (G.awaitNext === "auto") return;                     // basket made — advance is coming
  if (G.awaitNext === "manual") { nextProblem(); return } // revealed miss — SHOOT acts as Next

  const n = gridCols();
  const nRows = rowCount();
  const p = curProblem();

  if (G.rows.every((row) => row.every((v) => v === ""))) {
    setFeedback("Fill in the answer first!", "bad");
    sfx.miss();
    return;
  }
  // a gap (or an untouched line of working) means he isn't finished — don't burn an attempt
  for (let r = 0; r < nRows; r++) {
    const row = G.rows[r];
    if (row.every((v) => v === "")) {
      setFeedback(isDouble(p) ? "Every line needs filling in — including the total!" : "Keep going!", "bad");
      sfx.miss();
      return;
    }
    const L = row.findIndex((v) => v !== "");
    if (L >= 0 && row.slice(L).some((v) => v === "")) {
      setFeedback("Keep going — fill every column through to the ones!", "bad");
      sfx.miss();
      return;
    }
  }

  let allGood = true;
  for (let r = 0; r < nRows; r++) {
    const expected = expectedForRow(r);
    const pad = padForRow(r);
    for (let i = 0; i < n; i++) {
      const node = cellNode("answer", r, i);
      // unused leading cells may be empty or a written 0 — both are correct
      const ok = i < pad ? (G.rows[r][i] === "" || G.rows[r][i] === "0") : G.rows[r][i] === expected[i];
      if (!ok) allGood = false;
      if (node) {
        node.classList.remove("good", "bad");
        if (G.rows[r][i] !== "" || !ok) node.classList.add(ok ? "good" : "bad");   // blanks stay unmarked
      }
    }
  }

  if (allGood) {
    const onFire = G.streak >= 3;
    const pts = (G.attempt === 1 ? problemPts(p) : 1) + (onFire && G.attempt === 1 ? 1 : 0);
    G.score += pts;
    G.baskets += 1;
    G.streak += 1;
    G.bestStreak = Math.max(G.bestStreak, G.streak);
    updateScoreboard();
    setFeedback(G.attempt === 1
      ? (onFire ? `🔥 Swish! +${pts}` : `Swish! +${pts}`)
      : `Rebound putback! +${pts}`, "good");
    flyBall(pts);
    if (G.streak === 3) sfx.fire();
    G.revealed = true;
    G.awaitNext = "auto";
    shootBtn.disabled = true;
    const g = G, myIdx = G.idx;
    setTimeout(() => { if (G === g && G.idx === myIdx) nextProblem(); }, 1600);
  } else if (G.attempt === 1) {
    G.attempt = 2;
    setFeedback("Off the rim! Fix the red boxes and shoot again", "bad");
    sfx.rim();
  } else {
    // second miss: reveal answer + worked solution
    const lostFire = G.streak >= 3;
    G.streak = 0;
    updateScoreboard();
    for (let r = 0; r < nRows; r++) {
      const expected = expectedForRow(r);
      const pad = padForRow(r);
      for (let i = 0; i < n; i++) {
        const node = cellNode("answer", r, i);
        if (node) node.classList.remove("bad", "good");
        if (i < pad) { setCell("answer", r, i, ""); continue; }   // unused cells stay blank, unmarked
        setCell("answer", r, i, expected[i]);
        if (node) node.classList.add("good");
      }
    }
    showWorking();
    setFeedback((lostFire ? "🔥 Streak over! " : "") + "No basket — check the working, then hit Next", "bad");
    sfx.miss();
    G.revealed = true;
    G.awaitNext = "manual";
    shootBtn.textContent = "NEXT ▶";
  }
}

function showWorking() {
  const p = curProblem();
  const card = document.getElementById("problem-card");
  const w = el("div", "working");

  if (isDouble(p)) {
    w.innerHTML = [
      `Split the <b>${p.b}</b> into <b>${p.tens}0</b> and <b>${p.ones}</b>.`,
      `Line 1 &nbsp; <b>${p.a} × ${p.ones}</b> = <b>${p.pp1}</b>`,
      `Line 2 &nbsp; that ${p.tens} is really <b>${p.tens}0</b>, so <b>write a 0 in the ones column first</b> — ` +
        `that's the placeholder. Then ${p.a} × ${p.tens} = ${p.a * p.tens}, which gives <b>${p.pp2}</b>.`,
      `Add the lines: ${p.pp1} + ${p.pp2} = <b>${p.product}</b>`,
    ].join("<br>");
    card.appendChild(w);
    return;
  }

  const digits = String(p.a).split("").reverse().map(Number);
  const names = ["ones", "tens", "hundreds"];
  let carry = 0;
  const lines = [];
  for (let i = 0; i < digits.length; i++) {
    const raw = digits[i] * p.b;
    const total = raw + carry;
    const isLast = i === digits.length - 1;
    let line = `<b>${p.b} × ${digits[i]}</b> (${names[i]}) = ${raw}`;
    if (carry > 0) line += ` + carry ${carry} = <b>${total}</b>`;
    const nextCarry = Math.floor(total / 10);
    if (isLast) {
      line += total >= 10
        ? ` → write <b>${total}</b> (it fills the last ${String(total).length} boxes)`
        : ` → write <b>${total}</b>`;
    } else if (nextCarry > 0) {
      line += ` → write <b>${total % 10}</b>, carry <b>${nextCarry}</b>`;
    } else {
      line += ` → write <b>${total % 10}</b>`;
    }
    carry = nextCarry;
    lines.push(line);
  }
  w.innerHTML = lines.join("<br>") + `<br>Answer: <b>${p.product}</b>`;
  card.appendChild(w);
}

function setFeedback(msg, kind) {
  const fb = document.getElementById("feedback");
  if (!fb) return;
  fb.textContent = msg;
  fb.className = "feedback-line" + (kind ? " " + kind : "");
}

function updateScoreboard() {
  const scoreEl = document.getElementById("sb-score");
  if (scoreEl) scoreEl.textContent = G.score;
  const streakEl = document.getElementById("sb-streak");
  if (streakEl) {
    streakEl.innerHTML = G.streak >= 3
      ? `<span class="onfire">🔥 ON FIRE ×${G.streak}</span>`
      : `Streak <b>${G.streak}</b>`;
  }
}

/* ---------- ball flight ---------- */
function flyBall(pts) {
  const card = document.getElementById("problem-card");
  const hoop = document.getElementById("hoop");
  if (!card || !hoop) { sfx.swish(); return; }
  const from = card.getBoundingClientRect();
  const to = hoop.getBoundingClientRect();
  const ball = el("div", "fly-ball");
  const x0 = from.left + from.width / 2 - 23;
  const y0 = from.top - 10;
  const x1 = to.left + to.width / 2 - 23;
  const y1 = to.top + 52;
  ball.style.left = x0 + "px";
  ball.style.top = y0 + "px";
  fxLayer.appendChild(ball);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const anim = ball.animate([
    { transform: "translate(0px, 0px) scale(1)" },
    { transform: `translate(${dx * 0.5}px, ${dy - 130}px) scale(0.85)`, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.7)` },
  ], { duration: 700, easing: "cubic-bezier(0.3, 0, 0.7, 1)" });
  anim.onfinish = () => {
    ball.remove();
    sfx.swish();
    const pop = el("div", "pop-text", `+${pts}`);
    pop.style.left = (x1 - 8) + "px";
    pop.style.top = (y1 + 10) + "px";
    fxLayer.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
  };
}

/* ---------- round flow ---------- */
function nextProblem() {
  G.idx += 1;
  G.firstProblem = false;
  if (G.idx >= ROUND_LEN) { endRound(); return; }
  renderGame();
}

function endRound() {
  sfx.buzzer();
  const modeId = G.modeId;
  const isBest = G.score > (store.best[modeId] || 0);
  if (isBest) store.best[modeId] = G.score;
  store.career.points += G.score;
  store.career.baskets += G.baskets;
  store.career.games += 1;
  saveStore();
  if (isBest && G.score > 0) setTimeout(() => sfx.cheer(), 500);

  const perfect = G.baskets === ROUND_LEN;
  const summary = el("div", "summary");
  summary.appendChild(el("h2", perfect ? "perfect-title" : null, perfect ? "PERFECT GAME! 🏆" : "Full time! 🏁"));
  summary.appendChild(el("div", "final-score", `${G.score} pts`));
  const sub = el("div", "sub");
  sub.innerHTML = `🏀 Baskets: <b>${G.baskets} / ${ROUND_LEN}</b> &nbsp;•&nbsp; 🔥 Best streak: <b>${G.bestStreak}</b>`;
  summary.appendChild(sub);
  if (isBest && G.score > 0) summary.appendChild(el("div", "newbest", `⭐ New ${MODES[modeId].label} record!`));
  if (perfect && prizeAvailable) {
    const prize = el("button", "big-btn prize-claim", "🎁 CLAIM YOUR PRIZE!");
    prize.addEventListener("click", () => { sfx.cheer(); claimPrize(); });
    summary.appendChild(prize);
  }

  const btns = el("div", "summary-btns");
  const again = el("button", "big-btn primary", "Play again");
  again.addEventListener("click", () => { sfx.select(); newGame(modeId); });
  const homeBtn = el("button", "big-btn secondary", "Home");
  homeBtn.addEventListener("click", () => { sfx.tap(); renderHome(); });
  btns.append(again, homeBtn);
  summary.appendChild(btns);

  app.innerHTML = "";
  app.appendChild(summary);
}

/* ================= Horizontal Multiplication task box ================= */
let HX = null;

const HX_EXAMPLES = [
  { a: 23, b: 4,  note: "Split the 23 into 20 and 3." },
  { a: 47, b: 6,  note: "Split the 47 into 40 and 7." },
  { a: 22, b: 30, note: "30 is 3 × 10, so do × 3 first, then × 10.", roundTen: true },
];

function hxSplit(a, b) {
  const tens = Math.floor(a / 10) * 10, ones = a % 10;
  return { tens, ones, tensPart: tens * b, onesPart: ones * b, total: a * b };
}

function hxMakeQuestion(roundTenAllowed) {
  const a = randInt(12, 99);
  const b = roundTenAllowed && Math.random() < 0.3 ? randInt(2, 9) * 10 : randInt(3, 9);
  if (a % 10 === 0) return hxMakeQuestion(roundTenAllowed);
  return { a, b };
}

function hxWorkedExample(ex) {
  const s = hxSplit(ex.a, ex.b);
  const wrap = el("div", "hx-example");
  wrap.appendChild(el("div", "hx-eq", `${ex.a} × ${ex.b}`));
  const steps = el("div", "hx-steps");
  if (ex.roundTen) {
    const t = Math.floor(ex.b / 10);
    steps.innerHTML =
      `<div>${ex.note}</div>` +
      `<div><b>${ex.a} × ${t}</b> = ${ex.a * t}</div>` +
      `<div><b>${ex.a * t} × 10</b> = ${ex.a * ex.b}</div>` +
      `<div class="hx-ans">${ex.a} × ${ex.b} = <b>${ex.a * ex.b}</b></div>`;
  } else {
    steps.innerHTML =
      `<div>${ex.note}</div>` +
      `<div><b>${s.tens} × ${ex.b}</b> = ${s.tensPart}</div>` +
      `<div><b>${s.ones} × ${ex.b}</b> = ${s.onesPart}</div>` +
      `<div><b>${s.tensPart} + ${s.onesPart}</b> = ${s.total}</div>` +
      `<div class="hx-ans">${ex.a} × ${ex.b} = <b>${s.total}</b></div>`;
  }
  wrap.appendChild(steps);
  return wrap;
}

function hxSetTab(tab) {
  if (HX) { HX.practiceChecked = HX.tab === "practice" ? HX.practiceChecked : false; }
  HX.tab = tab;
  renderHorizontal(tab);
}

function renderHorizontal(tab = "learn") {
  G = null; COACH = null; MD = null;
  hushCoach();
  const keep = HX && HX.tab === tab ? HX : null;
  HX = keep || { tab, q: null, cells: [], active: 0, practiceChecked: false, testChecked: false, testIdx: 0, testScore: 0, testDone: false, q2: null, val: "" };
  HX.tab = tab;
  app.innerHTML = "";

  const wrap = el("div", "hx");
  const back = el("button", "coach-back", "✕");
  back.setAttribute("aria-label", "Back to home");
  back.addEventListener("click", () => {
    if (!back.dataset.arm) {
      back.dataset.arm = "1";
      back.textContent = "Leave?";
      back.classList.add("wide");
      setTimeout(() => {
        if (back.isConnected) { delete back.dataset.arm; back.textContent = "✕"; back.classList.remove("wide"); }
      }, 2200);
      sfx.tap();
      return;
    }
    sfx.tap();
    renderHome();
  });
  wrap.appendChild(back);

  wrap.appendChild(el("h2", "coach-title", "Horizontal Multiplication 📐"));
  wrap.appendChild(el("div", "hx-sub", "Break the big number into easy pieces, multiply each piece, then add."));

  const tabs = el("div", "hx-tabs");
  [["learn", "How it works"], ["practice", "Practice"], ["test", "Test yourself"]].forEach(([id, label]) => {
    const t = el("button", "hx-tab" + (tab === id ? " on" : ""), label);
    t.addEventListener("click", () => { sfx.select(); hxSetTab(id); });
    tabs.appendChild(t);
  });
  wrap.appendChild(tabs);

  const body = el("div", "hx-body");
  if (tab === "learn") hxRenderLearn(body);
  else if (tab === "practice") hxRenderPractice(body);
  else hxRenderTest(body);
  wrap.appendChild(body);

  app.appendChild(wrap);
}

function hxRenderLearn(body) {
  const rule = el("div", "hx-rule");
  rule.innerHTML =
    `<b>The trick:</b> you already know your tens. So chop the number up.<br>` +
    `<span class="hx-big">47 × 6 &nbsp;→&nbsp; (40 × 6) + (7 × 6)</span>` +
    `<br>Do the easy tens part first, then the ones part, then add them together. ` +
    `No columns, no carrying — just two easy multiplications.`;
  body.appendChild(rule);
  HX_EXAMPLES.forEach((ex) => body.appendChild(hxWorkedExample(ex)));
  const go = el("button", "big-btn primary", "Try one myself ▶");
  go.addEventListener("click", () => { sfx.select(); hxSetTab("practice"); });
  body.appendChild(go);
}

function hxNewPractice() {
  HX.q = hxMakeQuestion(true);
  HX.cells = ["", "", ""];
  HX.active = 0;
  HX.practiceChecked = false;
}

function hxRenderPractice(body) {
  if (!HX.q) hxNewPractice();
  const { a, b } = HX.q;
  const s = hxSplit(a, b);

  body.appendChild(el("div", "hx-eq big", `${a} × ${b} = ?`));

  const grid = el("div", "hx-grid");
  const mk = (label, idx, expected) => {
    const row = el("div", "hx-row");
    row.appendChild(el("div", "hx-label", label));
    const box = el("div", "hx-box" + (HX.active === idx ? " active" : ""), HX.cells[idx]);
    box.dataset.hx = String(idx);
    box.addEventListener("click", () => { HX.active = idx; sfx.select(); renderHorizontal("practice"); });
    if (HX.practiceChecked) box.classList.add(String(expected) === HX.cells[idx] ? "good" : "bad");
    row.appendChild(box);
    grid.appendChild(row);
  };
  if (b % 10 === 0) {
    const t = b / 10;
    mk(`${a} × ${t} =`, 0, a * t);
    mk(`then × 10 =`, 1, a * b);
    mk(`so ${a} × ${b} =`, 2, a * b);
  } else {
    mk(`${s.tens} × ${b} =`, 0, s.tensPart);
    mk(`${s.ones} × ${b} =`, 1, s.onesPart);
    mk(`add them =`, 2, s.total);
  }
  body.appendChild(grid);

  const want = b % 10 === 0
    ? [String(a * (b / 10)), String(a * b), String(a * b)]
    : [String(s.tensPart), String(s.onesPart), String(s.total)];

  const fb = el("div", "feedback-line");
  fb.id = "hx-feedback";
  if (HX.practiceChecked) {
    const ok = want.every((v, i) => HX.cells[i] === v);
    fb.textContent = ok ? "Nailed it! 🏀" : "Not yet — check the red ones";
    fb.className = "feedback-line " + (ok ? "good" : "bad");
  }
  body.appendChild(fb);

  body.appendChild(hxNumpad((k) => {
    if (HX.practiceChecked) return;
    if (k === "C") HX.cells[HX.active] = "";
    else if (k === "⌫") HX.cells[HX.active] = HX.cells[HX.active].slice(0, -1);
    else if (HX.cells[HX.active].length < 4) HX.cells[HX.active] += k;
    sfx.tap();
    renderHorizontal("practice");
  }));

  const btns = el("div", "hx-btns");
  const check = el("button", "big-btn primary", HX.practiceChecked ? "Next one ▶" : "Check");
  check.addEventListener("click", () => {
    if (HX.practiceChecked) { hxNewPractice(); sfx.select(); }
    else {
      HX.practiceChecked = true;
      const ok = want.every((v, i) => HX.cells[i] === v);
      ok ? sfx.swish() : sfx.rim();
    }
    renderHorizontal("practice");
  });
  const show = el("button", "big-btn secondary", "Show me");
  show.addEventListener("click", () => {
    HX.cells = [...want];
    HX.practiceChecked = true;
    sfx.tap();
    renderHorizontal("practice");
  });
  btns.append(check, show);
  body.appendChild(btns);
}

const HX_TEST_LEN = 8;

function hxRenderTest(body) {
  if (HX.testDone) {
    body.appendChild(el("div", "final-score", `${HX.testScore} / ${HX_TEST_LEN}`));
    body.appendChild(el("div", "hx-sub", HX.testScore >= HX_TEST_LEN - 1 ? "Outstanding." : HX.testScore >= 5 ? "Good work — keep going." : "Have another crack at Practice first."));
    const again = el("button", "big-btn primary", "Go again");
    again.addEventListener("click", () => {
      HX.testDone = false; HX.testIdx = 0; HX.testScore = 0; HX.q2 = null; HX.val = "";
      sfx.select(); renderHorizontal("test");
    });
    body.appendChild(again);
    return;
  }
  if (!HX.q2) { HX.q2 = hxMakeQuestion(true); HX.val = ""; HX.testChecked = false; }
  const { a, b } = HX.q2;

  body.appendChild(el("div", "hx-progress", `Question ${HX.testIdx + 1} of ${HX_TEST_LEN}  ·  Score ${HX.testScore}`));
  body.appendChild(el("div", "hx-eq big", `${a} × ${b} =`));

  const box = el("div", "hx-box wide" + (HX.testChecked ? (HX.val === String(a * b) ? " good" : " bad") : " active"), HX.val);
  body.appendChild(box);

  const fb = el("div", "feedback-line");
  if (HX.testChecked) {
    const ok = HX.val === String(a * b);
    fb.textContent = ok ? "Correct! 🏀" : `Not quite — it's ${a * b}`;
    fb.className = "feedback-line " + (ok ? "good" : "bad");
  }
  body.appendChild(fb);

  body.appendChild(hxNumpad((k) => {
    if (HX.testChecked) return;
    if (k === "C") HX.val = "";
    else if (k === "⌫") HX.val = HX.val.slice(0, -1);
    else if (HX.val.length < 5) HX.val += k;
    sfx.tap();
    renderHorizontal("test");
  }));

  const btn = el("button", "big-btn primary", HX.testChecked ? (HX.testIdx + 1 >= HX_TEST_LEN ? "See my score" : "Next ▶") : "Check");
  btn.addEventListener("click", () => {
    if (!HX.testChecked) {
      if (HX.val === "") { sfx.miss(); return; }
      HX.testChecked = true;
      if (HX.val === String(a * b)) { HX.testScore++; sfx.swish(); } else sfx.rim();
    } else {
      HX.testIdx++;
      if (HX.testIdx >= HX_TEST_LEN) HX.testDone = true;
      HX.q2 = null;
      sfx.select();
    }
    renderHorizontal("test");
  });
  body.appendChild(btn);
}

function hxNumpad(onTap) {
  const pad = el("div", "numpad hx-numpad");
  ["1","2","3","4","5","6","7","8","9","⌫","0","C"].forEach((k) => {
    const btn = el("button", "key" + (k === "C" || k === "⌫" ? " util" : ""), k);
    btn.addEventListener("click", () => onTap(k));
    pad.appendChild(btn);
  });
  return pad;
}

/* ================= Magic Digits (place the digits) ================= */
let MD = null;
const MD_LEN = 8;

function mdSolutions(digits, target) {
  const out = [];
  const [x, y, z] = digits;
  const perms = [[x,y,z],[x,z,y],[y,x,z],[y,z,x],[z,x,y],[z,y,x]];
  for (const [p, q, r] of perms) {
    if ((p * 10 + q) * r === target) out.push([p, q, r]);
  }
  return out;
}

function mdMakePuzzle(allowImpossible) {
  for (let tries = 0; tries < 200; tries++) {
    const a = randInt(12, 98), b = randInt(2, 9);
    const target = a * b;
    if (target > 999) continue;
    const digits = [Math.floor(a / 10), a % 10, b];
    if (allowImpossible && Math.random() < 0.25) {
      // nudge the target so no arrangement can work — the teacher's "some don't work" case
      for (const delta of shuffled([3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9])) {
        const t = target + delta;
        if (t > 9 && mdSolutions(digits, t).length === 0) {
          return { digits: shuffled(digits), target: t, possible: false };
        }
      }
      continue;
    }
    return { digits: shuffled(digits), target, possible: true };
  }
  return { digits: [8, 9, 5], target: 472, possible: true };
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mdHint(p) {
  const ones = p.target % 10;
  const pairs = [];
  for (const x of p.digits) for (const y of p.digits) {
    if ((x * y) % 10 === ones && !pairs.some(([a, b]) => a === y && b === x)) pairs.push([x, y]);
  }
  const lines = [`Work on the <b>ones column</b> first. The answer ends in <b>${ones}</b>.`];
  if (pairs.length) {
    lines.push(`Of your digits, only ${pairs.map(([x, y]) => `<b>${x} × ${y}</b>`).join(" or ")} ends in ${ones}. ` +
               `So one of those has to be the ones digit and the multiplier.`);
  } else {
    lines.push(`Try every pair of your digits — none of them multiply to something ending in <b>${ones}</b>. ` +
               `What does that tell you?`);
  }
  if (p.digits.includes(5)) lines.push(`Remember: anything <b>× 5</b> ends in 0 or 5.`);
  if (p.digits.some((d) => d % 2 === 0)) lines.push(`Anything <b>× an even number</b> ends in an even digit.`);
  return lines.join("<br>");
}

function renderMagic(fresh) {
  G = null; COACH = null; HX = null;
  hushCoach();
  if (fresh || !MD) {
    MD = { idx: 0, score: 0, done: false, puzzle: null, slots: [null, null, null], picked: null, checked: false, showHint: false };
  }
  if (!MD.puzzle) {
    MD.puzzle = mdMakePuzzle(MD.idx >= 3);
    MD.slots = [null, null, null];
    MD.picked = null;
    MD.checked = false;
    MD.showHint = false;
    MD.msg = "";
    MD.correct = false;
    MD.tries = 0;
  }
  app.innerHTML = "";

  const wrap = el("div", "md");
  const back = el("button", "coach-back", "✕");
  back.setAttribute("aria-label", "Back to home");
  back.addEventListener("click", () => {
    if (!back.dataset.arm) {
      back.dataset.arm = "1";
      back.textContent = "Leave?";
      back.classList.add("wide");
      setTimeout(() => {
        if (back.isConnected) { delete back.dataset.arm; back.textContent = "✕"; back.classList.remove("wide"); }
      }, 2200);
      sfx.tap();
      return;
    }
    sfx.tap();
    renderHome();
  });
  wrap.appendChild(back);

  if (MD.done) {
    wrap.appendChild(el("h2", "coach-title", "Magic Digits 🔍"));
    wrap.appendChild(el("div", "final-score", `${MD.score} / ${MD_LEN}`));
    wrap.appendChild(el("div", "hx-sub", MD.score >= MD_LEN - 1 ? "Detective of the year." : "Good thinking — go again?"));
    const again = el("button", "big-btn primary", "Play again");
    again.addEventListener("click", () => { sfx.select(); renderMagic(true); });
    wrap.appendChild(again);
    app.appendChild(wrap);
    return;
  }

  const p = MD.puzzle;
  wrap.appendChild(el("h2", "coach-title", "Magic Digits 🔍"));
  wrap.appendChild(el("div", "md-progress", `Puzzle ${MD.idx + 1} of ${MD_LEN}  ·  Score ${MD.score}`));
  wrap.appendChild(el("div", "hx-sub", "Use the digits below to complete the multiplication."));

  // digit chips
  const chips = el("div", "md-chips");
  p.digits.forEach((d, i) => {
    const used = MD.slots.includes(i);
    const chip = el("button", "md-chip" + (used ? " used" : "") + (MD.picked === i ? " picked" : ""), String(d));
    chip.addEventListener("click", () => {
      if (MD.checked || used) return;
      MD.picked = MD.picked === i ? null : i;
      sfx.select();
      renderMagic();
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);

  // the sum
  const card = el("div", "problem-card md-card");
  const grid = el("div", "digit-grid");
  grid.style.gridTemplateColumns = "repeat(3, auto)";
  const tStr = String(p.target).padStart(3, " ");

  const slotBox = (slotIdx) => {
    const digitIdx = MD.slots[slotIdx];
    const box = el("div", "answer-cell md-slot" + (digitIdx !== null ? " filled" : ""),
                   digitIdx !== null ? String(p.digits[digitIdx]) : "");
    if (MD.checked) box.classList.add(MD.correct ? "good" : "bad");
    box.addEventListener("click", () => {
      if (MD.checked) return;
      MD.msg = "";
      if (MD.slots[slotIdx] !== null) { MD.slots[slotIdx] = null; sfx.tap(); }
      else if (MD.picked !== null) { MD.slots[slotIdx] = MD.picked; MD.picked = null; sfx.tap(); }
      renderMagic();
    });
    return box;
  };

  grid.appendChild(el("div", "md-blank"));
  grid.appendChild(slotBox(0));
  grid.appendChild(slotBox(1));
  grid.appendChild(el("div", "times-sign", "×"));
  grid.appendChild(el("div", "md-blank"));
  grid.appendChild(slotBox(2));
  grid.appendChild(ruleLine());
  for (const ch of tStr) grid.appendChild(el("div", "top-digit", ch.trim()));
  card.appendChild(grid);
  wrap.appendChild(card);

  const fb = el("div", "feedback-line");
  if (MD.msg) {
    fb.textContent = MD.msg;
    fb.className = "feedback-line " + (MD.correct ? "good" : "bad");
  }
  wrap.appendChild(fb);

  if (MD.showHint && !MD.checked) {
    const h = el("div", "working");
    h.innerHTML = mdHint(p);
    wrap.appendChild(h);
  }

  const btns = el("div", "hx-btns");
  if (MD.checked) {
    const next = el("button", "big-btn primary", MD.idx + 1 >= MD_LEN ? "See my score" : "Next ▶");
    next.addEventListener("click", () => {
      MD.idx++;
      if (MD.idx >= MD_LEN) MD.done = true;
      MD.puzzle = null;
      sfx.select();
      renderMagic();
    });
    btns.appendChild(next);
  } else {
    const check = el("button", "big-btn primary", "Check it");
    check.addEventListener("click", () => {
      if (MD.slots.some((v) => v === null)) {
        MD.msg = "Put all three digits in first.";
        MD.correct = false;
        sfx.miss();
        renderMagic();
        return;
      }
      MD.tries = (MD.tries || 0) + 1;
      const a = p.digits[MD.slots[0]] * 10 + p.digits[MD.slots[1]];
      const b = p.digits[MD.slots[2]];
      MD.correct = a * b === p.target;
      MD.msg = MD.correct
        ? `Yes! ${a} × ${b} = ${p.target} 🏀`
        : `${a} × ${b} = ${a * b}, not ${p.target}. Try another arrangement.`;
      if (MD.correct) {
        MD.checked = true;
        if (MD.tries <= 2) MD.score++;                       // guessing your way there scores nothing
        MD.msg += MD.tries <= 2 ? "" : " (no point — that took a few goes)";
        sfx.swish();
      } else sfx.rim();
      renderMagic();
    });
    btns.appendChild(check);

    if (MD.idx >= 3) {
      const nope = el("button", "big-btn secondary", "It's impossible!");
      nope.addEventListener("click", () => {
        MD.tries = (MD.tries || 0) + 1;
        MD.correct = !p.possible;
        if (MD.correct) {
          MD.checked = true;
          if (MD.tries <= 2) MD.score++;
          MD.msg = "Correct — this one can't be done! Great reasoning. 🏀";
          sfx.swish();
        } else {
          MD.msg = `Not this one — there IS an arrangement that works. ` +
                   `Try the ones column: which digit × which could end in ${p.target % 10}?`;
          sfx.rim();
        }
        renderMagic();
      });
      btns.appendChild(nope);
    }

    const hint = el("button", "big-btn secondary", "Hint");
    hint.addEventListener("click", () => { MD.showHint = true; sfx.tap(); renderMagic(); });
    btns.appendChild(hint);

    const skip = el("button", "big-btn secondary", "Show me");
    skip.addEventListener("click", () => {
      const sol = mdSolutions(p.digits, p.target)[0];
      MD.checked = true;
      MD.correct = false;
      if (sol) {
        MD.slots = sol.map((d) => p.digits.indexOf(d));
        const used = new Set();
        MD.slots = sol.map((d) => {
          const idx = p.digits.findIndex((v, k) => v === d && !used.has(k));
          used.add(idx);
          return idx;
        });
        MD.msg = `${sol[0]}${sol[1]} × ${sol[2]} = ${p.target}`;
      } else {
        MD.msg = "This one genuinely can't be done — that was the catch!";
      }
      sfx.tap();
      renderMagic();
    });
    btns.appendChild(skip);
  }
  wrap.appendChild(btns);

  if (MD.idx >= 3 && !MD.checked) {
    wrap.appendChild(el("div", "md-warn", "⚠️ Careful — from here on, some of these can't be done at all."));
  }

  app.appendChild(wrap);
}

/* ---------- keyboard support (handy on desktop) ---------- */
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (COACH) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); coachNext(); }
    return;
  }
  if (!G || G.idx >= ROUND_LEN) return;
  if (/^[0-9]$/.test(e.key)) onKey(e.key);
  else if (e.key === "Backspace") { e.preventDefault(); onKey("⌫"); }
  else if (e.key === "Enter") {
    const er = (G.active && typeof G.active.r === "number") ? G.active.r : (G.lastRow || 0);
    if (rowCount() > 1 && er < rowCount() - 1) advanceRow();
    else onShoot();
  }
});

/* ---------- mute ---------- */
const muteBtn = document.getElementById("mute-btn");
function paintMute() { muteBtn.textContent = store.muted ? "🔇" : "🔊"; }
muteBtn.addEventListener("click", () => {
  store.muted = !store.muted;
  if (store.muted) hushCoach();
  saveStore();
  paintMute();
  if (!store.muted) sfx.tap();
});
paintMute();

/* ---------- boot ---------- */
idbGet("prize")
  .then((b) => { prizeAvailable = !!b; })
  .catch(() => {})
  .finally(() => renderHome());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
