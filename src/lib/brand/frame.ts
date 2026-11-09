// Pure, so the rule can be tested. `new` is a sibling of the shop's id, and is a normal-width page.
const WIDE = /^\/shops\/(?!new\/?$)[^/]+(\/orders\/[^/]+)?\/?$/;

/** The seller's operations screens (the dashboard and an order's detail) use the wide container; everything else the page one. */
export const isWidePath = (pathname: string): boolean => WIDE.test(pathname);
