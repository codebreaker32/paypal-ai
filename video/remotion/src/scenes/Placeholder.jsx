import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { typeScale } from "../theme.js";

/**
 * Stand-in for a screen clip that has not been recorded yet (render with
 * --placeholders): the shot's description from demo.json's `screen` field and
 * the clip file it waits for, on the brand's light grey. Lets the whole cut be
 * timed and captioned as an animatic before capture.
 */
export const Placeholder = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = typeScale(width, height);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface || "#f4f5f7", padding: `${Math.round(120 * s)}px ${Math.round(160 * s)}px` }}>
      <div style={{ font: `600 ${Math.round(28 * s)}px ${theme.font}`, color: theme.primary, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Placeholder · {scene.id} · beat {scene.beat ?? "-"}
      </div>
      <div style={{ marginTop: Math.round(28 * s), font: `600 ${Math.round(54 * s)}px/1.25 ${theme.font}`, color: theme.text, maxWidth: Math.round(1500 * s) }}>
        {scene.screen || scene.note || scene.id}
      </div>
      <div style={{ marginTop: Math.round(36 * s), font: `500 ${Math.round(28 * s)}px ${theme.font}`, color: theme.muted }}>
        waiting for {scene.video || "a clip"} · {(frame / fps).toFixed(1)} s / {(scene.durationSec || 0).toFixed(1)} s
      </div>
    </AbsoluteFill>
  );
};
