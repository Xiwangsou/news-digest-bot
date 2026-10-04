<template>
  <article
    :id="`article-${article.id}`"
    class="row"
    :class="{ read: article.read, selected }"
    :data-article-id="article.id"
    @click="emit('select', article)"
  >
    <div class="rank mono">{{ String(index + 1).padStart(2, '0') }}</div>

    <div class="body">
      <div class="meta-line">
        <span class="src" :style="{ '--src': color }">
          <span class="src-dot" />
          {{ article.source_label || sourceLabel(article.source) }}
        </span>
        <template v-if="publishedText">
          <span class="sep" />
          <span class="time">{{ publishedText }}</span>
        </template>
        <template v-if="article.tags">
          <span class="sep" />
          <span class="tags">
            <span v-for="t in tagList" :key="t" class="tag" :style="{ '--tc': tagColor(t) }">{{ tagLabel(t) }}</span>
          </span>
        </template>
      </div>

      <a class="title" :href="article.url" target="_blank" rel="noopener noreferrer" @click="markRead">
        {{ article.title }}
      </a>

      <p v-if="article.description" class="desc">{{ article.description }}</p>

      <div class="foot-line">
        <span v-if="article.upvotes > 0" class="metric">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12.876.64V.639l8.25 8.45a.75.75 0 1 1-1.073 1.05L12 2.15 3.943 10.14a.75.75 0 1 1-1.073-1.05l8.25-8.45a.75.75 0 0 1 1.756 0Z"/><path d="M12.75 9.5a.75.75 0 0 0-1.5 0v11.018l-4.943-5.1a.75.75 0 0 0-1.073 1.05l6.053 6.249a.75.75 0 0 0 1.077 0l6.053-6.249a.75.75 0 0 0-1.073-1.05L12.75 20.518V9.5Z"/></svg>
          {{ formatCount(article.upvotes) }}
        </span>
        <span v-if="article.comments_count > 0" class="metric">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {{ formatCount(article.comments_count) }}
        </span>
        <span class="metric score" title="综合热度分">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.2 6.6.5-5 4.3 1.5 6.5L12 16l-5.5 3.5L8 13l-5-4.3 6.6-.5z"/></svg>
          {{ Number(article.score || 0).toFixed(1) }}
        </span>
      </div>
    </div>

    <div class="actions">
      <button class="act star" :class="{ on: article.starred }" @click.stop="toggleStar"
        :title="article.starred ? '取消收藏' : '收藏'" :aria-label="article.starred ? '取消收藏' : '收藏'">
        <svg width="15" height="15" viewBox="0 0 24 24" :fill="article.starred ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z"/>
        </svg>
      </button>
      <a class="act" :href="article.url" target="_blank" rel="noopener noreferrer" title="在新标签页打开" aria-label="在新标签页打开" @click="markRead">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { formatCount, timeAgo, parseTags, sourceColor, sourceLabel, tagLabel, tagColor } from '../utils/format'

const props = defineProps({
  article: { type: Object, required: true },
  index: { type: Number, default: 0 },
  selected: { type: Boolean, default: false }
})
const emit = defineEmits(['update', 'select'])

const toast = useToast()

const color = computed(() => sourceColor(props.article.source))
const tagList = computed(() => parseTags(props.article.tags))
const publishedText = computed(() => timeAgo(props.article.published_at || props.article.fetched_at))

async function toggleStar() {
  const next = !props.article.starred
  // Optimistic — the row must feel instant.
  emit('update', { ...props.article, starred: next })
  try {
    await api.setStar(props.article.id, next)
  } catch (e) {
    emit('update', { ...props.article, starred: !next })
    toast.error('收藏失败：' + (e.friendlyMessage || '未知错误'))
  }
}

async function markRead() {
  if (props.article.read) return
  emit('update', { ...props.article, read: 1 })
  try {
    await api.setRead(props.article.id, true)
  } catch { /* silent — reading is best-effort */ }
}
</script>

<style scoped>
.row {
  position: relative;
  display: grid;
  grid-template-columns: 26px 1fr auto;
  gap: 14px;
  align-items: start;
  padding: 13px 14px;
  margin: 0 -14px;
  border-radius: var(--r-md);
  transition: background var(--t-fast) var(--ease);
}

.row:hover { background: var(--bg-hover); }

/* Keyboard-selected row */
.row.selected {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent-border);
}

/* Linear-style left accent pointer on hover */
.row::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
  opacity: 0;
  transform: scaleY(0.4);
  transition: opacity var(--t-base) var(--ease), transform var(--t-base) var(--ease-out);
}
.row:hover::before { opacity: 1; transform: scaleY(1); }

.rank {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-muted);
  text-align: right;
  padding-top: 2px;
  letter-spacing: -0.02em;
  transition: color var(--t-fast) var(--ease);
}
.row:hover .rank { color: var(--text-tertiary); }

.body { min-width: 0; }

.meta-line {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 4px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.src {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  color: var(--text-secondary);
}
.src-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--src);
  flex-shrink: 0;
}

.sep {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--text-muted);
}

.tags { display: inline-flex; gap: 4px; }
.tag {
  padding: 0 5px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--r-xs);
  font-size: 10.5px;
  font-weight: 500;
  color: var(--tc);
  background: color-mix(in srgb, var(--tc) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--tc) 22%, transparent);
}

.title {
  display: block;
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: -0.011em;
  color: var(--text-primary);
  transition: color var(--t-fast) var(--ease);
}
.title:hover { color: var(--accent); }

.desc {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.foot-line {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 7px;
}

.metric {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.metric svg { opacity: 0.75; }
.metric.score { color: var(--text-tertiary); font-weight: 500; }

/* Read state — muted but still legible */
.row.read .title { color: var(--text-tertiary); }
.row.read .desc { color: var(--text-muted); }

.actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0;
  transform: translateX(3px);
  transition: opacity var(--t-fast) var(--ease), transform var(--t-fast) var(--ease);
}
.row:hover .actions, .row:focus-within .actions { opacity: 1; transform: translateX(0); }

.act {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  color: var(--text-tertiary);
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.act:hover { background: var(--bg-active); color: var(--text-primary); }
.act.star.on { color: var(--star); opacity: 1; }
.row:hover .act.star.on { opacity: 1; }

@media (max-width: 860px) {
  .row { grid-template-columns: 20px 1fr auto; gap: 10px; padding: 12px 8px; margin: 0 -8px; }
  .row::before { display: none; }
  .title { font-size: 13.5px; }
  .desc { font-size: 12.5px; -webkit-line-clamp: 2; line-clamp: 2; }
  .actions { opacity: 1; transform: none; }
  .act { width: 24px; height: 24px; }
  .tags { display: none; }
}
</style>
