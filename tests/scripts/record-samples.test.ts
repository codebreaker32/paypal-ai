// The recorder's arguments: it never overwrites the committed recordings unless asked to.
import { describe, expect, it } from 'vitest';
import { SAMPLE_IDS } from '@/lib/ai/samples';
import { SAMPLES_DIR, parseArgs } from '../../scripts/record-samples';

const now = new Date('2026-11-06T10:20:30.456Z');

describe('record-samples arguments', () => {
  it('records every sample into a fresh scratch folder by default', () => {
    expect(parseArgs([], now)).toEqual({ out: 'data/recordings/2026-11-06T10-20-30-456Z', ids: SAMPLE_IDS });
  });
  it('overwrites src/lib/ai/samples only with --write-samples', () => {
    expect(SAMPLES_DIR).toBe('src/lib/ai/samples');
    expect(parseArgs(['--write-samples', 'ravi-bike-repair'], now)).toEqual({ out: SAMPLES_DIR, ids: ['ravi-bike-repair'] });
  });
  it('records into --out <dir>', () => {
    expect(parseArgs(['--out', '/tmp/rec', 'marigold-bakehouse'], now)).toEqual({ out: '/tmp/rec', ids: ['marigold-bakehouse'] });
  });
  it('rejects --out without a folder, and --out with --write-samples', () => {
    expect(() => parseArgs(['--out'], now)).toThrow(/--out needs a folder/);
    expect(() => parseArgs(['--out', '--write-samples'], now)).toThrow(/--out needs a folder/);
    expect(() => parseArgs(['--out', '/tmp/rec', '--write-samples'], now)).toThrow(/not both/);
  });
});
