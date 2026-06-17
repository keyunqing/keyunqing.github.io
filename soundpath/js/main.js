/**
 * 应用入口：加载数据、初始化语音、挂载路由与侧边导航。
 */
import { loadCourse } from './course.js';
import { initAudio } from './audio.js';
import { getState, subscribe } from './store.js';
import { dueCards } from './scheduler.js';
import { levelInfo } from './gamify.js';
import { esc } from './ui/components.js';
import { renderHome } from './ui/home.js';
import { renderMap } from './ui/map.js';
import { renderLesson } from './ui/lesson.js';
import { renderReview } from './ui/review.js';
import { renderStats } from './ui/stats.js';
import { renderCoach } from './ui/coach-ui.js';
import { renderSettings } from './ui/settings.js';

const NAV = [
  { path: 'home', label: '今日', icon: 'M12 3l8 6v12h-5v-7h-6v7H4V9z' },
  { path: 'map', label: '星图', icon: 'M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z' },
  { path: 'review', label: '复习', icon: 'M12 4a8 8 0 108 8h-2.5M20 4v5h-5' },
  { path: 'stats', label: '成长', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { path: 'coach', label: '教练', icon: 'M21 12a8 8 0 11-4-6.9M8 12h.01M12 12h.01M16 12h.01' },
  { path: 'settings', label: '设置', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8 4l2-1-1-3-2.2.4a8 8 0 00-1.4-1.4L18 4l-3-1-1 2a8 8 0 00-2 0L11 3 8 4l.6 2.2A8 8 0 007.2 7.6L5 7 4 10l2 1a8 8 0 000 2l-2 1 1 3 2.2-.4a8 8 0 001.4 1.4L8 20l3 1 1-2a8 8 0 002 0l1 2 3-1-.6-2.2a8 8 0 001.4-1.4L21 17l1-3z' },
];

const routes = {
  home: renderHome,
  map: renderMap,
  lesson: renderLesson,
  review: renderReview,
  stats: renderStats,
  coach: renderCoach,
  settings: renderSettings,
};

let disposeView = null;

/** 跳转路由 */
export function navigate(path) {
  location.hash = '#/' + path;
}

function currentRoute() {
  const hash = location.hash.replace(/^#\//, '') || 'home';
  const [name, ...args] = hash.split('/');
  return { name: routes[name] ? name : 'home', args };
}

function renderNav() {
  const { name } = currentRoute();
  const due = dueCards().length;
  document.getElementById('nav').innerHTML = NAV.map((n) => `
    <a class="nav-item ${name === n.path || (name === 'lesson' && n.path === 'map') ? 'active' : ''}" href="#/${n.path}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${n.icon}"/></svg>
      <span>${n.label}</span>
      ${n.path === 'review' && due > 0 ? `<em class="nav-badge">${due > 99 ? '99+' : due}</em>` : ''}
    </a>`).join('');
}

function renderSidebarFooter() {
  const st = getState();
  const lv = levelInfo();
  const streak = st.game.streak;
  const isToday = streak.lastDay === new Date().toISOString().slice(0, 10) ||
    streak.lastDay === localDateKey();
  document.getElementById('sidebar-footer').innerHTML = `
    <div class="side-level">
      <div class="side-level-row">
        <span class="side-level-num">Lv.${lv.level}</span>
        <span class="side-level-title">${esc(lv.title)}</span>
      </div>
      <div class="xp-bar"><div class="xp-fill" style="width:${Math.round(lv.pct * 100)}%"></div></div>
    </div>
    <div class="side-streak ${isToday && streak.current > 0 ? 'lit' : ''}" title="连续学习天数">
      <span class="flame">⚡</span> ${streak.current} 天
    </div>`;
}

function localDateKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function mount() {
  const { name, args } = currentRoute();
  const view = document.getElementById('view');
  if (disposeView) { disposeView(); disposeView = null; }
  view.scrollTop = 0;
  const result = routes[name](view, ...args);
  if (typeof result === 'function') disposeView = result;
  renderNav();
  renderSidebarFooter();
}

async function boot() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="boot"><div class="boot-mark">声</div><p>正在加载课程数据…</p></div>`;
  initAudio();
  await loadCourse();
  window.addEventListener('hashchange', mount);
  subscribe(() => { renderNav(); renderSidebarFooter(); });
  mount();
}

boot();
