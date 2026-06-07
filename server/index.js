import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 9122;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS || '1122969373')
  .split(',').map(s => s.trim()).filter(Boolean);

// Upstream services
const UPSTREAMS = {
  hermes: { host: '127.0.0.1', port: 9119 },
  router: { host: '127.0.0.1', port: 20128 },
  cbm:    { host: '127.0.0.1', port: 8080 },
};

function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = sorted.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed !== hash) return null;
    const userStr = params.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch { return null; }
}

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Validate initData — returns session info
app.post('/api/auth/validate', (req, res) => {
  const { initData } = req.body;
  const user = verifyInitData(String(initData || ''));
  if (user && ALLOWED_USERS.includes(String(user.id))) {
    res.json({ ok: true, user: { id: user.id, first_name: user.first_name } });
  } else {
    res.status(403).json({ ok: false, error: 'Invalid or missing Telegram auth' });
  }
});

// Reverse proxy for upstream services
// Usage: /proxy/hermes/*, /proxy/router/*, /proxy/cbm/*
app.all('/proxy/:service/*', (req, res) => {
  const service = req.params.service;
  const upstream = UPSTREAMS[service];
  if (!upstream) {
    return res.status(404).json({ error: `Unknown service: ${service}` });
  }

  // Extract path after /proxy/{service}/
  const subPath = req.params[0] || '';
  const targetPath = '/' + subPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');

  const options = {
    hostname: upstream.host,
    port: upstream.port,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${upstream.host}:${upstream.port}`,
      'x-forwarded-for': req.ip,
      'x-tg-user-id': '1122969373',
    },
  };

  // Remove hop-by-hop headers
  delete options.headers['connection'];

  const proxyReq = http.request(options, (proxyRes) => {
    // Forward response headers
    const headers = { ...proxyRes.headers };
    delete headers['transfer-encoding']; // let express handle it
    res.writeHead(proxyRes.statusCode || 502, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[PROXY] ${service} error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: `Upstream ${service} unreachable`, detail: err.message });
    }
  });

  // Forward request body
  req.pipe(proxyReq);
});

// WebSocket upgrade for /proxy/* paths
const server = app.listen(PORT, () => {
  console.log(`Kurumi Control Panel running on http://localhost:${PORT} (BOT_TOKEN=${BOT_TOKEN ? 'set' : 'MISSING'})`);
});

server.on('upgrade', (req, socket, head) => {
  const match = req.url?.match(/^\/proxy\/(\w+)\//);
  if (!match) { socket.destroy(); return; }

  const service = match[1];
  const upstream = UPSTREAMS[service];
  if (!upstream) { socket.destroy(); return; }

  const subPath = req.url.replace(`/proxy/${service}`, '');

  const proxyReq = http.request({
    hostname: upstream.host,
    port: upstream.port,
    path: subPath,
    method: 'GET',
    headers: {
      ...req.headers,
      host: `${upstream.host}:${upstream.port}`,
    },
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', (err) => {
    console.error(`[WS PROXY] ${service} error: ${err.message}`);
    socket.destroy();
  });

  proxyReq.end();
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
