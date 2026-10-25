import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
export async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'runotter-test-'));
  const config = loadConfig({
    DATA_DIR: dir,
    INGEST_TOKEN: 'test-ingest-key-only',
    PUBLIC_BASE_URL: 'http://localhost:8090',
  });
  const app = await buildApp(config);
  return {
    app,
    config,
    cleanup: async () => {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    },
    internal: { authorization: 'Bearer ' + config.INGEST_TOKEN },
    pair: async () => {
      const code = await app.inject({
        method: 'POST',
        url: '/api/pair/code',
        headers: { authorization: 'Bearer ' + config.INGEST_TOKEN },
      });
      const claim = await app.inject({
        method: 'POST',
        url: '/api/pair/claim',
        payload: { code: code.json().code, device_name: 'Test browser' },
      });
      return String(claim.headers['set-cookie']).split(';')[0];
    },
  };
}
