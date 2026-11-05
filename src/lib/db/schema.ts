import fs from 'node:fs';
import path from 'node:path';

// schema.sql is the single source of truth; the app always runs from the repo root (dev, start, tests).
export const SCHEMA_SQL = fs.readFileSync(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8');
