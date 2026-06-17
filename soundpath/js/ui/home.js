/**
 * 「今日」页：每日入口。教练简报 + 今日任务 + 关键数据一览。
 */
import { getState, save, todayStats, todayKey } from '../store.js';
import { getRule, nextRuleId, learnedCount, getCourse, trackedWordCount, masteredWordCount } from '../course.js';
import { dueCards, memoryHealth } from '../scheduler.js';
import { dailyBrief } from '../coach.js';
import { esc, ring } from './components.js';

export function renderHome(view) {
  const st = getState();

  if (!st.profile.onboarded) {
    renderOnboarding(view);
    return;
  }

  const due = dueCards().length;
  const day = todayStats();
  const nextId = nextRuleId();
  const next = nextId ? getRule(nextId) : null;
  const course = getCourse();
  const health = memoryHealth();

  // 教练简报：每天生成一次并缓存
  if (st.coach.lastBriefDay !== todayKey()) {
    st.coach.brief = dailyBrief();
    st.coach.lastBriefDay = todayKey();
    save();
  }
  const brief = st.coach.brief || [];

  const reviewPct = Math.min(1, day.reviews / st.profile.dailyReviewGoal);
  const lessonPct = Math.min(1, day.lessons / st.profile.dailyLessonGoal);

  view.innerHTML = `
  <div class="page page-home">
    <header class="page-head">
      <h1>${greeting()}</h1>
      <p class="page-sub">${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
    </header>

    <section class="coach-brief card">
      <div class="coach-avatar">导</div>
      <div class="coach-lines">
        ${brief.map((l) => `<p>${esc(l)}</p>`).join('')}
      </div>
    </section>

    <section class="task-grid">
      <div class="card task-card ${due > 0 ? 'task-hot' : ''}">
        <div class="task-ring">${ring(reviewPct, 72, 7)}<span class="task-ring-num">${day.reviews}<small>/${st.profile.dailyReviewGoal}</small></span></div>
        <div class="task-body">
          <h3>记忆复习</h3>
          <p>${due > 0 ? `<strong>${due}</strong> 个单词到了最佳复习点` : '当前没有到期的单词'}</p>
          <a class="btn ${due > 0 ? 'btn-primary' : ''}" href="#/review">${due > 0 ? '开始复习' : '查看记忆库'}</a>
        </div>
      </div>

      <div class="card task-card">
        <div class="task-ring">${ring(lessonPct, 72, 7)}<span class="task-ring-num">${day.lessons}<small>/${st.profile.dailyLessonGoal}</small></span></div>
        <div class="task-body">
          <h3>新的规律</h3>
          ${next
            ? `<p>下一颗星：<strong class="grapheme-pill">${esc(next.graphemes.join(' / '))}</strong> ${esc(next.nameCn)}</p>
               <a class="btn btn-primary" href="#/lesson/${esc(next.id)}">开始学习</a>`
            : `<p>全部规律已点亮 ✨</p><a class="btn" href="#/map">回顾星图</a>`}
        </div>
      </div>
    </section>

    <section class="stat-row">
      <div class="card stat-mini">
        <span class="stat-num">${learnedCount()}<small>/${course.sequence.length}</small></span>
        <span class="stat-label">已点亮规律</span>
      </div>
      <div class="card stat-mini">
        <span class="stat-num">${trackedWordCount()}</span>
        <span class="stat-label">在途单词</span>
      </div>
      <div class="card stat-mini">
        <span class="stat-num">${masteredWordCount()}</span>
        <span class="stat-label">稳定记住</span>
      </div>
      <div class="card stat-mini">
        <span class="stat-num">${health == null ? '—' : Math.round(health * 100) + '%'}</span>
        <span class="stat-label">记忆健康度</span>
      </div>
    </section>
  </div>`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了，注意休息';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/** 首次使用引导 */
function renderOnboarding(view) {
  view.innerHTML = `
  <div class="page onboard">
    <div class="onboard-inner">
      <div class="onboard-logo">声</div>
      <h1>声径 <span>SoundPath</span></h1>
      <p class="onboard-tagline">为中文母语成年人设计的英语解码能力成长系统</p>

      <div class="onboard-points">
        <div class="card onboard-point">
          <span class="op-icon">✦</span>
          <h3>点亮规律星图</h3>
          <p>英语拼写与发音之间有 106 条核心规律。学完它们，你将「见词能读、听音能写」——不再逐个死记单词。</p>
        </div>
        <div class="card onboard-point">
          <span class="op-icon">⟳</span>
          <h3>科学记忆系统</h3>
          <p>内置 FSRS 记忆算法，为每个单词建模你的遗忘曲线，总在「将忘未忘」的最佳时机安排复习，记忆效率远超死背。</p>
        </div>
        <div class="card onboard-point">
          <span class="op-icon">◉</span>
          <h3>教练陪伴成长</h3>
          <p>教练会跟踪你的真实数据，指出弱点、规划节奏。每天 15 分钟，看见自己持续变强。</p>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" id="start-journey">开始我的声径</button>
      <p class="onboard-note">所有数据保存在本机，完全离线可用</p>
    </div>
  </div>`;

  view.querySelector('#start-journey').addEventListener('click', () => {
    const st = getState();
    st.profile.onboarded = true;
    save();
    location.hash = '#/lesson/' + nextRuleId();
  });
}
