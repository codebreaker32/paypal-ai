/* eslint-disable @next/next/no-img-element -- fixed-size 2x screenshots; width/height reserve the box, no optimizer needed */
import { Stagger, StaggerItem } from '@/components/motion';
import { TextLink } from '@/components/ui/text-link';
import { AccentMarks } from './art';

/**
 * Each step shows Shelfie itself: one focal region of the real app on the demo shop, cropped about 480 CSS px wide
 * so its text stays readable (960×720 WebP in public/landing/, made at device scale 2; see docs/ASSETS.md). Step 1 is
 * a real photo of a handwritten price list under a card of Shelfie's reading. Same 4:3 frame for all three.
 */
const STEPS: { title: string; body: string; image: string; alt: string }[] = [
  {
    title: '1. Snap your price list',
    body: 'Take one photo of your menu.',
    image: '/landing/step-read.webp',
    alt: 'A handwritten café price list on paper, and Shelfie’s reading of one line, “Americano. 4.0”: price $4.00, added to the menu.',
  },
  {
    title: '2. AI shoppers order',
    body: 'Buyers (or their AI assistants) can order.',
    image: '/landing/step-order.webp',
    alt: 'The shop’s AI assistant has called create_order and shows the button Approve $27.00 on PayPal.',
  },
  {
    title: '3. Get paid on PayPal',
    body: 'Money goes straight into your PayPal account.',
    image: '/landing/step-paid.webp',
    alt: 'The seller’s order page: the order is Paid, with an AI brief that flags a nut allergy.',
  },
];

export function HowItWorks({ exampleShopHref }: { exampleShopHref: string | null }) {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="bg-blush">
      <div className="mx-auto grid w-full max-w-site gap-8 px-band-gutter py-band lg:gap-10">
        <div className="relative pl-10 xl:pl-12">
          <AccentMarks className="absolute left-0 top-0 size-9 -translate-y-3 text-accent-ink xl:size-11" />
          <h2 id="how-title" className="type-band text-ink">
            How it works
          </h2>
          <p className="mt-2 text-base text-ink xl:mt-3 xl:text-lg">A shop, in minutes. No website needed.</p>
          {exampleShopHref && (
            <p className="mt-3 xl:text-lg">
              <TextLink href={exampleShopHref}>See an example shop</TextLink>
            </p>
          )}
        </div>
        <Stagger as="ol" gap={0.08} className="grid gap-10 lg:grid-cols-3 lg:gap-6 xl:gap-10">
          {STEPS.map(({ title, body, image, alt }) => (
            <StaggerItem as="li" key={title} className="mx-auto flex w-full max-w-md flex-col gap-4 lg:max-w-none xl:gap-5">
              <img
                src={image}
                alt={alt}
                width={960}
                height={720}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full rounded-2xl bg-white object-cover shadow-md"
              />
              <div>
                <h3 className="text-lg font-bold tracking-tight text-ink xl:text-2xl">{title}</h3>
                <p className="mt-1 text-base text-ink xl:mt-2 xl:text-lg">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
