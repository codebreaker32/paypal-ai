import Image from 'next/image';
import { HeroChain } from './HeroChain';
import './landing.css';

/** The ribbon of pomegranate along the hero's foot, and the dome of the next band rising into it. */
function Wave() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-wave w-full">
      <path className="fill-accent" d="M0 0C360 70 1080 80 1440 5V120C1080 70 360 70 0 100Z" />
      <path className="fill-blush" d="M0 100C360 70 1080 70 1440 120H0Z" />
    </svg>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="landing-title" className="relative isolate overflow-hidden">
      <noscript>
        <style>{'[data-entrance]{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <Image src="/demo/home/hero.webp" alt="" fill priority sizes="100vw" className="hero-photo -z-20 object-cover" />
      <div aria-hidden="true" className="hero-wash absolute inset-0 -z-10" />
      <div className="relative mx-auto grid w-full max-w-site gap-8 px-band-gutter pt-band pb-wave xl:grid-cols-[auto_minmax(0,1fr)] xl:items-start">
        <div>
          <h1 id="landing-title" className="type-band-hero text-ink">
            Your price list, <br />
            open to <span className="text-accent-ink">AI shoppers.</span>
          </h1>
          <p className="mt-3 text-2xl text-ink xl:mt-4 xl:text-3xl">Snap. Share. Get paid.</p>
        </div>
        <HeroChain />
      </div>
      <Wave />
    </section>
  );
}
