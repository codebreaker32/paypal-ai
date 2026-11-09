// Next's image optimizer keeps resized copies of /i/ photos under .next/cache/images. `/i/` answers with a one-year
// max-age, and a stale entry is served while it revalidates, so a copy outlives its original unless it is purged here.
// Each entry is a folder holding one file named `<maxAge>.<expireAt>.<etag>.<upstreamEtag>.<ext>`, and `upstreamEtag`
// is the hash of the original's bytes, which finds every copy of a photo whatever its width, quality or URL spelling.
// tests/images/optimizer-cache.test.ts writes entries with Next's own code, so a change to that layout fails there.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Where `next start` and `next dev` keep the cache, relative to the app's working directory. */
export function imageCacheDirs(): string[] {
  const dist = path.join(/* turbopackIgnore: true */ process.cwd(), '.next');
  return [path.join(/* turbopackIgnore: true */ dist, 'cache', 'images'), path.join(/* turbopackIgnore: true */ dist, 'dev', 'cache', 'images')];
}

async function upstreamEtagOf(abs: string): Promise<string | null> {
  const bytes = await fs.readFile(/* turbopackIgnore: true */ abs).catch(() => null);
  return bytes && createHash('sha256').update(bytes).digest('base64url');
}

async function purgeEntry(dir: string, key: string, etags: Set<string>): Promise<void> {
  const entry = path.join(/* turbopackIgnore: true */ dir, key);
  const [file] = await fs.readdir(/* turbopackIgnore: true */ entry).catch(() => []);
  const upstream = file?.split('.', 5)[3];
  if (upstream && etags.has(upstream)) await fs.rm(/* turbopackIgnore: true */ entry, { recursive: true, force: true }).catch(() => undefined);
}

async function purge(etags: Set<string>, dirs: string[]): Promise<void> {
  if (etags.size === 0) return;
  for (const dir of dirs) {
    const keys = await fs.readdir(/* turbopackIgnore: true */ dir).catch(() => []);
    await Promise.all(keys.map((key) => purgeEntry(dir, key, etags)));
  }
}

/**
 * Removes files or folders and every optimizer copy of those files. The originals go first, so a request arriving
 * meanwhile can't rebuild a copy. Never throws: the rows are already gone, and a stale file is only disk space.
 */
export async function removeWithOptimizedCopies(paths: string[], dirs: string[] = imageCacheDirs()): Promise<void> {
  const etags = await Promise.all(paths.map(upstreamEtagOf));
  await Promise.all(paths.map((p) => fs.rm(/* turbopackIgnore: true */ p, { recursive: true, force: true }).catch(() => undefined)));
  await purge(new Set(etags.filter((etag): etag is string => etag !== null)), dirs);
}
