// The three sample menus a visitor can try from the Start page, with a recorded real reading of
// each (claude-sonnet-5-5 output with the current prompt, recorded by scripts/record-samples.ts).
// The recording is used only when no ANTHROPIC_API_KEY is set; with a key, samples are read live
// like any photo.
import path from 'node:path';
import type { SampleId } from '@/lib/client/api';
import { MenuExtractionSchema, type MenuExtraction } from '@/lib/ai/schemas';
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
  return MenuExtractionSchema.parse(SAMPLES[id].recorded);
}
