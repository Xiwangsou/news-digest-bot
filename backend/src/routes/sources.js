import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';

export const sourcesRouter = Router();

// Latest fetch outcome per source, so the UI can flag dead feeds.
function attachHealth(sources) {
  if (!sources.length) return sources;
  const latest = queryAll(`
    SELECT f.source, f.ok, f.count, f.error, f.ran_at, f.duration_ms
    FROM fetch_log f
    JOIN (SELECT source, MAX(id) AS max_id FROM fetch_log GROUP BY source) m
      ON m.max_id = f.id
  `);
  const bySource = Object.fromEntries(latest.map(l => [l.source, l]));
  return sources.map(s => {
    const h = bySource[s.key];
    const stats = queryOne('SELECT COUNT(*) AS total, MAX(fetched_at) AS latest FROM articles WHERE source = ?', [s.key]) || {};
    return {
      ...s,
      enabled: !!s.enabled,
      articleCount: stats.total || 0,
      latestFetch: stats.latest || null,
      lastRun: h ? { ok: !!h.ok, count: h.count, error: h.error, ranAt: h.ran_at, duration_ms: h.duration_ms } : null
    };
  });
}

sourcesRouter.get('/', (req, res) => {
  const sources = queryAll('SELECT * FROM sources ORDER BY id');
  res.json(attachHealth(sources));
});

// Aggregated health for the dashboard.
sourcesRouter.get('/health', (req, res) => {
  const rows = queryAll(`
    SELECT f.source, f.label, f.ok, f.count, f.error, f.ran_at, f.duration_ms
    FROM fetch_log f
    JOIN (SELECT source, MAX(id) AS max_id FROM fetch_log GROUP BY source) m
      ON m.max_id = f.id
    ORDER BY f.ok ASC, f.source ASC
  `);
  const healthy = rows.filter(r => r.ok).length;
  res.json({ feeds: rows, healthy, total: rows.length });
});

sourcesRouter.put('/:key', (req, res) => {
  const { enabled, weight, color, label } = req.body || {};
  const updates = [];
  const params = [];

  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (weight !== undefined) {
    const w = Number(weight);
    if (Number.isNaN(w) || w < 0.1 || w > 2) {
      return res.status(400).json({ error: 'weight must be a number between 0.1 and 2.0' });
    }
    updates.push('weight = ?'); params.push(w);
  }
  if (color !== undefined) {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(String(color))) {
      return res.status(400).json({ error: 'color must be a hex value' });
    }
    updates.push('color = ?'); params.push(String(color));
  }
  if (label !== undefined) {
    if (!String(label).trim()) return res.status(400).json({ error: 'label cannot be empty' });
    updates.push('label = ?'); params.push(String(label).trim());
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const existing = queryOne('SELECT * FROM sources WHERE key = ?', [req.params.key]);
  if (!existing) return res.status(404).json({ error: 'Source not found' });

  params.push(req.params.key);
  run(`UPDATE sources SET ${updates.join(', ')} WHERE key = ?`, params);
  res.json({ success: true, source: queryOne('SELECT * FROM sources WHERE key = ?', [req.params.key]) });
});

sourcesRouter.post('/', (req, res) => {
  const { key, label, color, weight, config } = req.body || {};
  if (!key || !label) return res.status(400).json({ error: 'key and label required' });
  if (!/^[a-z0-9_-]+$/i.test(String(key))) {
    return res.status(400).json({ error: 'key may only contain letters, numbers, - and _' });
  }
  if (!/^#[0-9a-fA-F]{3,8}$/.test(String(color || '#6366f1'))) {
    return res.status(400).json({ error: 'color must be a hex value' });
  }
  const existing = queryOne('SELECT id FROM sources WHERE key = ?', [key]);
  if (existing) return res.status(409).json({ error: 'Source key already exists' });

  run('INSERT INTO sources (key, label, enabled, weight, color, config) VALUES (?, ?, 1, ?, ?, ?)',
    [key, label, Number(weight) || 1.0, color || '#6366f1', config || '{}']);
  res.status(201).json({ success: true, source: queryOne('SELECT * FROM sources WHERE key = ?', [key]) });
});

sourcesRouter.delete('/:key', (req, res) => {
  const existing = queryOne('SELECT * FROM sources WHERE key = ?', [req.params.key]);
  if (!existing) return res.status(404).json({ error: 'Source not found' });
  run('DELETE FROM sources WHERE key = ?', [req.params.key]);
  res.json({ success: true });
});
