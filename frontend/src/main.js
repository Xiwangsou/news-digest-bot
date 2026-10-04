import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './assets/app.css'
import TodayDigest from './views/TodayDigest.vue'
import HistoryView from './views/HistoryView.vue'
import SourcesView from './views/SourcesView.vue'
import BookmarksView from './views/BookmarksView.vue'
import SearchView from './views/SearchView.vue'
import SettingsView from './views/SettingsView.vue'

const routes = [
  { path: '/', name: 'today', component: TodayDigest, meta: { title: '今日日报' } },
  { path: '/search', name: 'search', component: SearchView, meta: { title: '搜索' } },
  { path: '/bookmarks', name: 'bookmarks', component: BookmarksView, meta: { title: '我的收藏' } },
  { path: '/history', name: 'history', component: HistoryView, meta: { title: '历史归档' } },
  { path: '/sources', name: 'sources', component: SourcesView, meta: { title: '信息源' } },
  { path: '/settings', name: 'settings', component: SettingsView, meta: { title: '设置' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 }
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · News Digest` : 'News Digest'
})

createApp(App).use(router).mount('#app')
