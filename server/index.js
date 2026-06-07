import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 9122;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS || '1122969373')
  .split(',').map(s => s.trim()).filter(Boolean);

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

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.post('/api/auth/validate', (req, res) => {
  const user = verifyInitData(String(req.body?.initData || ''));
  if (user && ALLOWED_USERS.includes(String(user.id))) {
    res.json({ ok: true, user: { id: user.id, first_name: user.first_name } });
  } else {
    res.status(403).json({ ok: false });
  }
});

// ─── Reverse Proxy ────────────────────────────────────────────────────
// Uses Express sub-app so /proxy/hermes AND /proxy/hermes/* both work
for (const [name, upstream] of Object.entries(UPSTREAMS)) {
  const sub = express();

  sub.all('*', (req, res) => {
    const proxyBase = `/proxy/${name}`;
    const targetPath = req.path || '/';  // req.path is relative to mount point
    const queryStr = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
    const fullPath = targetPath + queryStr;

    const options = {
      hostname: upstream.host,
      port: upstream.port,
      path: fullPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${upstream.host}:${upstream.port}`,
        'x-forwarded-for': req.ip,
        'x-tg-user-id': '1122969373',
      },
    };
    delete options.headers['connection'];

    const proxyReq = http.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['transfer-encoding'];

      // Rewrite Location headers for redirects
      if (headers['location']) {
        const loc = headers['location'];
        if (loc.startsWith('/')) {
          headers['location'] = proxyBase + loc;
        }
      }

      const statusCode = proxyRes.statusCode || 200;
      const contentType = String(proxyRes.headers['content-type'] || '');

      if (contentType.includes('text/html')) {
        let body = '';
        proxyRes.setEncoding('utf8');
        proxyRes.on('data', (chunk) => { body += chunk; });
        proxyRes.on('end', () => {
          const baseTag = `<base href="${proxyBase}/">`;
          if (body.includes('<head>')) {
            body = body.replace('<head>', `<head>${baseTag}`);
          }
          delete headers['content-length'];
          res.writeHead(statusCode, { ...headers, 'content-length': Buffer.byteLength(body) });
          res.end(body);
        });
      } else {
        res.writeHead(statusCode, headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      console.error(`[PROXY] ${name} error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: `Upstream ${name} unreachable` });
      }
    });

    req.pipe(proxyReq);
  });

  app.use(`/proxy/${name}`, sub);
}

// ─── WebSocket Upgrade ────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Panel running on :${PORT} (BOT_TOKEN=${BOT_TOKEN ? 'set' : 'MISSING'})`);
});

server.on('upgrade', (req, socket, head) => {
  const match = req.url?.match(/^\/proxy\/(\w+)(\/.*)/);
  if (!match) { socket.destroy(); return; }
  const [, service, subPath] = match;
  const upstream = UPSTREAMS[service];
  if (!upstream) { socket.destroy(); return; }

  const proxyReq = http.request({
    hostname: upstream.host, port: upstream.port,
    path: subPath, method: 'GET',
    headers: { ...req.headers, host: `${upstream.host}:${upstream.port}` },
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

  proxyReq.on('error', () => socket.destroy());
  proxyReq.end();
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
