// SR25: what the production pass removed or decided not to build stays gone.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(process.cwd(), 'src');

function allFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? allFiles(p) : [p];
  });
}

const files = allFiles(ROOT);
const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('SR25 removal guard', () => {
  it.each(['is_demo', 'api/auth/demo', 'shelfie-storefront', 'api/checkout'])('nothing in src mentions %s', (text) => {
    const hits = files.filter((f) => read(f).includes(text)).map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('there is no attach route', () => {
    const routes = files.filter((f) => /[/\\]attach([/\\.]|$)/.test(path.relative(ROOT, f)));
    expect(routes).toEqual([]);
    const callers = files.filter((f) => /\/api\/[a-z/]*attach/.test(read(f))).map((f) => path.relative(ROOT, f));
    expect(callers).toEqual([]);
  });
});
