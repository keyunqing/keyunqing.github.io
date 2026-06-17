/**
 * 极简静态文件服务器。
 * 同时被两处使用：
 *  1. `npm run web` —— 浏览器开发预览
 *  2. electron/main.cjs —— 桌面端内部服务（绕开 file:// 下 ES Module 与 fetch 的限制）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * 创建静态服务器
 * @param {string} rootDir 站点根目录
 * @returns {http.Server}
 */
function createServer(rootDir) {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(rootDir, path.normalize(urlPath));

    // 防止目录穿越
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not Found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
}

module.exports = { createServer };

// CLI 模式：node scripts/serve.cjs [port]
if (require.main === module) {
  const port = Number(process.argv[2]) || 5173;
  const root = path.resolve(__dirname, '..');
  createServer(root).listen(port, () => {
    console.log(`声径 SoundPath 运行中: http://localhost:${port}`);
  });
}
