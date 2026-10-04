import { onMounted, onUnmounted } from 'vue'

/**
 * Global keyboard shortcuts, ignored while typing in a field.
 *
 *   j / ArrowDown  next item
 *   k / ArrowUp    previous item
 *   /              focus search
 *   o / Enter      open the selected item
 *   s              star / unstar the selected item
 *   Esc            clear search or blur
 *   ?              toggle the shortcut hint
 */
export function useShortcuts(handlers = {}) {
  const isTyping = (el) =>
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

  function onKey(e) {
    // Never hijack browser shortcuts.
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const typing = isTyping(e.target);

    if (e.key === 'Escape') {
      if (typing) e.target.blur();
      handlers.escape?.();
      return;
    }
    if (typing) return;

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        handlers.next?.();
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        handlers.prev?.();
        break;
      case '/':
        e.preventDefault();
        handlers.search?.();
        break;
      case 'o':
      case 'Enter':
        e.preventDefault();
        handlers.open?.();
        break;
      case 's':
        e.preventDefault();
        handlers.star?.();
        break;
      case '?':
        e.preventDefault();
        handlers.help?.();
        break;
      default:
        break;
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey));
  onUnmounted(() => window.removeEventListener('keydown', onKey));

  return { onKey };
}
