// Drives PayPal's sandbox approval page (the payer-action link from create_order) as a buyer, for the capture gate.
//
// payAsGuest: guest card checkout ("Pay with Credit or Debit Card"). It needs no buyer login, so it works whatever
// country the sandbox merchant is in. The recipe was proven by the capture spike (.scratch/capture-spike/FINDINGS.md):
// switch the form to the US, a sandbox test Visa, a US billing address, the "create a PayPal account" switch turned
// off, Pay Now, and for shipping orders PayPal's "Continue" on the address-match dialog. PayPal then sends the browser
// to the order's return URL.
//
// Guest card works only on orders paid into the platform account (the demo shop with no payee): on an order routed to
// a seller's own account (payee.email_address) the sandbox declines the card at capture (spike, 6 Nov 2026).
//
// payWithPayPalLogin: PayPal wallet checkout, logged in as a sandbox Personal account. Proven on 6 Nov 2026 with a US
// buyer paying an order routed to a US seller (capture COMPLETED). The India buyer can't pay the India platform account
// this way ("This seller doesn't accept payments in your currency"), which is why guest card came first.
//
// Nothing here reads .env: the caller passes the login. Never log it. The guest details are PayPal's public sandbox
// test values.
import type { Page, TestInfo } from '@playwright/test';

/** PayPal's sandbox test Visa that the spike proved (4012888888881881 is refused by the sandbox). */
export const TEST_CARD = { number: '4012000033330026', expiry: '12/30', cvv: '123' } as const;

export const GUEST = {
  email: 'shelfie-capture-gate@example.com',
  phone: '4085550123',
  firstName: 'Test',
  lastName: 'Buyer',
  line1: '2211 N First St',
  city: 'San Jose',
  state: 'CA',
  postalCode: '95131',
} as const;

export interface PayAsGuestOptions {
  /** Where PayPal must send the browser back to: Shelfie's own origin, e.g. http://localhost:3110. */
  returnOrigin: string;
  /** Saves PNGs of PayPal's pages along the way (the order summary, the filled card form). */
  shot?: (page: Page, name: string) => Promise<void>;
  /** Failure screenshots go into this test's output folder (test-results/…). */
  testInfo?: TestInfo;
}

export class PayPalBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayPalBlockedError';
  }
}

const SLOW = 60_000; // PayPal's sandbox pages are slow, especially the first load.

/** Text PayPal shows when it stops automation or refuses the card; any of these ends the attempt with evidence. */
const BLOCKERS: [RegExp, string][] = [
  [/captcha|security challenge|verify you(?:'|’)re a human|are you a robot/i, 'PayPal showed a security challenge (captcha)'],
  [/weren(?:'|’)t able to add this card|card was declined|couldn(?:'|’)t process this card/i, 'PayPal refused the test card'],
  [/doesn(?:'|’)t accept payments in your currency/i, 'PayPal refused the currency for this buyer'],
  [/things don(?:'|’)t appear to be working|something went wrong/i, 'PayPal showed an error page'],
];

async function blocker(page: Page): Promise<string | null> {
  const text = await page
    .locator('body')
    .innerText({ timeout: 2_000 })
    .catch(() => '');
  for (const [re, what] of BLOCKERS) if (re.test(text)) return what;
  return null;
}

async function failWithEvidence(page: Page, info: TestInfo | undefined, step: string, cause: unknown): Promise<never> {
  if (info) {
    const path = info.outputPath(`paypal-failure-${step}.png`);
    await page.screenshot({ path, fullPage: true }).catch(() => {});
    await info.attach(`paypal-failure-${step}`, { path, contentType: 'image/png' }).catch(() => {});
  }
  const seen = await blocker(page);
  const where = page.url().split('?')[0];
  const why = cause instanceof Error ? cause.message.split('\n')[0] : String(cause);
  const message = `PayPal checkout stopped at "${step}" on ${where}${seen ? ` (${seen})` : ''}: ${why}`;
  throw seen && /challenge/.test(seen) ? new PayPalBlockedError(message) : new Error(message);
}

/** The account-creation switch ("Save info & create your PayPal account"); its id changes on every render. */
async function turnOffAccountCreation(page: Page): Promise<void> {
  const flipped = await page.evaluate(() => {
    const el = document.querySelector<HTMLInputElement>('input[type=checkbox][id^="Switch_"]');
    if (el && el.checked) {
      el.click();
      return true;
    }
    return false;
  });
  if (flipped) await page.waitForTimeout(1_500);
  const stillOn = await page.evaluate(() => document.querySelector<HTMLInputElement>('input[type=checkbox][id^="Switch_"]')?.checked ?? false);
  if (stillOn) throw new Error('could not turn off "create your PayPal account"; stopping so no sandbox account is created');
  if (await page.locator('button[type=submit]:visible', { hasText: 'Create Account' }).count()) {
    throw new Error('only "Create Account" is offered; stopping so no sandbox account is created');
  }
}

/**
 * Approves a PayPal order as a guest paying by card, from its approval link to the moment the browser is back on
 * `returnOrigin`. Returns the URL PayPal returned to (the payer id is not kept). Throws with a screenshot on failure,
 * and with PayPalBlockedError when PayPal puts up a captcha or risk challenge.
 */
export async function payAsGuest(page: Page, approvalUrl: string, opts: PayAsGuestOptions): Promise<string> {
  const { returnOrigin, shot, testInfo } = opts;
  if (!/^https:\/\/www\.sandbox\.paypal\.com\//.test(approvalUrl)) throw new Error(`not a PayPal sandbox approval link: ${approvalUrl}`);
  let step = 'open';
  let returnedTo: string | null = null;
  const onRequest = (r: { url(): string }) => {
    if (!returnedTo && r.url().startsWith(returnOrigin)) returnedTo = r.url();
  };
  page.on('request', onRequest);
  try {
    await page.goto(approvalUrl, { waitUntil: 'domcontentloaded', timeout: SLOW });

    step = 'choose card';
    const payByCard = page.locator('a:visible, button:visible', { hasText: 'Pay with Credit or Debit Card' }).first();
    await payByCard.waitFor({ state: 'visible', timeout: SLOW });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    if (shot) await shot(page, 'paypal-approval');
    await payByCard.click();

    step = 'country';
    await page.locator('#country').waitFor({ state: 'visible', timeout: SLOW });
    await page.selectOption('#country', 'US');
    // The form re-renders for the US: wait until the state list holds US states.
    await page.locator('#billingState option[value="CA"]').waitFor({ state: 'attached', timeout: 30_000 });
    await page.waitForTimeout(1_500);

    step = 'card form';
    await page.fill('#email', GUEST.email);
    await page.fill('#phone', GUEST.phone);
    await page.fill('#cardNumber', TEST_CARD.number);
    await page.fill('#cardExpiry', TEST_CARD.expiry);
    await page.fill('#cardCvv', TEST_CARD.cvv);
    await page.fill('#firstName', GUEST.firstName);
    await page.fill('#lastName', GUEST.lastName);
    await page.fill('#billingLine1', GUEST.line1);
    await page.fill('#billingCity', GUEST.city);
    await page.selectOption('#billingState', GUEST.state);
    await page.fill('#billingPostalCode', GUEST.postalCode);
    // Shipping orders: "Shipping same as billing" stays ticked, so the ship-to is the billing address above.

    step = 'no account';
    await turnOffAccountCreation(page);
    if (shot) {
      await page.locator('#cardNumber').scrollIntoViewIfNeeded();
      await shot(page, 'paypal-guest-card');
    }

    step = 'pay';
    const pay = page.locator('button[type=submit]:visible', { hasText: /^(Pay Now|Continue|Pay \$|Agree & Pay|Pay)/ }).first();
    await pay.waitFor({ state: 'visible', timeout: 30_000 });
    await pay.click();

    step = 'return';
    const deadline = Date.now() + 120_000;
    while (!returnedTo && Date.now() < deadline) {
      await page.waitForTimeout(1_000);
      if (returnedTo) break;
      // Shipping orders: PayPal suggests its own form of the address ("2211 North 1st Street"); keep going.
      const cont = page.locator('button:visible', { hasText: /^Continue$/ });
      if (await cont.count().catch(() => 0)) await cont.first().click().catch(() => {});
      const seen = await blocker(page);
      if (seen) throw new Error(seen);
    }
    if (!returnedTo) throw new Error(`PayPal did not return to ${returnOrigin} within 120 s`);
    return (returnedTo as string).replace(/PayerID=[^&]+/, 'PayerID=…');
  } catch (e) {
    return failWithEvidence(page, testInfo, step.replace(/\s+/g, '-'), e);
  } finally {
    page.off('request', onRequest);
  }
}

export interface PayWithLoginOptions extends PayAsGuestOptions {
  /** The sandbox Personal account's login. Passed in by the caller from the environment; never logged. */
  email: string;
  password: string;
}

/**
 * Approves a PayPal order by logging in to PayPal as a sandbox buyer and paying from the wallet, from the approval
 * link to the moment the browser is back on `returnOrigin`. Returns the URL PayPal returned to (payer id removed).
 * Throws with a screenshot on failure (the login values never appear in the message).
 */
export async function payWithPayPalLogin(page: Page, approvalUrl: string, opts: PayWithLoginOptions): Promise<string> {
  const { returnOrigin, shot, testInfo, email, password } = opts;
  if (!/^https:\/\/www\.sandbox\.paypal\.com\//.test(approvalUrl)) throw new Error(`not a PayPal sandbox approval link: ${approvalUrl}`);
  let step = 'open';
  let returnedTo: string | null = null;
  const onRequest = (r: { url(): string }) => {
    if (!returnedTo && r.url().startsWith(returnOrigin)) returnedTo = r.url();
  };
  page.on('request', onRequest);
  try {
    await page.goto(approvalUrl, { waitUntil: 'domcontentloaded', timeout: SLOW });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    step = 'login email';
    const emailField = page.locator('#email');
    if (!(await emailField.isVisible().catch(() => false))) {
      // Some sessions open on the order summary with a "Log In" button first.
      const login = page.locator('a:visible, button:visible', { hasText: /^Log In$/ }).first();
      if (await login.count()) await login.click();
    }
    await emailField.waitFor({ state: 'visible', timeout: SLOW });
    if (shot) await shot(page, 'paypal-login');
    await emailField.fill(email);
    const next = page.locator('#btnNext');
    if (await next.isVisible().catch(() => false)) await next.click();

    step = 'login password';
    const pw = page.locator('#password');
    await pw.waitFor({ state: 'visible', timeout: SLOW });
    await pw.fill(password);
    await page.locator('#btnLogin').click();

    step = 'review';
    const pay = page.locator('button:visible', { hasText: /^(Complete Purchase|Pay Now|Continue to Review Order|Agree & Pay|Pay \$[\d.,]+)$/ }).first();
    await pay.waitFor({ state: 'visible', timeout: SLOW });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    if (shot) await shot(page, 'paypal-wallet-review');

    step = 'pay';
    const seen = await blocker(page);
    if (seen) throw new Error(seen);
    await pay.click();

    step = 'return';
    const deadline = Date.now() + 120_000;
    while (!returnedTo && Date.now() < deadline) {
      await page.waitForTimeout(1_000);
      if (returnedTo) break;
      // A shipping order can ask to confirm the address, or show a second review step.
      const more = page.locator('button:visible', { hasText: /^(Continue|Complete Purchase|Pay Now)$/ });
      if (await more.count().catch(() => 0)) await more.first().click().catch(() => {});
      const stop = await blocker(page);
      if (stop) throw new Error(stop);
    }
    if (!returnedTo) throw new Error(`PayPal did not return to ${returnOrigin} within 120 s`);
    return (returnedTo as string).replace(/PayerID=[^&]+/, 'PayerID=…');
  } catch (e) {
    return failWithEvidence(page, testInfo, `login-${step.replace(/\s+/g, '-')}`, e);
  } finally {
    page.off('request', onRequest);
  }
}
