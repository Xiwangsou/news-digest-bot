import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

const rssParser = new Parser({ timeout: 15000 });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const JSON_HEADERS = { 'User-Agent': UA, 'Accept': 'application/json' };
const HTML_HEADERS = { 'User-Agent': UA, 'Accept': 'text/html' };

// node-fetch v3 dropped the `timeout` option and only honours `signal`.
// Without this, a socket that never responds hangs the whole fetch batch.
const REQUEST_TIMEOUT = 20000;

/**
 * Runs a scraper under a hard time budget and re-throws on failure.
 *
 * Every scraper used to catch its own error and `return []`, which made a
 * dead feed indistinguishable from a quiet one — the health log showed "ok"
 * with 0 articles. Failures must propagate so the pipeline can record them.
 */
async function attempt(name, fn, timeoutMs = REQUEST_TIMEOUT) {
  try {
    const out = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`超时（>${timeoutMs / 1000}s）`)), timeoutMs).unref?.()
      )
    ]);
    if (!Array.isArray(out)) throw new Error(`${name} 返回了非数组结果`);
    return out;
  } catch (e) {
    const msg = e?.message || String(e);
    throw new Error(`${name}: ${msg}`);
  }
}

function wrapArticle(source, source_label, extra) {
  return {
    source,
    source_label,
    comments_count: 0,
    upvotes: 0,
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    ...extra
  };
}

function excerpt(text, max = 140) {
  if (!text) return '';
  const clean = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf('。', max);
  if (cut > max * 0.5) return clean.slice(0, cut + 1);
  return clean.slice(0, max).trim() + '…';
}

async function fetchJson(url, opts = {}) {
  // AbortSignal is what actually cancels the socket in node-fetch v3.
  const res = await fetch(url, {
    headers: JSON_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    ...opts
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchHtml(url, opts = {}) {
  const res = await fetch(url, {
    headers: HTML_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    ...opts
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function parseRss(url) {
  return rssParser.parseURL(url);
}

export function scrapeHackerNews() {
  return attempt('Hacker News', async () => {
    const data = await fetchJson('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30');
    return data.hits.map(hit => {
      let published = null;
      if (hit.created_at) {
        const d = /^(\d{4})-/.test(hit.created_at)
          ? new Date(hit.created_at)
          : new Date(hit.created_at * 1000);
        published = isNaN(d) ? null : d.toISOString();
      }
      return wrapArticle('hackernews', 'Hacker News', {
        title: hit.title,
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        description: excerpt(hit.story_text || hit.comment_text || ''),
        comments_count: hit.num_comments || 0,
        upvotes: hit.points || 0,
        published_at: published
      });
    });
  });
}

export function scrapeGitHub() {
  return attempt('GitHub Trending', async () => {
    const html = await fetchHtml('https://github.com/trending?since=daily');
    const $ = cheerio.load(html);
    const articles = [];

    $('article.Box-row').each((i, el) => {
      if (i >= 25) return;
      const href = $(el).find('h2 a').attr('href')?.trim();
      if (!href) return;
      const name = href.replace(/^\//, '').replace(/\s+/g, '');
      const desc = $(el).find('p').text().trim();
      const lang = $(el).find('[itemprop="programmingLanguage"]').text().trim();
      const stars = $(el).find('.float-sm-right').text().trim();

      articles.push(wrapArticle('github', 'GitHub Trending', {
        title: name,
        url: `https://github.com${href}`,
        description: excerpt([desc, lang ? `[${lang}]` : '', stars].filter(Boolean).join(' ')),
        upvotes: parseInt(String(stars).replace(/[^0-9]/g, ''), 10) || 0
      }));
    });

    if (!articles.length) throw new Error('no trending rows matched (layout may have changed)');
    return articles;
  });
}

export function scrapeV2ex() {
  return attempt('V2EX', async () => {
    const data = await fetchJson('https://www.v2ex.com/api/topics/latest.json');
    return data.slice(0, 30).map(t => wrapArticle('v2ex', 'V2EX', {
      title: t.title,
      url: `https://www.v2ex.com/t/${t.id}`,
      description: excerpt(t.content || '', 100),
      comments_count: t.replies || 0,
      published_at: t.created ? new Date(t.created * 1000).toISOString() : null
    }));
  });
}

/** Shared helper for the many plain RSS feeds. */
function rssScraper(name, key, label, url, { limit = 20, preclean = false } = {}) {
  return attempt(name, async () => {
    let feed;
    if (preclean) {
      const xml = await fetchHtml(url);
      const cleaned = xml
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
        .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+);)/g, '&amp;');
      feed = await rssParser.parseString(cleaned);
    } else {
      feed = await parseRss(url);
    }
    return feed.items.slice(0, limit).map(item => wrapArticle(key, label, {
      title: item.title,
      url: item.link,
      description: excerpt(item.contentSnippet || item.content || ''),
      published_at: item.isoDate || item.pubDate || null
    }));
  });
}

export const scrapeJuejin = () => rssScraper('掘金', 'juejin', '掘金', 'https://juejin.cn/rss', { limit: 25 });
export const scrapeProductHunt = () => rssScraper('Product Hunt', 'producthunt', 'Product Hunt', 'https://www.producthunt.com/feed');
export const scrape36kr = () => rssScraper('36氪', '36kr', '36氪', 'https://36kr.com/feed', { preclean: true });
export const scrapeHuxiu = () => rssScraper('虎嗅', 'huxiu', '虎嗅', 'https://rsshub.app/huxiu/article');
export const scrapeLobsters = () => rssScraper('Lobsters', 'lobsters', 'Lobsters', 'https://lobste.rs/rss');
export const scrapeInfoq = () => rssScraper('InfoQ 中国', 'infoq', 'InfoQ 中国', 'https://www.infoq.cn/feed');
export const scrapeSolidot = () => rssScraper('Solidot', 'solidot', 'Solidot', 'https://www.solidot.org/index.rss');
export const scrapeSspai = () => rssScraper('少数派', 'sspai', '少数派', 'https://sspai.com/feed');
export const scrapeJiqizhixin = () => rssScraper('机器之心', 'jiqizhixin', '机器之心', 'https://www.jiqizhixin.com/rss', { preclean: true });
export const scrapeSlashdot = () => rssScraper('Slashdot', 'slashdot', 'Slashdot', 'https://rss.slashdot.org/Slashdot/slashdot');

export function scrapeReddit() {
  return attempt('Reddit', async () => {
    const data = await fetchJson('https://www.reddit.com/r/programming/hot.json?limit=25');
    return data.data.children.slice(0, 25).map(post => {
      const p = post.data;
      return wrapArticle('reddit', 'Reddit r/programming', {
        title: p.title,
        url: p.url || `https://www.reddit.com${p.permalink}`,
        description: excerpt(p.selftext || ''),
        upvotes: p.ups || 0,
        comments_count: p.num_comments || 0,
        published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null
      });
    });
  });
}

export const scrapers = {
  hackernews: scrapeHackerNews,
  github: scrapeGitHub,
  v2ex: scrapeV2ex,
  juejin: scrapeJuejin,
  producthunt: scrapeProductHunt,
  '36kr': scrape36kr,
  huxiu: scrapeHuxiu,
  reddit: scrapeReddit,
  lobsters: scrapeLobsters,
  infoq: scrapeInfoq,
  solidot: scrapeSolidot,
  sspai: scrapeSspai,
  jiqizhixin: scrapeJiqizhixin,
  slashdot: scrapeSlashdot
};
