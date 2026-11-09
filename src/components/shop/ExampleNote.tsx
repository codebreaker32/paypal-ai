/**
 * The buyer's small "Example photo" note on a menu tile whose picture comes from the library (Part A3): a pill in the
 * photo's corner that fades in (opacity only) when the tile is hovered or holds keyboard focus. It takes no pointer and
 * no focus, and is hidden from screen readers because the photo's alt already says "example photo". Never a badge that
 * is always on: the example is a visual aid, and the item sheet states it in words.
 */
export function ExampleNote() {
  return (
    <span
      aria-hidden="true"
      data-example-note=""
      className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold text-surface opacity-0 transition-opacity duration-(--duration-fast) ease-out group-hover/tile:opacity-100 group-has-[:focus-visible]/tile:opacity-100"
    >
      Example photo
    </span>
  );
}
