import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, beat, Lockup } from "./slides/kit.jsx";

/** Height of the chapter bar in composition px; the footage is scaled to fit below it. */
export const CHAPTER_BAR_H = 84;

/** The home page's three steps, in its words (How it works). */
const STEPS = ["Snap your price list", "AI shoppers order", "Get paid on PayPal"];

const STEPS_X = 380; // where the first slot starts
const SLOT_W = 410;
const PILL_W = 340;
// Each step's pill hugs its label (28 px Figtree 700): 14 px before the number, ~32 px after the text.
const PILL_FIT = [340, 322, 336];
const PILL_H = 58;

/**
 * The roadmap, kept on screen through the three steps (scene.chapter
 * { step, of, title }), styled like the site's header: white, the drawn
 * lockup on the left, the three steps in fixed slots, "Step n of 3" on the
 * right. The current step sits in a pomegranate pill (the site's one filled
 * element); a done step shows a tick. When the step changes from the scene
 * before (prevStep), the pill slides across from the old slot.
 */
export const ChapterBar = ({ chapter, prevStep }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const step = chapter.step;
  const moving = prevStep && prevStep !== step;
  const p = moving ? beat(frame, 4, 20) : 1;
  const from = moving ? prevStep : step;
  const pillX = STEPS_X + (from - 1 + (step - from) * p) * SLOT_W - 14;
  const titles = STEPS.map((t, i) => (i + 1 === step && chapter.title ? chapter.title : t));

  const label = (i, onPill) => {
    const n = i + 1;
    const done = n < step;
    const current = n === step;
    const color = onPill ? C.white : current ? C.ink : done ? C.ink : C.muted;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, color, font: `${current || done ? 700 : 500} 28px/1 ${FONT}`, whiteSpace: "nowrap" }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: 999, flex: "0 0 auto", boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: onPill ? C.white : done ? C.ink : "transparent",
            border: onPill || done ? "none" : `2px solid ${C.muted}`,
            color: onPill ? C.pom : done ? C.white : C.muted,
            font: `800 21px/1 ${FONT}`,
          }}
        >
          {done && !onPill ? (
            <svg viewBox="0 0 20 20" width="20" height="20"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : n}
        </div>
        {titles[i]}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute", left: 0, top: 0, width, height: CHAPTER_BAR_H,
        background: C.white, borderBottom: `2px solid ${C.line}`, boxSizing: "border-box",
        textRendering: "geometricPrecision", overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 56, top: (CHAPTER_BAR_H - 36) / 2 - 1 }}>
        <Lockup height={36} />
      </div>

      <div style={{ position: "absolute", left: 0, top: (CHAPTER_BAR_H - PILL_H) / 2 - 1, width: PILL_W, height: PILL_H, borderRadius: 999, background: C.pom, transformOrigin: "0 50%", transform: `translateX(${pillX}px) scaleX(${(PILL_FIT[from - 1] + (PILL_FIT[step - 1] - PILL_FIT[from - 1]) * p) / PILL_W})` }} />

      {STEPS.map((_, i) => (
        <div key={i} style={{ position: "absolute", left: STEPS_X + i * SLOT_W, top: 0, height: CHAPTER_BAR_H - 2, display: "flex", alignItems: "center" }}>
          <div style={{ opacity: i + 1 === step ? 1 - p : 1 }}>{label(i, false)}</div>
          {i + 1 === step ? <div style={{ position: "absolute", left: 0, opacity: p }}>{label(i, true)}</div> : null}
        </div>
      ))}

      <div style={{ position: "absolute", right: 56, top: 0, height: CHAPTER_BAR_H - 2, display: "flex", alignItems: "center", font: `700 26px/1 ${FONT}`, color: C.pom, fontVariantNumeric: "tabular-nums" }}>
        Step {step} of {chapter.of || 3}
      </div>
    </div>
  );
};

/** The scene's footage, scaled to sit under the chapter bar (white margins at the sides). */
export const UnderChapterBar = ({ children, theme }) => {
  const { width, height } = useVideoConfig();
  const k = (height - CHAPTER_BAR_H) / height;
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <div
        style={{
          position: "absolute",
          left: Math.round((width - width * k) / 2), top: CHAPTER_BAR_H,
          width, height,
          transform: `scale(${k})`, transformOrigin: "0 0",
          overflow: "hidden",
          background: theme.bg,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
