<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 11a9 9 0 0 1 9 9" />
            <path d="M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1.4" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">News Digest</span>
          <span class="brand-sub">信息聚合日报</span>
        </div>
      </div>

      <nav class="nav" aria-label="主导航">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item"
          :class="{ active: route.name === item.name }">
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge tnum">{{ item.badge }}</span>
        </router-link>
      </nav>
      <div class="sidebar-foot">
        <div class="stat-block">
          <div class="stat-row">
            <span class="stat-label">累计文章</span>
            <span class="stat-value mono">{{ formatCount(meta.totalArticles) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">已收藏</span>
            <span class="stat-value mono">{{ formatCount(meta.starred) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">日报</span>
            <span class="stat-value mono">{{ formatCount(meta.digestCount) }}</span>
          </div>
        </div>

        <div class="foot-actions">
          <span class="status" :class="online ? 'ok' : 'off'">
            <span class="status-dot" />
            {{ online ? '服务在线' : '服务离线' }}
          </span>
          <button class="icon-toggle" @click="toggleTheme" :title="theme === 'dark' ? '切换浅色' : '切换深色'" :aria-label="theme === 'dark' ? '切换浅色主题' : '切换深色主题'">
            <svg v-if="theme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <main class="main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <ToastHost />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { api } from './api'
import { useToast } from './composables/useToast'
import { formatCount } from './utils/format'
import ToastHost from './components/ToastHost.vue'

const route = useRoute()
const { info } = useToast()

const theme = ref(localStorage.getItem('nd-theme') || 'dark')
const online = ref(false)
const meta = ref({ totalArticles: 0, starred: 0, digestCount: 0 })

const icon = (paths) => () => h('svg', {
  width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  class: 'nav-icon'
}, paths.map(d => h('path', { d })))

const navItems = computed(() => [
  {
    to: '/', name: 'today', label: '今日日报',
    icon: icon(['M3 3v5h5', 'M3.05 13A9 9 0 1 0 6 5.3L3 8', 'M12 7v5l4 2'])
  },
  {
    to: '/search', name: 'search', label: '搜索',
    icon: icon(['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm20 20-3.5-3.5'])
  },
  {
    to: '/bookmarks', name: 'bookmarks', label: '我的收藏',
    icon: icon(['M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z']),
    badge: meta.value.starred || null
  },
  {
    to: '/history', name: 'history', label: '历史归档',
    icon: icon(['M4 4h16v16H4z', 'M4 9h16', 'M9 4v16'])
  },
  {
    to: '/sources', name: 'sources', label: '信息源',
    icon: icon(['M4 6h16M4 12h16M4 18h10'])
  },
  {
    to: '/settings', name: 'settings', label: '设置',
    icon: icon(['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'])
  }
])

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.colorScheme = t
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('nd-theme', theme.value)
  applyTheme(theme.value)
}

async function checkHealth() {
  try {
    const data = await api.health()
    online.value = data.status === 'ok'
  } catch {
    online.value = false
  }
}

async function loadMeta() {
  try {
    meta.value = await api.meta()
  } catch { /* non-fatal */ }
}

let timer = null
onMounted(() => {
  applyTheme(theme.value)
  checkHealth()
  loadMeta()
  timer = setInterval(() => { checkHealth(); loadMeta() }, 30000)
})

onUnmounted(() => timer && clearInterval(timer))
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-canvas);
}

/* ---------- Sidebar ---------- */
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 18px 12px 14px;
  border-right: 1px solid var(--border);
  background: var(--bg-canvas);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 20px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--accent);
  box-shadow: var(--inner-highlight);
}

.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.014em;
  color: var(--text-primary);
  line-height: 1.3;
}
.brand-sub { font-size: 11px; color: var(--text-muted); line-height: 1.3; }

.nav { display: flex; flex-direction: column; gap: 1px; }

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  height: 32px;
  padding: 0 9px;
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 450;
  color: var(--text-secondary);
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.nav-item.active { background: var(--bg-active); color: var(--text-primary); font-weight: 500; }

.nav-item.active::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 16px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

.nav-icon { flex-shrink: 0; opacity: 0.85; }
.nav-item.active .nav-icon { opacity: 1; color: var(--accent); }
.nav-label { flex: 1; min-width: 0; }

.nav-badge {
  font-size: 11px;
  padding: 0 5px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
  color: var(--text-tertiary);
}

/* ---------- Footer ---------- */
.sidebar-foot { margin-top: auto; }

.stat-block {
  padding: 11px 10px;
  border-radius: var(--r-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  margin-bottom: 8px;
}
.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2.5px 0;
  font-size: 12px;
}
.stat-label { color: var(--text-tertiary); }
.stat-value { color: var(--text-secondary); font-size: 12px; font-weight: 500; }

.foot-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px 0;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--red);
}
.status.ok .status-dot {
  background: var(--green);
  box-shadow: 0 0 0 2.5px var(--green-soft);
}
.status.ok { color: var(--text-secondary); }

.icon-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  color: var(--text-tertiary);
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.icon-toggle:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ---------- Main ---------- */
.main { flex: 1; min-width: 0; }

.page-enter-active { transition: opacity var(--t-base) var(--ease), transform var(--t-base) var(--ease); }
.page-leave-active { transition: opacity 0.1s var(--ease); }
.page-enter-from { opacity: 0; transform: translateY(5px); }
.page-leave-to { opacity: 0; }

@media (max-width: 860px) {
  .app-shell { flex-direction: column; }
  .sidebar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    height: auto;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 8px 12px;
    border-right: none;
    border-bottom: 1px solid var(--border);
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
  }
  .brand { padding: 0 0 2px; }
  .brand-text { display: flex; }
  .nav { flex: 1; flex-direction: row; gap: 2px; overflow-x: auto; scrollbar-width: none; }
  .nav::-webkit-scrollbar { display: none; }
  .nav-item { flex: 1 0 auto; justify-content: center; height: 30px; padding: 0 9px; }
  .nav-item.active::before { display: none; }
  .nav-label { font-size: 12px; flex: none; }
  .nav-badge { display: none; }
  .sidebar-foot {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .stat-block { display: none; }
}

@media (max-width: 480px) {
  .brand-sub { display: none; }
  .nav-item { padding: 0 7px; }
  .nav-label { font-size: 11.5px; }
}
</style>
