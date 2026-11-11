import Image from 'next/image';
import { Reveal } from '@/components/motion';
import { AccentMarks } from './art';

/** The home page's last band: the cupcake photo, one closing line and PayPal's mark, fading into the footer below. */
export function Closing() {
  return (
    <section aria-labelledby="landing-close" className="relative isolate overflow-hidden bg-cocoa text-on-dark [--focus-ring-color:var(--white)]">
      <div className="absolute inset-y-0 left-0 -z-20 w-3/5">
        <Image src="/demo/home/closing.webp" alt="" fill sizes="60vw" className="object-cover object-[40%_55%]" />
      </div>
      <div aria-hidden="true" className="closing-fade absolute inset-0 -z-10" />
      {/* The band's foot fades into the footer's charcoal, so photo and footer read as one piece with no seam. */}
      <div aria-hidden="true" className="closing-floor absolute inset-0 -z-10" />
      <div className="relative mx-auto flex w-full max-w-site justify-end px-band-gutter pb-[calc(var(--spacing-band)*1.5)] pt-[calc(var(--spacing-band)*1.25)]">
        <Reveal className="flex w-full flex-col items-center text-center max-md:pl-[36%] md:w-[52%]">
          <div className="relative">
            <h2 id="landing-close" className="type-band-closing">
              Put your counter online today.
            </h2>
            <AccentMarks className="absolute left-full top-1/2 ml-2 hidden size-10 -translate-y-1/2 -scale-x-100 text-accent md:block" />
          </div>
          <p className="mt-2 text-base xl:mt-3 xl:text-lg">Turn your menu into a live shop in minutes.</p>
          {/* PayPal's colour logo needs a light ground, so on the cocoa band it sits on a white chip with clear space. */}
          <p className="mt-5 inline-flex items-center gap-3 whitespace-nowrap rounded-full bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-sm max-[389px]:gap-2 max-[389px]:px-3 xl:mt-6">
            Payments by
            {/* eslint-disable-next-line @next/next/no-img-element -- a fixed SVG logo, no optimizer needed */}
            <img src="/brand/paypal/paypal-color.svg" alt="PayPal" width={170} height={48} className="h-6 w-auto" />
          </p>
        </Reveal>
      </div>
    </section>
  );
}
