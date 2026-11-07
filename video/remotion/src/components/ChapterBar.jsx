import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { typeScale } from "../theme.js";

/** Height of the chapter bar in composition px; the footage is scaled to fit below it. */
export const CHAPTER_BAR_H = 84;

const STEPS = ["Snap your price list", "AI shoppers can order", "Paid on PayPal"];

/**
 * The roadmap, kept on screen through the three steps (scene.chapter
 * { step, of, title }): the mark, the three steps with the current one in ink
 * and the others muted, and "Step n of 3" in the accent on the right.
 */
export const ChapterBar = ({ chapter, theme }) => {
  const { width, height } = useVideoConfig();
  const s = typeScale(width, height);
  return (
    <div
      style={{
        position: "absolute", left: 0, top: 0, width, height: CHAPTER_BAR_H,
        background: "#ffffff",
        borderBottom: `2px solid ${theme.line}`,
        display: "flex", alignItems: "center",
        padding: `0 ${Math.round(56 * s)}px`,
        gap: Math.round(34 * s),
        font: `600 ${Math.round(28 * s)}px/1 ${theme.font}`,
        textRendering: "geometricPrecision",
      }}
    >
      <Img src={staticFile("assets/mark.svg")} style={{ width: Math.round(44 * s), height: Math.round(44 * s) }} />
      {STEPS.map((title, i) => {
        const n = i + 1;
        const current = n === chapter.step;
        const done = n < chapter.step;
        return (
          <React.Fragment key={n}>
            {i > 0 ? <div style={{ width: Math.round(40 * s), height: 2, background: theme.line }} /> : null}
            <div style={{ display: "flex", alignItems: "center", gap: Math.round(14 * s), color: current ? theme.text : theme.muted, fontWeight: current ? 700 : 500 }}>
              <div
                style={{
                  width: Math.round(42 * s), height: Math.round(42 * s), borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: current ? theme.primary : "transparent",
                  border: current ? "none" : `2px solid ${done ? theme.muted : theme.line}`,
                  color: current ? "#fff" : theme.muted,
                  fontWeight: 700, fontSize: Math.round(24 * s),
                }}
              >
                {n}
              </div>
              {title}
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ marginLeft: "auto", color: theme.primary, fontWeight: 700 }}>
        Step {chapter.step} of {chapter.of || 3}
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
