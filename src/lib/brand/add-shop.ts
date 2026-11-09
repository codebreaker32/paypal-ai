// Where setup's exits lead. `/` won't do: it sends a logged-in seller back to the draft they are leaving (`landingPath`).

export const ADD_SHOP_HREF = '/shops/new';

/** For `Try a sample menu instead`, which has to show samples even on an account that already has a shop. */
export const ADD_SHOP_SAMPLES_HREF = `${ADD_SHOP_HREF}?samples=1`;

/** The add-a-shop page offers samples to an account with no shops, and to a seller who came from setup asking for one. */
export function addShopSamples(shopCount: number, samplesParam: string | string[] | undefined): 'plain' | 'none' {
  return shopCount === 0 || samplesParam === '1' ? 'plain' : 'none';
}
