import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { AccentMarks } from './art';

export function Closing() {
  return (
    <section aria-labelledby="landing-close" className="relative isolate overflow-hidden bg-cocoa text-on-dark [--focus-ring-color:var(--white)]">
      <div className="absolute inset-y-0 left-0 -z-20 w-3/5">
        <Image src="/demo/home/closing.webp" alt="" fill sizes="60vw" className="object-cover object-[40%_55%]" />
      </div>
      <div aria-hidden="true" className="closing-fade absolute inset-0 -z-10" />
      <div className="relative mx-auto flex w-full max-w-site justify-end px-band-gutter py-band">
        <Reveal className="flex w-full flex-col items-center text-center max-md:pl-[36%] md:w-[52%]">
          <div className="relative">
            <h2 id="landing-close" className="type-band-closing">
              Put your counter online today.
            </h2>
            <AccentMarks className="absolute left-full top-1/2 ml-2 hidden size-10 -translate-y-1/2 -scale-x-100 text-accent md:block" />
          </div>
          <p className="mt-2 text-base xl:mt-3 xl:text-lg">Turn your menu into a live shop in minutes.</p>
          <ButtonLink href="/signup" variant="inverse" size="lg" iconEnd={ArrowRight} className="mt-5 max-xl:min-h-tap max-xl:px-5 max-xl:text-base xl:mt-6">
            Add your shop
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
