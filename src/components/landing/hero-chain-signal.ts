// When the home chat may open by itself (review F8): never over the hero chain's last steps. The chain marks its root
// `data-chain-done` and sends HERO_CHAIN_DONE once it has played through; the chat then waits until the chain is no
// longer under its panel (beside it, or scrolled away).

/** Sent on window once the hero chain has played through (or shown at once under reduced motion). */
export const HERO_CHAIN_DONE = 'shelfie:hero-chain-done';

/** The desktop panel's box (`home-chat.css`): 440 px wide, 24 px from the right and bottom, the viewport less 96 px tall. */
export const PANEL = { width: 440, inset: 24, top: 72 } as const;

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Whether the panel may open now, given the chain's box (null when there is none on the page), whether it has played
 * through, and the viewport. A chain scrolled out of view never blocks; one in view must have finished and sit clear of
 * the panel's box.
 */
export function chatMayOpen(chain: Box | null, done: boolean, viewport: { width: number; height: number }): boolean {
  if (!chain || chain.right <= chain.left || chain.bottom <= chain.top) return true;
  const inView = chain.bottom > 0 && chain.top < viewport.height && chain.right > 0 && chain.left < viewport.width;
  if (!inView) return true;
  if (!done) return false;
  const panelLeft = viewport.width - PANEL.inset - PANEL.width;
  const under = chain.right > panelLeft && chain.bottom > PANEL.top && chain.top < viewport.height - PANEL.inset;
  return !under;
}
