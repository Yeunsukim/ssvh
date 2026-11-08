// 내 컴퓨터에서 미리 보기용 작은 서버
// 사용법: node tools/serve.js  →  http://localhost:5178
// index.html은 Artifact로 올릴 때처럼 문서 뼈대(doctype/head/body)로 감싸서 보여 줍니다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 5178;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function wrap(body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${body}</body></html>`;
}

http.createServer((req, res) => {
  // 개발용: 화면에서 모은 글자 목록을 tools/_work/에 저장 (POST /__dump?name=파일이름)
  if (req.method === 'POST' && req.url.startsWith('/__dump')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'dump').replace(/[^\w.-]/g, '_');
    let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => { const dir = path.join(__dirname, '_work'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), body, 'utf8'); res.writeHead(200); res.end('ok'); });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없는 파일입니다'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(p === '/index.html' ? wrap(buf.toString('utf8')) : buf);
  });
}).listen(PORT, () => console.log(`SSV 병원 전산 실습: http://localhost:${PORT}`));
