// The counter card's shop name: a share of the card's width (cqw), smaller as the name gets longer, so it stays within
// three lines (the page clamps it there, and the QR gives up height for what's left).
const SIZES = [
  [24, 'text-[10cqw]'],
  [40, 'text-[7.5cqw]'],
  [80, 'text-[5.5cqw]'],
] as const;

export function cardNameSize(name: string): string {
  return SIZES.find(([max]) => name.length <= max)?.[1] ?? 'text-[4.6cqw]';
}
