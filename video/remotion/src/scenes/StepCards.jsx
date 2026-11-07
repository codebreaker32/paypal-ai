import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { typeScale } from "../theme.js";

const useRise = (fromSec) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - Math.round((fromSec ?? 0) * fps), fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.5) });
};

const Step = ({ step, theme, s }) => {
  const r = useRise(step.fromSec);
  return (
    <div
      style={{
        flex: "1 1 0",
        opacity: r,
        transform: `translateY(${interpolate(r, [0, 1], [24, 0])}px)`,
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        gap: Math.round(26 * s),
      }}
    >
      <div
        style={{
          width: Math.round(96 * s), height: Math.round(96 * s), borderRadius: 999,
          background: theme.primary, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          font: `700 ${Math.round(52 * s)}px/1 ${theme.font}`,
        }}
      >
        {step.n}
      </div>
      <div style={{ font: `700 ${Math.round(58 * s)}px/1.12 ${theme.font}`, color: theme.text, letterSpacing: "-0.02em" }}>
        {step.title}
      </div>
    </div>
  );
};

/** "How it works": the lockup and three numbered steps, each rising in as it is spoken (scene.steps). */
export const RoadmapCard = ({ scene, theme }) => {
  const { width, height } = useVideoConfig();
  const s = typeScale(width, height);
  const head = useRise(0);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, padding: `0 ${Math.round(150 * s)}px`, justifyContent: "center" }}>
      <div style={{ opacity: head, display: "flex", alignItems: "center", gap: Math.round(28 * s), marginBottom: Math.round(90 * s) }}>
        <Img src={staticFile("assets/lockup.svg")} alt="Shelfie" style={{ height: Math.round(84 * s), width: "auto" }} />
        <div style={{ font: `500 ${Math.round(44 * s)}px/1 ${theme.font}`, color: theme.muted }}>works in three steps</div>
      </div>
      <div style={{ display: "flex", gap: Math.round(70 * s), alignItems: "flex-start" }}>
        {(scene.steps || []).map((st) => <Step key={st.n} step={st} theme={theme} s={s} />)}
      </div>
    </AbsoluteFill>
  );
};

const Row = ({ row, theme, s }) => {
  const r = useRise(row.fromSec);
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: `${Math.round(360 * s)}px 1fr`, alignItems: "baseline",
        gap: Math.round(40 * s),
        padding: `${Math.round(34 * s)}px 0`,
        borderTop: `2px solid ${theme.line}`,
        opacity: r,
        transform: `translateY(${interpolate(r, [0, 1], [20, 0])}px)`,
      }}
    >
      <div style={{ font: `700 ${Math.round(40 * s)}px/1.2 ${theme.font}`, color: theme.primary }}>{row.label}</div>
      <div style={{ font: `600 ${Math.round(54 * s)}px/1.18 ${theme.font}`, color: theme.text, letterSpacing: "-0.015em" }}>{row.text}</div>
    </div>
  );
};

/** The close: who it's for, what PayPal does, what AI does (scene.rows), each rising in as it is spoken. */
export const SummaryCard = ({ scene, theme }) => {
  const { width, height } = useVideoConfig();
  const s = typeScale(width, height);
  const head = useRise(0);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, padding: `0 ${Math.round(150 * s)}px`, justifyContent: "center" }}>
      <div style={{ opacity: head, marginBottom: Math.round(50 * s) }}>
        <Img src={staticFile("assets/lockup.svg")} alt="Shelfie" style={{ height: Math.round(84 * s), width: "auto" }} />
      </div>
      <div style={{ borderBottom: `2px solid ${theme.line}` }}>
        {(scene.rows || []).map((row, i) => <Row key={i} row={row} theme={theme} s={s} />)}
      </div>
    </AbsoluteFill>
  );
};
