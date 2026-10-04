<template>
  <div class="view container">
    <header class="head">
      <div>
        <h1 class="title">历史归档</h1>
        <p class="sub">共 <span class="tnum">{{ total }}</span> 份日报 · 点击查看当日精选</p>
      </div>
    </header>

    <div v-if="loading" class="list">
      <div v-for="i in 4" :key="i" class="sk-item">
        <div class="skeleton sk-date" />
        <div class="sk-info">
          <div class="skeleton sk-line" style="width: 46%" />
          <div class="skeleton sk-line" style="width: 26%" />
        </div>
      </div>
    </div>

    <div v-else-if="!digests.length" class="empty">
      <div class="empty-art">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>
        </svg>
      </div>
      <h2 class="empty-title">暂无历史日报</h2>
      <p class="empty-text">生成日报后，历史记录会保存在这里，可随时回看。</p>
      <router-link to="/" class="btn btn-primary">去生成</router-link>
    </div>

    <div v-else class="list fade-up">
      <div v-for="d in digests" :key="d.id" class="item" @click="open(d.id)">
        <div class="date">
          <span class="d-day mono">{{ formatDay(d.date_tag) }}</span>
          <span class="d-mon">{{ formatMonth(d.date_tag) }}</span>
        </div>

        <div class="info">
          <h3 class="d-title">{{ d.title }}</h3>
          <div class="d-meta">
            <span class="tnum">{{ d.article_count }} 篇</span>
            <span v-if="d.source_count" class="sep" />
            <span v-if="d.source_count" class="tnum">{{ d.source_count }} 源</span>
            <span class="sep" />
            <span>{{ formatDateTime(d.generated_at) }}</span>
          </div>
        </div>

        <div class="acts" @click.stop>
          <a class="act" :href="`/api/digests/${d.id}/markdown`" title="导出 Markdown" aria-label="导出 Markdown">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/>
            </svg>
          </a>
          <a class="act" :href="`/api/digests/${d.id}/rss`" target="_blank" rel="noopener" title="RSS 订阅" aria-label="RSS 订阅">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
              <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.3" fill="currentColor" stroke="none"/>
            </svg>
          </a>
          <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Detail modal -->
    <transition name="modal">
      <div v-if="selected" class="overlay" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-head">
            <div class="modal-title-wrap">
              <h2 class="modal-title">{{ selected.title }}</h2>
              <p class="modal-sub">
                <span class="tnum">{{ selected.articles?.length || 0 }}</span> 篇文章
                <template v-if="selected.source_count"> · <span class="tnum">{{ selected.source_count }}</span> 个信息源</template>
                · {{ formatDateTime(selected.generated_at) }}
              </p>
            </div>
            <div class="modal-acts">
              <a class="btn btn-sm btn-ghost" :href="`/api/digests/${selected.id}/markdown`">导出</a>
              <button class="btn btn-sm btn-icon" @click="close" aria-label="关闭">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </header>

          <div v-if="selected.keywords?.length" class="modal-kw">
            <span v-for="k in selected.keywords.slice(0, 8)" :key="k.word" class="kw-chip">{{ k.word }}</span>
          </div>

          <div class="modal-body">
            <div v-if="detailLoading" class="modal-loading">
              <span class="spinner" /> 加载中…
            </div>
            <ArticleCard v-for="(a, i) in selected.articles || []" :key="a.id" :article="a" :index="i" />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { formatDay, formatMonth, formatDateTime } from '../utils/format'
import ArticleCard from '../components/ArticleCard.vue'

const toast = useToast()

const digests = ref([])
const total = ref(0)
const loading = ref(true)
const detailLoading = ref(false)
const selected = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await api.digests(60)
    digests.value = res.digests || []
    total.value = res.total ?? digests.value.length
  } catch (e) {
    toast.error('加载历史失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function open(id) {
  detailLoading.value = true
  selected.value = { id, title: '加载中…', articles: [], keywords: [] }
  document.body.style.overflow = 'hidden'
  try {
    selected.value = await api.digest(id)
  } catch (e) {
    toast.error('加载日报失败：' + (e.friendlyMessage || '未知错误'))
    close()
  } finally {
    detailLoading.value = false
  }
}

function close() {
  selected.value = null
  document.body.style.overflow = ''
}

function onKey(e) {
  if (e.key === 'Escape' && selected.value) close()
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.view { padding: 34px 0 72px; }

.head { margin-bottom: 22px; }
.title { font-size: 25px; font-weight: 600; letter-spacing: -0.024em; margin-bottom: 5px; }
.sub { font-size: 13.5px; color: var(--text-secondary); }
.sub span { color: var(--text-primary); font-weight: 550; }

.list {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 5px;
  box-shadow: var(--inner-highlight);
}

.item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 11px 14px;
  margin: 0 -9px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
}
.item:hover { background: var(--bg-hover); }

.date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: var(--r-md);
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  transition: border-color var(--t-fast) var(--ease);
}
.item:hover .date { border-color: var(--border-strong); }
.d-day { font-size: 17px; font-weight: 600; line-height: 1.1; letter-spacing: -0.03em; }
.d-mon { font-size: 9.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.info { flex: 1; min-width: 0; }
.d-title {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.011em;
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--t-fast) var(--ease);
}
.item:hover .d-title { color: var(--accent); }

.d-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.sep { width: 2px; height: 2px; border-radius: 50%; background: var(--text-muted); }

.acts { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.act {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  border-radius: var(--r-sm);
  color: var(--text-muted);
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.act:hover { background: var(--bg-active); color: var(--text-primary); }
.chev { color: var(--text-muted); margin-left: 3px; transition: transform var(--t-fast) var(--ease), color var(--t-fast) var(--ease); }
.item:hover .chev { transform: translateX(2px); color: var(--accent); }

/* Skeleton */
.sk-item { display: flex; gap: 15px; padding: 11px 14px; }
.sk-date { width: 46px; height: 46px; flex-shrink: 0; }
.sk-info { flex: 1; display: flex; flex-direction: column; gap: 7px; justify-content: center; }
.sk-line { height: 10px; }

/* Empty */
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

/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 56px 20px;
  overflow-y: auto;
}

.modal {
  width: 100%;
  max-width: 780px;
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  z-index: 2;
}
.modal-title { font-size: 16.5px; font-weight: 600; letter-spacing: -0.016em; margin-bottom: 3px; }
.modal-sub { font-size: 12.5px; color: var(--text-tertiary); }
.modal-acts { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.modal-kw {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  padding: 11px 20px;
  border-bottom: 1px solid var(--border-subtle);
}
.kw-chip {
  font-size: 11.5px;
  padding: 1px 7px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.modal-body { padding: 8px 12px 14px; max-height: 62vh; overflow-y: auto; }
.modal-loading {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 40px; font-size: 13px; color: var(--text-tertiary);
}

.modal-enter-active { transition: opacity var(--t-base) var(--ease); }
.modal-leave-active { transition: opacity var(--t-fast) var(--ease); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal { transition: transform var(--t-slow) var(--ease-out); }
.modal-enter-from .modal { transform: translateY(10px) scale(0.985); }

@media (max-width: 860px) {
  .view { padding: 20px 0 48px; }
  .title { font-size: 21px; }
  .list { padding: 3px; }
  .overlay { padding: 16px 10px; }
  .modal-body { max-height: none; }
}
</style>
