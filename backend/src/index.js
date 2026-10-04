import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB, queryAll, queryOne, run, saveDB, transaction } from './db.js';
import { scrapers } from './scrapers/index.js';
import { calculateScore, cleanDescription, deduplicate, extractKeywords, getTags, selectDiverse } from './scoring.js';
import { articlesRouter } from './routes/articles.js';
import { digestsRouter } from './routes/digests.js';
import { sourcesRouter } from './routes/sources.js';
import { settingsRouter } from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');

const app = express();
const PORT = process.env.PORT || 3210;

// Single source of truth for defaults; the settings route imports this too.
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  digestHour: '8',
  articlesPerDigest: '50',
  autoFetchOnGenerate: 'true',
  retentionDays: '90',
  maxSharePerSource: '0.34'
};

// Fetch guards. node-fetch v3 ignores `timeout`, so every layer needs its own
// budget or one unresponsive feed hangs the pipeline indefinitely.
const PER_SOURCE_TIMEOUT = 25000;
const TOTAL_FETCH_TIMEOUT = 180000;

/** Rejects with `message` if `promise` has not settled within `ms`. */
function withTimeout(promise, ms, message) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

app.use(cors());
app.use(express.json());

// Tag rules live with the rest of the scoring logic.
const TAG_LABELS = {
  ai: 'AI',
  frontend: '前端',
  backend: '后端',
  'open-source': '开源',
  startup: '创业',
  tool: '工具'
};

initDB().then(() => {
  console.log('[DB] SQLite initialized');

  app.use('/api/articles', articlesRouter);
  app.use('/api/digests', digestsRouter);
  app.use('/api/sources', sourcesRouter);
  // Re-arm the cron as soon as the digest hour changes, instead of making the
  // user restart the server for a setting that looks live.
  settingsRouter.setOnChange((changed) => {
    if (Object.prototype.hasOwnProperty.call(changed, 'digestHour') && scheduleDailyDigest) {
      scheduleDailyDigest();
    }
  });
  app.use('/api/settings', settingsRouter);
  app.get('/api/health', (req, res) => {
    const articleCount = queryOne('SELECT COUNT(*) AS c FROM articles')?.c || 0;
    const sourceCount = queryOne('SELECT COUNT(*) AS c FROM sources')?.c || 0;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      articles: articleCount,
      sources: sourceCount
    });
  });

  app.get('/api/meta', (req, res) => {
    const total = queryOne('SELECT COUNT(*) AS c FROM articles')?.c || 0;
    const starred = queryOne('SELECT COUNT(*) AS c FROM articles WHERE starred = 1')?.c || 0;
    const digests = queryOne('SELECT COUNT(*) AS c FROM digests')?.c || 0;
    const latest = queryOne('SELECT * FROM digests ORDER BY id DESC LIMIT 1');
    let keywords = [];
    if (latest?.keywords) {
      try { keywords = JSON.parse(latest.keywords); } catch { keywords = []; }
    }
    res.json({
      totalArticles: total,
      starred,
      digestCount: digests,
      latestDigest: latest || null,
      keywords,
      tagLabels: TAG_LABELS,
      serverTime: new Date().toISOString()
    });
  });

  // ---- Fetch pipeline ---------------------------------------------------
  // Runs sources in bounded parallel batches. Sequential fetching of 14
  // sources took ~30s; this keeps it well under a browser's patience.
  async function fetchAllSources({ only } = {}) {
    const sources = queryAll('SELECT * FROM sources WHERE enabled = 1');
    const targets = only ? sources.filter(s => only.includes(s.key)) : sources;
    const allArticles = [];
    const errors = [];
    const health = [];
    const startedAt = Date.now();

    const CONCURRENCY = 5;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (source) => {
          const scraper = scrapers[source.key];
          if (!scraper) throw new Error(`未注册抓取器："${source.key}"`);
          const t0 = Date.now();
          // Hard per-source budget. A feed that never responds must not be
          // able to stall the entire run.
          const articles = await withTimeout(
            scraper(),
            PER_SOURCE_TIMEOUT,
            `${source.label} 抓取超时（>${PER_SOURCE_TIMEOUT / 1000}s）`
          );
          return { source, articles, duration: Date.now() - t0 };
        })
      );

      results.forEach((res, idx) => {
        const source = batch[idx];
        if (res.status === 'fulfilled') {
          const { articles, duration } = res.value;
          health.push({ source: source.key, label: source.label, ok: true, count: articles.length, duration_ms: duration });
          console.log(`[Fetch] ${source.label}: ${articles.length} articles (${duration}ms)`);
          for (const a of articles) {
            if (!a || !a.url || !a.title) continue;
            a.score = calculateScore(a, source.weight);
            // Never repeat the headline as its own summary.
            a.description = cleanDescription(a.description, a.title);
            const tags = getTags(`${a.title} ${a.description || ''}`);
            a.tags = tags.join(',');
            a.source = source.key;
            a.source_label = source.label;
            allArticles.push(a);
          }
        } else {
          const message = res.reason?.message || String(res.reason);
          errors.push({ source: source.key, label: source.label, error: message });
          health.push({ source: source.key, label: source.label, ok: false, count: 0, error: message });
          console.error(`[Fetch] ${source.label} failed: ${message}`);
        }
      });
    }

    const unique = deduplicate(allArticles);
    console.log(`[Fetch] Total: ${allArticles.length} -> ${unique.length} after dedup`);

    let inserted = 0;
    let refreshed = 0;
    transaction(() => {
      for (const a of unique) {
        const existing = queryOne('SELECT id FROM articles WHERE url = ?', [a.url]);
        if (existing) {
          // Keep engagement metrics and score fresh for known articles.
          run(
            `UPDATE articles SET score = ?, upvotes = ?, comments_count = ?, description = COALESCE(NULLIF(?, ''), description), tags = COALESCE(NULLIF(?, ''), tags) WHERE id = ?`,
            [a.score, a.upvotes || 0, a.comments_count || 0, a.description || '', a.tags || '', existing.id]
          );
          refreshed++;
          continue;
        }
        run(
          `INSERT INTO articles (source, source_label, title, url, description, score, comments_count, upvotes, published_at, fetched_at, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [a.source, a.source_label, a.title, a.url, a.description || '', a.score, a.comments_count || 0, a.upvotes || 0, a.published_at || a.fetched_at, a.fetched_at, a.tags || null]
        );
        inserted++;
      }

      const ranAt = new Date().toISOString();
      for (const h of health) {
        run(
          `INSERT INTO fetch_log (source, label, ok, count, error, duration_ms, ran_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [h.source, h.label, h.ok ? 1 : 0, h.count, h.error || null, h.duration_ms || 0, ranAt]
        );
      }
      // Keep the log bounded.
      run(`DELETE FROM fetch_log WHERE id NOT IN (SELECT id FROM fetch_log ORDER BY id DESC LIMIT 200)`);
    });
    saveDB();

    console.log(`[Fetch] Inserted ${inserted}, refreshed ${refreshed} (${Date.now() - startedAt}ms)`);
    return {
      total: unique.length,
      inserted,
      refreshed,
      sources: health.length,
      failed: errors.length,
      errors,
      duration_ms: Date.now() - startedAt
    };
  }

  // ---- Settings ---------------------------------------------------------
  function getSettings() {
    const rows = queryAll('SELECT * FROM settings');
    const out = { ...DEFAULT_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  function getIntSetting(key, fallback, { min, max }) {
    const raw = getSettings()[key];
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // ---- Digest generation ------------------------------------------------
  function localDateTag(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function generateDigest({ skipFetch = false, force = false } = {}) {
    const t0 = Date.now();
    const settings = getSettings();
    let fetchSummary = null;
    if (!skipFetch && settings.autoFetchOnGenerate !== 'false') {
      fetchSummary = await withTimeout(
        fetchAllSources(),
        TOTAL_FETCH_TIMEOUT,
        `抓取总超时（>${TOTAL_FETCH_TIMEOUT / 1000}s），已跳过本次抓取`
      ).catch((e) => {
        // A stalled fetch must not prevent digest generation.
        console.error('[Fetch] aborted:', e.message);
        return { error: e.message, total: 0, inserted: 0, refreshed: 0, sources: 0, failed: 0, errors: [] };
      });
    }

    // Local midnight, not UTC — otherwise a digest generated in the evening
    // wrongly includes the previous day and vice versa.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    const dateTag = localDateTag();

    // Reuse today's digest unless the caller explicitly forces a new one.
    const existing = queryOne('SELECT * FROM digests WHERE date_tag = ? ORDER BY id DESC LIMIT 1', [dateTag]);
    if (existing && !force) {
      const count = queryOne('SELECT COUNT(*) AS c FROM digest_articles WHERE digest_id = ?', [existing.id])?.c || 0;
      if (count > 0) {
        return { digestId: existing.id, title: existing.title, articleCount: count, reused: true, dateTag };
      }
    }

    // Pull a wider pool, then select a balanced subset from it. Selecting
    // straight from the pool by score lets one source dominate the issue.
    const limit = getIntSetting('articlesPerDigest', 50, { min: 10, max: 200 });
    const poolSize = Math.max(limit * 4, 200);
    const pool = queryAll(
      `SELECT * FROM articles WHERE fetched_at >= ? ORDER BY score DESC LIMIT ?`,
      [startIso, poolSize]
    );

    if (pool.length === 0) {
      return { error: 'No articles found for today', dateTag };
    }

    const articles = selectDiverse(pool, limit, {
      maxShare: getIntSetting('maxSharePerSource', 34, { min: 10, max: 100 }) / 100
    });
    const sourceCount = new Set(articles.map(a => a.source)).size;
    const breakdown = articles.reduce((m, a) => {
      m[a.source] = (m[a.source] || 0) + 1;
      return m;
    }, {});
    console.log(
      `[Digest] ${articles.length}/${pool.length} 篇，来自 ${sourceCount} 个来源：` +
      Object.entries(breakdown).map(([k, v]) => `${k}=${v}`).join(' ')
    );

    const keywords = extractKeywords(articles);
    const title = `信息聚合日报 - ${dateTag}`;

    const result = run(
      `INSERT INTO digests (title, generated_at, article_count, date_tag, source_count, keywords, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, new Date().toISOString(), articles.length, dateTag, sourceCount, JSON.stringify(keywords), 0]
    );
    const digestId = result.lastInsertRowid;

    transaction(() => {
      articles.forEach((a, i) => {
        run('INSERT OR REPLACE INTO digest_articles (digest_id, article_id, position) VALUES (?, ?, ?)', [digestId, a.id, i]);
        // Keep the legacy column in sync for backwards compatibility.
        run('UPDATE articles SET digest_id = ? WHERE id = ?', [digestId, a.id]);
      });
    });
    const duration = Date.now() - t0;
    run('UPDATE digests SET duration_ms = ? WHERE id = ?', [duration, digestId]);
    saveDB();

    console.log(`[Digest] Generated digest #${digestId} with ${articles.length} articles (${duration}ms)`);
    return { digestId, title, articleCount: articles.length, sourceCount, keywords, fetch: fetchSummary, duration_ms: duration, dateTag };
  }

  // The daily digest time is user-configurable, so the schedule is built from
  // settings at boot and rebuilt whenever the setting changes.
  let digestCronTask = null;
  function scheduleDailyDigest() {
    const hour = getIntSetting('digestHour', 8, { min: 0, max: 23 });
    const expr = `0 ${hour} * * *`;
    if (digestCronTask) {
      digestCronTask.stop();
      digestCronTask = null;
    }
    digestCronTask = cron.schedule(expr, async () => {
      console.log(`[Cron] Daily digest (${String(hour).padStart(2, '0')}:00)...`);
      try {
        await generateDigest();
      } catch (e) {
        console.error('[Cron] digest generation failed:', e);
      }
    });
    console.log(`[Cron] Daily digest scheduled at ${String(hour).padStart(2, '0')}:00`);
  }
  scheduleDailyDigest();

  // Housekeeping at 03:20, well away from the digest run.
  cron.schedule('20 3 * * *', () => {
    try {
      pruneOldArticles();
    } catch (e) {
      console.error('[Cron] prune failed:', e);
    }
  });

  // ---- Retention --------------------------------------------------------
  /**
   * Trims old, unstarred articles so the database cannot grow without bound.
   * Starred articles and anything still referenced by a digest are kept —
   * deleting those would silently rewrite history.
   */
  function pruneOldArticles({ dryRun = false } = {}) {
    const days = getIntSetting('retentionDays', 90, { min: 1, max: 3650 });
    const cutoff = new Date(Date.now() - days * 864e5).toISOString();

    const candidates = queryAll(
      `SELECT id, title, source FROM articles
       WHERE fetched_at < ?
         AND starred = 0
         AND id NOT IN (SELECT article_id FROM digest_articles)
       LIMIT 5000`,
      [cutoff]
    );

    if (candidates.length === 0) {
      return { pruned: 0, retentionDays: days, dryRun };
    }

    if (dryRun) {
      return { pruned: candidates.length, retentionDays: days, dryRun: true, sample: candidates.slice(0, 5) };
    }

    const ids = candidates.map(a => a.id);
    // Chunked delete keeps the SQL statement well under SQLite's limits.
    const CHUNK = 400;
    transaction(() => {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const holes = slice.map(() => '?').join(',');
        run(`DELETE FROM articles WHERE id IN (${holes})`, slice);
      }
    });
    saveDB();
    console.log(`[Prune] Removed ${candidates.length} articles older than ${days} days`);
    return { pruned: candidates.length, retentionDays: days, dryRun: false };
  }

  // Manual triggers
  app.post('/api/digests/generate', async (req, res) => {
    try {
      const result = await generateDigest({
        skipFetch: req.body?.skipFetch === true,
        force: req.body?.force === true
      });
      if (result.error) return res.status(404).json(result);
      res.json(result);
    } catch (e) {
      console.error('[API] generate failed:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/fetch', async (req, res) => {
    try {
      const result = await withTimeout(
        fetchAllSources({ only: req.body?.sources }),
        TOTAL_FETCH_TIMEOUT,
        `抓取总超时（>${TOTAL_FETCH_TIMEOUT / 1000}s）`
      );
      res.json(result);
    } catch (e) {
      console.error('[API] fetch failed:', e);
      res.status(504).json({ error: e.message, timeout: true });
    }
  });

  // Retention: dry-run by default; pass { confirm: true } to actually delete.
  app.post('/api/prune', (req, res) => {
    try {
      const dryRun = req.body?.confirm !== true;
      res.json(pruneOldArticles({ dryRun }));
    } catch (e) {
      console.error('[Prune] failed:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/stats', (req, res) => {
    const totals = queryOne(`
      SELECT COUNT(*) AS articles,
             SUM(CASE WHEN starred = 1 THEN 1 ELSE 0 END) AS starred,
             SUM(CASE WHEN read = 1 THEN 1 ELSE 0 END) AS read
      FROM articles
    `) || {};
    const bySource = queryAll(
      'SELECT source, source_label, COUNT(*) AS count FROM articles GROUP BY source ORDER BY count DESC'
    );
    const byDay = queryAll(`
      SELECT substr(fetched_at, 1, 10) AS day, COUNT(*) AS count
      FROM articles GROUP BY day ORDER BY day DESC LIMIT 30
    `);
    const settings = getSettings();
    res.json({
      articles: totals.articles || 0,
      starred: totals.starred || 0,
      read: totals.read || 0,
      digests: queryOne('SELECT COUNT(*) AS c FROM digests')?.c || 0,
      sources: bySource,
      timeline: byDay.reverse(),
      settings
    });
  });

  // Serve the built frontend when it exists, so one process runs the whole app.
  if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler — without this, async throws kill the process.
  app.use((err, req, res, next) => {
    console.error('[API] Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  const server = app.listen(PORT, () => {
    console.log(`\n🚀 News Digest Bot server running on http://localhost:${PORT}`);
    console.log(`📅 Daily digest cron: 08:00`);
    if (fs.existsSync(FRONTEND_DIST)) console.log(`🖥️  Serving UI from frontend/dist`);
    console.log('');
  });

  server.on('error', (e) => {
    console.error(`[Server] Failed to listen on ${PORT}:`, e.message);
    process.exit(1);
  });
}).catch(e => {
  console.error('Failed to start:', e);
  process.exit(1);
});
