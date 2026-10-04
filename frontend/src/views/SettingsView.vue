<template>
  <div class="view container">
    <header class="head">
      <div>
        <h1 class="title">设置</h1>
        <p class="sub">聚合策略、数据保留与外观</p>
      </div>
    </header>

    <div v-if="loading" class="card pad">
      <div v-for="i in 4" :key="i" class="skeleton sk-row" />
    </div>

    <template v-else>
      <!-- Digest strategy -->
      <section class="card pad">
        <div class="sec-head">
          <h2 class="sec-title">日报策略</h2>
          <p class="sec-desc">影响下一次生成日报的结果</p>
        </div>

        <div class="field">
          <div class="field-label">
            <label for="perDigest">每份日报篇数</label>
            <span class="hint">10 – 200</span>
          </div>
          <div class="stepper">
            <button class="step" @click="bump('articlesPerDigest', -10)" :disabled="form.articlesPerDigest <= 10" aria-label="减少">−</button>
            <input id="perDigest" v-model.number="form.articlesPerDigest" type="number" min="10" max="200" step="10" class="num mono" />
            <button class="step" @click="bump('articlesPerDigest', 10)" :disabled="form.articlesPerDigest >= 200" aria-label="增加">+</button>
          </div>
        </div>

        <div class="field">
          <div class="field-label">
            <label for="share">单来源占比上限</label>
            <span class="hint">避免单一信息源霸占整份日报</span>
          </div>
          <div class="slider-row">
            <input id="share" v-model.number="form.maxSharePerSource" type="range" min="0.1" max="1" step="0.01" class="slider" />
            <span class="slider-val mono tnum">{{ Math.round(form.maxSharePerSource * 100) }}%</span>
          </div>
          <p class="preview">
            以 {{ effectiveLimit }} 篇计，单个来源最多占
            <strong>{{ Math.max(1, Math.round(effectiveLimit * form.maxSharePerSource)) }}</strong> 篇
          </p>
        </div>

        <div class="field">
          <div class="field-label">
            <label>生成时自动抓取</label>
            <span class="hint">关闭后仅使用已入库数据</span>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="form.autoFetchOnGenerate === 'true'" @change="form.autoFetchOnGenerate = $event.target.checked ? 'true' : 'false'" />
            <span class="track"><span class="knob" /></span>
          </label>
        </div>

    <div class="field">
      <div class="field-label">
        <label for="hour">每日自动生成时间</label>
        <span class="hint">定时任务触发时刻（0–23 时）</span>
      </div>
      <input id="hour" :value="form.digestHour" type="number" min="0" max="23" class="input mono"
        @change="form = { ...form, digestHour: Number($event.target.value) }" />
    </div>
      </section>

      <!-- Storage -->
      <section class="card pad">
        <div class="sec-head">
          <h2 class="sec-title">数据保留</h2>
          <p class="sec-desc">定期清理过旧文章，防止数据库无限增长</p>
        </div>

        <div v-if="stats" class="stat-grid">
          <div class="stat">
            <span class="stat-v mono tnum">{{ stats.articles }}</span>
            <span class="stat-l">文章总数</span>
          </div>
          <div class="stat">
            <span class="stat-v mono tnum">{{ stats.digests }}</span>
            <span class="stat-l">日报数</span>
          </div>
          <div class="stat">
            <span class="stat-v mono tnum">{{ stats.starred }}</span>
            <span class="stat-l">已收藏</span>
          </div>
        </div>

        <div class="field">
          <div class="field-label">
            <label for="retention">保留天数</label>
            <span class="hint">收藏文章永不清除</span>
          </div>
          <div class="stepper">
            <button class="step" @click="bump('retentionDays', -30)" :disabled="form.retentionDays <= 1" aria-label="减少">−</button>
            <input id="retention" v-model.number="form.retentionDays" type="number" min="1" max="3650" step="30" class="num mono" />
            <button class="step" @click="bump('retentionDays', 30)" :disabled="form.retentionDays >= 3650" aria-label="增加">+</button>
          </div>
        </div>

        <div class="prune-box">
          <div class="prune-text">
            <p class="prune-title">立即清理</p>
            <p class="prune-desc">
              <template v-if="pruneResult">
                <template v-if="pruneResult.dryRun">
                  将清理 <strong class="tnum">{{ pruneResult.pruned }}</strong> 篇超过 {{ pruneResult.retentionDays }} 天的文章
                  <template v-if="pruneResult.sample?.length">（例：{{ pruneResult.sample[0].title.slice(0, 28) }}…）</template>
                </template>
                <template v-else>已清理 <strong class="tnum">{{ pruneResult.pruned }}</strong> 篇文章</template>
              </template>
              <template v-else>手动触发一次清理，先预览再确认</template>
            </p>
          </div>
          <button v-if="!pruneResult || pruneResult.dryRun" class="btn btn-ghost btn-sm" @click="doPrune(false)" :disabled="pruning">
            {{ pruning ? '检查中' : '预览' }}
          </button>
          <button v-if="pruneResult?.dryRun && pruneResult.pruned > 0" class="btn btn-primary btn-sm" @click="doPrune(true)" :disabled="pruning">
            确认清理
          </button>
        </div>
      </section>

      <!-- Appearance -->
      <section class="card pad">
        <div class="sec-head">
          <h2 class="sec-title">外观</h2>
          <p class="sec-desc">主题偏好保存在本机</p>
        </div>
        <div class="field">
          <div class="field-label"><label>主题</label></div>
          <div class="seg">
            <button v-for="t in ['dark', 'light']" :key="t" class="seg-btn" :class="{ on: theme === t }" @click="setTheme(t)">
              {{ t === 'dark' ? '深色' : '浅色' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Shortcuts -->
      <section class="card pad">
        <div class="sec-head">
          <h2 class="sec-title">快捷键</h2>
          <p class="sec-desc">在日报列表中可用</p>
        </div>
        <div class="keys">
          <div v-for="k in shortcuts" :key="k.keys" class="key-row">
            <span class="key-desc">{{ k.label }}</span>
            <span class="key-combo">
              <kbd v-for="part in k.keys.split('+')" :key="part">{{ part }}</kbd>
            </span>
          </div>
        </div>
      </section>

      <!-- Save bar -->
      <transition name="v">
        <div v-if="dirty" class="savebar">
          <span class="savebar-text">有未保存的更改</span>
          <div class="savebar-acts">
            <button class="btn btn-ghost btn-sm" @click="reset">放弃</button>
            <button class="btn btn-primary btn-sm" @click="save" :disabled="saving">
              <span v-if="saving" class="spinner" />
              {{ saving ? '保存中' : '保存' }}
            </button>
          </div>
        </div>
      </transition>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useToast } from '../composables/useToast'

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const pruning = ref(false)
const form = ref({})
const original = ref({})
const stats = ref(null)
const pruneResult = ref(null)
const theme = ref(localStorage.getItem('nd-theme') || 'dark')

const shortcuts = [
  { keys: 'j', label: '下一条' },
  { keys: 'k', label: '上一条' },
  { keys: '/', label: '聚焦搜索' },
  { keys: 'o / Enter', label: '打开选中项' },
  { keys: 's', label: '收藏 / 取消收藏' },
  { keys: 'Esc', label: '清空搜索' },
  { keys: '?', label: '显示快捷键' }
]

const effectiveLimit = computed(() => Math.min(200, Math.max(10, Number(form.value.articlesPerDigest) || 50)))

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value))

function bump(key, delta) {
  const min = key === 'articlesPerDigest' ? 10 : 1
  const max = key === 'articlesPerDigest' ? 200 : 3650
  const next = Math.min(max, Math.max(min, (Number(form.value[key]) || 0) + delta))
  form.value = { ...form.value, [key]: next }
}

function setTheme(t) {
  theme.value = t
  localStorage.setItem('nd-theme', t)
  document.documentElement.setAttribute('data-theme', t)
  form.value = { ...form.value, theme: t }
}

function reset() {
  form.value = { ...original.value }
  pruneResult.value = null
}

async function load() {
  loading.value = true
  try {
    const [s, st] = await Promise.all([api.settings(), api.stats().catch(() => null)])
    original.value = { ...s }
    form.value = { ...s }
    theme.value = s.theme || 'dark'
    stats.value = st
  } catch (e) {
    toast.error('加载设置失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {
      articlesPerDigest: Number(form.value.articlesPerDigest),
      maxSharePerSource: Number(form.value.maxSharePerSource),
      autoFetchOnGenerate: String(form.value.autoFetchOnGenerate),
      digestHour: Number(form.value.digestHour),
      retentionDays: Number(form.value.retentionDays),
      // theme is an enum, not a number — never coerce it.
      theme: theme.value
    }
    const res = await api.saveSettings(payload)
    original.value = { ...original.value, ...payload }
    if (res.rejected && Object.keys(res.rejected).length) {
      toast.warn('部分设置未保存：' + Object.values(res.rejected)[0])
    } else {
      toast.success('设置已保存')
    }
    if (stats.value) stats.value = await api.stats().catch(() => stats.value)
  } catch (e) {
    const detail = e.response?.data?.details
    toast.error('保存失败：' + (detail ? Object.values(detail)[0] : (e.friendlyMessage || '未知错误')))
  } finally {
    saving.value = false
  }
}

async function doPrune(confirm) {
  pruning.value = true
  try {
    pruneResult.value = await api.prune(confirm)
    if (confirm) {
      toast.success(`已清理 ${pruneResult.value.pruned} 篇文章`)
      pruneResult.value = { ...pruneResult.value, dryRun: false }
      stats.value = await api.stats().catch(() => stats.value)
    }
  } catch (e) {
    toast.error('清理失败：' + (e.friendlyMessage || '未知错误'))
  } finally {
    pruning.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.view { padding: 34px 0 96px; max-width: 760px; }

.head { margin-bottom: 22px; }
.title { font-size: 25px; font-weight: 600; letter-spacing: -0.024em; margin-bottom: 5px; }
.sub { font-size: 13.5px; color: var(--text-secondary); }

.card { margin-bottom: 14px; }
.pad { padding: 18px 20px; }

.sec-head { margin-bottom: 16px; }
.sec-title { font-size: 14.5px; font-weight: 600; letter-spacing: -0.012em; margin-bottom: 2px; }
.sec-desc { font-size: 12.5px; color: var(--text-tertiary); }

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}
.field:first-of-type { border-top: none; padding-top: 0; }

.field-label { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.field-label label { font-size: 13.5px; color: var(--text-primary); font-weight: 450; }
.hint { font-size: 11.5px; color: var(--text-muted); }

.input { width: 84px; text-align: center; }

.stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-canvas);
  overflow: hidden;
  flex-shrink: 0;
}
.step {
  width: 28px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 15px;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.step:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.step:disabled { opacity: 0.3; cursor: not-allowed; }
.num {
  width: 52px;
  height: 30px;
  border: none;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: transparent;
  text-align: center;
  font-size: 13px;
  outline: none;
  -moz-appearance: textfield;
}
.num::-webkit-outer-spin-button, .num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.slider-row { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.slider {
  width: 128px;
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
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 1px var(--border-strong);
}
.slider-val { font-size: 12.5px; font-weight: 500; color: var(--text-secondary); width: 38px; text-align: right; }

.preview {
  width: 100%;
  margin-top: -2px;
  font-size: 11.5px;
  color: var(--text-muted);
}
.preview strong { color: var(--text-secondary); font-weight: 550; }

/* Switch */
.switch { position: relative; display: inline-flex; cursor: pointer; flex-shrink: 0; }
.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.track {
  width: 34px; height: 19px;
  border-radius: var(--r-full);
  background: var(--bg-active);
  border: 1px solid var(--border);
  display: flex; align-items: center;
  padding: 2px;
  transition: background var(--t-base) var(--ease), border-color var(--t-base) var(--ease);
}
.knob {
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform var(--t-base) var(--ease-out), background var(--t-base) var(--ease);
}
.switch input:checked + .track { background: var(--accent); border-color: transparent; }
.switch input:checked + .track .knob { transform: translateX(15px); background: #fff; }
.switch input:focus-visible + .track { box-shadow: 0 0 0 3px var(--accent-soft); }

/* Segmented */
.seg {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--bg-canvas);
  border: 1px solid var(--border);
  gap: 2px;
}
.seg-btn {
  height: 24px;
  padding: 0 14px;
  border-radius: var(--r-xs);
  font-size: 12.5px;
  color: var(--text-secondary);
  transition: all var(--t-fast) var(--ease);
}
.seg-btn:hover { color: var(--text-primary); }
.seg-btn.on { background: var(--bg-raised); color: var(--text-primary); font-weight: 500; box-shadow: var(--shadow-xs); }

/* Stats */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
}
.stat-v { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; }
.stat-l { font-size: 11px; color: var(--text-muted); }

/* Prune */
.prune-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: var(--r-sm);
  background: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
}
.prune-text { flex: 1; min-width: 0; }
.prune-title { font-size: 13px; color: var(--text-primary); margin-bottom: 1px; }
.prune-desc { font-size: 12px; color: var(--text-tertiary); line-height: 1.5; }
.prune-desc strong { color: var(--text-primary); }

/* Shortcuts */
.keys { display: flex; flex-direction: column; }
.key-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-top: 1px solid var(--border-subtle);
  font-size: 13px;
}
.key-row:first-child { border-top: none; }
.key-desc { color: var(--text-secondary); }
.key-combo { display: inline-flex; gap: 3px; }
kbd {
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
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

/* Save bar */
.savebar {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 10px 9px 16px;
  border-radius: var(--r-full);
  background: var(--bg-overlay);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg), var(--inner-highlight);
  backdrop-filter: blur(12px);
  animation: fade-up var(--t-slow) var(--ease-out);
}
.savebar-text { font-size: 13px; color: var(--text-secondary); }
.savebar-acts { display: flex; gap: 6px; }

.sk-row { height: 42px; margin-bottom: 10px; }

@media (max-width: 860px) {
  .view { padding: 20px 0 88px; }
  .title { font-size: 21px; }
  .field { flex-direction: column; align-items: flex-start; gap: 8px; }
  .field .input, .stepper, .slider-row, .switch { align-self: stretch; }
  .slider { width: 100%; flex: 1; }
  .slider-val { width: auto; }
  .stat-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .stat { padding: 8px 9px; }
  .stat-v { font-size: 15px; }
  .prune-box { flex-wrap: wrap; }
}
</style>
