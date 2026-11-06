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
