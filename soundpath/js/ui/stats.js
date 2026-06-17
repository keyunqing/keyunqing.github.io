/**
 * 「成长」页：等级、能力雷达、学习热力、成就墙 —— 看见自己的变化。
 */
import { getState } from '../store.js';
import { learnedCount, getCourse, trackedWordCount, masteredWordCount } from '../course.js';
import { levelInfo, skillRadar, ACHIEVEMENTS } from '../gamify.js';
import { memoryHealth } from '../scheduler.js';
import { esc, radarSVG, heatmap } from './components.js';

export function renderStats(view) {
  const st = getState();
  const lv = levelInfo();
  const radar = skillRadar();
  const daysSince = Math.max(1, Math.ceil((Date.now() - st.profile.createdAt) / 86400000));
  const activeDays = Object.keys(st.game.daily).length;
  const totalReviews = Object.values(st.game.daily).reduce((s, d) => s + d.reviews, 0);
  const totalXP = st.game.xp;
  const health = memoryHealth();
  const unlockedCount = Object.keys(st.game.achievements).length;

  view.innerHTML = `
  <div class="page page-stats">
    <header class="page-head">
      <h1>成长轨迹</h1>
      <p class="page-sub">声径第 ${daysSince} 天 · 活跃 ${activeDays} 天</p>
    </header>

    <section class="stats-top">
      <div class="card level-card">
        <div class="level-big">Lv.${lv.level}</div>
        <div class="level-title">${esc(lv.title)}</div>
        <div class="xp-bar xp-bar-lg"><div class="xp-fill" style="width:${Math.round(lv.pct * 100)}%"></div></div>
        <p class="level-next">距下一级还差 ${lv.toNext} XP · 累计 ${totalXP} XP</p>
      </div>
      <div class="card radar-card">
        <h2 class="card-title">能力维度</h2>
        ${radarSVG(radar, 260)}
      </div>
    </section>

    <section class="stat-row">
      <div class="card stat-mini"><span class="stat-num">${learnedCount()}<small>/${getCourse().sequence.length}</small></span><span class="stat-label">点亮规律</span></div>
      <div class="card stat-mini"><span class="stat-num">${trackedWordCount()}</span><span class="stat-label">在途单词</span></div>
      <div class="card stat-mini"><span class="stat-num">${masteredWordCount()}</span><span class="stat-label">稳定记住</span></div>
      <div class="card stat-mini"><span class="stat-num">${totalReviews}</span><span class="stat-label">累计复习</span></div>
      <div class="card stat-mini"><span class="stat-num">${st.game.streak.best}</span><span class="stat-label">最长连续</span></div>
      <div class="card stat-mini"><span class="stat-num">${health == null ? '—' : Math.round(health * 100) + '%'}</span><span class="stat-label">记忆健康度</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">学习热力 <small>最近 17 周</small></h2>
      ${heatmap(st.game.daily, 17)}
      <div class="hm-legend"><span>少</span><i class="hm-cell hm-0"></i><i class="hm-cell hm-1"></i><i class="hm-cell hm-2"></i><i class="hm-cell hm-3"></i><i class="hm-cell hm-4"></i><span>多</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">成就 <small>${unlockedCount} / ${ACHIEVEMENTS.length}</small></h2>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => {
          const at = st.game.achievements[a.id];
          return `<div class="ach-item ${at ? 'unlocked' : ''}" title="${esc(a.desc)}${at ? ' · ' + new Date(at).toLocaleDateString('zh-CN') : ''}">
            <span class="ach-badge">${a.icon}</span>
            <span class="ach-name">${esc(a.name)}</span>
            <span class="ach-desc">${esc(a.desc)}</span>
          </div>`;
        }).join('')}
      </div>
    </section>
  </div>`;
}
