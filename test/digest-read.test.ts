import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('finds 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts the valid lines per status', () => {
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('builds each row from the job lines', () => {
    expect(night?.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        fails: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        fails: 0,
        lastStatus: 'ok',
        lastError: 'upstream 503',
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        fails: 0,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        fails: 1,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        fails: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });
});

describe('readNight on a temp runs dir', () => {
  let root: string;
  let runsDir: string;
  const write = (night: string, text: string) => writeFileSync(join(runsDir, `${night}.jsonl`), text);

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    runsDir = join(root, 'runs');
    mkdirSync(runsDir);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('returns null for a night with no file', () => {
    expect(readNight(runsDir, '2026-10-30')).toBeNull();
  });

  it('returns null when the runs dir itself is missing', () => {
    expect(readNight(join(root, 'nope'), '2026-10-28')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    write('2026-11-01', '');
    expect(readNight(runsDir, '2026-11-01')).toEqual({
      night: '2026-11-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('rejects a night that is not YYYY-MM-DD, even when the path would exist', () => {
    // root/secret.jsonl is what "../secret" would reach from the runs dir.
    writeFileSync(join(root, 'secret.jsonl'), '{"at":"2026-10-29T01:00:00Z","job":"x","status":"ok","owner":null}\n');
    write('2026-11-02', '');
    for (const night of ['../secret', '2026-11-02.jsonl', '2026-11-2', '2026-11-02/', ' 2026-11-02', '', 'latest']) {
      expect(readNight(runsDir, night), night).toBeNull();
    }
  });

  it('skips blank lines and counts every wrong shape as a bad line', () => {
    const ok = { at: '2026-11-03T01:00:00+01:00', job: 'a/job', status: 'ok', owner: 'rook' };
    const lines = [
      JSON.stringify(ok),
      '',
      '   ',
      'not json',
      '[]',
      'null',
      '42',
      JSON.stringify({ ...ok, job: '' }),
      JSON.stringify({ ...ok, job: 7 }),
      JSON.stringify({ ...ok, status: 'done' }),
      JSON.stringify({ ...ok, owner: 7 }),
      JSON.stringify({ ...ok, error: 503 }),
      JSON.stringify({ ...ok, at: '2026-11-03T01:00:00' }), // no offset
      JSON.stringify({ ...ok, at: '2026-13-45T99:00:00+01:00' }),
      JSON.stringify({ ...ok, at: undefined }),
    ];
    write('2026-11-03', lines.join('\r\n') + '\r\n');
    const night = readNight(runsDir, '2026-11-03');
    expect(night?.badLines).toBe(12);
    expect(night?.rows.map((r) => r.job)).toEqual(['a/job']);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });

  it('reads a missing owner as null', () => {
    write('2026-11-04', '{"at":"2026-11-04T01:00:00+01:00","job":"a/job","status":"ok"}\n');
    expect(readNight(runsDir, '2026-11-04')?.rows[0]?.owner).toBeNull();
  });

  it('orders by instant, keeps the original strings, and takes the owner from the last line', () => {
    // File order is not time order: 00:30Z is 01:30+01:00, later than 01:00+01:00.
    write(
      '2026-11-05',
      [
        '{"at":"2026-11-05T00:30:00Z","job":"a/job","status":"retry","owner":"new","error":"late"}',
        '{"at":"2026-11-05T01:00:00+01:00","job":"a/job","status":"fail","owner":"old","error":"early"}',
        '',
      ].join('\n'),
    );
    expect(readNight(runsDir, '2026-11-05')?.rows).toEqual([
      {
        job: 'a/job',
        owner: 'new',
        runs: 2,
        retries: 1,
        fails: 1,
        lastStatus: 'retry',
        lastError: 'late',
        firstAt: '2026-11-05T01:00:00+01:00',
        lastAt: '2026-11-05T00:30:00Z',
      },
    ]);
  });
});
