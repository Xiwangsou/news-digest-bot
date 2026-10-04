<template>
  <div class="view container">
    <header class="head">
      <div>
        <h1 class="title">我的收藏</h1>
        <p class="sub">已收藏 <span class="tnum">{{ articles.length }}</span> 篇文章</p>
      </div>
      <button v-if="articles.length" class="btn btn-ghost btn-sm" @click="sourceFilter = sourceFilter ? '' : ''">
        {{ sourceFilter || '全部来源' }}
      </button>
    </header>

    <div v-if="articles.length" class="chips">
      <button class="chip" :class="{ on: !sourceFilter }" @click="sourceFilter = ''">全部</button>
      <button v-for="s in sources" :key="s.key" class="chip" :class="{ on: sourceFilter === s.key }" @click="sourceFilter = s.key">
        <span class="chip-dot" :style="{ background: sourceColor(s.key) }" />{{ s.label }}
        <span class="chip-n tnum">{{ s.count }}</span>
      </button>
    </div>

    <div v-if="loading" class="list">
      <div v-for="i in 4" :key="i" class="sk-row">
        <div class="skeleton sk-rank" />
        <div class="sk-body">
          <div class="skeleton sk-line" style="width: 28%" />
          <div class="skeleton sk-line lg" style="width: 84%" />
        </div>
      </div>
    </div>

    <div v-else-if="!filtered.length" class="empty">
      <div class="empty-art">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
          <path d="M12 3.2l2.7 5.5 6 .8-4.35 4.25 1.03 6-5.38-2.83L6.62 19.75l1.03-6L3.3 9.5l6-.8z"/>
        </svg>
      </div>
      <h2 class="empty-title">{{ sourceFilter ? '该来源暂无收藏' : '还没有收藏任何文章' }}</h2>
      <p class="empty-text">在日报列表中点击星标，即可把感兴趣的内容收藏到这里。</p>
      <router-link to="/" class="btn btn-primary">去逛逛</router-link>
    </div>

    <div v-else class="list fade-up">
      <ArticleCard v-for="(a, i) in filtered" :key="a.id" :article="a" :index="i" @update="onUpdate" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { sourceColor, sourceLabel } from '../utils/format'
import ArticleCard from '../components/ArticleCard.vue'

const toast = useToast()

const articles = ref([])
const loading = ref(true)
const sourceFilter = ref('')

const sources = computed(() => {
  const map = new Map()
  for (const a of articles.value) {
    if (!map.has(a.source)) map.set(a.source, { key: a.source, label: sourceLabel(a.source), count: 0 })
    map.get(a.source).count++
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const filtered = computed(() =>
  sourceFilter.value ? articles.value.filter(a => a.source === sourceFilter.value) : articles.value
)

async function load() {
  loading.value = true
  try {
    const res = await api.bookmarks({ limit: 300 })
    articles.value = res.articles || []
  } catch (e) {
    toast.error('加载收藏失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    loading.value = false
  }
}

// Un-starring removes the row from this view.
function onUpdate(updated) {
  if (updated.starred) {
    const i = articles.value.findIndex(a => a.id === updated.id)
    if (i >= 0) {
      const next = articles.value.slice()
      next[i] = { ...next[i], ...updated }
      articles.value = next
    }
  } else {
    articles.value = articles.value.filter(a => a.id !== updated.id)
  }
}

onMounted(load)
</script>

<style scoped>
.view { padding: 34px 0 72px; }

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.title { font-size: 25px; font-weight: 600; letter-spacing: -0.024em; margin-bottom: 5px; }
.sub { font-size: 13.5px; color: var(--text-secondary); }
.sub span { color: var(--text-primary); font-weight: 550; }

.chips { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 12px; }
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
  transition: all var(--t-fast) var(--ease);
}
.chip:hover { background: var(--bg-hover); color: var(--text-primary); }
.chip.on { background: var(--accent-soft); border-color: var(--accent-border); color: var(--accent); font-weight: 500; }
.chip-dot { width: 5px; height: 5px; border-radius: 50%; }
.chip-n { font-size: 11px; opacity: 0.62; }

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

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 76px 24px;
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
.empty-text { font-size: 13.5px; color: var(--text-secondary); margin-bottom: 18px; }

@media (max-width: 860px) {
  .view { padding: 20px 0 48px; }
  .title { font-size: 21px; }
  .head { flex-direction: column; align-items: stretch; }
  .head .btn { display: none; }
  .list { padding: 3px; }
}
</style>
