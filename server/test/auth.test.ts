import { expect, test } from 'vitest';
import { fixture } from './helper.js';
test('one-time pairing, secure cookie, revoke and loopback ingress isolation', async () => {
  const f = await fixture();
  try {
    expect((await f.app.inject('/api/devices')).statusCode).toBe(401);
    expect((await f.app.inject({ method: 'POST', url: '/api/pair/code' })).statusCode).toBe(403);
    const code = (
      await f.app.inject({ method: 'POST', url: '/api/pair/code', headers: f.internal })
    ).json().code;
    const claim = () =>
      f.app.inject({
        method: 'POST',
        url: '/api/pair/claim',
        payload: { code, device_name: 'Phone' },
      });
    const first = await claim();
    expect(first.statusCode).toBe(200);
    expect(String(first.headers['set-cookie'])).toMatch(/HttpOnly/);
    expect(String(first.headers['set-cookie'])).toMatch(/Secure/);
    expect((await claim()).statusCode).toBe(401);
    const cookie = String(first.headers['set-cookie']).split(';')[0];
    const devices = await f.app.inject({ url: '/api/devices', headers: { cookie } });
    expect(devices.statusCode).toBe(200);
    await f.app.inject({
      method: 'DELETE',
      url: '/api/devices/' + devices.json()[0].id,
      headers: { cookie },
    });
    expect((await f.app.inject({ url: '/api/devices', headers: { cookie } })).statusCode).toBe(401);
    expect(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/pair/code',
          headers: { ...f.internal, 'x-forwarded-for': '203.0.113.1' },
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await f.cleanup();
  }
});
test('pairing rate limit and cross-origin write rejection', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 10; i++)
      await f.app.inject({
        method: 'POST',
        url: '/api/pair/claim',
        payload: { code: '000000', device_name: 'Wrong' },
      });
    expect(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/pair/claim',
          payload: { code: '000000', device_name: 'Wrong' },
        })
      ).statusCode,
    ).toBe(429);
    expect(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/pair/claim',
          headers: { origin: 'https://evil.invalid' },
          payload: { code: '000000', device_name: 'Wrong' },
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await f.cleanup();
  }
});
