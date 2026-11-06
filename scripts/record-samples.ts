// npx tsx scripts/record-samples.ts [--out <dir>] [sample ids…]
// Reads each sample photo in public/samples with the real menu reader (claude-sonnet-5-5 and the current prompt) and
// writes the raw model output to <dir>/<id>.json (default src/lib/ai/samples). These recordings are what a visitor
// without ANTHROPIC_API_KEY sees when they try a sample (src/lib/ai/samples/index.ts). Needs ANTHROPIC_API_KEY in .env.
// Record into a scratch --out first, check the flagged cards (npx vitest run tests/ai/normalize.test.ts after
// copying), then copy over. Never edit prices in a recording by hand.
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { extractMenu } from '@/lib/ai/extract';
import { normalizeExtraction } from '@/lib/ai/normalize';
import { SAMPLE_IDS, isSampleId, samplePhotoPath } from '@/lib/ai/samples';

config({ quiet: true });

function args(argv: string[]): { out: string; ids: string[] } {
  let out = 'src/lib/ai/samples';
  const ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else ids.push(argv[i]);
  }
  return { out, ids: ids.length ? ids : SAMPLE_IDS };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (.env)');
  const { out, ids } = args(process.argv.slice(2));
  fs.mkdirSync(out, { recursive: true });
  for (const id of ids) {
    if (!isSampleId(id)) throw new Error(`Unknown sample: ${id} (one of ${SAMPLE_IDS.join(', ')})`);
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
