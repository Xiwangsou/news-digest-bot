<template>
  <div class="view container">
    <!-- Header -->
    <header class="head">
      <div class="head-main">
        <div class="eyebrow">
          <span class="live-dot" :class="{ on: online }" />
          <span>{{ todayLabel }}</span>
        </div>
        <h1 class="title">今日日报</h1>
        <p class="sub">
          <template v-if="digest">
            已聚合 <strong class="tnum">{{ digest.articles?.length || 0 }}</strong> 篇文章
            · 来自 <strong class="tnum">{{ sourceCount }}</strong> 个信息源
            <template v-if="digest.generated_at"> · {{ formatDateTime(digest.generated_at) }} 更新</template>
          </template>
          <template v-else>聚合全球科技资讯，生成每日精选</template>
        </p>
      </div>

      <div class="head-actions">
        <button class="btn btn-ghost" @click="refresh" :disabled="busy">
          <svg :class="{ spinning: busy === 'fetch' }" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
          </svg>
          <span>{{ busy === 'fetch' ? '抓取中' : '抓取更新' }}</span>
        </button>
        <button class="btn btn-primary" @click="generate" :disabled="busy">
          <span v-if="busy === 'generate'" class="spinner" />
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
          <span>{{ busy === 'generate' ? '生成中' : '生成日报' }}</span>
        </button>
      </div>
    </header>

    <!-- Progress -->
    <transition name="v">
      <div v-if="busy" class="progress">
        <div class="progress-track"><div class="progress-bar" /></div>
        <span class="progress-text">{{ statusMsg }}</span>
      </div>
    </transition>

    <!-- Keyword cloud -->
    <transition name="v">
      <div v-if="keywords.length" class="cloud">
        <span class="cloud-label">今日热词</span>
        <div class="cloud-items">
          <button v-for="k in keywords" :key="k.word" class="kw" :style="kwStyle(k)"
            :title="`${k.word} · 出现 ${k.count} 次`" @click="search = k.word">{{ k.word }}</button>
        </div>
      </div>
    </transition>

    <!-- Filters -->
    <div v-if="articles.length" class="filters">
      <div class="chips-scroll">
        <button class="chip" :class="{ on: activeSource === 'all' && showRead === 'all' }" @click="setSource('all')">
          全部 <span class="chip-n tnum">{{ articles.length }}</span>
        </button>
        <button v-for="s in sourceStats" :key="s.source" class="chip" :class="{ on: activeSource === s.source }"
          @click="setSource(s.source)">
          <span class="chip-dot" :style="{ background: sourceColor(s.source) }" />
          {{ s.source_label }}
          <span class="chip-n tnum">{{ s.count }}</span>
        </button>
      </div>

      <div class="filter-right">
        <div class="seg-mini">
          <button class="seg-mini-btn" :class="{ on: showRead === 'all' }" @click="showRead = 'all'">全部</button>
          <button class="seg-mini-btn" :class="{ on: showRead === 'unread' }" @click="showRead = 'unread'">
            未读 <span v-if="unreadCount" class="tnum">{{ unreadCount }}</span>
          </button>
        </div>
        <div class="search" :class="{ on: search }">
          <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
          <input ref="searchRef" v-model="search" class="search-input" placeholder="搜索标题或摘要…  ( / )" aria-label="搜索文章" />
          <button v-if="search" class="search-clear" @click="search = ''" aria-label="清除搜索">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <button v-if="unreadCount" class="btn btn-ghost btn-icon" @click="markAllRead" title="全部标记为已读" aria-label="全部标记为已读">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading skeletons -->
    <div v-if="busy && !articles.length" class="list">
      <div v-for="i in 6" :key="i" class="sk-row">
        <div class="skeleton sk-rank" />
        <div class="sk-body">
          <div class="skeleton sk-line" style="width: 30%" />
          <div class="skeleton sk-line lg" style="width: 88%" />
          <div class="skeleton sk-line" style="width: 62%" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!articles.length" class="empty">
      <div class="empty-art">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z"/>
          <path d="M8 8h8M8 12h8M8 16h5"/>
        </svg>
      </div>
      <h2 class="empty-title">今日还没有聚合内容</h2>
      <p class="empty-text">点击「生成日报」，系统会从 14 个信息源抓取最新内容，按热度排序并生成今日精选。</p>
      <button class="btn btn-primary btn-lg" @click="generate" :disabled="busy">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
        立即生成
      </button>
    </div>

    <!-- No match -->
    <div v-else-if="!filtered.length" class="empty compact">
      <h2 class="empty-title">没有匹配的文章</h2>
      <p class="empty-text">试试切换信息源或修改搜索关键词。</p>
      <button class="btn btn-ghost" @click="resetFilters">重置筛选</button>
    </div>

    <!-- List -->
    <div v-else class="list fade-up">
      <ArticleCard
        v-for="(a, i) in filtered"
        :key="a.id"
        :article="a"
        :index="i"
        :selected="selectedId === a.id"
        @update="onUpdate"
        @select="onSelect"
      />
    </div>

    <p class="hint-row">
      <kbd>j</kbd><kbd>k</kbd> 上下浏览 · <kbd>/</kbd> 搜索 · <kbd>s</kbd> 收藏 · <kbd>?</kbd> 全部快捷键
    </p>

    <!-- Shortcut overlay -->
    <transition name="modal">
      <div v-if="showHelp" class="overlay" @click.self="showHelp = false">
        <div class="help-card" role="dialog" aria-modal="true">
          <h2 class="help-title">键盘快捷键</h2>
          <div class="help-list">
            <div v-for="k in helpItems" :key="k.keys" class="help-row">
              <span class="help-desc">{{ k.label }}</span>
              <span class="help-keys">
                <kbd v-for="p in k.keys.split(' ')" :key="p">{{ p }}</kbd>
              </span>
            </div>
          </div>
          <button class="btn btn-ghost" @click="showHelp = false">知道了</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, nextTick, watch } from 'vue'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { useShortcuts } from '../composables/useShortcuts'
import { sourceColor, formatDateTime } from '../utils/format'
import ArticleCard from '../components/ArticleCard.vue'

const toast = useToast()

const busy = ref(null)
const statusMsg = ref('')
const online = ref(true)
const digest = ref(null)
const articles = ref([])
const activeSource = ref('all')
const search = ref('')
const showRead = ref('all')
const selectedId = ref(null)
const showHelp = ref(false)
const searchRef = ref(null)

const helpItems = [
  { keys: 'j ↓', label: '下一条' },
  { keys: 'k ↑', label: '上一条' },
  { keys: '/', label: '聚焦搜索框' },
  { keys: 'o Enter', label: '打开选中文章' },
  { keys: 's', label: '收藏 / 取消收藏' },
  { keys: 'Esc', label: '清空搜索' },
  { keys: '?', label: '显示本帮助' }
]

const todayLabel = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

const sourceStats = computed(() => {
  const map = new Map()
  for (const a of articles.value) {
    if (!map.has(a.source)) map.set(a.source, { source: a.source, source_label: a.source_label, count: 0 })
    map.get(a.source).count++
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const sourceCount = computed(() => sourceStats.value.length)

const unreadCount = computed(() => articles.value.filter(a => !a.read).length)

const filtered = computed(() => {
  let list = articles.value
  if (activeSource.value !== 'all') list = list.filter(a => a.source === activeSource.value)
  if (showRead.value === 'unread') list = list.filter(a => !a.read)
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    )
  }
  return list
})

const keywords = computed(() => {
  const kws = digest.value?.keywords
  if (Array.isArray(kws) && kws.length) return kws
  // Fall back to counting tags so the cloud is never empty.
  const freq = {}
  for (const a of articles.value) {
    for (const t of (a.tags || '').split(',').filter(Boolean)) freq[t] = (freq[t] || 0) + 1
  }
  return Object.entries(freq).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 12)
})
const maxKw = computed(() => Math.max(1, ...keywords.value.map(k => k.count)))

function kwStyle(k) {
  const ratio = k.count / maxKw.value
  const size = 11.5 + ratio * 4.5
  return { fontSize: `${size.toFixed(1)}px`, opacity: (0.55 + ratio * 0.45).toFixed(2) }
}

async function load() {
  try {
    digest.value = await api.latestDigest()
    articles.value = digest.value.articles || []
    online.value = true
  } catch (e) {
    articles.value = []
    if (e.response?.status !== 404) online.value = false
  }
}

async function generate() {
  busy.value = 'generate'
  statusMsg.value = '正在从各信息源抓取内容…'
  try {
    const res = await api.generate()
    if (res.error) {
      toast.warn(res.error)
    } else {
      await load()
      toast.success(res.reused
        ? `今日日报已是最新（${res.articleCount} 篇）`
        : `日报生成完成 · ${res.articleCount} 篇文章`, 4000)
    }
  } catch (e) {
    toast.error('生成失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    busy.value = null
    statusMsg.value = ''
  }
}

async function refresh() {
  busy.value = 'fetch'
  statusMsg.value = '正在抓取最新内容…'
  try {
    const res = await api.fetchSources()
    await load()
    if (res.failed > 0) {
      toast.warn(`抓取完成，${res.failed} 个信息源失败`, 5000)
    } else {
      toast.success(`已更新 · 新增 ${res.inserted} 篇 / 刷新 ${res.refreshed} 篇`)
    }
  } catch (e) {
    toast.error('抓取失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    busy.value = null
    statusMsg.value = ''
  }
}

function onUpdate(updated) {
  const i = articles.value.findIndex(a => a.id === updated.id)
  if (i >= 0) {
    const next = articles.value.slice()
    next[i] = { ...next[i], ...updated }
    articles.value = next
  }
}

function resetFilters() {
  activeSource.value = 'all'
  search.value = ''
  showRead.value = 'all'
}

function setSource(key) {
  activeSource.value = key
  showRead.value = 'all'
}

function onSelect(article) {
  selectedId.value = article.id
}

// ---- Keyboard navigation -------------------------------------------------
function move(delta) {
  const list = filtered.value
  if (!list.length) return
  const i = list.findIndex(a => a.id === selectedId.value)
  const next = i === -1
    ? (delta > 0 ? 0 : list.length - 1)
    : Math.min(list.length - 1, Math.max(0, i + delta))
  selectedId.value = list[next].id
  scrollToSelected()
}

function scrollToSelected() {
  nextTick(() => {
    document.getElementById(`article-${selectedId.value}`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function openSelected() {
  const article = articles.value.find(a => a.id === selectedId.value)
  if (article) window.open(article.url, '_blank', 'noopener')
}

async function starSelected() {
  const article = articles.value.find(a => a.id === selectedId.value)
  if (!article) { toast.info('先用 j / k 选中一条文章'); return }
  const next = !article.starred
  onUpdate({ ...article, starred: next })
  try {
    await api.setStar(article.id, next)
    toast.success(next ? '已收藏' : '已取消收藏')
  } catch (e) {
    onUpdate({ ...article, starred: !next })
    toast.error('操作失败：' + (e.friendlyMessage || '未知错误'))
  }
}

async function markAllRead() {
  if (!digest.value?.id) return
  try {
    const res = await api.bulk({ action: 'read', digest_id: digest.value.id })
    articles.value = articles.value.map(a => ({ ...a, read: 1 }))
    toast.success(`已标记 ${res.changed} 篇为已读`)
  } catch (e) {
    toast.error('操作失败：' + (e.friendlyMessage || '未知错误'))
  }
}

useShortcuts({
  next: () => move(1),
  prev: () => move(-1),
  search: () => searchRef.value?.focus(),
  open: openSelected,
  star: starSelected,
  help: () => { showHelp.value = !showHelp.value },
  escape: () => {
    if (showHelp.value) { showHelp.value = false; return }
    if (search.value) search.value = ''
  }
})

// Keep the selection inside the visible list when filters change.
watch(filtered, (list) => {
  if (selectedId.value && !list.some(a => a.id === selectedId.value)) {
    selectedId.value = null
  }
})

onMounted(load)
onActivated(load)
</script>

<style scoped>
.view { padding: 34px 0 72px; }

/* ---------- Header ---------- */
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-bottom: 7px;
  letter-spacing: 0.01em;
}
.live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
}
.live-dot.on { background: var(--green); box-shadow: 0 0 0 2.5px var(--green-soft); }

.title {
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.024em;
  line-height: 1.15;
  color: var(--text-primary);
  margin-bottom: 5px;
}

.sub { font-size: 13.5px; color: var(--text-secondary); }
.sub strong { color: var(--text-primary); font-weight: 550; }

.head-actions { display: flex; gap: 7px; flex-shrink: 0; }
.spinning { animation: spin 0.9s linear infinite; }

/* ---------- Progress ---------- */
.progress { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.progress-track {
  flex: 1;
  height: 2px;
  border-radius: 2px;
  background: var(--bg-subtle);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  width: 34%;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: slide 1.15s var(--ease) infinite;
}
@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(320%); }
}
.progress-text { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; }

/* ---------- Keyword cloud ---------- */
.cloud {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--r-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  margin-bottom: 16px;
}
.cloud-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}
.cloud-items { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; min-width: 0; }
.kw {
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 1.35;
  letter-spacing: -0.008em;
  transition: color var(--t-fast) var(--ease);
}
.kw:hover { color: var(--accent); }

/* ---------- Filters ---------- */
.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}

.chips-scroll {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 1px;
  min-width: 0;
}
.chips-scroll::-webkit-scrollbar { display: none; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 27px;
  padding: 0 10px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 450;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--t-fast) var(--ease);
}
.chip:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-strong); }
.chip.on {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 500;
}
.chip-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.chip-n { font-size: 11px; opacity: 0.62; }

.filter-right { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }

.seg-mini {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--bg-canvas);
  border: 1px solid var(--border);
  gap: 1px;
}
.seg-mini-btn {
  height: 22px;
  padding: 0 9px;
  border-radius: var(--r-xs);
  font-size: 11.5px;
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all var(--t-fast) var(--ease);
}
.seg-mini-btn:hover { color: var(--text-primary); }
.seg-mini-btn.on { background: var(--bg-raised); color: var(--text-primary); font-weight: 500; box-shadow: var(--shadow-xs); }

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 29px;
  padding: 0 9px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--bg-canvas);
  transition: border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
  width: 190px;
}
.search:focus-within, .search.on { border-color: var(--accent-border); box-shadow: 0 0 0 3px var(--accent-soft); }
.search-icon { color: var(--text-muted); flex-shrink: 0; }
.search-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  font-size: 12.5px;
  color: var(--text-primary);
}
.search-input::placeholder { color: var(--text-muted); }
.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: var(--r-xs);
  color: var(--text-muted);
  flex-shrink: 0;
}
.search-clear:hover { color: var(--text-primary); background: var(--bg-hover); }

/* ---------- List ---------- */
.list {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 5px;
  box-shadow: var(--inner-highlight);
}

.sk-row { display: flex; gap: 14px; padding: 13px 14px; }
.sk-rank { width: 26px; height: 11px; flex-shrink: 0; margin-top: 3px; }
.sk-body { flex: 1; display: flex; flex-direction: column; gap: 7px; }
.sk-line { height: 10px; }
.sk-line.lg { height: 13px; }

/* ---------- Empty ---------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 76px 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--inner-highlight);
}
.empty.compact { padding: 52px 24px; }
.empty-art {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-lg);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text-muted);
  margin-bottom: 16px;
}
.empty-title { font-size: 16px; font-weight: 600; letter-spacing: -0.014em; margin-bottom: 6px; }
.empty-text {
  font-size: 13.5px;
  color: var(--text-secondary);
  max-width: 400px;
  line-height: 1.6;
  margin-bottom: 18px;
}

/* Hint + help overlay */
.hint-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 18px;
  font-size: 11.5px;
  color: var(--text-muted);
}
.hint-row kbd {
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--r-xs);
  margin: 0 1px;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.help-card {
  width: 100%;
  max-width: 340px;
  padding: 20px;
  border-radius: var(--r-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
}
.help-title { font-size: 15px; font-weight: 600; margin-bottom: 14px; }
.help-list { margin-bottom: 16px; }
.help-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-top: 1px solid var(--border-subtle);
  font-size: 13px;
}
.help-row:first-child { border-top: none; }
.help-desc { color: var(--text-secondary); }
.help-keys { display: inline-flex; gap: 4px; }
.help-keys kbd {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-secondary);
  background: var(--bg-canvas);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--r-xs);
}
.help-card .btn { width: 100%; }

@media (max-width: 860px) {
  .view { padding: 20px 0 48px; }
  .head { flex-direction: column; align-items: stretch; gap: 14px; }
  .title { font-size: 21px; }
  .head-actions { justify-content: flex-start; }
  .filters { flex-direction: column; align-items: stretch; gap: 9px; }
  .search { width: 100%; }
  .cloud { flex-direction: column; align-items: flex-start; gap: 6px; }
  .cloud-items { gap: 8px; }
  .kw { font-size: 12px !important; }
  .list { padding: 3px; }
}

@media (max-width: 480px) {
  .head-actions .btn { flex: 1 1 0; padding: 0 10px; }
}
</style>
