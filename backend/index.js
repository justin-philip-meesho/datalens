const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 8090;

app.use(cors({ origin: 'http://localhost:9080' }));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DataLens API', port: PORT });
});

// List all saved dashboards
app.get('/api/dashboards', (req, res) => {
  const rows = db.prepare('SELECT id, name, created_at, updated_at FROM dashboards ORDER BY updated_at DESC').all();
  res.json(rows);
});

// Get a saved dashboard by id
app.get('/api/dashboards/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, state: JSON.parse(row.state) });
});

// Save / upsert a dashboard
app.post('/api/dashboards', (req, res) => {
  const { name, state } = req.body;
  if (!name || !state) return res.status(400).json({ error: 'name and state required' });
  const existing = db.prepare('SELECT id FROM dashboards WHERE name = ?').get(name);
  if (existing) {
    db.prepare('UPDATE dashboards SET state = ?, updated_at = datetime("now") WHERE id = ?')
      .run(JSON.stringify(state), existing.id);
    res.json({ id: existing.id, name, updated: true });
  } else {
    const info = db.prepare('INSERT INTO dashboards (name, state) VALUES (?, ?)').run(name, JSON.stringify(state));
    res.json({ id: info.lastInsertRowid, name, created: true });
  }
});

// Delete a dashboard
app.delete('/api/dashboards/:id', (req, res) => {
  db.prepare('DELETE FROM dashboards WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

app.listen(PORT, () => {
  console.log(`DataLens API running on http://localhost:${PORT}`);
});
