// Shared formatting + source metadata so every view renders sources the same way.

export const SOURCE_META = {
  hackernews: { label: 'Hacker News', color: '#ff6600', desc: '国际科技与创业社区头版' },
  github: { label: 'GitHub Trending', color: '#8b949e', desc: '每日开源热门项目' },
  v2ex: { label: 'V2EX', color: '#71717a', desc: '创意工作者社区' },
  juejin: { label: '掘金', color: '#4d8bf5', desc: '中文技术分享' },
  producthunt: { label: 'Product Hunt', color: '#f97316', desc: '每日新产品榜单' },
  '36kr': { label: '36氪', color: '#3b82f6', desc: '科技商业资讯' },
  huxiu: { label: '虎嗅', color: '#ef4444', desc: '商业与科技深度' },
  reddit: { label: 'Reddit', color: '#ff4500', desc: 'r/programming 热门' },
  lobsters: { label: 'Lobsters', color: '#ef4444', desc: '技术社区精选' },
  infoq: { label: 'InfoQ 中国', color: '#10b981', desc: '软件行业资讯' },
  solidot: { label: 'Solidot', color: '#22c55e', desc: '奇客的资讯' },
  sspai: { label: '少数派', color: '#f59e0b', desc: '数字生活与效率' },
  jiqizhixin: { label: '机器之心', color: '#a855f7', desc: 'AI 前沿资讯' },
  slashdot: { label: 'Slashdot', color: '#3b82f6', desc: '科技新闻聚合' }
}

export const FALLBACK_COLOR = '#7d8590'

export const TAG_META = {
  ai: { label: 'AI', color: '#a855f7' },
  frontend: { label: '前端', color: '#4d8bf5' },
  backend: { label: '后端', color: '#10b981' },
  'open-source': { label: '开源', color: '#8b949e' },
  startup: { label: '创业', color: '#f97316' },
  tool: { label: '工具', color: '#d29922' }
}

export const sourceColor = (key) => SOURCE_META[key]?.color || FALLBACK_COLOR
export const sourceLabel = (key) => SOURCE_META[key]?.label || key
export const sourceDesc = (key) => SOURCE_META[key]?.desc || '自定义信息源'
export const tagLabel = (tag) => TAG_META[tag]?.label || tag
export const tagColor = (tag) => TAG_META[tag]?.color || FALLBACK_COLOR

/** Compact counts: 1200 -> 1.2k */
export function formatCount(n) {
  const num = Number(n) || 0
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(num)
}

/** "3小时前" / "刚刚" / "2天前" */
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月前`
  return `${Math.floor(months / 12)}年前`
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function formatDay(tag) {
  const d = new Date(`${tag}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.getDate()
}

export function formatMonth(tag) {
  const d = new Date(`${tag}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN', { month: 'short' })
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Split tags stored as a comma string. */
export const parseTags = (raw) => (raw ? String(raw).split(',').filter(Boolean) : [])
