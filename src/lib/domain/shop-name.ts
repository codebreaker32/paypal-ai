// The delete sheet's "type the shop's name": what counts as the same name, on the client and the server alike.

/** Unicode composition, apostrophes and quotes, and runs of whitespace: differences a seller can't see or type. */
function comparable(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[‘’‚‛ʼ′`´]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `typed` is the shop's name as it reads on screen. Case still counts. */
export function sameShopName(typed: string, name: string): boolean {
  return comparable(typed) === comparable(name);
}
