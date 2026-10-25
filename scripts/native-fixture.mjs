import { buildApp } from '../server/src/app.ts';
import { loadConfig } from '../server/src/config.ts';
import { Store } from '../server/src/db/client.ts';
import { Settings } from '../server/src/services/settings.ts';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';

// Disposable, synthetic-only integration server. Credentials and response bodies are never logged.
await mkdir('.tools/native-fixture-data', { recursive: true });
const config = loadConfig({
  ...process.env,
  PORT: '18091',
  DATA_DIR: resolve('.tools/native-fixture-data'),
  PUBLIC_BASE_URL: 'https://10.0.2.2:18443/dock',
  INGEST_TOKEN: randomBytes(32).toString('hex'),
  DSH_CMD: process.execPath,
  DSH_ARGS: JSON.stringify([resolve('scripts/native-fixture-agent.mjs')]),
  DEEPSEEK_API_KEY: '',
  EMAIL_NOTIFY_BIN: '',
  WECHAT_NOTIFY_BIN: '',
  ARTIFACT_SCAN_DIRS: '',
});
const app = await buildApp(config);
const store = new Store(config.DATA_DIR);
new Settings(store).set(
  {
    theme: 'light',
    dnd_start: '00:00',
    dnd_end: '00:00',
    notifications: true,
    lockscreen_hide: true,
  },
  'synthetic-fixture',
);
const audit = [];
app.server.on('request', (request) => {
  if (String(request.headers['user-agent']).startsWith('VelaDeckNative/'))
    audit.push({
      method: request.method,
      path: request.url.split('?')[0].replace(/^\/dock(?=\/api\/)/, ''),
    });
});
const internal = { authorization: 'Bearer ' + config.INGEST_TOKEN };
const samples = [
  [
    '每周研究摘要 · 演示',
    'research',
    'markdown',
    '# 每周研究摘要\n\n这是一份合成测试报告，不含个人资料。\n\n- 审阅进展\n- 确认下一步',
  ],
  ['工作流配置快照 · 演示', 'automation', 'json', '{"synthetic":true,"workflow":"native-client"}'],
  ['项目交付清单 · 演示', 'planning', 'csv', 'item,status\nDesign,ready\nNative,testing'],
  [
    '阅读清单 · 演示',
    'reading',
    'html',
    '<h1>阅读清单</h1><p>这份示例用 Android 原生文本视图显示。</p>',
  ],
  [
    '构建记录 · 演示',
    'engineering',
    'log',
    'Synthetic native build log\nNo production account was used.',
  ],
  [
    'API 集成报告 · 演示',
    'engineering',
    'markdown',
    '# API 集成报告\n\n原生界面直接访问 HTTPS JSON 与 SSE API。\n\n这是合成验收内容。',
  ],
];
for (const [i, [title, project, kind, file]] of samples.entries()) {
  const result = await app.inject({
    method: 'POST',
    url: '/api/artifacts',
    headers: internal,
    payload: {
      title,
      project,
      kind,
      file,
      summary: '用于原生界面与真实 API 验收的合成内容。',
      idempotency_key: 'native-qa:' + i,
    },
  });
  if (result.statusCode !== 200) throw Error('Fixture artifact setup failed');
}
await writeFile('.tools/native-fixture.json', JSON.stringify({ server: config.PUBLIC_BASE_URL }), {
  mode: 0o600,
});
await app.listen({ host: '127.0.0.1', port: 18091 });
const control = createServer(async (request, response) => {
  if (request.url === '/pair') {
    const code = await app.inject({ method: 'POST', url: '/api/pair/code', headers: internal });
    response.setHeader('Content-Type', 'application/json');
    response.end(code.body);
  } else if (request.url === '/notify') {
    await app.inject({
      method: 'POST',
      url: '/api/notify',
      headers: internal,
      payload: {
        type: 'native.fixture',
        priority: 'P1',
        title: '原生通知 · 演示',
        body: 'Synthetic notification.',
        deep_link: '/ops',
        idempotency_key: 'native-notify:' + Date.now(),
      },
    });
    response.end('ok');
  } else if (request.url === '/state') {
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        audit,
        starred: store.get('SELECT count(*) AS n FROM artifacts WHERE starred=1').n,
        inbox: store.all('SELECT content,status FROM inbox_items'),
        approvals: store.all('SELECT status FROM approvals'),
        devices: store.all('SELECT name,revoked_at FROM devices'),
        settings: new Settings(store).get(),
      }),
    );
  } else {
    response.statusCode = 404;
    response.end();
  }
});
control.listen(18092, '127.0.0.1');
console.log('Synthetic native API fixture ready.');
const stop = async () => {
  control.close();
  await app.close();
  store.close();
  process.exit(0);
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
