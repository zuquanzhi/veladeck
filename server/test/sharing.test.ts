import { test, expect } from 'vitest';
import { fixture } from './helper.js';
import { Store } from '../src/db/client.js';
test('public shares are read-only, hashed, revocable and escape hostile markup', async () => {
  const f = await fixture();
  const store = new Store(f.config.DATA_DIR);
  try {
    const cookie = await f.pair();
    const a = (
      await f.app.inject({
        method: 'POST',
        url: '/api/artifacts',
        headers: f.internal,
        payload: {
          project: 'demo',
          kind: 'markdown',
          title: '<script>alert(1)</script>',
          file: '<script>alert(1)</script>\n# Read-only',
          idempotency_key: 'share-test',
        },
      })
    ).json();
    const result = (
      await f.app.inject({
        method: 'POST',
        url: '/api/artifacts/' + a.id + '/share',
        headers: { cookie },
        payload: {},
      })
    ).json();
    const url = new URL(result.url);
    const publicPage = await f.app.inject(url.pathname);
    expect(publicPage.statusCode).toBe(200);
    expect(publicPage.body).not.toContain('<script>');
    const stored = store.get<{ token: string }>('SELECT token FROM share_links')!.token;
    expect(stored).not.toBe(url.pathname.split('/').at(-1));
    await f.app.inject({
      method: 'DELETE',
      url: '/api/artifacts/' + a.id + '/share',
      headers: { cookie },
    });
    expect((await f.app.inject(url.pathname)).statusCode).toBe(404);
  } finally {
    store.close();
    await f.cleanup();
  }
});
test('Inbox retries do not duplicate submissions', async () => {
  const f = await fixture();
  try {
    const cookie = await f.pair(),
      payload = { content: 'An explicit example idea', idempotency_key: 'same-item' };
    const post = () =>
      f.app.inject({ method: 'POST', url: '/api/inbox', headers: { cookie }, payload });
    const first = await post(),
      second = await post();
    expect(first.json().id).toBe(second.json().id);
    expect((await f.app.inject({ url: '/api/inbox', headers: { cookie } })).json()).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
