import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { typeScale } from "../theme.js";

/**
 * A sourced fact or quote over the footage (scene.onScreen in demo.json):
 * a white card, top-left inside the title-safe area, ink text, a pomegranate
 * rule on its left edge and the source in muted ink. build-props resolves each
 * item's `fromSec` / `toSec` (seconds into the scene; `from` / `to` may name a
 * spoken phrase instead, matched in the scene's word timings).
 */
export const OnScreenText = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = typeScale(width, height);
  const t = frame / fps;
  const { fromSec = 0, toSec = Infinity } = item;
  if (t < fromSec || t >= toSec) return null;
  const inP = spring({ frame: frame - Math.round(fromSec * fps), fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.45) });
  const out = Number.isFinite(toSec) ? interpolate(t, [toSec - 0.3, toSec], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  if (item.variant === "statement") {
    // The positioning line: centred, large, over the dimmed footage.
    return (
      <div style={{ position: "absolute", inset: 0, background: `rgba(17,18,20,${0.55 * inP * out})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: Math.round(1380 * s),
            background: "#ffffff",
            borderRadius: Math.round(20 * s),
            padding: `${Math.round(56 * s)}px ${Math.round(72 * s)}px`,
            opacity: inP * out,
            transform: `translateY(${interpolate(inP, [0, 1], [18, 0])}px)`,
            textAlign: "left",
          }}
        >
          <div style={{ width: Math.round(96 * s), height: Math.round(8 * s), borderRadius: 4, background: theme.primary, marginBottom: Math.round(34 * s) }} />
          <div style={{ font: `700 ${Math.round(70 * s)}px/1.12 ${theme.font}`, color: theme.text, letterSpacing: "-0.025em" }}>{item.text}</div>
          {item.sub ? (
            <div style={{ marginTop: Math.round(26 * s), font: `500 ${Math.round(48 * s)}px/1.25 ${theme.font}`, color: theme.text }}>{item.sub}</div>
          ) : null}
        </div>
      </div>
    );
  }
  const pos = item.position === "top-right"
    ? { top: Math.round(height * 0.07), right: Math.round(width * 0.05) }
    : { top: Math.round(height * 0.07), left: Math.round(width * 0.05) };
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        maxWidth: Math.round((item.maxWidth || 900) * s),
        background: "#ffffff",
        borderLeft: `${Math.round(8 * s)}px solid ${theme.primary}`,
        borderRadius: Math.round(10 * s),
        padding: `${Math.round(26 * s)}px ${Math.round(34 * s)}px ${Math.round(24 * s)}px`,
        opacity: inP * out,
        transform: `translateY(${interpolate(inP, [0, 1], [14, 0])}px)`,
      }}
    >
      <div style={{ font: `600 ${Math.round(40 * s)}px/1.28 ${theme.font}`, color: theme.text, letterSpacing: "-0.01em" }}>
        {item.text}
      </div>
      {item.source ? (
        <div style={{ marginTop: Math.round(14 * s), font: `500 ${Math.round(24 * s)}px/1.3 ${theme.font}`, color: theme.muted }}>
          {item.source}
        </div>
      ) : null}
    </div>
  );
};
