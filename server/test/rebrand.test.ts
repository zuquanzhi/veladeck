import { expect, test } from 'vitest';
import { rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './helper.js';
import { buildApp } from '../src/app.js';

test('rebranded server reopens a legacy database with paired devices and artifacts intact', async () => {
  const f = await fixture();
  let reopened: Awaited<ReturnType<typeof buildApp>> | undefined;
  try {
    const cookie = await f.pair();
    const created = await f.app.inject({
      method: 'POST',
      url: '/api/artifacts',
      headers: f.internal,
      payload: {
        project: 'upgrade-test',
        kind: 'markdown',
        title: 'Retained report',
        file: '# Preserved content',
        idempotency_key: 'rebrand-upgrade',
      },
    });
    expect(created.statusCode).toBe(200);
    const artifactId = created.json().id;
    await f.app.close();
    const legacy = join(f.config.DATA_DIR, 'runotter.db');
    await rename(join(f.config.DATA_DIR, 'veladeck.db'), legacy);
    reopened = await buildApp(f.config);
    expect((await reopened.inject({ url: '/api/session', headers: { cookie } })).statusCode).toBe(
      200,
    );
    const report = await reopened.inject({
      url: '/api/artifacts/' + artifactId,
      headers: { cookie },
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().title).toBe('Retained report');
    expect((await stat(legacy)).isFile()).toBe(true);
    await expect(stat(join(f.config.DATA_DIR, 'veladeck.db'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await reopened?.close();
    await f.cleanup();
  }
});
