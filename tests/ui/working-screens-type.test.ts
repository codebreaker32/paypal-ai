// Working screens use only type-page (24/32) and type-section (16/24) for headings.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BANNED = /\btype-(display|hero|title)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = [...sources('src/components/dashboard'), ...sources('src/app/shops'), 'src/components/setup/LiveStep.tsx', 'src/components/setup/StepHeader.tsx'];

describe('working-screen type', () => {
  it('finds the screens it is meant to check', () => {
    expect(files).toEqual(expect.arrayContaining(['src/components/dashboard/SharePanel.tsx', 'src/components/setup/LiveStep.tsx']));
    expect(files.length).toBeGreaterThan(10);
  });
  it.each(['src/app/shops/[id]/(app)/orders/[orderId]/page.tsx', 'src/components/dashboard/BriefCard.tsx'])('%s keeps to the two working sizes', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/\btype-heading\b/);
  });
  it.each(files)('%s uses no display type', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(BANNED);
  });
});
