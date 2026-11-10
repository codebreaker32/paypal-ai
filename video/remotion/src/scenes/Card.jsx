import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import {
  C, FONT, LIFT, beat, rise, WaveTop, Arrow, AccentMarks, AssistantMark, Tick, Lockup, PayPalLogo, splitEmphasis,
} from "../components/slides/kit.jsx";

/**
 * The card scenes (scene.kind "card"), in the public site's band language.
 * scene.slide picks the layout: "title" (the greeting: headline on white and
 * the hero's four-step chain on a pomegranate band) or "end" (the lockup, the
 * line, and a charcoal footer band with "Built with" PayPal's logo and Claude).
 * Anything else falls back to the title layout without the chain.
 */
export const Card = ({ scene }) => {
  if (scene.slide === "end") return <EndSlide scene={scene} />;
  return <TitleSlide scene={scene} chain={scene.slide === "title"} />;
};

/* ---------- The title: "Hi there! Welcome to Shelfie." ---------- */

const CARD_W = 330;
const CARD_H = 350;

const ChainCard = ({ children, style }) => (
  <div
    style={{
      width: CARD_W, height: CARD_H, borderRadius: 24, background: C.white, boxShadow: LIFT,
      padding: "22px 22px 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden", ...style,
    }}
  >
    {children}
  </div>
);

const StepLabel = ({ n, text }) => (
  <div
    style={{
      position: "relative", zIndex: 2, margin: "-30px auto 0", width: "fit-content",
      background: C.white, color: C.ink, borderRadius: 16, boxShadow: LIFT,
      padding: "12px 22px", font: `700 27px/1.15 ${FONT}`, textAlign: "center", whiteSpace: "nowrap",
    }}
  >
    {n}. {text}
  </div>
);

const pop = (p) => ({ opacity: Math.min(1, p * 1.6), transform: `scale(${0.5 + 0.5 * p})` });

function Chain({ frame }) {
  const at = { c1: 16, a1: 26, c2: 30, cart: 40, a2: 44, c3: 48, ask: 56, placed: 64, a3: 66, c4: 70, tick: 78, received: 84 };
  const cards = [
    {
      on: at.c1, label: "Snap your menu",
      card: (
        <ChainCard style={{ padding: 0, background: C.paper, transform: "rotate(-3deg)" }}>
          <Img src={staticFile("assets/slides/menu-photo.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 18%" }} />
        </ChainCard>
      ),
    },
    {
      on: at.c2, label: "Get a live shop",
      card: (
        <ChainCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10, font: `700 24px/1 ${FONT}`, color: C.ink }}>
            <Img src={staticFile("assets/mark.svg")} style={{ width: 30, height: 30 }} />
            Marigold Bakehouse
          </div>
          <div style={{ marginTop: 14, flex: 1, borderRadius: 14, overflow: "hidden" }}>
            <Img src={staticFile("assets/slides/almond-croissant.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: `600 22px/1 ${FONT}`, color: C.ink, whiteSpace: "nowrap" }}>Almond croissant</span>
            <span style={{ ...pop(beat(frame, at.cart, 10)), background: C.pom, color: C.white, borderRadius: 999, padding: "9px 14px", font: `600 19px/1 ${FONT}`, whiteSpace: "nowrap" }}>
              Add to cart
            </span>
          </div>
        </ChainCard>
      ),
    },
    {
      on: at.c3, label: "AI shoppers order",
      card: (
        <ChainCard>
          <div style={{ display: "flex", alignItems: "center", gap: 10, font: `700 24px/1 ${FONT}`, color: C.ink }}>
            <AssistantMark size={34} />
            Assistant
          </div>
          <div style={{ ...rise(beat(frame, at.ask), 14), marginTop: 18, background: C.sunken, borderRadius: 16, padding: "14px 16px", font: `500 23px/1.3 ${FONT}`, color: C.ink }}>
            Order 2 almond croissants, please!
          </div>
          <div style={{ ...pop(beat(frame, at.placed, 10)), transformOrigin: "left center", marginTop: "auto", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 10, background: C.okSoft, borderRadius: 999, padding: "8px 18px 8px 8px", font: `700 22px/1 ${FONT}`, color: C.ink }}>
            <Tick size={30} />
            Order placed!
          </div>
        </ChainCard>
      ),
    },
    {
      on: at.c4, label: "Get paid on PayPal",
      card: (
        <ChainCard style={{ alignItems: "center", justifyContent: "center", gap: 22 }}>
          <PayPalLogo width={196} />
          <div style={pop(beat(frame, at.tick, 10))}><Tick size={64} /></div>
          <div style={{ ...rise(beat(frame, at.received), 10), font: `700 26px/1 ${FONT}`, color: C.ink }}>Payment received!</div>
        </ChainCard>
      ),
    },
  ];
  const arrows = [at.a1, at.a2, at.a3];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 612, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      {cards.map((c, i) => (
        <React.Fragment key={c.label}>
          <div style={rise(beat(frame, c.on, 16), 40)}>
            {c.card}
            <StepLabel n={i + 1} text={c.label} />
          </div>
          {i < arrows.length ? (
            <div style={{ margin: `${CARD_H / 2 - 30}px 26px 0` }}>
              <Arrow p={beat(frame, arrows[i], 10)} width={60} shadow />
            </div>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

const TitleSlide = ({ scene, chain }) => {
  const frame = useCurrentFrame();
  const band = beat(frame, 0, 20);
  const text = scene.subtitle || scene.title || "";
  // "Hi there! Welcome to Shelfie." sets as two lines, the shop's name in the accent.
  const [first, ...rest] = text.split(/(?<=!)\s+/);
  const second = rest.join(" ");
  const [pre, em, post] = splitEmphasis(second || first, scene.emphasis || "Shelfie.");
  return (
    <AbsoluteFill style={{ background: C.white, overflow: "hidden" }}>
      {chain ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 676, bottom: 0, transform: `translateY(${(1 - band) * 440}px)` }}>
          <WaveTop color={C.pom} height={110} />
          <div style={{ background: C.pom, position: "absolute", left: 0, right: 0, top: 108, bottom: 0 }} />
        </div>
      ) : null}

      <div style={{ position: "absolute", left: 128, top: 92, ...rise(beat(frame, 2, 16), 16) }}>
        <Lockup height={76} />
      </div>

      <div style={{ position: "absolute", left: 120, top: chain ? 226 : 380, font: `800 146px/1 ${FONT}`, letterSpacing: "-0.035em", color: C.ink, textRendering: "geometricPrecision" }}>
        {second ? <div style={rise(beat(frame, 6, 18), 36)}>{first}</div> : null}
        <div style={{ ...rise(beat(frame, 12, 18), 36), display: "flex", alignItems: "flex-start", marginTop: 4 }}>
          <span>
            {pre}
            <span style={{ color: C.pom }}>{em}</span>
            {post}
          </span>
          <div style={{ marginLeft: 12, marginTop: -26 }}>
            <AccentMarks size={80} p={beat(frame, 28, 14)} mirror />
          </div>
        </div>
      </div>

      {chain ? <Chain frame={frame} /> : null}
    </AbsoluteFill>
  );
};

/* ---------- The end card ---------- */

const EndSlide = ({ scene }) => {
  const frame = useCurrentFrame();
  const [pre, em, post] = splitEmphasis(scene.subtitle || "", scene.emphasis || "AI shoppers.");
  const band = beat(frame, 10, 22);
  const cta = scene.cta || "Built with PayPal and Claude";
  // "Built with PayPal and Claude": PayPal is its own logo, on a white chip.
  const [ctaPre, ctaPost] = cta.includes("PayPal") ? cta.split("PayPal") : [cta, null];
  return (
    <AbsoluteFill style={{ background: C.white, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={rise(beat(frame, 0, 18), 24)}>
          <Lockup height={150} />
        </div>
        <div style={{ ...rise(beat(frame, 6, 18), 30), marginTop: 64, font: `800 92px/1.05 ${FONT}`, letterSpacing: "-0.035em", color: C.ink, maxWidth: 1600 }}>
          {pre}
          <span style={{ color: C.pom }}>{em}</span>
          {post}
        </div>
        {scene.narration ? (
          <div style={{ ...rise(beat(frame, 14, 18), 16), marginTop: 40, font: `600 44px/1.2 ${FONT}`, color: C.inkSoft }}>
            {scene.narration}
          </div>
        ) : null}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 700, bottom: 0, transform: `translateY(${(1 - band) * 400}px)` }}>
        <WaveTop color={C.charcoal} height={80} flip />
        <div style={{ position: "absolute", left: 0, right: 0, top: 78, bottom: 0, background: C.charcoal, display: "flex", alignItems: "center", justifyContent: "center", gap: 28, font: `600 42px/1 ${FONT}`, color: C.white, paddingBottom: 10 }}>
          <span style={{ color: C.charcoalSoft }}>{ctaPre.trim()}</span>
          {ctaPost !== null ? (
            <>
              <div style={{ background: C.white, borderRadius: 18, padding: "22px 34px" }}>
                <PayPalLogo width={190} />
              </div>
              <span style={{ display: "flex", gap: 14 }}>
                {ctaPost.trim().split(/\s+(?=\S+$)/).map((w, i) => (
                  <span key={i} style={{ color: i === 0 ? C.charcoalSoft : C.white, fontWeight: i === 0 ? 600 : 800 }}>{w}</span>
                ))}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
