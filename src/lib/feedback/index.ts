export type FeedbackEvent = 'success' | 'error';

/** Announces a result to whoever listens for `shelfie:feedback`. Safe to call on the server, where it does nothing. */
export function feedback(event: FeedbackEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('shelfie:feedback', { detail: { event } }));
}
