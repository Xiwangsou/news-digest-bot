import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';

export const articlesRouter = Router();

const VALID_ORDERS = ['score', 'fetched_at', 'upvotes', 'comments_count', 'published_at', 'id'];

// Clamps user input so a bad query string can never break the SQL.
const toInt = (v, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const toBool = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (v === true || v === 'true' || v === '1' || v === 1) return 1;
  if (v === false || v === 'false' || v === '0' || v === 0) return 0;
  return null;
};

// Builds the shared WHERE clause + params for the list and count queries.
function buildFilter(query, { alias = 'a' } = {}) {
  const a = alias;
  const where = [];
  const params = [];

  const source = query.source;
  if (source && source !== 'all') { where.push(`${a}.source = ?`); params.push(String(source)); }

  const digestId = toInt(query.digest_id, null);
  if (digestId) { where.push(`${a}.id IN (SELECT article_id FROM digest_articles WHERE digest_id = ?)`); params.push(digestId); }

  const starred = toBool(query.starred);
  if (starred !== null) { where.push(`${a}.starred = ?`); params.push(starred); }

  const read = toBool(query.read);
  if (read !== null) { where.push(`${a}.read = ?`); params.push(read); }

  const tag = query.tag;
  if (tag) { where.push("(',' || COALESCE(" + a + ".tags,'') || ',') LIKE ?"); params.push(`%,${tag},%`); }

  // Restrict to a time window, e.g. today / 7d / 30d.
  const range = String(query.range || '').toLowerCase();
  const days = { today: 1, '3d': 3, '7d': 7, '30d': 30, '90d': 90 }[range];
  if (days) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    where.push(`${a}.fetched_at >= ?`);
    params.push(since);
  }

  const q = String(query.q || '').trim();
  if (q) {
    where.push(`(${a}.title LIKE ? OR ${a}.description LIKE ?)`);
    const like = `%${q.replace(/[%_]/g, m => `\\${m}`)}%`;
    params.push(like, like);
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

articlesRouter.get('/', (req, res) => {
  const { source, digest_id, starred, read, q, tag } = req.query;
  const limit = toInt(req.query.limit, 50, { min: 1, max: 200 });
  const offset = toInt(req.query.offset, 0, { min: 0 });
  const order = VALID_ORDERS.includes(req.query.order) ? req.query.order : 'score';

  const { clause, params } = buildFilter({ source, digest_id, starred, read, q, tag });

  const articles = queryAll(
    `SELECT a.* FROM articles a ${clause} ORDER BY a.${order} DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { total } = queryOne(`SELECT COUNT(*) AS total FROM articles a ${clause}`, params) || { total: 0 };

  res.json({ articles, total, limit, offset });
});

// NOTE: literal sub-paths must be declared before any '/:id' style route.
articlesRouter.get('/sources', (req, res) => {
  const counts = queryAll(`
    SELECT source, source_label, COUNT(*) AS count, MAX(fetched_at) AS latest
    FROM articles GROUP BY source ORDER BY count DESC
  `);
  res.json(counts);
});

articlesRouter.get('/tags', (req, res) => {
  const rows = queryAll(`SELECT tags FROM articles WHERE tags IS NOT NULL AND tags != ''`);
  const freq = {};
  for (const r of rows) {
    for (const t of String(r.tags).split(',')) {
      if (!t) continue;
      freq[t] = (freq[t] || 0) + 1;
    }
  }
  const tags = Object.entries(freq)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  res.json(tags);
});

// Cross-digest search: the Today view only holds one issue's articles, so a
// query there cannot reach yesterday's. This searches the whole archive.
articlesRouter.get('/search', (req, res) => {
  const { clause, params } = buildFilter(req.query);
  const limit = toInt(req.query.limit, 50, { min: 1, max: 200 });
  const offset = toInt(req.query.offset, 0, { min: 0 });
  const order = VALID_ORDERS.includes(req.query.order) ? req.query.order : 'score';

  const articles = queryAll(
    `SELECT a.* FROM articles a ${clause} ORDER BY a.${order} DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const { total } = queryOne(`SELECT COUNT(*) AS total FROM articles a ${clause}`, params) || { total: 0 };
  res.json({ articles, total, limit, offset });
});

articlesRouter.get('/bookmarks/all', (req, res) => {
  const limit = toInt(req.query.limit, 100, { min: 1, max: 500 });
  const offset = toInt(req.query.offset, 0, { min: 0 });
  const articles = queryAll(
    'SELECT * FROM articles WHERE starred = 1 ORDER BY score DESC, id DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const { total } = queryOne('SELECT COUNT(*) AS total FROM articles WHERE starred = 1') || { total: 0 };
  res.json({ articles, total });
});

articlesRouter.get('/:id', (req, res) => {
  const article = queryOne('SELECT * FROM articles WHERE id = ?', [toInt(req.params.id, 0)]);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

// Bulk actions — declared before the '/:id/...' routes so the literal path
// always wins. Used by "mark all read" and similar list-level controls.
articlesRouter.post('/bulk', (req, res) => {
  const { action, ids, digest_id, source } = req.body || {};
  if (!['read', 'unread', 'star', 'unstar'].includes(action)) {
    return res.status(400).json({ error: 'action must be one of read, unread, star, unstar' });
  }

  const flag = action === 'read' || action === 'star' ? 1 : 0;
  const column = action === 'read' || action === 'unread' ? 'read' : 'starred';
  const list = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger).slice(0, 1000) : [];

  let result;
  if (list.length) {
    const holes = list.map(() => '?').join(',');
    result = run(`UPDATE articles SET ${column} = ? WHERE id IN (${holes})`, [flag, ...list]);
  } else if (digest_id) {
    result = run(
      `UPDATE articles SET ${column} = ? WHERE id IN (SELECT article_id FROM digest_articles WHERE digest_id = ?)`,
      [flag, toInt(digest_id, 0)]
    );
  } else if (source) {
    result = run(`UPDATE articles SET ${column} = ? WHERE source = ?`, [flag, String(source)]);
  } else {
    return res.status(400).json({ error: 'Provide ids, digest_id or source' });
  }

  res.json({ success: true, action, changed: result.changes });
});

// Star / unstar
articlesRouter.post('/:id/star', (req, res) => {
  const id = toInt(req.params.id, 0);
  const star = req.body?.star === false ? 0 : 1;
  const result = run('UPDATE articles SET starred = ? WHERE id = ?', [star, id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Article not found' });
  res.json({ success: true, article: queryOne('SELECT * FROM articles WHERE id = ?', [id]) });
});

// Mark read / unread
articlesRouter.post('/:id/read', (req, res) => {
  const id = toInt(req.params.id, 0);
  const read = req.body?.read === false ? 0 : 1;
  const result = run('UPDATE articles SET read = ? WHERE id = ?', [read, id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Article not found' });
  res.json({ success: true, article: queryOne('SELECT * FROM articles WHERE id = ?', [id]) });
});
