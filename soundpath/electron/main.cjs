/**
 * Electron 主进程。
 * 启动内部静态服务器（随机端口），再加载应用页面，
 * 以保证 ES Module / fetch / Web Speech API 全部正常工作。
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { createServer } = require('../scripts/serve.cjs');

let mainWindow = null;

async function start() {
  const server = createServer(path.resolve(__dirname, '..'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    title: '声径 SoundPath',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  // 外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
}

app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) start();
});
