// Load .env (Node 20.12+/24 has native support; fall back to a tiny parser)
try { process.loadEnvFile && process.loadEnvFile(__dirname + '/.env'); }
catch (e) { require('fs').existsSync(__dirname + '/.env') && loadEnvManual(); }
function loadEnvManual() {
  const fs = require('fs');
  fs.readFileSync(__dirname + '/.env', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const ai = require('./ai');

const app = express();
const PORT = process.env.PORT || 8090;

app.use(cors({ origin: ['http://localhost:9080', 'http://localhost:8090'] }));
app.use(express.json({ limit: '50mb' }));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DataLens API', port: PORT, aiEnabled: ai.aiEnabled(), model: ai.MODEL });
});

// ── AI: dataset summary ───────────────────────────────────────────────────────
app.post('/api/ai/summarize', async (req, res) => {
  if (!ai.aiEnabled()) return res.status(503).json({ error: 'AI not configured' });
  try {
    const result = await ai.summarize(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AI: ask a question about the data ──────────────────────────────────────────
app.post('/api/ai/ask', async (req, res) => {
  if (!ai.aiEnabled()) return res.status(503).json({ error: 'AI not configured' });
  try {
    const result = await ai.ask(req.body || {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Saved dashboards (SQLite) ───────────────────────────────────────────────────
app.get('/api/dashboards', (req, res) => {
  res.json(db.prepare('SELECT id, name, created_at, updated_at FROM dashboards ORDER BY updated_at DESC').all());
});
app.get('/api/dashboards/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, state: JSON.parse(row.state) });
});
app.post('/api/dashboards', (req, res) => {
  const { name, state } = req.body;
  if (!name || !state) return res.status(400).json({ error: 'name and state required' });
  const existing = db.prepare('SELECT id FROM dashboards WHERE name = ?').get(name);
  if (existing) {
    db.prepare('UPDATE dashboards SET state = ?, updated_at = datetime("now") WHERE id = ?').run(JSON.stringify(state), existing.id);
    res.json({ id: existing.id, name, updated: true });
  } else {
    const info = db.prepare('INSERT INTO dashboards (name, state) VALUES (?, ?)').run(name, JSON.stringify(state));
    res.json({ id: info.lastInsertRowid, name, created: true });
  }
});
app.delete('/api/dashboards/:id', (req, res) => {
  db.prepare('DELETE FROM dashboards WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// ── Serve built frontend (single Docker image) ──────────────────────────────────
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (require('fs').existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`DataLens API on http://localhost:${PORT}  ·  AI ${ai.aiEnabled() ? 'enabled (' + ai.MODEL + ')' : 'disabled'}`);
});
