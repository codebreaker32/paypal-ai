import type { ComponentType } from 'react';
import { Stagger, StaggerItem } from '@/components/motion';
import { TextLink } from '@/components/ui/text-link';
import { AccentMarks, CameraIcon, OrderIcon, PaidIcon } from './art';

const STEPS: { title: string; body: string; Icon: ComponentType<{ className?: string }> }[] = [
  { title: '1. Snap your price list', body: 'Take one photo of your menu.', Icon: CameraIcon },
  { title: '2. AI shoppers order', body: 'Buyers (or their AI assistants) can order.', Icon: OrderIcon },
  { title: '3. Get paid on PayPal', body: 'Money goes straight into your PayPal account.', Icon: PaidIcon },
];

export function HowItWorks({ exampleShopHref }: { exampleShopHref: string | null }) {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="bg-blush-band">
      <div className="mx-auto grid w-full max-w-site gap-8 px-band-gutter py-band xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:items-center xl:gap-10">
        <div className="relative pl-10 xl:pl-12">
          <AccentMarks className="absolute left-0 top-0 size-9 -translate-y-3 text-accent-ink xl:size-11" />
          <h2 id="how-title" className="type-band text-ink">
            How it works
          </h2>
          <p className="mt-2 text-base text-ink-soft xl:mt-3 xl:text-lg">A shop, in minutes. No website needed.</p>
          {exampleShopHref && (
            <p className="mt-3 xl:text-lg">
              <TextLink href={exampleShopHref}>See an example shop</TextLink>
            </p>
          )}
        </div>
        <Stagger as="ol" gap={0.08} className="grid gap-6 xl:grid-cols-3 xl:gap-0">
          {STEPS.map(({ title, body, Icon }) => (
            <StaggerItem
              as="li"
              key={title}
              className="flex items-center gap-5 xl:flex-col xl:gap-4 xl:border-l xl:border-blush-ring xl:px-8 xl:text-center"
            >
              <span className="flex size-18 shrink-0 items-center justify-center rounded-full bg-blush-ring text-ink xl:size-22">
                <Icon className="size-10 xl:size-12" />
              </span>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-ink xl:text-2xl">{title}</h3>
                <p className="mt-1 text-base text-ink-soft xl:mt-2 xl:text-lg">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
