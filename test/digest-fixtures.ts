import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A temp runs dir with one `<night>.jsonl` per entry. Route tests use this instead of `runs/`,
// which is read-only real data. Call `remove` in afterAll.
export function tempRuns(nights: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  const runsDir = join(root, 'runs');
  mkdirSync(runsDir);
  for (const [night, text] of Object.entries(nights)) {
    writeFileSync(join(runsDir, `${night}.jsonl`), text);
  }
  return { runsDir, remove: () => rmSync(root, { recursive: true, force: true }) };
}

// Lines are in file order, not time order or job order, so the tests see the sorting.
export const NORMAL_NIGHT = [
  '{"at":"2026-11-10T02:00:00+01:00","job":"sync/lane","status":"ok","owner":"rook"}',
  '{"at":"2026-11-10T01:00:00+01:00","job":"backup/notes","status":"fail","owner":"lane-07","error":"quota exceeded"}',
  '{"at":"2026-11-10T01:30:00+01:00","job":"fetch/fixtures","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-11-10T01:31:00+01:00","job":"fetch/fixtures","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-11-10T01:32:00+01:00","job":"fetch/fixtures","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-11-10T01:33:00+01:00","job":"fetch/fixtures","status":"ok","owner":"rook"}',
  '{"at":"2026-11-10T03:00:00+01:00","job":"digest/render","status":"ok","owner":null}',
].join('\n');

// One line that doesn't parse, between two good ones.
export const BAD_LINE_NIGHT = [
  '{"at":"2026-11-12T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  'not json',
  '{"at":"2026-11-12T02:00:00+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
].join('\n');

export const EMPTY_NIGHT = '';
