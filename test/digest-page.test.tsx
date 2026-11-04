import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { BAD_LINE_NIGHT, EMPTY_NIGHT, NORMAL_NIGHT, tempRuns } from './digest-fixtures.js';

describe('GET /digest/:night', () => {
  let run: ReturnType<typeof tempRuns>;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    run = tempRuns({ '2026-11-10': NORMAL_NIGHT, '2026-11-11': EMPTY_NIGHT, '2026-11-12': BAD_LINE_NIGHT });
    app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: run.runsDir });
  });
  afterAll(() => run.remove());

  it('renders a normal night in the layout, one row per job, with its marks', async () => {
    const res = await app.request('/digest/2026-11-10');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<header>');
    expect(html).toContain('digest 2026-11-10');
    expect(html).toContain('quota exceeded');
    expect(html).toContain('upstream 503');
    expect(html).toContain('[WARN: 3 retries]');
    expect(html).toContain('[WARN: 1 fail]');
    expect(html).not.toContain('did not parse');
    expect(html).not.toContain('nothing ran');
  });

  it('shows the missing-data mark for a null owner', async () => {
    const html = await (await app.request('/digest/2026-11-10')).text();
    expect(html).toContain('<td class="nowrap">\u2014</td>');
  });

  it('404s a night with no file, in the layout', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('<header>');
    expect(html).toContain('no run log for this night');
  });

  it('says "nothing ran" for an empty night, with no table', async () => {
    const res = await app.request('/digest/2026-11-11');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('did not parse');
  });

  it('says how many lines did not parse, and still lists the good ones', async () => {
    const res = await app.request('/digest/2026-11-12');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('1 line did not parse');
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
  });
});
