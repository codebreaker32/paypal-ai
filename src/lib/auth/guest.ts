// The two test-harness switches, which mean nothing on a real deployment (SR20).

const onRender = (): boolean => Boolean(process.env.RENDER);

/** Whether a shop can be started without an account: only for a harness that sets SHELFIE_ALLOW_GUEST_SHOPS=1, and never on Render. */
export function guestShopsAllowed(): boolean {
  if (onRender()) return false;
  return process.env.SHELFIE_ALLOW_GUEST_SHOPS === '1';
}

/** The e2e and screenshot servers make many accounts from one address, so SHELFIE_TEST skips the auth limits. */
export function authLimitsSkipped(): boolean {
  return !onRender() && Boolean(process.env.SHELFIE_TEST);
}
