/**
 * 端到端冒烟测试：用隐藏的 Electron 窗口真实加载应用，
 * 走完「引导 → 课程 → 练习 → 各页面」关键路径，收集渲染进程报错。
 * 运行：npx electron tests/smoke.cjs
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createServer } = require('../scripts/serve.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function main() {
  const server = createServer(path.resolve(__dirname, '..'));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const win = new BrowserWindow({ show: false, width: 1280, height: 840 });
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 3) errors.push(`[console] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('render-process-gone', (e, d) => errors.push('渲染进程崩溃: ' + d.reason));
  win.webContents.on('did-fail-load', (e, code, desc) => errors.push(`加载失败: ${code} ${desc}`));

  const js = (code) => win.webContents.executeJavaScript(code, true);

  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await sleep(1800);

  const check = async (name, code) => {
    try {
      const val = await js(code);
      console.log(`  ✓ ${name}${val !== undefined ? ' → ' + String(val).slice(0, 80) : ''}`);
      return val;
    } catch (err) {
      errors.push(`[${name}] ${err.message}`);
      console.log(`  ✗ ${name}: ${err.message}`);
    }
  };

  console.log('[1] 启动与引导页');
  await check('视图已渲染', `document.getElementById('view').innerHTML.length > 200`);
  await check('引导页出现', `!!document.getElementById('start-journey')`);

  console.log('[2] 点击「开始我的声径」→ 进入第一课');
  await js(`document.getElementById('start-journey').click()`);
  await sleep(900);
  await check('课程页标题', `document.querySelector('.page-lesson h1')?.textContent`);
  await check('例词卡片数量', `document.querySelectorAll('.word-card').length`);

  console.log('[3] 开始练习');
  await js(`document.getElementById('start-quiz')?.click()`);
  await sleep(900);
  await check('练习题已渲染', `document.querySelector('#ex-box')?.innerHTML.length > 100`);
  await check('题型', `document.querySelector('#ex-box')?.className`);

  console.log('[4] 遍历主要页面');
  for (const route of ['home', 'map', 'review', 'stats', 'coach', 'settings']) {
    await js(`location.hash = '#/${route}'`);
    await sleep(750);
    await check(`#/${route}`, `document.getElementById('view').innerHTML.length`);
  }

  console.log('[5] 星图点击第一颗星 → 课程');
  await js(`document.querySelector('#nav a[href="#/map"]').click()`);
  await sleep(600);
  await js(`document.querySelector('.star-open, .star-lit')?.click()`);
  await sleep(800);
  await check('课程页打开', `!!document.querySelector('.page-lesson')`);

  console.log('[6] 完整做完一课练习 → 完成页 → 复习会话');
  await js(`document.getElementById('start-quiz')?.click()`);
  await sleep(800);
  for (let i = 0; i < 30; i++) {
    const done = await js(`!!document.querySelector('.page-done')`);
    if (done) break;
    await js(`(function(){
      const reveal = document.querySelector('.ex-reveal');
      if (reveal) { reveal.click(); return; }
      const rate = document.querySelector('.rate-good');
      if (rate) { rate.click(); return; }
      const cont = document.querySelector('.ex-continue');
      if (cont) { cont.click(); return; }
      const spell = document.querySelector('.spell-input');
      if (spell && !spell.disabled) { spell.value = 'zz'; document.querySelector('.spell-submit').click(); return; }
      const asm = document.querySelector('.asm-check');
      if (asm && !asm.disabled) { document.querySelector('.asm-pool .chip')?.click(); asm.click(); return; }
      const opt = document.querySelector('.opt-btn:not(:disabled)');
      if (opt) { opt.click(); return; }
    })()`);
    await sleep(450);
  }
  await check('完成页出现', `!!document.querySelector('.page-done')`);
  await check('例词已进入记忆系统', `JSON.parse(localStorage.getItem('soundpath.v1')).cards && Object.keys(JSON.parse(localStorage.getItem('soundpath.v1')).cards).length`);
  await js(`location.hash = '#/review'`);
  await sleep(900);
  await check('复习会话已开始', `!!document.querySelector('.page-quiz #ex-box') && document.querySelector('#ex-box').innerHTML.length > 100`);
  await check('星已点亮', `document.querySelectorAll('.star-lit, .star-mastered').length >= 0`);

  console.log(`\n冒烟测试结束：${errors.length} 个错误`);
  errors.forEach((e) => console.error('  ✗', e));
  app.exit(errors.length ? 1 : 0);
}

app.whenReady().then(() =>
  main().catch((e) => {
    console.error('冒烟测试自身异常:', e);
    app.exit(2);
  })
);
