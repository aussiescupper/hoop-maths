# 🏀 Hoop Maths

**Henry's Hoop Maths** — a basketball shootaround for practising **vertical multiplication with carrying**, built for iPad. Play it here → **https://aussiescupper.github.io/hoop-maths/**

A ScupperLab production, sibling app to [Skate Maths](https://github.com/aussiescupper/skate-maths).

## How it works

Every problem is laid out **vertically, just like the school worksheets** — top number, × digit, ruled line, and empty answer boxes. You build the answer **column by column from the ones**, using the on-screen number pad. Dashed **carry boxes** above the top number give you scratch space for carries (toggle them off from the home screen when you're ready to carry in your head).

When the answer is in, hit **SHOOT!** 🏀

- **Swish** — every box right first go: the ball flies into the hoop. 2-digit problems are worth **2 points**, 3-digit problems **3 points**.
- **Off the rim** — wrong boxes turn red; fix them and shoot again for a **rebound putback** (1 point).
- **Miss twice** — the full column-by-column working is shown, so every miss teaches the method.
- **On fire** 🔥 — three baskets in a row starts a hot streak: +1 bonus point per basket until you miss.

A round is **10 shots**. The scoreboard tracks score and streak; the final buzzer shows baskets, best streak, and any new record. Career points, baskets, games and per-mode records are saved on the device.

## Modes

| Mode | Problems | Worth |
|---|---|---|
| **2-digit** | 63 × 9, 82 × 8 … | 2-pointers |
| **3-digit** | 485 × 8, 738 × 7 … | 3-pointers |
| **Mix it up** | both, shuffled | 2 & 3 pointers |

Problems are generated to need carrying most of the time, and the 3-digit mode deliberately includes **internal-zero numbers** (304 × 5 style) — the classic place-value traps.

## Install on iPad

1. Open the link above in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. It runs full-screen and **works offline** after the first load.

## Tech

Vanilla HTML/CSS/JS, no dependencies. PWA with a cache-first service worker, WebAudio sound effects (no audio files), and localStorage for progress. Icons generated with Python/Pillow.
