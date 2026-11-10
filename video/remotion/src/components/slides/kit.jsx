import React from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";

/**
 * The slide system's shared parts, built from the public site's bands
 * (docs/DESIGN.md "The public site"): pomegranate and blush bands with the
 * hero's wave, charcoal for the close, white cards joined by drawn arrows
 * (landing/HeroChain.tsx), the Awning logo as drawn files and PayPal's own
 * logo files, unmodified, on white only.
 *
 * Motion: one exponential ease-out; only transform and opacity move.
 */
export const C = {
  pom: "#c21a4b",
  pomDeep: "#a3153f",
  blush1: "#fffcfd",
  blush2: "#fff7f8",
  blush3: "#feeaed", // text on pomegranate (5.14:1)
  blush5: "#ffced6",
  charcoal: "#292524",
  charcoalSoft: "#d6d3d1", // text on charcoal (10.18:1)
  ink: "#111214",
  inkSoft: "#3d4148",
  muted: "#5e636c",
  line: "#eceef1",
  sunken: "#f4f5f7",
  paper: "#f6ecd9",
  ok: "#1e7a45",
  okSoft: "#e4f3ea",
  noteSoft: "#eef2f6",
  note: "#475569",
  white: "#ffffff",
};

export const FONT = "Figtree, system-ui, sans-serif";

/** Ink-tinted lift for true cards: an offset plus a soft blur (DESIGN.md elevation). */
export const LIFT = "0 2px 4px rgba(17,18,20,0.06), 0 18px 40px -12px rgba(17,18,20,0.28)";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** 0..1 progress of a beat that starts at `start` frames and lasts `dur` frames. */
export const beat = (frame, start, dur = 14) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

/** Rise-in style for a beat: opacity plus a short upward travel. */
export const rise = (p, dist = 28) => ({ opacity: p, transform: `translateY(${(1 - p) * dist}px)` });

/** The hero's wave: a pomegranate (or any) band whose top edge is the site's curve. */
export const WaveTop = ({ color, height = 90, flip = false }) => (
  <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ display: "block", width: "100%", height, transform: flip ? "scaleX(-1)" : undefined }}>
    <path fill={color} d="M0 40C360 0 1080 0 1440 60V120H0Z" />
  </svg>
);

/** A drawn arrow: it slides out of its own clipped slot, so it reads as drawn while only transform moves. */
export const Arrow = ({ p, color = C.white, width = 64, shadow = false }) => (
  <div style={{ width, overflow: "hidden", flex: "0 0 auto" }}>
    <svg
      viewBox="0 0 28 24"
      style={{ display: "block", width: "100%", transform: `translateX(${(p - 1) * 105}%)`, filter: shadow ? "drop-shadow(0 1px 3px rgba(17,18,20,0.35))" : undefined }}
      fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 12h21M15 4l9 8-9 8" />
    </svg>
  </div>
);

/** Three hand-drawn strokes beside a heading (landing/art.tsx AccentMarks), drawn in with a clip. */
export const AccentMarks = ({ size = 72, color = C.pom, p = 1, mirror = false }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
    style={{ opacity: p, transform: `${mirror ? "scaleX(-1) " : ""}scale(${0.6 + 0.4 * p})`, flex: "0 0 auto" }}>
    <path d="M6 30c5 1.5 9 3 13 5" />
    <path d="M10 8c2.5 6 5 11 8.5 16" />
    <path d="M30 4c-.8 6.5-.8 12 0 18" />
  </svg>
);

/** The assistant: a neutral speech bubble and spark (landing/art.tsx), nobody's logo. */
export const AssistantMark = ({ size = 40 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="none" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
      d="M10 7h28a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H23l-9 7v-7h-4a6 6 0 0 1-6-6V13a6 6 0 0 1 6-6Z" />
    <path fill={C.pom} d="M24 12.5c1 4.6 2.9 6.5 7.5 7.5-4.6 1-6.5 2.9-7.5 7.5-1-4.6-2.9-6.5-7.5-7.5 4.6-1 6.5-2.9 7.5-7.5Z" />
  </svg>
);

/** A green tick in a circle (the chain's "paid" and "placed" marks). */
export const Tick = ({ size = 40 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} style={{ flex: "0 0 auto" }}>
    <circle cx="20" cy="20" r="20" fill={C.ok} />
    <path d="M12 20.5l5.5 5.5L28.5 14.5" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The drawn Awning lockup or mark (never "shelfie" set in Figtree). */
export const Lockup = ({ height, style }) => (
  <Img src={staticFile("assets/lockup.svg")} alt="Shelfie" style={{ height, width: "auto", display: "block", ...style }} />
);
export const Mark = ({ size, style }) => (
  <Img src={staticFile("assets/mark.svg")} alt="" style={{ width: size, height: size, display: "block", ...style }} />
);

/**
 * PayPal's official logo (paypalobjects.com/paypal-ui/logos/svg/), unmodified,
 * full colour, so it only ever sits on white. Width >= 120 px at 1080p.
 */
export const PayPalLogo = ({ width = 180, mark = false }) => (
  <Img
    src={staticFile(mark ? "assets/paypal/paypal-mark-color.svg" : "assets/paypal/paypal-color.svg")}
    alt="PayPal"
    style={{ width: Math.max(120, width), height: "auto", display: "block", flex: "0 0 auto" }}
  />
);

/**
 * Seconds into the scene at which a spoken phrase starts, from the scene's
 * word timings ([{ text, startSec }]). Null when the phrase is not found.
 */
export function phraseAt(words, phrase) {
  if (!words?.length || !phrase) return null;
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9%']/g, "");
  const want = phrase.split(/\s+/).map(norm).filter(Boolean);
  const got = words.map((w) => norm(w.text));
  for (let i = 0; i + want.length <= got.length; i++) {
    if (want.every((w, k) => got[i + k] === w)) return words[i].startSec;
  }
  return null;
}

/** Splits `text` around `emphasis` (a substring) so it can be set in the accent. */
export function splitEmphasis(text, emphasis) {
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (at < 0) return [text, "", ""];
  return [text.slice(0, at), emphasis, text.slice(at + emphasis.length)];
}
