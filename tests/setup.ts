// Loads .env for sandbox/live suites. Unit tests never need it. Values are never printed.
import { expect } from 'vitest';
import { config } from 'dotenv';
config({ path: process.env.SHELFIE_ENV_FILE ?? '.env', quiet: true });
process.env.SHELFIE_TEST = '1';
process.env.SHELFIE_ALLOW_GUEST_SHOPS = '1';
// Only the live AI suites may reach Claude: elsewhere an unset key makes writeOrderBrief store the template brief.
if (!/tests[\\/]ai-live[\\/]/.test(expect.getState().testPath ?? '')) delete process.env.ANTHROPIC_API_KEY;
