import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, FONT, LIFT, beat, rise, Arrow, AccentMarks, Mark, PayPalLogo, phraseAt } from "../components/slides/kit.jsx";

/**
 * The architecture card (scene.kind "architecture"): the hero's chain motif
 * grown to the whole system, six white cards on the blush band joined by
 * drawn arrows, snaking in two rows. Every card starts dim and lights when the
 * narration names it (phrase cues matched in the scene's word timings); the
 * closing phrase lifts the photo card, where it all started.
 */
const NODES = [
  { id: "photo", title: "A photo of the price list", sub: "One snap from the seller's phone", brand: "photo", cue: "Claude reads" },
  { id: "read", title: "Claude reads it", sub: "Every item, price and question", brand: "claude", cue: "Claude reads" },
  { id: "catalog", title: "Catalog", sub: "Each item becomes a PayPal product", brand: "paypal", cue: "holds the catalog" },
  { id: "door", title: "Agent door (MCP)", sub: "Any AI assistant can order", brand: "door", cue: "agent door" },
  { id: "orders", title: "Orders and payment", sub: "Paid to the seller's own account", brand: "paypal", cue: "takes the payment" },
  { id: "brief", title: "Claude brief", sub: "via the PayPal Agent Toolkit", brand: "claude", cue: "writes the brief" },
];

const CARD_W = 480;
const CARD_H = 236;
const GAP = 92;
const LEFT = (1920 - (3 * CARD_W + 2 * GAP)) / 2;
const ROW1 = 250;
const ROW2 = 590;

// Row 1 left to right (photo, read, catalog); row 2 right to left (door, orders, brief).
const POS = [
  [LEFT, ROW1], [LEFT + CARD_W + GAP, ROW1], [LEFT + 2 * (CARD_W + GAP), ROW1],
  [LEFT + 2 * (CARD_W + GAP), ROW2], [LEFT + CARD_W + GAP, ROW2], [LEFT, ROW2],
];

const ClaudeTag = () => (
  <span style={{ background: C.ink, color: C.white, borderRadius: 999, padding: "9px 18px 10px", font: `700 24px/1 ${FONT}`, letterSpacing: "0.005em" }}>
    Claude
  </span>
);

function Brand({ brand }) {
  if (brand === "paypal") return <PayPalLogo width={150} />;
  if (brand === "claude") return <ClaudeTag />;
  if (brand === "door") {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 12, font: `600 22px/1 ui-monospace, SFMono-Regular, Menlo, monospace`, color: C.inkSoft }}>
        <Mark size={40} />
        /s/marigold-bakehouse/mcp
      </span>
    );
  }
  return null;
}

function Node({ node, lit, lift }) {
  const photo = node.brand === "photo";
  return (
    <div
      style={{
        width: CARD_W, height: CARD_H, borderRadius: 24, background: C.white, boxShadow: LIFT, overflow: "hidden",
        display: "flex", boxSizing: "border-box",
        opacity: 0.38 + 0.62 * lit,
        transform: `scale(${0.96 + 0.04 * lit + 0.04 * lift})`,
      }}
    >
      {photo ? (
        <div style={{ width: 188, flex: "0 0 auto", background: C.paper }}>
          <Img src={staticFile("assets/slides/menu-photo.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%" }} />
        </div>
      ) : null}
      <div style={{ padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: photo ? "center" : "space-between", flex: 1, minWidth: 0 }}>
        {photo ? null : <div style={{ display: "flex", alignItems: "center", height: 44 }}><Brand brand={node.brand} /></div>}
        <div>
          <div style={{ font: `800 40px/1.08 ${FONT}`, letterSpacing: "-0.025em", color: C.ink }}>{node.title}</div>
          <div style={{ marginTop: 10, font: `500 25px/1.3 ${FONT}`, color: C.muted }}>{node.sub}</div>
        </div>
      </div>
    </div>
  );
}

export const ArchitectureCard = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = scene.wordTimings || [];
  const dur = scene.durationSec || 17;
  const cueFrame = (phrase, fallbackSec) => Math.round((phraseAt(words, phrase) ?? fallbackSec) * fps);
  const lightAt = NODES.map((n, i) => cueFrame(n.cue, 1.5 + i * 1.8));
  const paperAt = cueFrame("A sheet of paper", dur - 4);

  const head = beat(frame, 0, 18);
  // The structure draws first (cards land dim, arrows draw in order), then the voice lights it.
  const land = (i) => beat(frame, 6 + i * 4, 16);
  const arrowP = (i) => beat(frame, 14 + i * 5, 12);
  const lift = interpolate(frame, [paperAt, paperAt + 8, paperAt + 26], [0, 1, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const midY1 = ROW1 + CARD_H / 2 - 30;
  const midY2 = ROW2 + CARD_H / 2 - 30;
  const arrows = [
    { x: LEFT + CARD_W + (GAP - 60) / 2, y: midY1, rot: 0 },
    { x: LEFT + 2 * CARD_W + GAP + (GAP - 60) / 2, y: midY1, rot: 0 },
    { x: POS[2][0] + CARD_W / 2 - 30, y: ROW1 + CARD_H + (ROW2 - ROW1 - CARD_H) / 2 - 30, rot: 90 },
    { x: LEFT + 2 * CARD_W + GAP + (GAP - 60) / 2, y: midY2, rot: 180 },
    { x: LEFT + CARD_W + (GAP - 60) / 2, y: midY2, rot: 180 },
  ];

  return (
    <AbsoluteFill style={{ background: C.blush2, overflow: "hidden", textRendering: "geometricPrecision" }}>
      <div style={{ position: "absolute", left: LEFT, top: 78, display: "flex", alignItems: "flex-start", gap: 14, ...rise(head, 20) }}>
        <div style={{ font: `800 92px/1 ${FONT}`, letterSpacing: "-0.04em", color: C.ink }}>The whole picture</div>
        <div style={{ marginTop: -22 }}><AccentMarks size={70} p={beat(frame, 12, 14)} mirror /></div>
      </div>

      {arrows.map((a, i) => (
        <div key={i} style={{ position: "absolute", left: a.x, top: a.y, width: 60, height: 60, display: "flex", alignItems: "center", transform: `rotate(${a.rot}deg)` }}>
          <Arrow p={arrowP(i)} color={C.pom} width={60} />
        </div>
      ))}

      {NODES.map((n, i) => {
        const lit = beat(frame, lightAt[i], 14);
        return (
          <div key={n.id} style={{ position: "absolute", left: POS[i][0], top: POS[i][1], ...rise(land(i), 30) }}>
            <Node node={n} lit={lit} lift={n.id === "photo" ? lift : 0} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
