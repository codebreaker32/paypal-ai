import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { typeScale } from "../theme.js";

/**
 * A title card in Shelfie's brand: white page, the logo (the drawn lockup,
 * assets/lockup.svg, when the title is "Shelfie" or scene.lockup is set;
 * otherwise the mark beside the title in ink), one
 * short pomegranate rule, the line in muted ink, and an optional small footer
 * line (scene.cta). Flat: no gradient, glow or shadow. `band` (the demoday
 * presenter close) is not used by Shelfie and renders the same card.
 */
export const Card = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = typeScale(width, height);

  const rise = (delayFrames) =>
    spring({ frame: frame - delayFrames, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.6) });
  const titleIn = rise(0);
  const subIn = rise(Math.round(fps * 0.2));
  const ruleIn = rise(Math.round(fps * 0.35));
  const footIn = rise(Math.round(fps * 0.5));
  const logo = scene.logo === false ? null : scene.logo || "assets/mark.svg";
  // The name is never set in Figtree: the brand's own title card shows the drawn lockup (docs/DESIGN.md, "Logo").
  const lockup = scene.lockup === false ? null : scene.lockup || (scene.title === "Shelfie" ? "assets/lockup.svg" : null);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 10%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: Math.round(28 * s),
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [20, 0])}px)`,
        }}
      >
        {lockup ? (
          <Img src={staticFile(lockup)} alt={scene.title} style={{ height: Math.round(150 * s), width: "auto" }} />
        ) : (
          <>
            {logo ? <Img src={staticFile(logo)} style={{ width: Math.round(112 * s), height: Math.round(112 * s) }} /> : null}
            <div
              style={{
                font: `700 ${Math.round((scene.titleSize || 124) * s)}px/1 ${theme.font}`,
                letterSpacing: "-0.03em",
                color: theme.text,
              }}
            >
              {scene.title}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          width: interpolate(ruleIn, [0, 1], [0, Math.round(96 * s)]),
          height: Math.round(6 * s),
          background: theme.primary,
          borderRadius: Math.round(3 * s),
          margin: `${Math.round(40 * s)}px 0 ${Math.round(34 * s)}px`,
        }}
      />

      {scene.subtitle ? (
        <div
          style={{
            font: `500 ${Math.round(48 * s)}px/1.25 ${theme.font}`,
            color: theme.text,
            opacity: subIn,
            transform: `translateY(${interpolate(subIn, [0, 1], [16, 0])}px)`,
            maxWidth: "80%",
          }}
        >
          {scene.subtitle}
        </div>
      ) : null}

      {scene.cta ? (
        <div
          style={{
            marginTop: Math.round(56 * s),
            font: `500 ${Math.round(30 * s)}px/1.3 ${theme.font}`,
            color: theme.muted,
            opacity: footIn,
          }}
        >
          {scene.cta}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
