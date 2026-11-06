// npx tsx scripts/record-samples.ts [--out <dir> | --write-samples] [sample ids…]
// Reads each sample photo in public/samples with the real menu reader (claude-sonnet-5-5 and the current prompt) and
// writes the raw model output to <dir>/<id>.json. By default <dir> is a fresh scratch folder under data/recordings;
// --write-samples overwrites the committed recordings in src/lib/ai/samples, which are what a visitor without
// ANTHROPIC_API_KEY sees when they try a sample (src/lib/ai/samples/index.ts), what `npm run seed` publishes and what
// the e2e counts expect. Needs ANTHROPIC_API_KEY in .env.
// Record into scratch first, check the flagged cards it prints (and npx vitest run tests/ai/normalize.test.ts after
// copying), then copy over or rerun with --write-samples. Never edit prices in a recording by hand.
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { extractMenu } from '@/lib/ai/extract';
import { normalizeExtraction } from '@/lib/ai/normalize';
import { SAMPLE_IDS, isSampleId, samplePhotoPath } from '@/lib/ai/samples';

export const SAMPLES_DIR = 'src/lib/ai/samples';

export function parseArgs(argv: string[], now = new Date()): { out: string; ids: string[] } {
  let out: string | null = null;
  let writeSamples = false;
  const ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--write-samples') writeSamples = true;
    else if (argv[i] === '--out') {
      const dir = argv[++i];
      if (!dir || dir.startsWith('--')) throw new Error('--out needs a folder: --out <dir>');
      out = dir;
    } else ids.push(argv[i]);
  }
  if (out && writeSamples) throw new Error('Use --out <dir> or --write-samples, not both');
  const scratch = path.join('data', 'recordings', now.toISOString().replace(/[:.]/g, '-'));
  return { out: writeSamples ? SAMPLES_DIR : (out ?? scratch), ids: ids.length ? ids : SAMPLE_IDS };
}

async function main() {
  config({ quiet: true });
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (.env)');
  const { out, ids } = parseArgs(process.argv.slice(2));
  const unknown = ids.find((id) => !isSampleId(id));
  if (unknown) throw new Error(`Unknown sample: ${unknown} (one of ${SAMPLE_IDS.join(', ')})`);
  fs.mkdirSync(out, { recursive: true });
  for (const id of ids.filter(isSampleId)) {
    const started = Date.now();
    const raw = await extractMenu([{ data: fs.readFileSync(samplePhotoPath(id)), mediaType: 'image/jpeg' }]);
    const file = path.join(out, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
    const c = normalizeExtraction(raw);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if ('unreadable' in c) {
      console.log(`${id}: ${secs}s, unreadable (${c.reason}) -> ${file}`);
      continue;
    }
    console.log(`${id}: ${secs}s, ${c.items.length} items, ${c.needsAttention} flagged -> ${file}`);
    for (const i of c.items.filter((x) => x.issues.length)) console.log(`  [${i.issues.join(',')}] ${i.name}: ${i.issueDetail}`);
    for (const w of c.warnings) console.log(`  note: ${w}`);
  }
}

// Only when run as a script, so tests can import parseArgs without reading anything.
if (process.argv[1] && /record-samples\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
