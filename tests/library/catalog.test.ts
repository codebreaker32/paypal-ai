// The bundled example-photo library: every entry points at a real 800x600 WebP, ids are unique, and every file is catalogued.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { isItemCategory } from '@/lib/domain/category';
import { LIBRARY } from '@/lib/library/catalog';

const dir = path.join(process.cwd(), 'public', 'library');

describe('LIBRARY', () => {
  it('has unique ids, each named <type>-<n> with file /library/<id>.webp', () => {
    expect(new Set(LIBRARY.map((p) => p.id)).size).toBe(LIBRARY.length);
    for (const p of LIBRARY) {
      expect(p.id).toBe(`${p.type}-${p.id.match(/\d+$/)?.[0]}`);
      expect(p.file).toBe(`/library/${p.id}.webp`);
    }
  });

  it('gives every photo a category, tags, a description and a Pexels credit', () => {
    for (const p of LIBRARY) {
      expect(isItemCategory(p.category), p.id).toBe(true);
      expect(p.tags.length, p.id).toBeGreaterThan(0);
      for (const t of p.tags) expect(t, p.id).toBe(t.toLowerCase());
      expect(p.shows.trim(), p.id).not.toBe('');
      expect(p.source, p.id).toMatch(/^https:\/\/www\.pexels\.com\/photo\/[\w%-]+-\d+\/$/);
      expect(p.photographer.trim(), p.id).not.toBe('');
      expect(p.licence).toBe('Pexels License');
    }
  });

  it('lists exactly the files in public/library', () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
    expect(LIBRARY.map((p) => `${p.id}.webp`).sort()).toEqual(files);
  });

  it('has 800x600 WebP files', async () => {
    for (const p of LIBRARY) {
      const m = await sharp(path.join(dir, `${p.id}.webp`)).metadata();
      expect([m.format, m.width, m.height], p.id).toEqual(['webp', 800, 600]);
    }
  });

  it('is credited in docs/ASSETS.md', () => {
    const assets = fs.readFileSync(path.join(process.cwd(), 'docs', 'ASSETS.md'), 'utf8');
    for (const p of LIBRARY) expect(assets, p.id).toContain(`| \`${p.id}\` |`);
  });
});
