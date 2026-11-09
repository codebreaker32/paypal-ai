import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { typeScale } from "../theme.js";

/**
 * Zoom-to-action for one beat (demo.json `beats[].focus`): the shot eases in
 * toward a rectangle of the 1920x1080 capture ({ x, y, w, h } in capture px),
 * a pomegranate box draws around it while the rest of the frame dims a little,
 * and an optional label (`label`) sits beside the box. `zoom` (default 1.3) is
 * clamped so the footage always covers the frame; `delaySec` delays it all.
 * Only transform and opacity animate.
 */
export const FocusLayer = ({ focus, theme, children }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const s = typeScale(W, H);
  const t = frame / fps;
  const t0 = focus.delaySec ?? 0.25;
  const ease = Easing.inOut(Easing.cubic);
  const p = interpolate(t, [t0, t0 + 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const z = Math.max(1, focus.zoom ?? 1.3);

  const cx = focus.x + focus.w / 2;
  const cy = focus.y + focus.h / 2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const txEnd = clamp(W / 2 - z * cx, W - z * W, 0);
  const tyEnd = clamp(H / 2 - z * cy, H - z * H, 0);
  const sc = 1 + (z - 1) * p;
  const tx = txEnd * p;
  const ty = tyEnd * p;

  // The box, in composition px, at the END of the zoom (it appears after it).
  const pad = 10;
  const bx = txEnd + z * focus.x - pad;
  const by = tyEnd + z * focus.y - pad;
  const bw = z * focus.w + pad * 2;
  const bh = z * focus.h + pad * 2;
  const boxIn = interpolate(t, [t0 + 0.55, t0 + 0.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const labelIn = interpolate(t, [t0 + 0.75, t0 + 1.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const showBox = focus.box !== false && focus.w > 2 && focus.h > 2;

  // Label: above the box when there is room, else below it, else inside its top edge.
  // labelPlacement: "below" forces it under the box, for when the lines above the box are the point.
  const labelH = Math.round(70 * s);
  const gap = Math.round(14 * s);
  let ly;
  if (focus.labelPlacement === "below") ly = by + bh + gap;
  else if (by - gap - labelH > 30) ly = by - gap - labelH;
  else if (by + bh + gap + labelH < H - 150) ly = by + bh + gap;
  else ly = by + gap;
  const lx = clamp(bx, 40, W - 40 - 900);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${sc})`, transformOrigin: "0 0" }}>
        {children}
      </AbsoluteFill>
      {showBox ? (
        <div
          style={{
            position: "absolute",
            left: bx, top: by, width: bw, height: bh,
            borderRadius: Math.round(16 * s),
            border: `${Math.round(5 * s)}px solid ${theme.primary}`,
            boxShadow: `0 0 0 4000px rgba(17,18,20,${0.32 * boxIn})`,
            opacity: boxIn,
          }}
        />
      ) : null}
      {focus.label ? (
        <div
          style={{
            position: "absolute",
            left: lx, top: ly,
            opacity: labelIn,
            transform: `translateY(${(1 - labelIn) * 10}px)`,
            background: theme.primary,
            color: "#ffffff",
            font: `700 ${Math.round(38 * s)}px/1 ${theme.font}`,
            letterSpacing: "-0.01em",
            padding: `${Math.round(16 * s)}px ${Math.round(26 * s)}px`,
            borderRadius: Math.round(14 * s),
            whiteSpace: "nowrap",
            textRendering: "geometricPrecision",
          }}
        >
          {focus.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
