// Loads .env for sandbox/live suites. Unit tests never need it. Values are never printed.
import { config } from 'dotenv';
config({ path: process.env.SHELFIE_ENV_FILE ?? '.env', quiet: true });
process.env.SHELFIE_TEST = '1';
