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
  { id: "photo", title: "Price list photo", sub: "From the seller's phone", brand: "photo", cue: "Claude reads" },
  { id: "read", title: "Claude reads it", sub: "Every item, price and question", brand: "claude", cue: "Claude reads" },
  { id: "catalog", title: "Catalog", sub: "Every item a PayPal product", brand: "paypal", cue: "holds the catalog" },
  { id: "door", title: "Agent door (MCP)", sub: "Any AI assistant can order", brand: "door", cue: "agent door" },
  { id: "orders", title: "Orders and payment", sub: "Paid to the seller's own account", brand: "paypal", cue: "takes the payment" },
  { id: "brief", title: "Claude brief", sub: "via the PayPal Agent Toolkit", brand: "claude", cue: "writes the brief" },
];

const CARD_W = 500;
const CARD_H = 236;
const GAP = 90; // LEFT comes to 120, the margin every slide shares
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
      <span style={{ display: "flex", alignItems: "center", gap: 12, font: `600 23px/1 ${FONT}`, color: C.inkSoft }}>
        <Mark size={40} />
        /s/marigold-bakehouse/mcp
      </span>
    );
  }
  return null;
}

// Every card has the same rows: a 44 px brand row, then the title and one line under it.
const PAD = 28;
const THUMB_W = 128;

function Node({ node, lit, lift, settle }) {
  const photo = node.brand === "photo";
  // Unlit, the card's ground and words are dim; the brand row stays hidden until
  // the card lights, so a logo is never shown at reduced opacity. `settle` steps
  // the other cards back for the closing line (smaller, quieter words; the brand
  // row is left alone) while the photo card grows.
  const dim = 0.38 + 0.62 * lit;
  const words = dim * (1 - 0.45 * settle);
  return (
    <div style={{ position: "relative", width: CARD_W, height: CARD_H, transform: `scale(${0.96 + 0.04 * lit + 0.1 * lift - 0.05 * settle})`, transformOrigin: "50% 50%" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 24, background: C.white, boxShadow: LIFT, opacity: dim }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", display: "flex" }}>
        {photo ? (
          <div style={{ width: THUMB_W, flex: "0 0 auto", background: C.paper, opacity: dim }}>
            <Img src={staticFile("assets/slides/menu-photo.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%" }} />
          </div>
        ) : null}
        <div style={{ padding: `${PAD}px ${PAD + 4}px`, display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", height: 44, opacity: lit, transform: `translateY(${(1 - lit) * 8}px)` }}>
            {photo ? <PhotoTag /> : <Brand brand={node.brand} />}
          </div>
          <div style={{ marginTop: 26, opacity: words }}>
            <div style={{ font: `800 40px/1.08 ${FONT}`, letterSpacing: "-0.025em", color: C.ink, whiteSpace: "nowrap" }}>{node.title}</div>
            <div style={{ marginTop: 12, font: `500 25px/1.3 ${FONT}`, color: C.muted, whiteSpace: "nowrap" }}>{node.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PhotoTag = () => (
  <span style={{ background: C.pom, color: C.white, borderRadius: 999, padding: "9px 18px 10px", font: `700 24px/1 ${FONT}` }}>
    Seller
  </span>
);

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
  // "A sheet of paper is all Rosa needed": the photo card grows and the rest settle back.
  const lift = beat(frame, paperAt, 22);
  const settle = beat(frame, paperAt, 22);

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
          <div key={n.id} style={{ position: "absolute", left: POS[i][0], top: POS[i][1], zIndex: n.id === "photo" ? 2 : 1, ...rise(land(i), 30) }}>
            <Node node={n} lit={lit} lift={n.id === "photo" ? lift : 0} settle={n.id === "photo" ? 0 : settle} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
