import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 9122;
const STATIC_DIR = '/var/www/kurumiclaw';

let hermesToken = null;
let tokenFetchedAt = 0;
const TOKEN_TTL = 5 * 60 * 1000; // re-fetch every 5 min

// ─── Fetch & cache Hermes session token ─────────────────────────────
async function fetchHermesToken() {
  try {
    const res = await fetch('http://127.0.0.1:9119/');
    const html = await res.text();
    const m = html.match(/__HERMES_SESSION_TOKEN__="([^"]+)"/);
    if (m) {
      hermesToken = m[1];
      tokenFetchedAt = Date.now();
      console.log(`[TOKEN] Refreshed Hermes session token (expires in ${TOKEN_TTL / 1000}s)`);
    }
  } catch (err) {
    console.error('[TOKEN] Failed to fetch token:', err.message);
  }
}

async function getToken() {
  if (!hermesToken || Date.now() - tokenFetchedAt > TOKEN_TTL) {
    await fetchHermesToken();
  }
  return hermesToken;
}

// ─── Static files ───────────────────────────────────────────────────
app.use(express.static(STATIC_DIR));

// ─── API: /api/health ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

// ─── API: /api/stats ───────────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
  try {
    const token = await getToken();
    if (!token) {
      return res.status(503).json({ error: 'Hermes token unavailable' });
    }

    const hermesRes = await fetch('http://127.0.0.1:9119/api/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!hermesRes.ok) {
      return res.status(hermesRes.status).json({ error: 'Hermes API error' });
    }

    const data = await hermesRes.json();
    const sessions = data.sessions || [];
    const total = data.total ?? sessions.length;
    const active = sessions.filter(s => s.is_active).length;

    // Collect unique models + sum token usage
    const modelSet = new Set();
    let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCost = 0;
    for (const s of sessions) {
      if (s.model) modelSet.add(s.model);
      totalInput += s.input_tokens || 0;
      totalOutput += s.output_tokens || 0;
      totalCacheRead += s.cache_read_tokens || 0;
      totalCost += s.estimated_cost_usd || 0;
    }

    res.json({
      sessions: { total, active },
      models: { count: modelSet.size, list: [...modelSet] },
      tokens: {
        input: totalInput,
        output: totalOutput,
        cache_read: totalCacheRead,
        total: totalInput + totalOutput,
      },
      cost: { estimated_usd: totalCost },
      airdrops: { count: 47 }, // static from airdrop pipeline
      uptime: Math.floor(process.uptime()),
    });
  } catch (err) {
    console.error('[STATS]', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── SPA fallback ──────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────────
await fetchHermesToken();
app.listen(PORT, () => {
  console.log(`Kurumi Claw API running on :${PORT}`);
});
