// A file-backed SQLite path for tests that go through getDb() (route handlers, instrumentation). Importing this
// module registers one afterAll for the test file: it closes the process-wide connection and deletes every path
// handed out, with its -wal and -shm files, so test runs don't pile databases up in the temp folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const files: string[] = [];

export function tempDbPath(name: string): string {
  const file = path.join(os.tmpdir(), `shelfie-${name}-${process.pid}-${Date.now()}-${files.length}.db`);
  files.push(file);
  return file;
}

afterAll(() => {
  const g = globalThis as unknown as { __shelfieDb?: { close(): void } };
  g.__shelfieDb?.close();
  delete g.__shelfieDb;
  for (const file of files.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  }
});
