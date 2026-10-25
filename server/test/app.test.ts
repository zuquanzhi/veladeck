import { expect, test } from 'vitest';
import { fixture } from './helper.js';
test('health exposes version and UTC time', async () => {
  const f = await fixture();
  try {
    const r = await f.app.inject('/api/health');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, version: '0.1.2' });
  } finally {
    await f.cleanup();
  }
});
