import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
try {
  await mkdir('docs/brand', { recursive: true });
  const mark = await readFile('web/public/brand/mark.svg', 'utf8');
  for (const theme of ['light', 'dark']) {
    const dark = theme === 'dark';
    const desktop = (
      await readFile('docs/screenshots/workspace-desktop' + (dark ? '-dark' : '') + '.png')
    ).toString('base64');
    const mobile = (
      await readFile('docs/screenshots/native-workspace-' + (dark ? 'dark' : 'light') + '.png')
    ).toString('base64');
    const page = await browser.newPage({
      viewport: { width: 1600, height: 920 },
      deviceScaleFactor: 1,
    });
    const bg = dark ? '#0b0e14' : '#f5f7fa',
      ink = dark ? '#f2f5fa' : '#1b1d22',
      muted = dark ? '#8f9aaa' : '#767d88',
      surface = dark ? '#161c27' : '#fff',
      line = dark ? '#293241' : '#e2e6ed',
      blue = dark ? '#69adff' : '#006edb';
    await page.setContent(
      `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${ink};width:1600px;height:920px;overflow:hidden;background-image:radial-gradient(${line} .7px,transparent .7px);background-size:24px 24px}.brand{position:absolute;left:88px;top:65px;display:flex;gap:16px;align-items:center;font-size:31px;font-weight:650;letter-spacing:-1.4px}.brand svg{width:57px;height:57px}.brand b{color:${blue}}.eyebrow{position:absolute;left:88px;top:210px;font:11px monospace;letter-spacing:2.5px;color:${muted}}h1{position:absolute;left:82px;top:248px;margin:0;font-size:80px;letter-spacing:-4.8px;line-height:1.08;font-weight:650}h1 span{color:${blue}}.intro{position:absolute;left:88px;top:466px;width:500px;font-size:22px;line-height:1.65;letter-spacing:-.35px;color:${muted}}.tags{position:absolute;left:88px;top:608px;display:flex;gap:9px}.tags span{font:10px monospace;letter-spacing:.8px;border:1px solid ${line};background:${surface};border-radius:7px;padding:10px 12px;color:${muted}}.terminal{position:absolute;left:88px;top:696px;width:483px;border:1px solid ${line};background:${surface};border-radius:14px;padding:21px 22px;font:13px monospace;box-shadow:0 6px 20px #00000003}.terminal i{font-style:normal;color:${blue};margin-right:13px}.terminal small{display:block;margin-top:15px;color:${muted};font:10px monospace;letter-spacing:.3px}.window{position:absolute;left:704px;top:203px;width:810px;height:592px;border:1px solid ${line};border-radius:19px;background:${surface};overflow:hidden;box-shadow:0 24px 80px #00000016;transform:perspective(1600px) rotateY(-5deg) rotateX(1deg)}.chrome{height:34px;border-bottom:1px solid ${line};display:flex;align-items:center;gap:5px;padding:0 14px}.chrome i{width:6px;height:6px;border-radius:50%;background:${line}}.chrome span{font:9px monospace;color:${muted};margin:auto;padding-right:24px}.window img{width:100%;display:block}.phone{position:absolute;left:1236px;top:352px;width:247px;height:540px;background:${surface};padding:6px;border:2px solid ${line};border-radius:36px;box-shadow:0 24px 65px #00000030;overflow:hidden;transform:rotate(3deg)}.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:28px}.phone::before{display:none}.caption{position:absolute;left:716px;top:160px;color:${muted};font:9px monospace;letter-spacing:1.8px}.footer{position:absolute;bottom:42px;left:88px;color:${muted};font:10px monospace;letter-spacing:1px}</style></head><body><div class="brand">${mark}<span>VelaDeck<b>.</b></span></div><p class="eyebrow">YOUR PERSONAL AGENT WORKSPACE</p><h1>Your agents.<br/><span>Within reach.</span></h1><p class="intro">A calmer place for agent outputs,<br/>conversations, and the decisions that matter.</p><div class="tags"><span>SELF-HOSTED</span><span>NATIVE ANDROID</span><span>OPEN SOURCE</span></div><div class="terminal"><i>~</i> npm ci &amp;&amp; npm run build<small>SMALL SURFACE. CLEAR SIGNAL. YOUR CONTROL.</small></div><span class="caption">REAL INTERFACE / SEEDED DEMO CONTENT</span><div class="window"><div class="chrome"><i></i><i></i><i></i><span>veladeck / workspace</span></div><img src="data:image/png;base64,${desktop}"/></div><div class="phone"><img src="data:image/png;base64,${mobile}"/></div><span class="footer">BUILT TO STAY OUT OF YOUR WAY.</span></body></html>`,
    );
    await page.evaluate(() =>
      Promise.all(
        [...document.images].map((i) =>
          i.complete
            ? Promise.resolve()
            : new Promise((r) => {
                i.onload = r;
                i.onerror = r;
              }),
        ),
      ),
    );
    await page.screenshot({ path: 'docs/brand/hero-' + theme + '.png' });
    await page.close();
  }
  console.log('Rendered light and dark README covers from actual application screenshots.');
} finally {
  await browser.close();
}
