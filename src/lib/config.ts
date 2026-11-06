// Environment configuration. Errors name the missing variable, never a value.

export class ConfigError extends Error {}

export interface Config {
  paypalClientId: string;
  paypalSecret: string;
  paypalBase: string;
  paypalWebhookId: string | null;
  anthropicApiKey: string | null;
  /** SHELFIE_RECORDED_SAMPLES=1: sample menus use their recorded reading even with a key (demo recording). */
  recordedSamples: boolean;
  appUrl: string;
  databasePath: string;
  uploadsDir: string;
  buyerEmail: string | null;
  buyerPassword: string | null;
}

const opt = (name: string): string | null => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : null;
};

const req = (name: string): string => {
  const v = opt(name);
  if (!v) throw new ConfigError(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return v;
};

export const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

export function getConfig(): Config {
  return {
    get paypalClientId() { return req('PAYPAL_CLIENT_ID'); },
    get paypalSecret() { return req('PAYPAL_SECRET_KEY'); },
    paypalBase: PAYPAL_SANDBOX_BASE,
    paypalWebhookId: opt('PAYPAL_WEBHOOK_ID'),
    anthropicApiKey: opt('ANTHROPIC_API_KEY'),
    recordedSamples: opt('SHELFIE_RECORDED_SAMPLES') === '1',
    // RENDER_EXTERNAL_URL is set by Render at runtime (https://<service>.onrender.com).
    appUrl: (opt('APP_URL') ?? opt('RENDER_EXTERNAL_URL') ?? 'http://localhost:3000').replace(/\/+$/, ''),
    databasePath: opt('DATABASE_PATH') ?? 'data/shelfie.db',
    uploadsDir: opt('UPLOADS_DIR') ?? 'data/uploads',
    buyerEmail: opt('PAYPAL_SANDBOX_BUYER_EMAIL'),
    buyerPassword: opt('PAYPAL_SANDBOX_BUYER_PASSWORD'),
  };
}
