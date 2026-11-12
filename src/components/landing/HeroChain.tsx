'use client';

import { Check } from 'lucide-react';
import { m, useInView, type Variants } from 'motion/react';
import Image from 'next/image';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { EASE_OUT } from '@/components/motion';
import { usePrefersReducedMotion } from '@/components/motion/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';
import { AccentMarks, AssistantMark } from './art';
import { HERO_CHAIN_DONE } from './hero-chain-signal';

/** When each beat lands, in seconds after the chain comes into view. */
const AT = { paper: 0.15, arrow1: 0.7, shop: 0.95, cart: 1.35, arrow2: 1.7, assistant: 1.95, ask: 2.3, placed: 2.8, arrow3: 3.25, pay: 3.5, tick: 3.95, received: 4.1 };

type Custom = { at: number; reduced: boolean };
const at = ({ at: delay, reduced }: Custom, duration: number) => (reduced ? { duration: 0 } : { delay, duration, ease: EASE_OUT });
const instant = { duration: 0 };

const BEATS = {
  rise: {
    hidden: { opacity: 0, y: 20, transition: instant },
    shown: (c: Custom) => ({ opacity: 1, y: 0, transition: at(c, 0.42) }),
  },
  // Slides out of its own clipped slot, so an arrow reads as drawn while only transform moves.
  draw: {
    hidden: { x: '-105%', transition: instant },
    shown: (c: Custom) => ({ x: 0, transition: at(c, 0.3) }),
  },
  pop: {
    hidden: { opacity: 0, scale: 0.4, transition: instant },
    shown: (c: Custom) => ({
      opacity: 1,
      scale: 1,
      transition: c.reduced ? instant : { delay: c.at, type: 'spring' as const, stiffness: 460, damping: 15 },
    }),
  },
} satisfies Record<string, Variants>;

const Playing = createContext({ show: false, reduced: false });

function Beat({ on, kind = 'rise', className, children }: { on: number; kind?: keyof typeof BEATS; className?: string; children: ReactNode }) {
  const { show, reduced } = useContext(Playing);
  return (
    <m.div
      data-entrance=""
      data-chain-beat=""
      className={className}
      variants={BEATS[kind]}
      custom={{ at: on, reduced }}
      initial="hidden"
      animate={show ? 'shown' : 'hidden'}
    >
      {children}
    </m.div>
  );
}

function Arrow({ on, className }: { on: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('overflow-hidden text-on-dark', className)}>
      <Beat on={on} kind="draw">
        <svg viewBox="0 0 28 24" className="block w-full [filter:drop-shadow(0_1px_3px_rgb(var(--ink-rgb)/0.55))]" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h21M15 4l9 8-9 8" />
        </svg>
      </Beat>
    </div>
  );
}

const CARD = 'relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl bg-surface px-3 pb-7 pt-3 shadow-lg xl:px-3.5 xl:pt-3.5';

/**
 * A real handwritten café price list (Bundo Kim, Unsplash License; docs/ASSETS.md), cropped 3:4 at 2x. It stands for
 * "a menu on paper" in general, so nothing here names it as a particular seller's.
 */
const PAPER_MENU = '/landing/paper-menu.webp';

function PaperCard() {
  return (
    <div className="relative -rotate-3">
      <AccentMarks className="absolute -top-7 right-3 z-10 size-8 -scale-x-100 text-accent" />
      <div className="rounded-sm bg-surface p-1.5 shadow-lg">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xs bg-paper">
          <Image src={PAPER_MENU} alt="" fill unoptimized loading="eager" className="object-cover" />
        </div>
      </div>
    </div>
  );
}

function ShopCard() {
  return (
    <div className={CARD}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink xl:text-base">
        <LogoMark className="size-5" />
        <span className="min-w-0 truncate">Sweet Bakes</span>
      </p>
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-md">
        <Image src="/demo/home/cupcake.webp" alt="" fill sizes="200px" className="object-cover" />
      </div>
      <p className="mt-1.5 flex justify-between text-sm font-semibold text-ink">
        <span>Cupcakes</span>
        <span className="type-figures">$4</span>
      </p>
      <Beat on={AT.cart} kind="pop" className="mt-1.5 self-end">
        <span className="block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-on-accent">Add to cart</span>
      </Beat>
    </div>
  );
}

function AssistantCard() {
  return (
    <div className={CARD}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink xl:text-base">
        <AssistantMark className="size-6 text-ink" />
        Assistant
      </p>
      <Beat on={AT.ask} className="mt-2.5">
        <p className="rounded-lg bg-surface-sunken px-2.5 py-2 text-sm text-ink">Order 2 cupcakes and 1 cookie, please!</p>
      </Beat>
      <Beat on={AT.placed} kind="pop" className="mt-auto self-start">
        <p className="flex items-center gap-1.5 rounded-full bg-ok-soft py-1 pl-1.5 pr-3 text-sm font-semibold text-ink">
          <Tick className="size-5" />
          Order placed!
        </p>
      </Beat>
    </div>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-ok text-on-accent', className)}>
      <Check strokeWidth={3.5} className="size-[60%]" />
    </span>
  );
}

function PayCard() {
  return (
    <div className={cn(CARD, 'items-center justify-center gap-2 text-center')}>
      {/* PayPal's own logo, unmodified, on the white card with clear space (docs/ASSETS.md); never set as text. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed SVG logo, no optimizer needed */}
      <img src="/brand/paypal/paypal-color.svg" alt="PayPal" width={170} height={48} className="mb-2 h-auto w-[78%] max-w-36" />
      <Beat on={AT.tick} kind="pop">
        <Tick className="size-10" />
      </Beat>
      <Beat on={AT.received}>
        <p className="text-sm font-semibold text-ink xl:text-base">Payment received!</p>
      </Beat>
    </div>
  );
}

const STEPS = [
  { caption: 'Photo of your price list', on: AT.paper, card: <PaperCard />, arrow: AT.arrow1 },
  { caption: 'Live shop in minutes', on: AT.shop, card: <ShopCard />, arrow: AT.arrow2 },
  { caption: 'Any AI assistant can order', on: AT.assistant, card: <AssistantCard />, arrow: AT.arrow3 },
  { caption: 'Paid to your PayPal', on: AT.pay, card: <PayCard />, arrow: null },
];

/** The four white cards with their captions, from 768 px. */
function FullChain() {
  return (
    <ol className="hidden items-start gap-10 md:flex xl:mt-8">
      {STEPS.map((step, index) => (
        <li key={step.caption} className="relative min-w-0 flex-1">
          <Beat on={step.on}>
            <div aria-hidden="true">{step.card}</div>
            <p className="relative z-10 mx-auto -mt-4 w-fit max-w-[9.5rem] rounded-lg bg-surface px-3 py-1.5 text-balance text-center text-sm font-semibold text-ink shadow-md xl:text-base">
              {index + 1}. {step.caption}
            </p>
          </Beat>
          {step.arrow !== null && <Arrow on={step.arrow} className="absolute left-full top-[38%] ml-1 w-8" />}
        </li>
      ))}
    </ol>
  );
}

const THUMB = 'relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg';

/** Each step's small picture on phones, square so the four rows line up. */
const PHONE_THUMBS = [
  <div key="paper" className={cn(THUMB, 'bg-paper')}>
    <Image src={PAPER_MENU} alt="" fill unoptimized loading="eager" className="object-cover" />
  </div>,
  <div key="shop" className={THUMB}>
    <Image src="/demo/home/cupcake.webp" alt="" fill sizes="64px" className="object-cover" />
    <span className="absolute bottom-1 right-1 rounded-xs bg-surface p-0.5 shadow-sm">
      <LogoMark className="size-4" />
    </span>
  </div>,
  <div key="assistant" className={cn(THUMB, 'bg-surface-sunken')}>
    <AssistantMark className="size-9 text-ink" />
  </div>,
  <div key="pay" className={cn(THUMB, 'bg-surface-sunken')}>
    {/* The thumbnail is too small for the full logo's clear space, so it carries PayPal's own PP mark. */}
    {/* eslint-disable-next-line @next/next/no-img-element -- a fixed SVG logo, no optimizer needed */}
    <img src="/brand/paypal/paypal-mark-color.svg" alt="PayPal" width={48} height={48} className="size-8" />
    <Tick className="absolute bottom-1 right-1 size-5" />
  </div>,
];

/** One short line under each step's name on phones, where there is room for words but not for the full cards. */
const PHONE_DETAILS = ['Paper, a board or a printout.', 'Claude reads it and builds your shop.', 'People can order on your page too.', 'Each order is paid into your account.'];

/** The four steps as a numbered list of captioned rows, on phones (below 768 px). */
function PhoneList() {
  return (
    <ol data-hero-phone-steps="" className="grid gap-2.5 pb-4 md:hidden">
      {STEPS.map((step, index) => (
        <li key={step.caption}>
          <Beat on={step.on} className="flex items-center gap-3.5 rounded-xl bg-surface p-2 pr-4 shadow-md">
            <div aria-hidden="true" className="relative">
              {PHONE_THUMBS[index]}
              <span className="absolute -left-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent shadow-sm">
                {index + 1}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{step.caption}</p>
              <p className="text-sm text-ink-muted">{PHONE_DETAILS[index]}</p>
            </div>
          </Beat>
        </li>
      ))}
    </ol>
  );
}

/** From the chain coming into view to its last beat landing ("Order received", a 0.42 s rise), in ms. */
export const CHAIN_MS = Math.round((AT.received + 0.42) * 1000);

/**
 * The paper-to-payment story. It plays when it comes into view, and again if the visitor scrolls away and back. The
 * first time it has played through it marks its root `data-chain-done` and tells the home chat (HERO_CHAIN_DONE), which
 * never opens itself over it.
 */
export function HeroChain() {
  const ref = useRef<HTMLDivElement>(null);
  const show = useInView(ref, { amount: 0.25 });
  const reduced = usePrefersReducedMotion();
  const playing = show || reduced;
  useEffect(() => {
    const root = ref.current;
    if (!playing || !root || root.hasAttribute('data-chain-done')) return;
    const timer = window.setTimeout(() => {
      root.setAttribute('data-chain-done', '');
      window.dispatchEvent(new Event(HERO_CHAIN_DONE));
    }, reduced ? 0 : CHAIN_MS);
    return () => window.clearTimeout(timer);
  }, [playing, reduced]);
  return (
    <div ref={ref} data-hero-story="" className="relative z-10">
      <Playing.Provider value={{ show: playing, reduced }}>
        <FullChain />
        <PhoneList />
      </Playing.Provider>
    </div>
  );
}
