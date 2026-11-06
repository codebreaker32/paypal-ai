/**
 * Caption phrasing, shared by the burned-in captions (components/Captions.jsx,
 * style "shelfie") and the SRT writer (scripts/srt.mjs), so the two always
 * show the same phrases at the same times.
 *
 * Input: one scene's word timings, [{ text, startSec, endSec }] as written by
 * video/voice/kokoro_tts.py (demoday's tts.mjs shape).
 *
 * 1. Split into sentences (at . ! ? and at pauses longer than MAX_GAP_SEC).
 * 2. A sentence longer than MAX_CHARS / MAX_WORDS is cut into the fewest
 *    near-equal parts, each break placed near its ideal point and preferably
 *    just after a comma, so no phrase ends on a dangling "for".
 *
 * Each phrase has `showSec` / `hideSec`: it appears just before its first word
 * and stays up until the next one appears (no blink between phrases), or
 * TAIL_SEC after its last word when a longer pause follows.
 */
export const MAX_CHARS = 50;
export const MAX_WORDS = 10;
const MAX_GAP_SEC = 0.6;
const LEAD_SEC = 0.08;
const TAIL_SEC = 0.5;
const HOLD_GAP_SEC = 0.35;
const COMMA_BONUS = 12; // characters a break may move to land on a comma

const phraseLen = (ws) => ws.reduce((n, w) => n + w.text.length, 0) + Math.max(0, ws.length - 1);

function sentences(words) {
  const out = [];
  let cur = [];
  for (const w of words) {
    if (!w?.text?.trim()) continue;
    const last = cur.at(-1);
    if (last && (/[.!?]["”]?$/.test(last.text) || w.startSec - last.endSec > MAX_GAP_SEC)) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

function splitBalanced(ws) {
  const total = phraseLen(ws);
  const n = Math.max(Math.ceil(total / MAX_CHARS), Math.ceil(ws.length / MAX_WORDS));
  if (n <= 1) return [ws];
  const cum = [];
  let c = 0;
  for (const [i, w] of ws.entries()) {
    c += w.text.length + (i ? 1 : 0);
    cum.push(c);
  }
  const breaks = [];
  let prev = -1;
  for (let k = 1; k < n; k++) {
    const target = (k * total) / n;
    let best = null;
    // break after word i; leave at least one word on each side
    for (let i = prev + 1; i < ws.length - (n - k); i++) {
      const score = Math.abs(cum[i] - target) - (/[,;:]$/.test(ws[i].text) ? COMMA_BONUS : 0);
      if (best == null || score < best.score) best = { i, score };
    }
    breaks.push(best.i);
    prev = best.i;
  }
  const parts = [];
  let start = 0;
  for (const b of [...breaks, ws.length - 1]) {
    parts.push(ws.slice(start, b + 1));
    start = b + 1;
  }
  return parts.filter((p) => p.length);
}

export function groupPhrases(words = []) {
  const phrases = sentences(words).flatMap(splitBalanced).map((ws) => ({
    words: ws,
    text: ws.map((w) => w.text).join(" "),
    startSec: ws[0].startSec,
    endSec: ws.at(-1).endSec,
  }));
  for (const [i, p] of phrases.entries()) {
    const next = phrases[i + 1];
    p.showSec = Math.max(0, p.startSec - LEAD_SEC);
    p.hideSec = p.endSec + TAIL_SEC;
    if (next) {
      const nextShow = next.startSec - LEAD_SEC;
      if (nextShow - p.endSec < TAIL_SEC + HOLD_GAP_SEC) p.hideSec = nextShow;
    }
  }
  return phrases;
}
