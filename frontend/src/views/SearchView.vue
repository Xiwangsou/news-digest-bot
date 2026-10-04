<template>
  <div class="view container">
    <header class="head">
      <div>
        <h1 class="title">搜索</h1>
        <p class="sub">检索全部历史归档，不限于今日</p>
      </div>
    </header>

    <div class="searchbar">
      <svg class="s-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref="input"
        v-model="q"
        class="s-input"
        placeholder="搜索标题或摘要…"
        aria-label="搜索全部文章"
        @keydown.enter="run"
      />
      <button v-if="q" class="s-clear" @click="clear" aria-label="清除">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <button class="s-go" :disabled="!q.trim() || loading" @click="run">搜索</button>
    </div>

    <div v-if="q && !loading" class="meta">
      <span v-if="error" class="err">{{ error }}</span>
      <span v-else>找到 <strong class="tnum">{{ total }}</strong> 条结果<template v-if="total > results.length">，显示前 {{ results.length }} 条</template></span>
    </div>

    <div class="chips">
      <button class="chip" :class="{ on: !range }" @click="range = ''">全部时间</button>
      <button v-for="r in ranges" :key="r.v" class="chip" :class="{ on: range === r.v }" @click="range = r.v">{{ r.l }}</button>
    </div>

    <div v-if="loading" class="list">
      <div v-for="i in 5" :key="i" class="sk-row">
        <div class="skeleton sk-rank" />
        <div class="sk-body">
          <div class="skeleton sk-line" style="width: 30%" />
          <div class="skeleton sk-line lg" style="width: 80%" />
        </div>
      </div>
    </div>

    <div v-else-if="!q.trim()" class="empty">
      <div class="empty-art">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <h2 class="empty-title">搜索全部归档</h2>
      <p class="empty-text">可以找到任意历史日报中的文章，按热度或时间排序。</p>
    </div>

    <div v-else-if="searched && !results.length" class="empty">
      <div class="empty-art">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8.5 11h5" />
        </svg>
      </div>
      <h2 class="empty-title">没有找到「{{ q }}」</h2>
      <p class="empty-text">换个关键词试试，或放宽时间范围。</p>
    </div>

    <div v-else-if="results.length" class="list fade-up">
      <ArticleCard v-for="(a, i) in results" :key="a.id" :article="a" :index="i" @update="onUpdate" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { api } from '../api'
import ArticleCard from '../components/ArticleCard.vue'

const q = ref('')
const range = ref('')
const results = ref([])
const total = ref(0)
const loading = ref(false)
const searched = ref(false)
const error = ref('')
const input = ref(null)

const ranges = [
  { v: 'today', l: '今天' },
  { v: '7d', l: '近 7 天' },
  { v: '30d', l: '近 30 天' },
  { v: '90d', l: '近 90 天' }
]

async function run() {
  const term = q.value.trim()
  if (!term) { results.value = []; total.value = 0; searched.value = false; return }
  loading.value = true
  error.value = ''
  try {
    const res = await api.search({ q: term, range: range.value || undefined, limit: 100, order: 'score' })
    results.value = res.articles || []
    total.value = res.total || 0
    searched.value = true
  } catch (e) {
    error.value = '搜索失败：' + (e.friendlyMessage || '未知错误')
    results.value = []
    total.value = 0
    searched.value = true
  } finally {
    loading.value = false
  }
}

function clear() {
  q.value = ''
  results.value = []
  total.value = 0
  searched.value = false
  nextTick(() => input.value?.focus())
}

function onUpdate(updated) {
  const i = results.value.findIndex(a => a.id === updated.id)
  if (i >= 0) {
    const next = results.value.slice()
    next[i] = { ...next[i], ...updated }
    results.value = next
  }
}

let debounce = null
watch(q, () => {
  clearTimeout(debounce)
  if (!q.value.trim()) { results.value = []; total.value = 0; searched.value = false; return }
  debounce = setTimeout(run, 320)
})

watch(range, () => { if (q.value.trim()) run() })

onMounted(() => input.value?.focus())
</script>

<style scoped>
.view { padding: 34px 0 72px; }

.head { margin-bottom: 18px; }
.title { font-size: 25px; font-weight: 600; letter-spacing: -0.024em; margin-bottom: 5px; }
.sub { font-size: 13.5px; color: var(--text-secondary); }

.searchbar {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 8px 0 13px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  box-shadow: var(--inner-highlight);
  transition: border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.searchbar:focus-within { border-color: var(--accent-border); box-shadow: 0 0 0 3px var(--accent-soft); }
.s-icon { color: var(--text-muted); flex-shrink: 0; }
.s-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  font-size: 14.5px;
  color: var(--text-primary);
}
.s-input::placeholder { color: var(--text-muted); }
.s-clear {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: var(--r-xs);
  color: var(--text-muted); flex-shrink: 0;
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.s-clear:hover { color: var(--text-primary); background: var(--bg-hover); }
.s-go {
  height: 28px;
  padding: 0 12px;
  border-radius: var(--r-sm);
  background: var(--accent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 500;
  flex-shrink: 0;
  transition: background var(--t-fast) var(--ease);
}
.s-go:hover:not(:disabled) { background: var(--accent-hover); }
.s-go:disabled { opacity: 0.4; cursor: not-allowed; }

.meta { margin: 12px 0 0; font-size: 12.5px; color: var(--text-tertiary); }
.meta strong { color: var(--text-primary); font-weight: 550; }
.err { color: var(--red); }

.chips { display: flex; gap: 5px; flex-wrap: wrap; margin: 12px 0 0; }
.chip {
  height: 26px;
  padding: 0 11px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  transition: all var(--t-fast) var(--ease);
}
.chip:hover { background: var(--bg-hover); color: var(--text-primary); }
.chip.on { background: var(--accent-soft); border-color: var(--accent-border); color: var(--accent); font-weight: 500; }

.list {
  margin-top: 14px;
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

.empty {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 66px 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}
.empty-art {
  width: 60px; height: 60px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--r-lg);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--text-muted);
  margin-bottom: 16px;
}
.empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.empty-text { font-size: 13.5px; color: var(--text-secondary); }

@media (max-width: 860px) {
  .view { padding: 20px 0 48px; }
  .title { font-size: 21px; }
  .list { padding: 3px; }
}
</style>
