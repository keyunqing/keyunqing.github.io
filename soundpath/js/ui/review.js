/**
 * 「复习」页：FSRS 驱动的记忆复习会话。
 * 答错的卡片会在本次会话内重现，直到答对为止。
 */
import { dueCards, gradeCard, dueForecast } from '../scheduler.js';
import { getState, save } from '../store.js';
import { getCourse, trackedWordCount, masteredWordCount } from '../course.js';
import { buildReviewExercise } from '../exercises.js';
import { recordExercise, addXP, checkAchievements } from '../gamify.js';
import { esc, barChart, achievementToast } from './components.js';
import { renderExercise } from './exercise.js';

const SESSION_CAP = 60;

export function renderReview(view) {
  const due = dueCards();
  if (!due.length) {
    renderEmpty(view);
    return;
  }

  const queue = due.slice(0, SESSION_CAP);
  const planned = queue.length;
  let reviewed = 0;
  let correctCount = 0;
  let dispose = null;

  view.innerHTML = `
  <div class="page page-quiz">
    <header class="quiz-head">
      <a class="back-link" href="#/home">← 退出</a>
      <div class="quiz-progress"><div class="quiz-progress-fill" style="width:0%"></div></div>
      <span class="quiz-count"></span>
    </header>
    <div class="quiz-stage"><div class="exercise" id="ex-box"></div></div>
  </div>`;

  const box = view.querySelector('#ex-box');
  const fill = view.querySelector('.quiz-progress-fill');
  const count = view.querySelector('.quiz-count');

  const showNext = () => {
    if (dispose) { dispose(); dispose = null; }
    if (!queue.length) {
      finish(view, { reviewed, correctCount, planned });
      return;
    }
    const item = queue[0];
    count.textContent = `剩余 ${queue.length}`;
    fill.style.width = `${Math.min(100, (reviewed / (planned + 0.0001)) * 100)}%`;

    const ex = buildReviewExercise(item.word);
    dispose = renderExercise(box, ex, {
      onResult({ correct, rating }) {
        queue.shift();
        gradeCard(item.id, rating);
        recordExercise(ex.skill, correct);
        addXP(correct ? 5 : 1);
        reviewed++;
        if (correct) correctCount++;
        else queue.push(item); // 答错的本次会话内重现
        save();
        showNext();
      },
    });
  };
  showNext();

  return () => dispose && dispose();
}

/** 会话结束页 */
function finish(view, { reviewed, correctCount, planned }) {
  const acc = reviewed ? Math.round((correctCount / reviewed) * 100) : 0;
  const newAch = checkAchievements();
  const remaining = dueCards().length;

  view.innerHTML = `
  <div class="page page-done">
    <div class="done-inner">
      <div class="done-star">⟳</div>
      <h1>复习完成</h1>
      <div class="done-stats">
        <div class="done-stat"><strong>${planned}</strong><span>张卡片</span></div>
        <div class="done-stat"><strong>${acc}%</strong><span>首答正确率</span></div>
        <div class="done-stat"><strong>+${correctCount * 5 + (reviewed - correctCount)}</strong><span>XP</span></div>
      </div>
      <p class="done-note">每张卡片的下次复习时间已根据你的表现重新计算。</p>
      <div class="done-actions">
        ${remaining > 0 ? `<button class="btn btn-primary btn-lg" id="review-more">继续复习（还有 ${remaining}）</button>` : ''}
        <a class="btn ${remaining ? '' : 'btn-primary'}" href="#/home">回到今日</a>
        <a class="btn" href="#/map">去学新规律</a>
      </div>
    </div>
  </div>`;
  view.querySelector('#review-more')?.addEventListener('click', () => renderReview(view));
  newAch.forEach((a, i) => setTimeout(() => achievementToast(a), 500 + i * 900));
}

/** 无到期卡片时的记忆库总览 */
function renderEmpty(view) {
  const st = getState();
  const course = getCourse();
  const cards = Object.entries(st.cards);
  const forecast = dueForecast(7);
  const labels = ['今天', '明天', ...Array.from({ length: 5 }, (_, i) => {
    const d = new Date(Date.now() + (i + 2) * 86400000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  })];

  // 即将到期的卡片预览
  const upcoming = cards
    .filter(([, c]) => c.due > Date.now())
    .sort((a, b) => a[1].due - b[1].due)
    .slice(0, 8);

  view.innerHTML = `
  <div class="page">
    <header class="page-head">
      <h1>记忆库</h1>
      <p class="page-sub">当前没有到期的卡片 —— 记忆系统正在替你计时，到点自然会出现</p>
    </header>

    ${cards.length === 0 ? `
    <div class="card empty-card">
      <p>记忆库还是空的。去星图点亮第一条规律，例词就会自动进入记忆系统。</p>
      <a class="btn btn-primary" href="#/map">前往星图</a>
    </div>` : `
    <section class="stat-row">
      <div class="card stat-mini"><span class="stat-num">${trackedWordCount()}</span><span class="stat-label">在途单词</span></div>
      <div class="card stat-mini"><span class="stat-num">${masteredWordCount()}</span><span class="stat-label">稳定记住</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">未来 7 天复习预测</h2>
      ${barChart(forecast, labels, 560, 150)}
    </section>

    ${upcoming.length ? `
    <section class="card">
      <h2 class="card-title">即将到期</h2>
      <div class="upcoming-list">
        ${upcoming.map(([id, c]) => {
          const w = course.words[id];
          if (!w) return '';
          const hours = Math.max(1, Math.round((c.due - Date.now()) / 3600000));
          const when = hours < 24 ? `${hours} 小时后` : `${Math.round(hours / 24)} 天后`;
          return `<div class="upcoming-item"><span class="upcoming-word">${esc(w.w)}</span><span class="upcoming-meaning">${esc(w.meaning)}</span><span class="upcoming-when">${when}</span></div>`;
        }).join('')}
      </div>
    </section>` : ''}`}
  </div>`;
}
