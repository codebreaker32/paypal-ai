import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { typeScale } from "../theme.js";

/**
 * The opening logo (manifest `intro`): the drawn lockup on the white page over
 * the first seconds of the opening shot, then a fade to the footage. The
 * narration and its captions start underneath it, so it adds no dead air.
 * `{ lockup: "assets/lockup.svg", holdSec: 1.6, outSec: 0.5 }`.
 */
export const Intro = ({ intro, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = typeScale(width, height);
  const hold = Math.round((intro.holdSec ?? 1.6) * fps);
  const out = Math.max(1, Math.round((intro.outSec ?? 0.5) * fps));
  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.6) });
  const opacity = interpolate(frame, [hold, hold + out], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ruleW = interpolate(spring({ frame: frame - Math.round(fps * 0.3), fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.6) }), [0, 1], [0, Math.round(96 * s)]);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, justifyContent: "center", alignItems: "center", opacity }}>
      <Img
        src={staticFile(intro.lockup || "assets/lockup.svg")}
        alt="Shelfie"
        style={{
          height: Math.round(150 * s),
          width: "auto",
          opacity: rise,
          transform: `translateY(${interpolate(rise, [0, 1], [20, 0])}px)`,
        }}
      />
      <div
        style={{
          width: ruleW,
          height: Math.round(6 * s),
          background: theme.primary,
          borderRadius: Math.round(3 * s),
          marginTop: Math.round(40 * s),
        }}
      />
    </AbsoluteFill>
  );
};
