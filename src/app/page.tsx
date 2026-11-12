import { redirect, unstable_rethrow } from 'next/navigation';
import { Closing } from '@/components/landing/Closing';
import { Faq } from '@/components/landing/Faq';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { HomeChat, type HomeChatShop } from '@/components/landing/HomeChat';
import { starterPrompts } from '@/components/shop/starters';
import { currentAccount, landingPath } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import * as itemsRepo from '@/lib/db/repos/items';
import * as shops from '@/lib/db/repos/shops';
import { LISTED_STATUSES } from '@/lib/domain/listed';
import { pictureSource, pictureSrc } from '@/lib/library/picture';
import { RESERVED_SLUG } from '@/lib/domain/payee';
import { takesOrders } from '@/lib/orders/pricing';

/** Where a logged-in visitor goes instead, or null to show the page. The landing page must render even if storage is down. */
function destinationFor(accountId: string): string | null {
  try {
    return landingPath(accountId);
  } catch (err) {
    console.error('Landing page: could not read the account’s shops', err instanceof Error ? err.message : err);
    return null;
  }
}

async function readAccountId(): Promise<string | null> {
  try {
    return (await currentAccount())?.id ?? null;
  } catch (err) {
    unstable_rethrow(err); // let Next's own signals (dynamic rendering) through
    console.error('Landing page: could not read the session', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * What the home page's chat needs to take orders for the example shop, or null (no chat at all) unless that shop is
 * live and takes orders: the chat's greeting promises orders.
 */
function exampleShopChat(): HomeChatShop | null {
  try {
    const db = getDb();
    const shop = shops.bySlug(db, RESERVED_SLUG);
    if (shop?.status !== 'live' || !takesOrders(shop)) return null;
    const items = itemsRepo.listWithVariants(db, shop.id, { status: [...LISTED_STATUSES] });
    // Each item's picture by the usual rules (own photo, else example photo); the cards under replies read it by id.
    const pictures = itemsRepo.itemPictures(db, shop.id, shop.kind);
    const menu = items.flatMap((i) => {
      const prices = i.variants.map((v) => v.priceCents).filter((c): c is number => c !== null && c > 0);
      if (i.soldOut || !prices.length) return [];
      const picture = pictures.get(i.id);
      const src = picture ? pictureSrc(picture) : null;
      return [{ id: i.id, name: i.name, priceCents: Math.min(...prices), photoUrl: src, example: !!picture && pictureSource(picture) === 'example' }];
    });
    return { slug: shop.slug, name: shop.name, starters: starterPrompts(shop, items, { takesOrders: true }), cover: shop.coverUrl, menu };
  } catch (err) {
    console.error('Landing page: could not read the example shop for the chat', err instanceof Error ? err.message : err);
    return null;
  }
}

export default async function LandingPage({ searchParams }: PageProps<'/'>) {
  const accountId = await readAccountId();
  const destination = accountId && destinationFor(accountId);
  if (destination) redirect(destination);
  const { chat: chatParam } = await searchParams;
  const chat = exampleShopChat();
  // `?chat=0` switches the chat's auto-open off and `?chat=1` on; the e2e harness (SHELFIE_TEST) starts with it off.
  const autoOpen = chatParam === '1' || (chatParam !== '0' && !process.env.SHELFIE_TEST);

  return (
    <>
      <Hero />
      <HowItWorks />
      <Faq />
      <Closing />
      {chat && <HomeChat shop={chat} autoOpen={autoOpen} />}
    </>
  );
}
