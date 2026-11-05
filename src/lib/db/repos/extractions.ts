import type { Db } from '@/lib/db';
import { now } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import type { SkippedLine } from '@/lib/domain/types';

export interface Extraction {
  id: string;
  shopId: string;
  status: 'running' | 'done' | 'failed';
  model: string;
  raw: unknown;
  imageQuality: string | null;
  warnings: string[];
  skipped: SkippedLine[];
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface Row {
  id: string; shop_id: string; status: Extraction['status']; model: string; raw_json: string | null; image_quality: string | null;
  warnings_json: string; skipped_lines_json: string; error: string | null; duration_ms: number | null; created_at: string;
}

const toExtraction = (r: Row): Extraction => ({
  id: r.id, shopId: r.shop_id, status: r.status, model: r.model, raw: r.raw_json ? JSON.parse(r.raw_json) : null,
  imageQuality: r.image_quality, warnings: JSON.parse(r.warnings_json) as string[],
  skipped: JSON.parse(r.skipped_lines_json) as SkippedLine[], error: r.error, durationMs: r.duration_ms, createdAt: r.created_at,
});

export function start(db: Db, shopId: string, model: string): string {
  const id = newId('ext');
  db.prepare(`INSERT INTO extractions (id, shop_id, status, model, created_at) VALUES (?, ?, 'running', ?, ?)`).run(id, shopId, model, now());
  return id;
}

export function finish(db: Db, id: string, r: { raw: unknown; imageQuality: string | null; warnings: string[]; skipped: SkippedLine[]; durationMs: number }): void {
  db.prepare(
    `UPDATE extractions SET status = 'done', raw_json = ?, image_quality = ?, warnings_json = ?, skipped_lines_json = ?, duration_ms = ? WHERE id = ?`,
  ).run(JSON.stringify(r.raw), r.imageQuality, JSON.stringify(r.warnings), JSON.stringify(r.skipped), r.durationMs, id);
}

export function fail(db: Db, id: string, error: string, raw?: unknown): void {
  db.prepare(`UPDATE extractions SET status = 'failed', error = ?, raw_json = ? WHERE id = ?`)
    .run(error, raw === undefined ? null : JSON.stringify(raw), id);
}

export function latest(db: Db, shopId: string): Extraction | null {
  const r = db.prepare('SELECT * FROM extractions WHERE shop_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(shopId) as Row | undefined;
  return r ? toExtraction(r) : null;
}
