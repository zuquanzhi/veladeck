import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const data = await mkdtemp(join(tmpdir(), 'veladeck-visual-'));
const origin = 'http://localhost:18091';
const token = 'visual-fixture-ingress-only';
const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
  env: {
    ...process.env,
    PORT: '18091',
    PUBLIC_BASE_URL: origin,
    DATA_DIR: data,
    INGEST_TOKEN: token,
    DEEPSEEK_API_KEY: '',
    EMAIL_NOTIFY_BIN: '',
    WECHAT_NOTIFY_BIN: '',
  },
  stdio: 'ignore',
});
async function capture(page, options) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.screenshot({ animations: 'disabled', ...options });
}
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break;
    } catch {
      /* The fixture is still starting. */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_BIN ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  await mkdir('docs/screenshots', { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByRole('button', { name: '连接工作台', exact: true }).waitFor();
  await capture(page, { path: 'docs/screenshots/pairing.png', fullPage: true });
  const pair = await (
    await fetch(origin + '/api/pair/code', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
    })
  ).json();
  await page.getByLabel('一次性配对码').fill(pair.code);
  await page.getByRole('button', { name: '连接工作台', exact: true }).click();
  await page.getByRole('heading', { name: '工作台.' }).waitFor();
  const examples = [
    ['每周研究摘要', 'research', 'markdown', '把零散的线索，整理成下一步行动。'],
    ['API 集成与验收报告', 'engineering', 'markdown', '接口契约、验证结果与待跟进事项。'],
    ['阅读清单 · 本周精选', 'reading', 'html', '值得保存的文章，留给专注的时刻。'],
    ['构建检查日志', 'engineering', 'log', '一份完整的编译与检查过程记录。'],
    ['项目交付清单', 'planning', 'csv', '从第一条任务，到最后一个确认。'],
    ['工作流配置快照', 'automation', 'json', '记录当前的规则与任务安排。'],
  ];
  const ids = [];
  for (const [i, [title, project, kind, summary]] of examples.entries()) {
    const file =
      kind === 'html'
        ? '<h1>阅读清单</h1><p>用于界面演示的示例内容。</p>'
        : kind === 'csv'
          ? 'item,status\nDesign,review\nBuild,ready'
          : kind === 'json'
            ? '{"demo":true,"workflow":"personal"}'
            : '# 示例报告\n\n这份内容仅用于界面演示，不包含个人资料。\n\n- 清晰的成果\n- 可追踪的下一步';
    const result = await (
      await fetch(origin + '/api/artifacts', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({
          project,
          kind,
          title,
          summary,
          file,
          idempotency_key: 'visual:' + i,
        }),
      })
    ).json();
    ids.push(result.id);
  }
  const cookie = (await context.cookies()).map((c) => c.name + '=' + c.value).join('; ');
  await fetch(origin + '/api/artifacts/' + ids[0] + '/star', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ value: true }),
  });
  for (const content of ['整理下一份研究报告 · 演示', '阅读一篇值得保存的文章 · 演示'])
    await fetch(origin + '/api/inbox', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'text', content }),
    });
  await page.reload();
  await page.getByRole('heading', { name: '每周研究摘要', exact: true }).waitFor();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Mobile layout overflows',
  );
  await capture(page, { path: 'docs/screenshots/workspace-mobile.png' });
  await capture(page, { path: 'docs/screenshots/artifacts.png', fullPage: true });
  await page.getByRole('button', { name: '星标', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.artifact').length === 1);
  assert.equal(await page.locator('.artifact').count(), 1);
  await page.getByRole('button', { name: '全部文件' }).click();
  await page.getByRole('heading', { name: '每周研究摘要', exact: true }).click();
  await page.getByRole('heading', { name: '示例报告' }).waitFor();
  for (const [name, title] of [
    ['对话', '对话.'],
    ['审批', '审批.'],
    ['运维', '运行概览.'],
    ['设置', '设置.'],
  ]) {
    await page.getByRole('navigation', { name: '手机主导航' }).getByRole('link', { name }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
  }
  await page.getByLabel('主题', { exact: true }).selectOption('dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await capture(page, { path: 'docs/screenshots/settings-dark.png', fullPage: true });
  await page
    .getByRole('navigation', { name: '手机主导航' })
    .getByRole('link', { name: '产物', exact: true })
    .click();
  await page.getByRole('heading', { name: '每周研究摘要', exact: true }).waitFor();
  await page.waitForURL(origin + '/');
  await page.waitForFunction(
    () => document.querySelector('.mobile-nav a.active')?.getAttribute('href') === '/',
  );
  await capture(page, { path: 'docs/screenshots/workspace-mobile-dark.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    '375px layout overflows',
  );
  await page
    .getByRole('navigation', { name: '手机主导航' })
    .getByRole('link', { name: '设置', exact: true })
    .click();
  await page.getByLabel('主题', { exact: true }).selectOption('light');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  await desktop.addCookies(await context.cookies());
  const screen = await desktop.newPage();
  screen.on('pageerror', (e) => errors.push(e.message));
  await screen.goto(origin);
  await screen.getByRole('heading', { name: '每周研究摘要', exact: true }).waitFor();
  await capture(screen, { path: 'docs/screenshots/workspace-desktop.png' });
  await screen.getByRole('button', { name: '列表视图', exact: true }).click();
  assert(
    await screen.locator('.artifact-grid').evaluate((el) => el.classList.contains('list-view')),
  );
  await screen.getByRole('button', { name: '卡片视图', exact: true }).click();
  await screen.keyboard.press('Control+k');
  await screen.waitForFunction(
    () => document.activeElement === document.querySelector('[data-global-search]'),
  );
  assert(
    await screen
      .getByRole('textbox', { name: '搜索产物', exact: true })
      .evaluate((el) => document.activeElement === el),
  );
  await screen.getByRole('textbox', { name: '搜索产物', exact: true }).fill('API');
  await screen.waitForFunction(() => document.querySelectorAll('.artifact').length === 1);
  await screen.getByRole('textbox', { name: '搜索产物', exact: true }).fill('');
  await screen.getByRole('heading', { name: '每周研究摘要', exact: true }).waitFor();
  await screen
    .getByRole('navigation', { name: '桌面主导航' })
    .getByRole('link', { name: /设置/ })
    .click();
  await screen.getByLabel('主题', { exact: true }).selectOption('dark');
  await screen.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await screen
    .getByRole('navigation', { name: '桌面主导航' })
    .getByRole('link', { name: /产物/ })
    .click();
  await screen.getByRole('heading', { name: '每周研究摘要', exact: true }).waitFor();
  await capture(screen, { path: 'docs/screenshots/workspace-desktop-dark.png' });
  const unpaired = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const pairing = await unpaired.newPage();
  await pairing.goto(origin);
  await pairing.getByRole('button', { name: '连接工作台', exact: true }).waitFor();
  await capture(pairing, { path: 'docs/screenshots/pairing-desktop.png' });
  const iconPage = await browser.newPage();
  const mark = await readFile('web/public/brand/mark.svg', 'utf8');
  for (const size of [192, 512]) {
    await iconPage.setViewportSize({ width: size, height: size });
    await iconPage.setContent(
      '<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' +
        mark,
    );
    await iconPage.screenshot({ path: 'web/public/icon-' + size + '.png', omitBackground: true });
  }
  const ribbon = mark.match(/<path\b[^>]*\/>/g).join('');
  await iconPage.setViewportSize({ width: 512, height: 512 });
  await iconPage.setContent(
    '<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111318"/><g transform="translate(8 8) scale(.75)">' +
      ribbon +
      '</g></svg>',
  );
  await iconPage.screenshot({ path: 'web/public/icon-maskable-512.png' });
  if (errors.length) throw Error('Browser errors: ' + errors.join('\n'));
  await writeFile(
    '.tools/visual-qa.json',
    JSON.stringify(
      {
        status: 'passed',
        mobile: [375, 390],
        desktop: 1440,
        themes: ['light', 'dark'],
        checks: [
          'pairing',
          'navigation',
          'artifact detail',
          'star filter',
          'list/grid',
          'keyboard search',
          'theme persistence',
          'no horizontal overflow',
        ],
        page_errors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'VISUAL QA PASS: 375/390px mobile, 1440px desktop, both themes, pairing, filters, detail, navigation and keyboard search.',
  );
} finally {
  if (browser) await browser.close();
  child.kill();
  await new Promise((r) => child.once('exit', r));
  await rm(data, { recursive: true, force: true });
}
