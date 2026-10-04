import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'digest.sqlite');

let db;
let saveTimer = null;

export async function initDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_label TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      description TEXT,
      score REAL DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      upvotes INTEGER DEFAULT 0,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      digest_id INTEGER,
      starred INTEGER DEFAULT 0,
      read INTEGER DEFAULT 0,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      article_count INTEGER DEFAULT 0,
      date_tag TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      weight REAL DEFAULT 1.0,
      color TEXT DEFAULT '#6366f1',
      config TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Feed health log: makes silent scraper failures observable.
    CREATE TABLE IF NOT EXISTS fetch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      label TEXT,
      ok INTEGER NOT NULL DEFAULT 0,
      count INTEGER DEFAULT 0,
      error TEXT,
      duration_ms INTEGER DEFAULT 0,
      ran_at TEXT NOT NULL
    );
  `);

  // ---- Migrations -------------------------------------------------------
  // Older builds stored a single digest_id on articles, which silently stole
  // articles from previous digests every time a new digest was generated.
  // The junction table below is the authoritative many-to-many link.
  db.run(`
    CREATE TABLE IF NOT EXISTS digest_articles (
      digest_id INTEGER NOT NULL,
      article_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY (digest_id, article_id)
    );
    CREATE INDEX IF NOT EXISTS idx_da_digest ON digest_articles(digest_id);
    CREATE INDEX IF NOT EXISTS idx_da_article ON digest_articles(article_id);
    CREATE INDEX IF NOT EXISTS idx_articles_score ON articles(score DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_fetched ON articles(fetched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
    CREATE INDEX IF NOT EXISTS idx_digests_date ON digests(date_tag);
  `);

  // Backfill the junction table from the legacy digest_id column (once).
  const legacy = queryOne(
    'SELECT COUNT(*) AS c FROM articles WHERE digest_id IS NOT NULL'
  );
  const linked = queryOne('SELECT COUNT(*) AS c FROM digest_articles');
  if ((legacy?.c || 0) > 0 && (linked?.c || 0) === 0) {
    db.run(`
      INSERT OR IGNORE INTO digest_articles (digest_id, article_id, position)
      SELECT digest_id, id,
        (SELECT COUNT(*) FROM articles a2
          WHERE a2.digest_id = articles.digest_id AND a2.score > articles.score)
      FROM articles WHERE digest_id IS NOT NULL
    `);
    console.log('[DB] Migrated legacy digest_id links into digest_articles');
  }

  const digestsCols = new Set(queryAll('PRAGMA table_info(digests)').map(c => c.name));
  if (!digestsCols.has('source_count')) db.run('ALTER TABLE digests ADD COLUMN source_count INTEGER DEFAULT 0');
  if (!digestsCols.has('keywords')) db.run('ALTER TABLE digests ADD COLUMN keywords TEXT');
  if (!digestsCols.has('duration_ms')) db.run('ALTER TABLE digests ADD COLUMN duration_ms INTEGER DEFAULT 0');

  const articleCols = new Set(queryAll('PRAGMA table_info(articles)').map(c => c.name));
  if (!articleCols.has('starred')) db.run('ALTER TABLE articles ADD COLUMN starred INTEGER DEFAULT 0');
  if (!articleCols.has('read')) db.run('ALTER TABLE articles ADD COLUMN read INTEGER DEFAULT 0');
  if (!articleCols.has('tags')) db.run('ALTER TABLE articles ADD COLUMN tags TEXT');

  // Default sources
  const defaults = [
    ['hackernews', 'Hacker News', 1, 1.0, '#ff6600'],
    ['github', 'GitHub Trending', 1, 1.0, '#8b949e'],
    ['v2ex', 'V2EX', 1, 0.8, '#71717a'],
    ['juejin', '掘金', 1, 0.8, '#1e80ff'],
    ['producthunt', 'Product Hunt', 1, 0.9, '#da552f'],
    ['36kr', '36氪', 1, 0.7, '#0061fe'],
    ['huxiu', '虎嗅', 1, 0.7, '#e8384f'],
    ['reddit', 'Reddit r/programming', 1, 0.8, '#ff4500'],
    ['lobsters', 'Lobsters', 1, 0.8, '#ef4444'],
    ['infoq', 'InfoQ 中国', 1, 0.7, '#10b981'],
    ['solidot', 'Solidot', 1, 0.7, '#22c55e'],
    ['sspai', '少数派', 1, 0.7, '#f59e0b'],
    ['jiqizhixin', '机器之心', 1, 0.7, '#a855f7'],
    ['slashdot', 'Slashdot', 1, 0.7, '#3b82f6']
  ];
  for (const [key, label, enabled, weight, color] of defaults) {
    db.run(
      `INSERT OR IGNORE INTO sources (key, label, enabled, weight, color, config) VALUES (?, ?, ?, ?, ?, '{}')`,
      [key, label, enabled, weight, color]
    );
  }

  // Repair labels mangled by an earlier encoding fault ("InfoQ ??", "???").
  // A label containing U+FFFD or a run of '?' cannot be intentional.
  for (const [key, label, , , color] of defaults) {
    const row = queryOne('SELECT label, color FROM sources WHERE key = ?', [key]);
    if (!row) continue;
    const bad = /\uFFFD|\?{2,}/.test(String(row.label || ''));
    if (bad) {
      db.run('UPDATE sources SET label = ? WHERE key = ?', [label, key]);
      console.log(`[DB] Repaired label for "${key}": "${row.label}" -> "${label}"`);
    }
    if (!/^#[0-9a-fA-F]{3,8}$/.test(String(row.color || ''))) {
      db.run('UPDATE sources SET color = ? WHERE key = ?', [color, key]);
    }
  }

  // Backfill source_label on articles whose label was corrupted.
  for (const [key, label] of defaults) {
    db.run(
      `UPDATE articles SET source_label = ? WHERE source = ? AND (source_label IS NULL OR source_label = '' OR source_label LIKE '%?%' OR source_label LIKE '%' || char(65533) || '%')`,
      [label, key]
    );
  }

  // One-time cleanup of summaries that merely repeat the headline or contain
  // raw entity/link soup, written by earlier builds.
  const { cleanDescription } = await import('./scoring.js');
  const dirty = queryAll(
    `SELECT id, title, description FROM articles
     WHERE description IS NOT NULL AND description != ''`
  );
  let cleaned = 0;
  for (const row of dirty) {
    const fixed = cleanDescription(row.description, row.title);
    if (fixed !== row.description) {
      db.run('UPDATE articles SET description = ? WHERE id = ?', [fixed, row.id]);
      cleaned++;
    }
  }
  if (cleaned) console.log(`[DB] Cleaned ${cleaned} article summaries`);

  saveDB();
  return db;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDB();
    saveTimer = null;
  }, 400);
}

export function saveDB() {
  if (!db) return;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const buffer = Buffer.from(db.export());
  // Write to a temp file first so an interrupted write cannot corrupt the DB.
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, DB_PATH);
}

export function getDB() {
  if (!db) throw new Error('DB not initialized. Call initDB() first.');
  return db;
}

export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

// Runs a statement.
// `changes` is reliable for INSERT OR IGNORE / UPDATE.
// `lastInsertRowid` is only meaningful for INSERTs that actually inserted a row —
// previously it returned a stale id for UPDATEs, which is how the "inserted N
// articles" counter and digest linking went wrong.
export function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  let lastInsertRowid = 0;
  if (changes > 0 && /^\s*INSERT/i.test(sql)) {
    const row = queryOne('SELECT last_insert_rowid() AS id');
    lastInsertRowid = row?.id || 0;
  }
  scheduleSave();
  return { lastInsertRowid, changes };
}

// Atomic multi-statement write with a single debounced save.
export function transaction(fn) {
  db.run('BEGIN');
  try {
    const result = fn();
    db.run('COMMIT');
    return result;
  } catch (e) {
    try { db.run('ROLLBACK'); } catch { /* already rolled back */ }
    throw e;
  } finally {
    scheduleSave();
  }
}
