// The bundled demo photos: every URL points at a real file in public/demo, keyed by the recorded readings' item names.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAMPLE_IDS, recordedReading } from '@/lib/ai/samples';
import { DEMO_PHOTOS, demoCoverFor, demoPhotoFor } from '@/lib/demo/photos';

const fileOf = (url: string) => path.join(process.cwd(), 'public', ...url.split('/').filter(Boolean));

describe('DEMO_PHOTOS', () => {
  it('has a set for each sample menu', () => {
    expect(Object.keys(DEMO_PHOTOS).sort()).toEqual([...SAMPLE_IDS].sort());
  });

  it.each(SAMPLE_IDS)('%s: every photo is a site-relative /demo/<slug>/ JPEG that exists, for an item on the menu', (slug) => {
    const set = DEMO_PHOTOS[slug];
    const names = recordedReading(slug).items.map((i) => i.name);
    for (const [name, url] of Object.entries(set.items)) {
      expect(names).toContain(name);
      expect(url).toMatch(new RegExp(`^/demo/${slug}/[a-z0-9-]+\\.jpg$`));
      expect(fs.existsSync(fileOf(url)), url).toBe(true);
    }
    if (set.cover !== null) {
      expect(set.cover).toBe(`/demo/${slug}/cover.jpg`);
      expect(fs.existsSync(fileOf(set.cover)), set.cover).toBe(true);
    }
  });

  it('gives the seeded demo shop a cover and a photo for every item', () => {
    const set = DEMO_PHOTOS['marigold-bakehouse'];
    expect(set.cover).not.toBeNull();
    expect(Object.keys(set.items).sort()).toEqual(recordedReading('marigold-bakehouse').items.map((i) => i.name).sort());
  });

  it('gives Tía Lupe a cover and a photo for every item', () => {
    const set = DEMO_PHOTOS['tia-lupe-chalkboard'];
    expect(set.cover).toBe('/demo/tia-lupe-chalkboard/cover.jpg');
    expect(Object.keys(set.items).sort()).toEqual(recordedReading('tia-lupe-chalkboard').items.map((i) => i.name).sort());
    expect(demoPhotoFor('tia-lupe-chalkboard', 'Agua fresca del dia')).toBe('/demo/tia-lupe-chalkboard/agua-fresca-del-dia.jpg');
  });

  it("leaves an item the seller adds themself with no photo, so it shows the designed fallback", () => {
    expect(demoPhotoFor('tia-lupe-chalkboard', 'Birria quesatacos')).toBeNull();
    expect(demoPhotoFor('ravi-bike-repair', 'Custom wheel build')).toBeNull();
  });
});

describe('demoPhotoFor', () => {
  it('finds an item by its exact name, or loosely (case, accents, spacing, punctuation)', () => {
    expect(demoPhotoFor('marigold-bakehouse', 'Almond croissant')).toBe('/demo/marigold-bakehouse/almond-croissant.jpg');
    expect(demoPhotoFor('marigold-bakehouse', '  almond   CROISSANT ')).toBe('/demo/marigold-bakehouse/almond-croissant.jpg');
    expect(demoPhotoFor('marigold-bakehouse', 'Focaccia - rosemary & sea salt')).toBe(DEMO_PHOTOS['marigold-bakehouse'].items['Focaccia – rosemary & sea salt']);
  });

  it('is null for an unknown shop or item', () => {
    expect(demoPhotoFor('someone-else', 'Almond croissant')).toBeNull();
    expect(demoPhotoFor('marigold-bakehouse', 'Bagel')).toBeNull();
    expect(demoPhotoFor('marigold-bakehouse', '')).toBeNull();
    expect(demoPhotoFor('toString', 'x')).toBeNull();
    expect(demoPhotoFor('marigold-bakehouse', 'constructor')).toBeNull();
  });

  it('demoCoverFor gives the cover, or null', () => {
    expect(demoCoverFor('marigold-bakehouse')).toBe('/demo/marigold-bakehouse/cover.jpg');
    expect(demoCoverFor('nope')).toBeNull();
  });
});
