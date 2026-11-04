import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus, StatusCounts } from './types.js';

// Same shape as the board's nights on disk (src/status.ts). Nothing else reaches the path.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
// ISO 8601 with an explicit offset. Without one, the instant would depend on the server's zone.
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    throw e;
  }

  const lines: RunLine[] = [];
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue; // a blank line (the trailing newline, say) isn't a bad line
    const line = parseLine(raw);
    if (line) lines.push(line);
    else badLines++;
  }

  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of lines) counts[line.status]++;

  // Oldest first, by instant, so "first", "last" and "the last line" follow time, not file
  // order. The sort is stable: lines at the same instant keep their file order.
  lines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const byJob = new Map<string, DigestRow>();
  for (const line of lines) {
    const row = byJob.get(line.job) ?? {
      job: line.job,
      owner: line.owner,
      runs: 0,
      retries: 0,
      fails: 0,
      lastStatus: line.status,
      lastError: null,
      firstAt: line.at,
      lastAt: line.at,
    };
    row.runs++;
    if (line.status === 'retry') row.retries++;
    if (line.status === 'fail') row.fails++;
    // A job's lines can disagree on the owner (handed over mid-night). The last line wins,
    // even when it says null: it is the latest word on whose the job is.
    row.owner = line.owner;
    row.lastStatus = line.status;
    if (line.error !== undefined) row.lastError = line.error;
    row.lastAt = line.at;
    byJob.set(line.job, row);
  }

  // Code-unit order, not localeCompare, so the order doesn't depend on the machine's locale.
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { night, rows, badLines, counts };
};

// The edge: everything after this trusts RunLine. Returns null for a line that doesn't parse or
// has the wrong shape. A missing `owner` reads as null and a null `error` as none, since both
// only mean "not known".
function parseLine(raw: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const { at, job, status, owner = null, error = null } = value as Record<string, unknown>;
  if (typeof at !== 'string' || !AT.test(at) || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== null && typeof error !== 'string') return null;

  return error === null ? { at, job, status, owner } : { at, job, status, owner, error };
}

function isStatus(value: unknown): value is RunStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}
