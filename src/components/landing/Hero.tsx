import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
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
          <h1 id="landing-title" className="type-band-hero w-fit text-ink">
            Your price list, <br />
            open to <span className="text-accent-ink">AI shoppers.</span>
          </h1>
          <p data-hero-purpose="" className="mt-3 max-w-xl text-xl text-balance text-ink sm:text-2xl xl:mt-4">
            Turn a photo of your price list into a shop AI assistants can order from.
          </p>
          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-6 xl:mt-8">
            <ButtonLink href="/signup" variant="brand" size="lg" iconEnd={ArrowRight} className="shadow-md max-sm:w-full">
              Add your shop
            </ButtonLink>
            <TextLink href="/browse" className="self-center text-lg text-ink">
              Browse shops
            </TextLink>
          </div>
        </div>
        <HeroChain />
      </div>
      <Wave />
    </section>
  );
}
