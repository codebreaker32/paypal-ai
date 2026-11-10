import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, FONT, beat, rise, WaveTop, AccentMarks, splitEmphasis } from "./slides/kit.jsx";

/**
 * Words over the footage (scene.onScreen in demo.json), in the public site's
 * band language. build-props resolves each item's `fromSec` / `toSec` (seconds
 * into the scene; `from` / `to` may name a spoken phrase instead).
 *
 * - default (a sourced statistic): a pomegranate panel slides in from the left
 *   over the footage; a leading figure ("47%") is set as the display number,
 *   the rest of the sentence under it, the source in blush.
 * - variant "statement": a blush band rises with the hero's wave and covers
 *   the footage; the line is set large in ink, `emphasis` (a substring) in the
 *   accent.
 * The captions draw above both.
 */
export const OnScreenText = ({ item, sceneFrames, outFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;
  const { fromSec = 0, toSec = Infinity } = item;
  if (t < fromSec || t >= toSec) return null;
  const f = frame - Math.round(fromSec * fps);
  // An item that runs to the scene's end leaves with the scene: it fades over
  // the transition into the next one (a full-frame band would otherwise hide
  // the cross-fade and snap off on the cut).
  const out = Number.isFinite(toSec)
    ? interpolate(t, [toSec - 0.35, toSec], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : sceneFrames && outFrames
      ? interpolate(frame, [sceneFrames - outFrames, sceneFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  return item.variant === "statement"
    ? <Statement item={item} f={f} height={height} out={out} />
    : <Stat item={item} f={f} out={out} />;
};

/** The stat panel's width; the captions move over the footage beside it (Captions.jsx). */
export const PANEL_W = 900;

function Stat({ item, f, out }) {
  const slide = beat(f, 0, 18);
  // "47% of US ..." -> "47%" and "of US ...".
  const m = /^(\d[\d.,]*%)\s+(.*)$/.exec(item.text);
  const figure = m ? m[1] : null;
  const rest = m ? m[2] : item.text;
  // It leaves the way it came: slides back out to the left (no fade, so the figure never ghosts over the footage).
  const leave = 1 - (1 - out) * (1 - out); // eases in: it accelerates away
  const x = (Math.min(slide, leave) - 1) * PANEL_W;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: PANEL_W, background: C.pom,
          transform: `translateX(${x}px)`,
          padding: "118px 96px 0 120px", boxSizing: "border-box", color: C.white,
        }}
      >
        {figure ? (
          <div style={{ ...rise(beat(f, 8, 18), 40), font: `800 300px/0.9 ${FONT}`, letterSpacing: "-0.05em", fontVariantNumeric: "lining-nums tabular-nums", marginLeft: -12 }}>
            {figure}
          </div>
        ) : null}
        <div style={{ ...rise(beat(f, 14, 18), 24), marginTop: 44, font: `700 54px/1.16 ${FONT}`, letterSpacing: "-0.02em", maxWidth: 680, textWrap: "balance" }}>
          {rest}
        </div>
        {item.source ? (
          <div style={{ ...rise(beat(f, 22, 16), 12), marginTop: 40, display: "flex", gap: 16, alignItems: "flex-start", font: `500 27px/1.35 ${FONT}`, color: C.blush3, maxWidth: 640 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.blush3, marginTop: 17, flex: "0 0 auto" }} />
            {item.source}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Statement({ item, f, height, out = 1 }) {
  const up = beat(f, 0, 22);
  const [pre, em, post] = splitEmphasis(item.text, item.emphasis);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: out }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: -100, height: height + 100, transform: `translateY(${(1 - up) * (height + 100)}px)` }}>
        <WaveTop color={C.blush2} height={120} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 118, bottom: 0, background: C.blush2 }} />
      </div>
      {/* The text starts on the 120 px margin every slide shares; the accent marks sit above it. */}
      <div style={{ position: "absolute", left: 120, right: 100, top: 112, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ marginLeft: -6 }}>
          <AccentMarks size={84} p={beat(f, 18, 14)} />
        </div>
        <div style={{ ...rise(beat(f, 8, 20), 40), marginTop: 18, font: `800 156px/1.0 ${FONT}`, letterSpacing: "-0.04em", color: C.ink, maxWidth: 1560 }}>
          {pre}
          <span style={{ color: C.pom }}>{em}</span>
          {post}
        </div>
      </div>
    </div>
  );
}
