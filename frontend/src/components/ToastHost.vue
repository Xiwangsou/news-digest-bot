<template>
  <div class="toast-viewport" role="status" aria-live="polite">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">
        <span class="toast-icon">
          <svg v-if="t.type === 'success'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else-if="t.type === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <svg v-else-if="t.type === 'warn'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close" @click="dismiss(t.id)" aria-label="关闭">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast'
const { toasts, dismiss } = useToast()
</script>

<style scoped>
.toast-viewport {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: min(400px, calc(100vw - 40px));
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 10px 10px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-md), var(--inner-highlight);
  backdrop-filter: blur(12px);
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.toast-icon { flex-shrink: 0; margin-top: 2px; display: flex; }
.toast-msg { flex: 1; min-width: 0; word-break: break-word; }

.toast-success .toast-icon { color: var(--green); }
.toast-error .toast-icon { color: var(--red); }
.toast-warn .toast-icon { color: var(--amber); }
.toast-info .toast-icon { color: var(--accent); }

.toast-success { border-left: 2px solid var(--green); }
.toast-error { border-left: 2px solid var(--red); }
.toast-warn { border-left: 2px solid var(--amber); }
.toast-info { border-left: 2px solid var(--accent); }

.toast-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--r-xs);
  color: var(--text-muted);
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.toast-close:hover { color: var(--text-primary); background: var(--bg-hover); }

.toast-enter-active { transition: all var(--t-slow) var(--ease-out); }
.toast-leave-active { transition: all var(--t-base) var(--ease); position: absolute; right: 0; }
.toast-enter-from { opacity: 0; transform: translateX(24px) scale(0.97); }
.toast-leave-to { opacity: 0; transform: translateX(24px) scale(0.97); }
.toast-move { transition: transform var(--t-base) var(--ease); }
</style>
