import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { BAD_LINE_NIGHT, EMPTY_NIGHT, NORMAL_NIGHT, tempRuns } from './digest-fixtures.js';

type Digest = { night: string; rows: { job: string; owner: string | null; runs: number }[]; badLines: number };

// The job names in the order the page lists them: the first cell of each body row.
function pageJobs(html: string): string[] {
  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
  return [...body.matchAll(/<tr[^>]*>\s*<td>([^<\s]+)/g)].map((m) => m[1]);
}

describe('GET /api/digest/:night', () => {
  let run: ReturnType<typeof tempRuns>;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    run = tempRuns({ '2026-11-10': NORMAL_NIGHT, '2026-11-11': EMPTY_NIGHT, '2026-11-12': BAD_LINE_NIGHT });
    app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: run.runsDir });
  });
  afterAll(() => run.remove());

  it('answers 200 with one row per job, sorted by job', async () => {
    const res = await app.request('/api/digest/2026-11-10');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Digest;
    expect(body.night).toBe('2026-11-10');
    expect(body.rows.map((r) => r.job)).toEqual(['backup/notes', 'digest/render', 'fetch/fixtures', 'sync/lane']);
    expect(body.rows.find((r) => r.job === 'fetch/fixtures')).toMatchObject({ owner: 'rook', runs: 4 });
    expect(body.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
    expect(body.badLines).toBe(0);
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-01-01' });
  });

  it('answers 200 with no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-11-11');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: '2026-11-11',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts the bad line and still lists the good jobs', async () => {
    const res = await app.request('/api/digest/2026-11-12');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Digest;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
  });

  it.each(['2026-11-10', '2026-11-12'])('lists the same jobs, in the same order, as the page for %s', async (night) => {
    const json = (await (await app.request(`/api/digest/${night}`)).json()) as Digest;
    const html = await (await app.request(`/digest/${night}`)).text();
    expect(pageJobs(html)).toEqual(json.rows.map((r) => r.job));
  });

  it('lists no jobs on the page for an empty night, same as the JSON', async () => {
    const json = (await (await app.request('/api/digest/2026-11-11')).json()) as Digest;
    const html = await (await app.request('/digest/2026-11-11')).text();
    expect(json.rows).toEqual([]);
    expect(pageJobs(html)).toEqual([]);
  });
});
