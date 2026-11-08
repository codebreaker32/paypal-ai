'use client';

import { useState } from 'react';

/**
 * The buyer's small "Example photo" note on a menu tile whose picture comes from the library (Part A3): a pill in the
 * photo's corner that fades in (opacity only) on hover, on keyboard focus, and on a tap, which toggles it. It sits over
 * the photo as a transparent button, so touch and keyboard reach it; the photo's alt already says "example photo".
 * Never a badge that is always on: the example is a visual aid, the note only answers someone who wonders.
 */
export function ExampleNote({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${name}: example photo, not the shop’s own`}
      title="Example photo"
      aria-pressed={open}
      data-example-note=""
      data-open={open || undefined}
      onClick={() => setOpen((o) => !o)}
      onBlur={() => setOpen(false)}
      className="group/note press-text absolute inset-0 cursor-default rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold text-surface opacity-0 transition-opacity duration-(--duration-fast) ease-out group-hover/tile:opacity-100 group-focus-visible/note:opacity-100 group-data-open/note:opacity-100"
      >
        Example photo
      </span>
    </button>
  );
}
