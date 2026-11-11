/* eslint-disable @next/next/no-img-element -- fixed-size 2x screenshots; width/height reserve the box, no optimizer needed */
import { Stagger, StaggerItem } from '@/components/motion';
import { AccentMarks } from './art';

/**
 * Step 1 is the seller's side of the camera: a real photo of a handwritten price list (Unsplash License; see
 * docs/ASSETS.md), with nothing drawn over it. Steps 2 and 3 show Shelfie itself: one focal region of the real app on
 * the demo shop, cropped about 480 to 520 CSS px wide so its text stays readable (step 2 is retaken by the `step 2` test in
 * e2e/home-chat.spec.ts). All are 960×720 WebP in public/landing/,
 * in the same 4:3 frame.
 */
export const STEPS: { title: string; body: string; image: string; alt: string }[] = [
  {
    title: '1. Snap your price list',
    body: 'Take one photo of your menu.',
    image: '/landing/step-read.webp',
    alt: 'A handwritten café price list on paper: Espresso 4.5, Shakerato 4.0, Americano 4.0, Caffe Latte 4.5.',
  },
  {
    title: '2. AI shoppers order',
    body: 'Buyers (or their AI assistants) can order.',
    image: '/landing/step-order.webp',
    alt: 'The shop’s AI assistant: “Placed your order · $25.50 · waiting for your PayPal approval”, the order summary and the button Approve $25.50 on PayPal.',
  },
  {
    title: '3. Get paid on PayPal',
    body: 'Money goes straight into your PayPal account.',
    image: '/landing/step-paid.webp',
    alt: 'The seller’s order page: the order is Paid, with an AI brief that flags a nut allergy.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="bg-blush">
      <div className="mx-auto grid w-full max-w-site gap-8 px-band-gutter py-band lg:gap-10">
        <div className="relative pl-10 xl:pl-12">
          <AccentMarks className="absolute left-0 top-0 size-9 -translate-y-3 text-accent-ink xl:size-11" />
          <h2 id="how-title" className="type-band text-ink">
            How it works
          </h2>
          <p className="mt-2 text-base text-ink xl:mt-3 xl:text-lg">A shop, in minutes. No website needed.</p>
        </div>
        {/* Heading and line first, then the picture (owner, run 12). From lg each step spans two rows of a shared
            subgrid, so the headings start on one line and the pictures on another, however the short lines wrap. */}
        <Stagger
          as="ol"
          gap={0.08}
          className="grid gap-10 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-4 xl:gap-x-10 xl:gap-y-5"
        >
          {STEPS.map(({ title, body, image, alt }) => (
            <StaggerItem
              as="li"
              key={title}
              className="mx-auto flex w-full max-w-md flex-col gap-4 lg:row-span-2 lg:grid lg:max-w-none lg:grid-rows-subgrid xl:gap-5"
            >
              <div>
                <h3 className="text-lg font-bold tracking-tight text-ink xl:text-2xl">{title}</h3>
                <p className="mt-1 text-base text-ink xl:mt-2 xl:text-lg">{body}</p>
              </div>
              <img
                src={image}
                alt={alt}
                width={960}
                height={720}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full self-start rounded-2xl bg-white object-cover shadow-md"
              />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
