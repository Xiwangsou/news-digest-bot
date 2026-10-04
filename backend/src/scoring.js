// Scoring & text utilities

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…',
  mdash: '—', ndash: '–', middot: '·', laquo: '«', raquo: '»'
};

/**
 * Decodes the entity soup that RSS feeds emit. Handles named entities,
 * numeric references (&#38; / &#x26;) and the "frx2F" mangling some
 * CDNs produce ("&frx2F;" -> "/").
 */
export function decodeEntities(text) {
  if (!text) return '';
  let out = String(text);

  // "&frx2F;" style placeholders used by archive.is and friends.
  out = out.replace(/&frx([0-9a-fA-F]{2});/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  out = out.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return match;
      try { return String.fromCodePoint(code); } catch { return match; }
    }
    const key = body.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : match;
  });

  return out;
}

/** True when the excerpt carries no information beyond the headline. */
function isRedundant(description, title) {
  if (!description) return true;
  const norm = s => s.toLowerCase().replace(/[\s\p{P}]+/gu, '');
  const d = norm(description);
  const t = norm(title || '');
  if (!d) return true;
  if (t && (d === t || t.includes(d) || d.includes(t))) return true;
  return false;
}

export function calculateScore(article, sourceWeight = 1.0) {
  let score = 0;

  // Base score from upvotes
  if (article.upvotes > 0) {
    score += Math.log10(article.upvotes + 1) * 2;
  } else {
    score += 2.5;
  }

  // Comments contribute less
  if (article.comments_count > 0) {
    score += Math.log10(article.comments_count + 1) * 1;
  }

  // Source weight multiplier
  score *= sourceWeight;

  // Recency bonus (newer = higher score)
  if (article.published_at) {
    const published = new Date(article.published_at).getTime();
    if (!Number.isNaN(published)) {
      const ageHours = (Date.now() - published) / 36e5;
      if (ageHours < 6) score += 3;
      else if (ageHours < 12) score += 2;
      else if (ageHours < 24) score += 1;
      else if (ageHours < 48) score += 0.5;
    }
  }

  // Title length penalty (very short or very long titles are less likely to be quality)
  const titleLen = (article.title || '').length;
  if (titleLen > 10 && titleLen < 200) score += 0.5;

  // Keyword bonus for interesting terms
  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  const BONUS_KEYWORDS = ['ai', 'gpt', 'agent', '开源', 'open-source', 'open source', 'rust', 'python', 'github', 'llm', 'tool', '框架', 'framework', '教程', '实战', 'launch', 'show hn', '新'];
  const bonusCount = BONUS_KEYWORDS.filter(k => text.includes(k)).length;
  score += Math.min(bonusCount * 0.15, 1.5);

  return Math.round(score * 100) / 100;
}

export function generateExcerpt(text, max = 120) {
  if (!text) return '';
  // Strip tags first, then decode entities — feeds escape the markup.
  let clean = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  clean = decodeEntities(clean).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf('。', max);
  if (cut > max * 0.5) return clean.slice(0, cut + 1);
  return clean.slice(0, max).trim() + '…';
}

/** Full cleanup for an article's summary field. */
export function cleanDescription(text, title) {
  let excerpt = generateExcerpt(text, 150);
  if (!excerpt) return '';

  // A bare list of links is not a summary.
  if (/^(?:https?:\/\/\S+\s*)+$/i.test(excerpt)) return '';

  // Sometimes a feed's only "content" is a shortened link; drop the links
  // and keep whatever prose remains.
  const withoutLinks = excerpt.replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  if (withoutLinks.length >= 20 && !/^https?:\/\//i.test(withoutLinks)) {
    excerpt = generateExcerpt(withoutLinks, 150);
  }

  return isRedundant(excerpt, title) ? '' : excerpt;
}

export function deduplicate(articles) {
  const seenTitle = new Set();
  const seenUrl = new Set();
  const unique = [];

  for (const a of articles) {
    if (!a || !a.url || !a.title) continue;

    // Normalize URL: drop scheme, www, trailing slash, query and hash.
    let url = a.url.trim();
    try {
      const u = new URL(url);
      url = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
    } catch {
      url = url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
    }

    // Compare on a normalized title so the same story from two sources collapses.
    const titleKey = a.title
      .toLowerCase()
      .replace(/[\s\p{P}]+/gu, '')
      .slice(0, 60);

    if (seenUrl.has(url) || (titleKey && seenTitle.has(titleKey))) continue;
    seenUrl.add(url);
    if (titleKey) seenTitle.add(titleKey);
    unique.push(a);
  }

  return unique;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'it', 'as',
  'not', 'have', 'has', 'had', 'do', 'does', 'will', 'would', 'could', 'should',
  'may', 'might', 'can', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'you', 'your',
  'our', 'out', 'up', 'about', 'into', 'over', 'than', 'then', 'them', 'they',
  'he', 'she', 'we', 'us', 'am', 'no', 'yes', 'if', 'so', 'just', 'now', 'new',
  'get', 'got', 'make', 'made', 'use', 'used', 'using', 'one', 'two', 'via',
  'www', 'com', 'http', 'https', 'html', 'href', 'target', 'blank', 'rel',
  'nofollow', 'noreferrer', 'amp', 'nbsp', 'quot', 'apos', 'utf', 'x2f',
  'says', 'said', 'want', 'need', 'needs', 'like', 'look', 'think', 'know',
  'see', 'come', 'take', 'give', 'find', 'tell', 'show', 'here', 'also',
  'after', 'before', 'because', 'much', 'many', 'well', 'back', 'even',
  'still', 'never', 'always', 'often', 'really', 'something', 'anything',
  'everything', 'nothing', 'someone', 'everyone', 'around', 'though',
  '另外', '以及', '并且', '这个', '那个', '我们', '他们', '可以', '因为',
  '所以', '但是', '如果', '已经', '还是', '一个', '一些', '什么', '怎么',
  '为了', '通过', '进行', '使用', '目前', '表示', '这样', '那样', '需要',
  '原文', '点击', '查看', '阅读', '更多', '详情', '评论', '转载', '声明',
  '免责', '文章', '编辑', '本文', '来源', '不会', '没有', '问题', '出现'
]);

// Tokens that look like URL/hex fragments rather than real words.
const NOISE_PATTERN = /^(?:[0-9a-f]{2,4}|x[0-9a-f]{2,})$/i;

// Domain terms worth surfacing as tags. Ordered: first match wins per family.
const TAG_RULES = [
  ['ai', ['ai', 'llm', 'agent', 'gpt', 'claude', 'openai', 'gemini', 'anthropic', '大模型', '模型', '推理', '智能体', '机器学习', '深度学习', 'neural', 'llm']],
  ['frontend', ['react', 'vue', 'angular', 'svelte', 'frontend', 'css', '组件', '前端', 'tailwind', 'ui kit', 'design system']],
  ['backend', ['node', 'go ', 'golang', 'rust', 'python', 'backend', '数据库', 'database', '后端', 'api', '服务器', 'postgres', 'mysql', 'sqlite']],
  ['open-source', ['github', 'open source', 'open-source', '开源', 'trending', 'star']],
  ['startup', ['startup', '创业', '独立开发', 'indie hacker', 'product hunt', '融资', 'funding', '估值']],
  ['tool', ['工具', 'tool', 'cli', '效率', 'software', 'app', '插件', 'plugin', 'workflow']]
];

export function getTags(text) {
  const lower = String(text || '').toLowerCase();
  const tags = [];
  for (const [tag, keywords] of TAG_RULES) {
    if (keywords.some(k => lower.includes(k))) tags.push(tag);
  }
  return tags;
}

export function extractKeywords(articles) {
  const wordFreq = {};
  const bump = (word, n = 1) => {
    if (!word || word.length < 2) return;
    if (STOP_WORDS.has(word)) return;
    if (NOISE_PATTERN.test(word)) return;
    if (/^\d+$/.test(word)) return;
    // Require real signal: short latin words must repeat to count at all.
    wordFreq[word] = (wordFreq[word] || 0) + n;
  };

  for (const a of articles) {
    const text = `${a.title || ''} ${a.description || ''}`.toLowerCase();

    // Latin words (length >= 3 reads better than noise like "flock"/"around")
    for (const w of text.match(/[a-z][a-z0-9+#]{2,}/g) || []) {
      bump(w, 2);
    }

    // CJK: 2-grams, which read naturally in Chinese. Longer grams are only
    // preferred when the same long term recurs across articles.
    for (const seg of text.match(/[\u4e00-\u9fff]{2,}/g) || []) {
      for (let i = 0; i < seg.length - 1; i += 2) {
        const bigram = seg.slice(i, i + 2);
        if (STOP_WORDS.has(bigram)) continue;
        bump(bigram, 1);
      }
    }
  }

  const isLatin = w => /^[a-z]/.test(w);
  const isCjk = w => /[\u4e00-\u9fff]/.test(w);

  return Object.entries(wordFreq)
    // Drop latin words seen only once or twice — they are almost always noise.
    .filter(([word, count]) => (isCjk(word) ? count >= 2 : isLatin(word) ? count >= 4 : true))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Picks a balanced, high-quality set from the day's pool.
 *
 * A plain "ORDER BY score DESC LIMIT n" lets one chatty source take half the
 * digest (Hacker News was filling ~50% of every issue), which defeats the
 * point of an aggregator. This does a source quota pass first, then fills the
 * remaining slots purely by score.
 *
 * @param {Array} pool    candidate articles, any order
 * @param {number} limit  target size
 * @param {object} opts
 * @param {number} opts.maxShare  max fraction one source may occupy (0..1)
 * @param {number} opts.maxPerSource  hard cap per source
 */
export function selectDiverse(pool, limit, { maxShare = 0.34, maxPerSource = Infinity } = {}) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  if (pool.length <= limit) return pool.slice();

  const byScore = pool.slice().sort((a, b) => (b.score || 0) - (a.score || 0));

  // Group by source, each pre-sorted by score.
  const groups = new Map();
  for (const a of byScore) {
    if (!groups.has(a.source)) groups.set(a.source, []);
    groups.get(a.source).push(a);
  }

  const sourceCount = groups.size;
  // Never let one source exceed this share of the final digest.
  const shareCap = Math.max(1, Math.ceil(limit * maxShare));
  const perSourceCap = Math.min(shareCap, maxPerSource);

  const picked = [];
  const taken = new Set();

  // Round-robin across sources: guarantees breadth before depth.
  let progressed = true;
  let round = 0;
  while (picked.length < limit && progressed) {
    progressed = false;
    for (const list of groups.values()) {
      if (picked.length >= limit) break;
      if (round >= perSourceCap) continue;
      const next = list[round];
      if (!next || taken.has(next.id)) continue;
      picked.push(next);
      taken.add(next.id);
      progressed = true;
    }
    round++;
  }

  // Fill any remaining slots by raw score, respecting the per-source cap.
  if (picked.length < limit) {
    const used = new Map();
    for (const a of picked) used.set(a.source, (used.get(a.source) || 0) + 1);
    for (const a of byScore) {
      if (picked.length >= limit) break;
      if (taken.has(a.id)) continue;
      if ((used.get(a.source) || 0) >= perSourceCap) continue;
      picked.push(a);
      taken.add(a.id);
      used.set(a.source, (used.get(a.source) || 0) + 1);
    }
  }

  // Final ordering for display: strongest first.
  return picked.sort((a, b) => (b.score || 0) - (a.score || 0));
}
