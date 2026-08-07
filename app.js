/* ============ Hoop Maths ============
   Vertical multiplication practice (2-digit × 1-digit and 3-digit × 1-digit)
   with carrying, styled as a basketball shootaround.
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
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

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

/* ---------- modes ---------- */
const MODES = {
  two:   { label: "2-digit", sample: "63 × 9", pts: 2, digits: [2] },
  three: { label: "3-digit", sample: "485 × 8", pts: 3, digits: [3] },
  mixed: { label: "Mix it up", sample: "both!", pts: 0, digits: [2, 3] },
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

function makeProblem(nDigits) {
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
    const hasCarry = columnCarries(a, b).some((c) => c > 0);
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
  if (modeId === "mixed") problems.sort(() => Math.random() - 0.5);
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
    cells: [],        // answer cell values (strings, "" = empty), left→right
    carries: [],      // carry scratch values, left→right
    active: null,     // { kind: "answer"|"carry", i }
    firstProblem: true,
  };
  renderGame();
}

function curProblem() { return G.problems[G.idx]; }
function cellCount() { return curProblem().nDigits + 1; }
function problemPts(p) { return p.nDigits === 2 ? 2 : 3; }

function expectedCells() {
  // expected value of each answer cell, left→right ("" for unused leading cells)
  const n = cellCount();
  const s = String(curProblem().product);
  const pad = n - s.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(i < pad ? "" : s[i - pad]);
  return out;
}

/* ---------- screens ---------- */
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderHome() {
  G = null;
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
  for (const id of ["two", "three", "mixed"]) {
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

  home.appendChild(el("div", "scupperlab", "A ScupperLab production"));
  app.appendChild(home);
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
  quit.addEventListener("click", () => { sfx.tap(); renderHome(); });
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
  if (G.firstProblem && G.idx === 0) fb.textContent = "Start with the ones column ➜ tap digits below";
  padZone.appendChild(fb);
  padZone.appendChild(buildNumpad());
  const shoot = el("button", "shoot-btn", "SHOOT! 🏀");
  shoot.id = "shoot-btn";
  shoot.addEventListener("click", onShoot);
  padZone.appendChild(shoot);
  play.appendChild(padZone);

  game.appendChild(play);
  app.appendChild(game);
}

function buildProblemCard() {
  const p = curProblem();
  const n = cellCount();
  G.cells = Array(n).fill("");
  G.carries = Array(n).fill("");
  G.active = { kind: "answer", i: n - 1 };
  G.attempt = 1;
  G.revealed = false;

  const card = el("div", "problem-card");
  card.id = "problem-card";
  const grid = el("div", "digit-grid");
  grid.style.gridTemplateColumns = `repeat(${n}, auto)`;

  // row 1: carry scratch boxes (none over the ones column)
  if (store.carryHelper) {
    for (let i = 0; i < n; i++) {
      const c = el("div", "carry-cell" + (i === n - 1 ? " hidden-cell" : ""));
      c.dataset.kind = "carry";
      c.dataset.i = i;
      if (i < n - 1) c.addEventListener("click", () => selectCell("carry", i));
      grid.appendChild(c);
    }
  }

  // row 2: the top number, right-aligned (leftmost column stays empty)
  const aStr = String(p.a);
  for (let i = 0; i < n; i++) {
    const d = el("div", "top-digit", i === 0 ? "" : aStr[i - 1]);
    grid.appendChild(d);
  }

  // row 3: × sign at far left, multiplier under the ones column
  for (let i = 0; i < n; i++) {
    if (i === 0) grid.appendChild(el("div", "times-sign", "×"));
    else if (i === n - 1) grid.appendChild(el("div", "bottom-digit", String(p.b)));
    else grid.appendChild(el("div", "bottom-digit", ""));
  }

  grid.appendChild(el("div", "rule-line"));

  // row 4: answer cells
  for (let i = 0; i < n; i++) {
    const cell = el("div", "answer-cell");
    cell.dataset.kind = "answer";
    cell.dataset.i = i;
    cell.addEventListener("click", () => selectCell("answer", i));
    grid.appendChild(cell);
  }

  card.appendChild(grid);
  return card;
}

function buildNumpad() {
  const pad = el("div", "numpad");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  for (const k of keys) {
    const btn = el("button", "key" + (k === "C" || k === "⌫" ? " util" : ""), k);
    btn.addEventListener("click", () => onKey(k));
    pad.appendChild(btn);
  }
  return pad;
}

/* ---------- cell interaction ---------- */
function cellNode(kind, i) {
  return app.querySelector(`[data-kind="${kind}"][data-i="${i}"]`);
}

function selectCell(kind, i) {
  if (G.revealed) return;
  G.active = { kind, i };
  paintActive();
  sfx.select();
}

function paintActive() {
  app.querySelectorAll(".answer-cell, .carry-cell").forEach((c) => c.classList.remove("active"));
  if (!G.active) return;
  const node = cellNode(G.active.kind, G.active.i);
  if (node) node.classList.add("active");
}

function setCell(kind, i, val) {
  if (kind === "answer") G.cells[i] = val; else G.carries[i] = val;
  const node = cellNode(kind, i);
  if (node) node.textContent = val;
}

function onKey(k) {
  if (G.revealed) return;
  if (k === "C") {
    const n = cellCount();
    for (let i = 0; i < n; i++) { setCell("answer", i, ""); setCell("carry", i, ""); }
    clearMarks();
    G.active = { kind: "answer", i: n - 1 };
    paintActive();
    sfx.tap();
    return;
  }
  if (!G.active) return;
  const { kind, i } = G.active;
  if (k === "⌫") {
    if (kind === "answer" && G.cells[i] === "" && i < cellCount() - 1) {
      G.active = { kind: "answer", i: i + 1 };   // step back toward the ones column
      setCell("answer", i + 1, "");
    } else {
      setCell(kind, i, "");
    }
    cellNode(G.active.kind, G.active.i)?.classList.remove("good", "bad");
    paintActive();
    sfx.tap();
    return;
  }
  // digit
  setCell(kind, i, k);
  cellNode(kind, i)?.classList.remove("good", "bad");
  if (kind === "answer" && i > 0) G.active = { kind: "answer", i: i - 1 };
  else if (kind === "carry") G.active = { kind: "answer", i: Math.min(i + 1, cellCount() - 1) };
  paintActive();
  sfx.tap();
}

function clearMarks() {
  app.querySelectorAll(".answer-cell").forEach((c) => c.classList.remove("good", "bad"));
}

/* ---------- shoot / validate ---------- */
function onShoot() {
  if (!G) return;
  const shootBtn = document.getElementById("shoot-btn");
  if (G.revealed) { nextProblem(); return; }

  const n = cellCount();
  const expected = expectedCells();
  if (G.cells.every((v) => v === "")) {
    setFeedback("Fill in the answer first!", "bad");
    sfx.miss();
    return;
  }

  let allGood = true;
  for (let i = 0; i < n; i++) {
    const node = cellNode("answer", i);
    const ok = G.cells[i] === expected[i];
    if (!ok) allGood = false;
    node.classList.remove("good", "bad");
    node.classList.add(ok ? "good" : "bad");
  }

  if (allGood) {
    const p = curProblem();
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
    shootBtn.disabled = true;
    setTimeout(() => { shootBtn.disabled = false; nextProblem(); }, 1150);
  } else if (G.attempt === 1) {
    G.attempt = 2;
    setFeedback("Off the rim! Fix the red boxes and shoot again", "bad");
    sfx.rim();
  } else {
    // second miss: reveal answer + worked solution
    G.streak = 0;
    updateScoreboard();
    for (let i = 0; i < n; i++) {
      setCell("answer", i, expected[i]);
      const node = cellNode("answer", i);
      node.classList.remove("bad");
      node.classList.add("good");
    }
    showWorking();
    setFeedback("No basket — check the working, then hit Next", "bad");
    sfx.miss();
    G.revealed = true;
    shootBtn.textContent = "NEXT ▶";
  }
}

function showWorking() {
  const p = curProblem();
  const card = document.getElementById("problem-card");
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
    if (isLast) line += ` → write <b>${total}</b>`;
    else line += ` → write <b>${total % 10}</b>, carry <b>${Math.floor(total / 10)}</b>`;
    carry = Math.floor(total / 10);
    lines.push(line);
  }
  const w = el("div", "working");
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

  const summary = el("div", "summary");
  summary.appendChild(el("h2", null, "Full time! 🏁"));
  summary.appendChild(el("div", "final-score", `${G.score} pts`));
  const sub = el("div", "sub");
  sub.innerHTML = `🏀 Baskets: <b>${G.baskets} / ${ROUND_LEN}</b> &nbsp;•&nbsp; 🔥 Best streak: <b>${G.bestStreak}</b>`;
  summary.appendChild(sub);
  if (isBest && G.score > 0) summary.appendChild(el("div", "newbest", `⭐ New ${MODES[modeId].label} record!`));

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

/* ---------- keyboard support (handy on desktop) ---------- */
document.addEventListener("keydown", (e) => {
  if (!G || G.idx >= ROUND_LEN) return;
  if (/^[0-9]$/.test(e.key)) onKey(e.key);
  else if (e.key === "Backspace") { e.preventDefault(); onKey("⌫"); }
  else if (e.key === "Enter") onShoot();
});

/* ---------- mute ---------- */
const muteBtn = document.getElementById("mute-btn");
function paintMute() { muteBtn.textContent = store.muted ? "🔇" : "🔊"; }
muteBtn.addEventListener("click", () => {
  store.muted = !store.muted;
  saveStore();
  paintMute();
  if (!store.muted) sfx.tap();
});
paintMute();

/* ---------- boot ---------- */
renderHome();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
