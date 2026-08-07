# 🏀 Hoop Maths

**Play it here → https://aussiescupper.github.io/hoop-maths/**

Henry's Hoop Maths — a vertical multiplication practice game for iPad. Solve
2-digit × 1-digit (2-pointers) and 3-digit × 1-digit (3-pointers) problems
column by column, carries and all, then SHOOT. Three in a row and you're
🔥 ON FIRE.

A ScupperLab production.

## How it plays

- Pick a mode: **2-digit**, **3-digit**, or **Mix it up** (five of each).
- Build the answer from the **ones column**, right to left, on the big numpad.
  The dashed boxes above the sum are scratch space for carries (turn them off
  on the home screen when you can carry in your head).
- **SHOOT!** Every column right = basket. One miss = a rebound chance with the
  wrong boxes marked. Two misses = the full worked solution, column by column.
- 10 shots a round. First-try baskets score 2 or 3 points; on-fire baskets
  score a bonus; rebound putbacks score 1. Career points, baskets and per-mode
  records are saved on the device.
- Problems are generated to almost always involve carrying, and deliberately
  include internal-zero numbers (304 × 6 style) — the classic place-value traps.

## Install on iPad

Open the link in Safari → Share → **Add to Home Screen**. Works offline after
the first load. Updates you deploy are picked up automatically on the next
online launch (app shell is network-first with offline fallback).

## Stack

Vanilla HTML/CSS/JS, no dependencies. PWA: `manifest.webmanifest` + `sw.js`
(network-first shell, cache-first icons). Sounds are synthesised with WebAudio —
no audio files. Deployed from `main` via GitHub Pages.
