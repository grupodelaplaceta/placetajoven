'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const API = new Map([
  ['/api/status', require('../api/status')],
  ['/api/planes', require('../api/planes')],
  ['/api/test-login', require('../api/test-login')],
  ['/api/recompensas', require('../api/recompensas')],
  ['/api/alta', require('../api/alta')],
  ['/api/renovar', require('../api/renovar')],
  ['/api/cancelar', require('../api/cancelar')],
  ['/api/verificar', require('../api/verificar')],
  ['/api/keys', require('../api/keys')]
  ,['/api/caminos', require('../api/caminos')]
  ,['/api/cuenta-joven', require('../api/cuenta-joven')]
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = requested === '/' ? '/index.html' : requested;
  const file = path.resolve(PUBLIC, '.' + relative);
  if (!file.startsWith(PUBLIC + path.sep)) return respond(res, 403, 'Forbidden');
  fs.stat(file, (statError, info) => {
    if (statError || !info.isFile()) return respond(res, 404, 'Not found');
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const handler = API.get(pathname);
  if (handler) return handler(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Placeta Joven test server: http://localhost:${PORT}/test-login.html`);
});