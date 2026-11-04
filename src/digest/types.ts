// The digest's contract (plan morning-digest § 1). The page, the JSON route and the board link
// all build on these types, so the page and the JSON can't drift apart (ADR 0001).
//
// The reader is `readNight` in `./read.ts`, typed as `ReadNight` below:
//
//   import { readNight } from './digest/read.js';
//   const night = readNight(config.runsDir, c.req.param('night'));
//   if (!night) return c.notFound();

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of `runs/<night>.jsonl`, after parsing. The reader drops lines that don't have this
// shape and counts them in `DigestNight.badLines`.
export type RunLine = {
  at: string; // ISO 8601 with its offset, e.g. "2026-10-29T01:30:00+01:00"
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job in the night.
export type DigestRow = {
  job: string;
  // From the job's last line. null renders as the styleguide's missing-data mark.
  owner: string | null;
  runs: number; // log lines for this job, every status
  retries: number; // lines with status "retry"
  fails: number; // lines with status "fail"
  lastStatus: RunStatus; // status of the job's last line
  // The `error` of the job's latest line that has one, even if a later line went ok.
  // null when no line for the job has an error.
  lastError: string | null;
  // The `at` of the job's earliest and latest lines, as written in the log. The offset is kept;
  // never converted to UTC.
  firstAt: string;
  lastAt: string;
};

// Lines per status across the whole night, not per job. Bad lines are not in here.
export type StatusCounts = { ok: number; retry: number; fail: number };

export type DigestNight = {
  night: string; // "YYYY-MM-DD", as asked for
  rows: DigestRow[]; // sorted by job; empty when the file has no lines
  badLines: number; // lines that didn't parse or had the wrong shape
  counts: StatusCounts;
};

// Reads `<runsDir>/<night>.jsonl`.
// Returns null when there is no file for that night, or when `night` isn't a `YYYY-MM-DD`
// date (so a route parameter can't reach outside the runs dir). Routes answer null with 404.
// An empty file is a night with no rows, not null. Bad lines never throw.
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
