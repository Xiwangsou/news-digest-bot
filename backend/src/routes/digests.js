import { Router } from 'express';
import { queryAll, queryOne } from '../db.js';

export const digestsRouter = Router();

const toInt = (v, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function parseKeywords(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Reads a digest plus its articles through the junction table.
function loadDigest(id) {
  const digest = queryOne('SELECT * FROM digests WHERE id = ?', [id]);
  if (!digest) return null;
  const articles = queryAll(
    `SELECT a.* FROM digest_articles da
     JOIN articles a ON a.id = da.article_id
     WHERE da.digest_id = ? ORDER BY da.position ASC`,
    [id]
  );
  return { ...digest, keywords: parseKeywords(digest.keywords), articles };
}

digestsRouter.get('/', (req, res) => {
  const limit = toInt(req.query.limit, 30, { min: 1, max: 200 });
  const offset = toInt(req.query.offset, 0, { min: 0 });
  const digests = queryAll(
    'SELECT * FROM digests ORDER BY generated_at DESC, id DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const { total } = queryOne('SELECT COUNT(*) AS total FROM digests') || { total: 0 };
  res.json({ digests: digests.map(d => ({ ...d, keywords: parseKeywords(d.keywords) })), total, limit, offset });
});

// Declared before '/:id' so "latest" is not parsed as an id.
digestsRouter.get('/latest', (req, res) => {
  const digest = queryOne('SELECT id FROM digests ORDER BY id DESC LIMIT 1');
  if (!digest) return res.status(404).json({ error: 'No digests found' });
  res.json(loadDigest(digest.id));
});

digestsRouter.get('/:id', (req, res) => {
  const result = loadDigest(toInt(req.params.id, 0));
  if (!result) return res.status(404).json({ error: 'Digest not found' });
  res.json(result);
});

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

digestsRouter.get('/:id/rss', (req, res) => {
  const digest = loadDigest(toInt(req.params.id, 0));
  if (!digest) return res.status(404).json({ error: 'Digest not found' });

  const items = digest.articles.map(a => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.url)}</link>
      <description>${escapeXml(a.description || '')}</description>
      <source>${escapeXml(a.source_label)}</source>
      <guid isPermaLink="true">${escapeXml(a.url)}</guid>
      <pubDate>${new Date(a.published_at || a.fetched_at).toUTCString()}</pubDate>
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(digest.title)}</title>
    <link>http://localhost:${process.env.PORT || 3210}</link>
    <description>News Digest - ${escapeXml(digest.date_tag || '')}</description>
    <lastBuildDate>${new Date(digest.generated_at).toUTCString()}</lastBuildDate>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(rss);
});

digestsRouter.get('/:id/markdown', (req, res) => {
  const digest = loadDigest(toInt(req.params.id, 0));
  if (!digest) return res.status(404).json({ error: 'Digest not found' });

  const kw = digest.keywords.slice(0, 10).map(k => k.word).join(' · ');
  let md = `# ${digest.title}\n\n`;
  md += `> 生成时间：${new Date(digest.generated_at).toLocaleString('zh-CN')}\n`;
  md += `> 共 ${digest.articles.length} 篇文章，来自 ${digest.source_count || '—'} 个信息源\n`;
  if (kw) md += `> 关键词：${kw}\n`;
  md += '\n---\n\n';

  digest.articles.forEach((a, i) => {
    md += `### ${i + 1}. [${a.title}](${a.url})\n\n`;
    md += `\`${a.source_label}\``;
    if (a.score) md += ` · 热度 ${a.score}`;
    if (a.upvotes) md += ` · ▲ ${a.upvotes}`;
    if (a.comments_count) md += ` · 💬 ${a.comments_count}`;
    md += '\n\n';
    if (a.description) md += `${a.description}\n\n`;
  });

  md += `---\n\n由 News Digest 自动生成于 ${new Date().toLocaleString('zh-CN')}\n`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="digest-${digest.date_tag}.md"`);
  res.send(md);
});
