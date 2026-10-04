<template>
  <div class="view container">
    <header class="head">
      <div>
        <h1 class="title">信息源</h1>
        <p class="sub">
          <span class="tnum">{{ enabledCount }}</span> / <span class="tnum">{{ sources.length }}</span> 已启用
          <template v-if="health"> · <span class="tnum">{{ health.healthy }}</span> 个抓取正常</template>
        </p>
      </div>
    </header>

    <div v-if="loading" class="list">
      <div v-for="i in 6" :key="i" class="sk-row">
        <div class="skeleton sk-toggle" />
        <div class="sk-info">
          <div class="skeleton sk-line" style="width: 32%" />
          <div class="skeleton sk-line" style="width: 52%" />
        </div>
        <div class="skeleton sk-weight" />
      </div>
    </div>

    <div v-else class="list fade-up">
      <div v-for="s in sources" :key="s.id" class="row" :class="{ off: !s.enabled }">
        <label class="switch" :title="s.enabled ? '点击停用' : '点击启用'">
          <input type="checkbox" :checked="s.enabled" @change="toggle(s)" />
          <span class="track"><span class="knob" /></span>
        </label>

        <div class="info">
          <div class="top">
            <span class="dot" :style="{ background: s.color || sourceColor(s.key) }" />
            <span class="name">{{ s.label }}</span>
            <span class="key mono">{{ s.key }}</span>
            <span v-if="s.lastRun && !s.lastRun.ok" class="badge-err" title="最近一次抓取失败">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              抓取失败
            </span>
            <span v-else-if="s.articleCount" class="badge-count tnum">{{ s.articleCount }} 篇</span>
          </div>
          <p class="desc">
            {{ sourceDesc(s.key) }}
            <template v-if="s.lastRun?.ok && s.latestFetch">
              · 最近 {{ timeAgo(s.latestFetch) }}
            </template>
            <template v-if="s.lastRun && !s.lastRun.ok && s.lastRun.error">
              · <span class="err-text">{{ s.lastRun.error }}</span>
            </template>
          </p>
        </div>

        <div class="weight">
          <span class="w-label">权重</span>
          <input type="range" min="0.1" max="2" step="0.1" :value="s.weight" class="slider"
            :aria-label="`${s.label} 权重`" @change="saveWeight(s, $event.target.value)" />
          <span class="w-val mono tnum">{{ Number(s.weight).toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <div class="note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>
      </svg>
      <p>
        <strong>权重</strong>影响文章的打分排序（0.1–2.0），数值越高该来源在日报中越靠前。
        停用后，下次生成日报将不再抓取该来源。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { sourceColor, sourceDesc, timeAgo } from '../utils/format'

const toast = useToast()

const sources = ref([])
const health = ref(null)
const loading = ref(true)

const enabledCount = computed(() => sources.value.filter(s => s.enabled).length)

async function load() {
  loading.value = true
  try {
    const [list, h] = await Promise.all([
      api.sources(),
      api.sourceHealth().catch(() => null)
    ])
    sources.value = list
    health.value = h
  } catch (e) {
    toast.error('加载信息源失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function toggle(s) {
  const next = !s.enabled
  s.enabled = next
  try {
    await api.updateSource(s.key, { enabled: next })
  } catch (e) {
    s.enabled = !next
    toast.error('更新失败：' + (e.friendlyMessage || '未知错误'))
  }
}

async function saveWeight(s, val) {
  const w = parseFloat(val)
  if (Number.isNaN(w) || w === s.weight) return
  s.weight = w
  try {
    await api.updateSource(s.key, { weight: w })
  } catch (e) {
    toast.error('更新权重失败：' + (e.friendlyMessage || '未知错误'))
    load()
  }
}

onMounted(load)
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
  margin-bottom: 16px;
}

.row {
  display: grid;
  grid-template-columns: 34px 1fr 168px;
  gap: 14px;
  align-items: center;
  padding: 11px 14px;
  margin: 0 -9px;
  border-radius: var(--r-md);
  transition: background var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}
.row:hover { background: var(--bg-hover); }
.row.off { opacity: 0.5; }
.row.off:hover { opacity: 0.75; }

/* Switch */
.switch { position: relative; display: inline-flex; cursor: pointer; }
.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.track {
  width: 30px;
  height: 17px;
  border-radius: var(--r-full);
  background: var(--bg-active);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 1.5px;
  transition: background var(--t-base) var(--ease), border-color var(--t-base) var(--ease);
}
.knob {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform var(--t-base) var(--ease-out), background var(--t-base) var(--ease);
}
.switch input:checked + .track { background: var(--accent); border-color: transparent; }
.switch input:checked + .track .knob { transform: translateX(13px); background: #fff; }
.switch input:focus-visible + .track { box-shadow: 0 0 0 3px var(--accent-soft); }

/* Info */
.info { min-width: 0; }
.top { display: flex; align-items: center; gap: 7px; margin-bottom: 2px; flex-wrap: wrap; }
.dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.name { font-size: 13.5px; font-weight: 500; color: var(--text-primary); }
.key { font-size: 10.5px; color: var(--text-muted); }

.badge-count {
  font-size: 10.5px;
  padding: 0 5px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
  color: var(--text-tertiary);
}
.badge-err {
  font-size: 10.5px;
  padding: 0 6px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: var(--r-xs);
  background: var(--red-soft);
  color: var(--red);
}

.desc {
  font-size: 12.5px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.err-text { color: var(--red); opacity: 0.85; }

/* Weight */
.weight { display: flex; align-items: center; gap: 9px; }
.w-label { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  border-radius: 2px;
  background: var(--bg-active);
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 1px var(--border-strong);
  transition: transform var(--t-fast) var(--ease);
}
.slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
.slider::-moz-range-thumb {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--bg-surface); cursor: pointer;
}
.w-val { font-size: 12px; font-weight: 500; color: var(--text-secondary); width: 22px; text-align: right; flex-shrink: 0; }

/* Skeleton */
.sk-row { display: grid; grid-template-columns: 34px 1fr 168px; gap: 14px; align-items: center; padding: 11px 14px; }
.sk-toggle { width: 30px; height: 17px; }
.sk-info { display: flex; flex-direction: column; gap: 6px; }
.sk-line { height: 10px; }
.sk-weight { height: 3px; }

/* Note */
.note {
  display: flex;
  gap: 9px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
  font-size: 12.5px;
  line-height: 1.6;
}
.note svg { flex-shrink: 0; margin-top: 2px; color: var(--accent); }
.note strong { color: var(--text-secondary); font-weight: 550; }

@media (max-width: 860px) {
  .view { padding: 20px 0 48px; }
  .title { font-size: 21px; }
  .row { grid-template-columns: 34px 1fr; gap: 12px; }
  .weight { grid-column: 2; }
  .desc { white-space: normal; }
}
</style>
