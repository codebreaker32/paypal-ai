// Schema.org JSON-LD for the public shop page (spec §10a): what search engines and AI agents read from the page itself.
// The menu goes in as offers (prices from the shop's rows, as PayPal strings) with each item's photo, the cover as
// the shop's image, PayPal as the way to pay, and, while the shop takes orders, an OrderAction whose EntryPoint is the
// agent door.
import { toPayPalValue } from '@/lib/domain/money';
import { absolutePhotoUrl } from '@/lib/domain/photo-url';
import type { ItemWithVariants, Shop, ShopKind } from '@/lib/domain/types';
import { isListed, pricedOptions, takesOrders } from '@/lib/orders/pricing';

type Json = Record<string, unknown>;

const BUSINESS_TYPE: Record<ShopKind, string> = { food: 'FoodEstablishment', goods: 'Store', services: 'LocalBusiness' };

export interface ShopUrls {
  /** Absolute URL of the public shop page, `${APP_URL}/s/<slug>`. */
  shopUrl: string;
  /** Absolute URL of the shop's agent door, `${APP_URL}/s/<slug>/mcp`. */
  doorUrl: string;
}

/** One Offer per priced option; in-person and unpriced items get none (they can't be ordered online). */
function offers(item: ItemWithVariants): Json | Json[] | undefined {
  if (item.status !== 'live') return undefined;
  const list = pricedOptions(item).map((v) => ({
    '@type': 'Offer',
    ...(v.label ? { name: v.label } : {}),
    price: toPayPalValue(v.priceCents!),
    priceCurrency: 'USD',
    availability: item.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
  }));
  if (!list.length) return undefined;
  return list.length === 1 ? list[0] : list;
}

function entry(type: string, item: ItemWithVariants, siteUrl: string): Json {
  const o = offers(item);
  const image = absolutePhotoUrl(siteUrl, item.photoUrl);
  return {
    '@type': type,
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    ...(image ? { image } : {}),
    ...(o ? { offers: o } : {}),
  };
}

/** Listed items by section, in menu order (the same grouping as the page's menu). */
function sections(items: ItemWithVariants[]): [string, ItemWithVariants[]][] {
  const map = new Map<string, ItemWithVariants[]>();
  for (const item of items) {
    if (!isListed(item)) continue;
    const name = item.section?.trim() || 'Menu';
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(item);
  }
  return [...map];
}

export function shopJsonLd(shop: Shop, items: ItemWithVariants[], urls: ShopUrls): Json {
  const grouped = sections(items);
  const cover = absolutePhotoUrl(urls.shopUrl, shop.coverUrl);
  const catalog =
    shop.kind === 'food'
      ? {
          hasMenu: {
            '@type': 'Menu',
            name: `${shop.name} menu`,
            hasMenuSection: grouped.map(([name, list]) => ({
              '@type': 'MenuSection',
              name,
              hasMenuItem: list.map((item) => entry('MenuItem', item, urls.shopUrl)),
            })),
          },
        }
      : {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: shop.name,
            itemListElement: grouped.map(([name, list]) => ({
              '@type': 'OfferCatalog',
              name,
              itemListElement: list.map((item) => entry(item.kind === 'SERVICE' ? 'Service' : 'Product', item, urls.shopUrl)),
            })),
          },
        };

  return {
    '@context': 'https://schema.org',
    '@type': BUSINESS_TYPE[shop.kind],
    '@id': `${urls.shopUrl}#shop`,
    name: shop.name,
    description: shop.about || `Order from ${shop.name} with any AI assistant, and pay with PayPal.`,
    url: urls.shopUrl,
    // The cover photo; without one, the menu photo the shop was made from.
    ...(cover ? { image: cover } : shop.menuPhotoPaths.length ? { image: `${urls.shopUrl}/photo/1` } : {}),
    currenciesAccepted: 'USD',
    paymentAccepted: 'PayPal',
    ...catalog,
    // Only a shop that takes orders (live, and it knows where to be paid) advertises the door; others keep the menu.
    ...(takesOrders(shop)
      ? {
          potentialAction: {
            '@type': 'OrderAction',
            name: 'Order through the agent door',
            description:
              'The agent door is an MCP server (Streamable HTTP transport: JSON-RPC over HTTP POST, no sign-in) with the ' +
              'tools get_shop_info, list_products, create_order and get_order_status. Prices come from the shop; ' +
              'create_order returns a PayPal link and the buyer approves payment on PayPal.',
            target: {
              '@type': 'EntryPoint',
              name: 'Agent door (MCP)',
              urlTemplate: urls.doorUrl,
              httpMethod: 'POST',
              encodingType: 'application/json',
              contentType: 'application/json',
            },
          },
        }
      : {}),
  };
}

/**
 * The text for `<script type="application/ld+json">`. Every `<` becomes the JSON escape `\u003c` (still the same
 * JSON), so seller text such as `</script>` can't close the script element or open a new one.
 */
export function jsonLdScript(data: Json): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * /browse as schema.org: an ItemList of every shop taking orders, each with its page and its agent door, so an agent
 * that lands on the directory finds every door without reading the cards.
 */
export function browseJsonLd(shops: { slug: string; name: string; kind: ShopKind; line: string }[], appUrl: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Shops on Shelfie',
    url: `${appUrl}/browse`,
    numberOfItems: shops.length,
    itemListElement: shops.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': BUSINESS_TYPE[s.kind],
        '@id': `${appUrl}/s/${s.slug}#shop`,
        name: s.name,
        url: `${appUrl}/s/${s.slug}`,
        ...(s.line ? { description: s.line } : {}),
        potentialAction: {
          '@type': 'OrderAction',
          name: 'Order through the agent door',
          target: { '@type': 'EntryPoint', name: 'Agent door (MCP)', urlTemplate: `${appUrl}/s/${s.slug}/mcp`, httpMethod: 'POST', contentType: 'application/json' },
        },
      },
    })),
  };
}
