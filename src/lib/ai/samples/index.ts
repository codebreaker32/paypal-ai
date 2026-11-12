// The three sample menus a visitor can try from the Start page, with a recorded real reading of
// each (claude-sonnet-5-5 output, recorded by scripts/record-samples.ts). A later pass added each item's
// `category` (its drawing) from a live pass with the current prompt; every other field is the
// earlier recording's, so names, prices and the e2e counts did not move. The recording is used
// only when no ANTHROPIC_API_KEY is set (or SHELFIE_RECORDED_SAMPLES=1); with a key, samples are
// read live like any photo. Readings from before categories still parse (`parseStoredReading`).
import path from 'node:path';
import type { SampleId } from '@/lib/client/api';
import { parseStoredReading, type MenuExtraction } from '@/lib/ai/schemas';
import marigold from './marigold-bakehouse.json';
import tiaLupe from './tia-lupe-chalkboard.json';
import ravi from './ravi-bike-repair.json';

export type { SampleId };

interface Sample {
  name: string;
  recorded: unknown;
}

export const SAMPLES: Record<SampleId, Sample> = {
  'marigold-bakehouse': { name: 'Marigold Bakehouse', recorded: marigold },
  'tia-lupe-chalkboard': { name: 'Tía Lupe’s Tacos', recorded: tiaLupe },
  'ravi-bike-repair': { name: 'Ravi’s Bike Repair', recorded: ravi },
};

export const SAMPLE_IDS = Object.keys(SAMPLES) as SampleId[];

export function isSampleId(v: unknown): v is SampleId {
  return typeof v === 'string' && Object.hasOwn(SAMPLES, v);
}

/** The sample's photo in public/samples. */
export function samplePhotoPath(id: SampleId): string {
  return path.join(process.cwd(), 'public', 'samples', `${id}.jpg`);
}

/** The recorded model output for a sample, validated against the live schema. */
export function recordedReading(id: SampleId): MenuExtraction {
  const parsed = parseStoredReading(SAMPLES[id].recorded);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}
