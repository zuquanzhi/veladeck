import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const data = await mkdtemp(join(tmpdir(), 'veladeck-smoke-'));
const port = 18090;
const ingest = 'smoke-temporary-ingest-only';
const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, INGEST_TOKEN: ingest },
  stdio: 'ignore',
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(r.status, 200);
      assert.equal((await r.json()).ok, true);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert(ready, 'server health never became ready');
  const request = (path: string, method = 'GET', body?: unknown, cookie = '') =>
    fetch(`http://127.0.0.1:${port}` + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        authorization: 'Bearer ' + ingest,
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const pair = (await (await request('/api/pair/code', 'POST')).json()) as { code: string };
  const claim = await request('/api/pair/claim', 'POST', { code: pair.code, device_name: 'Smoke' });
  assert.equal(claim.status, 200);
  const cookie = claim.headers.get('set-cookie')!.split(';')[0];
  assert.equal(
    (await request('/api/pair/claim', 'POST', { code: pair.code, device_name: 'Again' })).status,
    401,
  );
  const payload = {
    project: 'smoke',
    kind: 'markdown',
    title: 'Smoke report',
    file: '# Version one',
    idempotency_key: 'smoke:report',
  };
  const artifact = (await (await request('/api/artifacts', 'POST', payload)).json()) as {
    id: string;
  };
  assert(artifact.id);
  await request('/api/artifacts', 'POST', { ...payload, file: '# Version two' });
  const list = (await (
    await request('/api/artifacts?q=Smoke', 'GET', undefined, cookie)
  ).json()) as { total: number };
  assert.equal(list.total, 1);
  assert.equal(
    (await request('/api/artifacts/' + artifact.id + '/download', 'GET', undefined, cookie)).status,
    200,
  );
  const diff = (await (
    await request('/api/artifacts/' + artifact.id + '/diff?vs=1', 'GET', undefined, cookie)
  ).json()) as { diff: string };
  assert(diff.diff.includes('Version one'));
  assert.equal(
    (await request('/api/artifacts/' + artifact.id + '/star', 'POST', { value: true }, cookie))
      .status,
    200,
  );
  console.log(
    'SMOKE PASS: HTTP health, single-use pairing, artifact ingest/search/download/star/version diff',
  );
} finally {
  child.kill();
  await new Promise((r) => child.once('exit', r));
  await rm(data, { recursive: true, force: true });
}
