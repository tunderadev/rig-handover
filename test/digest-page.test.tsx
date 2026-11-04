import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders a night in the layout, 404s a missing one', async () => {
    const app = createApp(config);
    const ok = await app.request('/digest/2026-10-28');
    expect(ok.status).toBe(200);
    const html = await ok.text();
    expect(html).toContain('<header>');
    expect(html).toContain('did not parse');
    expect(html).toContain('\u2014');
    const missing = await app.request('/digest/2026-01-01');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('<header>');
  });
});
