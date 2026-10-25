import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const data = await mkdtemp(join(tmpdir(), 'runotter-ui-'));
const token = 'temporary-ui-fixture-only';
const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
  env: {
    ...process.env,
    PORT: '18091',
    PUBLIC_BASE_URL: 'http://localhost:18091',
    DATA_DIR: data,
    INGEST_TOKEN: token,
  },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://localhost:18091/api/health')).ok) break;
    } catch {
      /* wait for the fixture server */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir('docs/screenshots', { recursive: true });
  await page.goto('http://localhost:18091');
  await page.getByRole('button', { name: '连接工作台 →' }).waitFor();
  await page.screenshot({ path: 'docs/screenshots/pairing.png', fullPage: true });
  const pair = await (
    await fetch('http://localhost:18091/api/pair/code', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
    })
  ).json();
  await page.getByLabel('一次性配对码').fill(pair.code);
  await page.getByRole('button', { name: '连接工作台 →' }).click();
  await page.getByText('接住每一次进展。', { exact: true }).waitFor();
  for (const [i, title] of [
    '每周研究摘要 · 演示',
    '构建检查结果 · 演示',
    '一份值得稍后读的报告 · 演示',
  ].entries())
    await fetch('http://localhost:18091/api/artifacts', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({
        project: ['research', 'engineering', 'daily'][i],
        kind: 'markdown',
        title,
        summary: '界面截图专用示例，不包含个人资料。',
        file: '# 示例报告\n\n这是明确标注的界面演示内容。',
        idempotency_key: 'ui:' + i,
      }),
    });
  await page.reload();
  await page.getByText('每周研究摘要 · 演示').waitFor();
  await page.screenshot({ path: 'docs/screenshots/artifacts.png', fullPage: true });
  await page.getByText('每周研究摘要 · 演示').click();
  await page.getByRole('heading', { name: '示例报告' }).waitFor();
  await page.locator('nav').getByRole('link', { name: /审批/ }).click();
  await page.getByText('关键一步，由你决定。').waitFor();
  await page.locator('nav').getByRole('link', { name: /运维/ }).click();
  await page.getByText('一切，心中有数。').waitFor();
  await page.getByText('今日成本与配额').waitFor();
  await page.locator('nav').getByRole('link', { name: /设置/ }).click();
  await page.getByText('通知与专注').waitFor();
  if (errors.length) throw Error('Browser errors: ' + errors.join('\n'));
  console.log(
    'UI QA PASS: mobile pairing, artifact list/detail, approvals, ops and settings; no page errors.',
  );
} finally {
  if (browser) await browser.close();
  child.kill();
  await new Promise((r) => child.once('exit', r));
  await rm(data, { recursive: true, force: true });
}
