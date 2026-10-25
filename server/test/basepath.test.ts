import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
test('base-path requests are rewritten before routing, including API requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'veladeck-base-'));
  const app = await buildApp(
    loadConfig({ DATA_DIR: directory, PUBLIC_BASE_URL: 'https://host.example/private/dock' }),
  );
  try {
    const r = await app.inject('/private/dock/api/health');
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    expect((await app.inject('/private/dock/api/session')).statusCode).toBe(401);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
