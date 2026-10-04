import { ref } from 'vue'

// Minimal global toast store — replaces window.alert with non-blocking feedback.
const toasts = ref([])
let seq = 0

function push(message, type = 'info', duration = 3600) {
  const id = ++seq
  toasts.value = [...toasts.value, { id, message, type }]
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    info: (m, d) => push(m, 'info', d),
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d ?? 5000),
    warn: (m, d) => push(m, 'warn', d)
  }
}
