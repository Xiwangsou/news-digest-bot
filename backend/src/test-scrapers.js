/**
 * Scrapers health check.
 *
 *   npm run test:scrapers                  # every source
 *   npm run test:scrapers hackernews juejin   # only the named ones
 *
 * Exits non-zero when any source fails, so it can be used in CI.
 */
import { scrapers } from './scrapers/index.js';

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';

async function main() {
  const wanted = process.argv.slice(2);
  const entries = wanted.length
    ? Object.entries(scrapers).filter(([k]) => wanted.includes(k))
    : Object.entries(scrapers);

  if (!entries.length) {
    console.error(`No matching sources. Available: ${Object.keys(scrapers).join(', ')}`);
    process.exit(1);
  }

  const t0 = Date.now();
  const rows = [];

  for (const [key, fn] of entries) {
    const started = Date.now();
    try {
      const articles = await fn();
      rows.push({ key, ok: true, count: articles.length, ms: Date.now() - started });
    } catch (e) {
      rows.push({ key, ok: false, error: e.message, ms: Date.now() - started });
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);

  console.log('');
  for (const r of rows) {
    const mark = r.ok ? `${GREEN}OK  ${RESET}` : `${RED}FAIL${RESET}`;
    const detail = r.ok ? `${padL(r.count, 3)} articles` : r.error;
    console.log(`  ${mark}  ${pad(r.key, 14)} ${padL(r.ms + 'ms', 8)}  ${DIM}${detail}${RESET}`);
  }

  const okCount = rows.filter(r => r.ok).length;
  const total = rows.filter(r => r.ok).reduce((s, r) => s + r.count, 0);
  const failed = rows.length - okCount;

  console.log(`\n  ${okCount}/${rows.length} sources healthy · ${total} articles · ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
