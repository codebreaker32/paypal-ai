// What the shop page tells the cart, computed on the server: which items can be ordered and what each costs. Client
// code never imports `lib/orders/pricing` (it pulls in the database repos); these figures are for display only.
import { formatUSD } from '@/lib/domain/money';
import type { ItemWithVariants, Shop, ShopKind } from '@/lib/domain/types';
import { itemPictures, pictureOf, pictureSource } from '@/lib/library/picture';
import type { CartItemState, CartMenuItem, ShopCartData } from './cart';
import { orderableOptions, tilePrice } from './tile';

interface Section {
  name: string;
  items: ItemWithVariants[];
}

function itemState(item: ItemWithVariants, takesOrders: boolean): CartItemState {
  if (item.status === 'in_person') return 'in_person';
  if (item.soldOut) return 'sold_out';
  if (!takesOrders) return 'not_taking';
  // Live with no price yet: the buyer can only ask.
  return orderableOptions(item, takesOrders).length ? 'orderable' : 'in_person';
}

const option = (v: ItemWithVariants['variants'][number]) => ({ id: v.id, label: v.label, cents: v.priceCents! });

function priceText(item: ItemWithVariants): string | null {
  const price = tilePrice(item);
  if (!price) return null;
  if (price.kind === 'from') return `From ${formatUSD(price.cents)} · ${price.count} options`;
  return price.options.map((o) => `${o.label ? `${o.label} ` : ''}${formatUSD(o.cents)}`).join('   ');
}

export function shopCartData(shop: Shop, sections: Section[], kind: ShopKind, takesOrders: boolean): ShopCartData {
  // The same call as `Menu`, so the sheet shows the picture the tile shows.
  const pictures = itemPictures(
    sections.flatMap((s) => s.items),
    kind,
  );
  const items = sections.flatMap((section, tone) =>
    section.items.map((item): CartMenuItem => {
      const picture = pictures.get(item.id) ?? pictureOf(item, kind, null);
      const state = itemState(item, takesOrders);
      return {
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        state,
        options: state === 'orderable' ? orderableOptions(item, takesOrders).map(option) : [],
        heldOptions: state === 'not_taking' ? orderableOptions(item, true).map(option) : [],
        priceText: priceText(item),
        picture,
        tone,
        example: pictureSource(picture) === 'example',
      };
    }),
  );
  return { items, fulfillment: shop.fulfillment, shippingCents: shop.shippingFeeCents, pickupNotes: shop.pickupNotes ?? '', orderCapCents: shop.orderCapCents };
}
