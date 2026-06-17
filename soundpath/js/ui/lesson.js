/**
 * 「课程」页：学习一条拼读规律。
 * 流程：讲解（看 + 听 + 例词探索）→ 引导练习（多题型）→ 完成（例词进入记忆系统）。
 */
import { getRule, getChapters, isLearned, nextRuleId } from '../course.js';
import { getState, save } from '../store.js';
import { addCardsForRule } from '../scheduler.js';
import { buildLessonQuiz } from '../exercises.js';
import { recordExercise, recordLesson, addXP, checkAchievements } from '../gamify.js';
import { esc, renderBreakdown, renderSyllables, achievementToast, celebrate } from './components.js';
import { renderExercise } from './exercise.js';
import { speak } from '../audio.js';

export function renderLesson(view, ruleId) {
  const rule = getRule(ruleId);
  if (!rule) {
    location.hash = '#/map';
    return;
  }
  let disposeEx = null;
  renderTeach(view, rule, () => startQuiz(view, rule, (d) => (disposeEx = d)));
  return () => disposeEx && disposeEx();
}

/** 讲解阶段 */
function renderTeach(view, rule, onStart) {
  const chapter = getChapters().find((c) => c.id === rule.chapterId);
  const words = rule.examples.slice(0, 10);
  const learned = isLearned(rule.id);

  view.innerHTML = `
  <div class="page page-lesson">
    <header class="lesson-head">
      <a class="back-link" href="#/map">← 星图</a>
      <p class="lesson-chapter">${esc(chapter?.title || '')}</p>
      <div class="lesson-title-row">
        <div class="grapheme-stack">${rule.graphemes.map((g) => `<span class="grapheme-big">${esc(g)}</span>`).join('')}</div>
        <div>
          <h1>${esc(rule.nameCn)}</h1>
          <p class="lesson-ipa">${esc(rule.ipa)}　<button class="icon-btn" id="hear-rule" title="听例词">🔊</button></p>
        </div>
      </div>
    </header>

    <section class="card lesson-explain">
      <p>${esc(rule.explainZh)}</p>
      ${rule.notes.length ? `<ul class="lesson-notes">${rule.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </section>

    ${words.length ? `
    <section class="lesson-words">
      <h2>例词 <small>点击发音，注意彩色部分</small></h2>
      <div class="word-grid">
        ${words.map((w, i) => `
        <div class="card word-card" data-i="${i}">
          <div class="word-bk">${renderBreakdown(w)}</div>
          ${renderSyllables(w) ? `<div class="word-syl">${renderSyllables(w)}</div>` : ''}
          <div class="word-meaning">${esc(w.meaning)}</div>
          ${w.sentence ? `<div class="word-sentence" data-sent="${esc(w.sentence)}" title="点击朗读例句">${esc(w.sentence)}<span>${esc(w.sentenceCn)}</span></div>` : ''}
        </div>`).join('')}
      </div>
    </section>` : ''}

    <div class="lesson-actions">
      ${words.length >= 4
        ? `<button class="btn btn-primary btn-lg" id="start-quiz">开始练习</button>`
        : `<button class="btn btn-primary btn-lg" id="mark-done">我理解了，标记完成</button>`}
      ${learned ? '<p class="lesson-relearn-note">这条规律你已点亮，本次为巩固复习</p>' : ''}
    </div>
  </div>`;

  // 例词发音
  view.querySelectorAll('.word-card').forEach((c) => {
    c.addEventListener('click', (e) => {
      if (e.target.closest('.word-sentence')) return;
      speak(rule.examples[Number(c.dataset.i)].w);
      c.classList.remove('pulse');
      void c.offsetWidth;
      c.classList.add('pulse');
    });
  });
  view.querySelectorAll('.word-sentence').forEach((s) => {
    s.addEventListener('click', () => speak(s.dataset.sent, { rate: 0.85 }));
  });

  // 顺序朗读例词
  view.querySelector('#hear-rule')?.addEventListener('click', () => {
    const list = words.slice(0, 4).map((w) => w.w);
    let i = 0;
    const next = () => {
      if (i < list.length) speak(list[i++], { onend: () => setTimeout(next, 350) });
    };
    next();
  });

  view.querySelector('#start-quiz')?.addEventListener('click', onStart);
  view.querySelector('#mark-done')?.addEventListener('click', () => completeLesson(view, rule, { correct: 0, total: 0 }));
}

/** 练习阶段 */
function startQuiz(view, rule, setDispose) {
  const quiz = buildLessonQuiz(rule.id, 8);
  let idx = 0;
  let correct = 0;
  let dispose = null;

  view.innerHTML = `
  <div class="page page-quiz">
    <header class="quiz-head">
      <button class="back-link" id="back-teach">← 返回讲解</button>
      <div class="quiz-progress"><div class="quiz-progress-fill" style="width:0%"></div></div>
      <span class="quiz-count">1 / ${quiz.length}</span>
    </header>
    <div class="quiz-stage"><div class="exercise" id="ex-box"></div></div>
  </div>`;

  view.querySelector('#back-teach').addEventListener('click', () => {
    if (dispose) dispose();
    renderTeach(view, rule, () => startQuiz(view, rule, setDispose));
  });

  const box = view.querySelector('#ex-box');
  const fill = view.querySelector('.quiz-progress-fill');
  const count = view.querySelector('.quiz-count');

  const showNext = () => {
    if (dispose) dispose();
    if (idx >= quiz.length) {
      completeLesson(view, rule, { correct, total: quiz.length });
      return;
    }
    count.textContent = `${idx + 1} / ${quiz.length}`;
    fill.style.width = `${(idx / quiz.length) * 100}%`;
    dispose = renderExercise(box, quiz[idx], {
      onResult({ correct: ok }) {
        recordExercise(quiz[idx].skill, ok);
        addXP(ok ? 6 : 2);
        if (ok) correct++;
        idx++;
        save();
        showNext();
      },
    });
    setDispose(dispose);
  };
  showNext();
}

/** 完成阶段 */
function completeLesson(view, rule, { correct, total }) {
  const st = getState();
  const first = !isLearned(rule.id);
  let added = [];

  if (first) {
    st.rules[rule.id] = { status: 'learned', at: Date.now(), score: total ? correct / total : 1 };
    added = addCardsForRule(rule.id);
    recordLesson();
  } else {
    addXP(10);
  }
  save();
  const newAch = checkAchievements();

  const acc = total ? Math.round((correct / total) * 100) : null;
  const next = nextRuleId();

  view.innerHTML = `
  <div class="page page-done">
    <div class="done-inner">
      <div class="done-star">✦</div>
      <h1>${first ? '新的星已点亮' : '巩固完成'}</h1>
      <p class="done-rule"><span class="grapheme-pill">${esc(rule.graphemes.join(' / '))}</span> ${esc(rule.nameCn)}</p>
      <div class="done-stats">
        ${acc != null ? `<div class="done-stat"><strong>${acc}%</strong><span>练习正确率</span></div>` : ''}
        <div class="done-stat"><strong>+${first ? 30 + (total ? correct * 6 + (total - correct) * 2 : 0) : 10 + correct * 6 + (total - correct) * 2}</strong><span>XP</span></div>
        ${added.length ? `<div class="done-stat"><strong>${added.length}</strong><span>个单词进入记忆系统</span></div>` : ''}
      </div>
      ${added.length ? `<p class="done-note">这些单词将由记忆系统在最佳时机安排复习，无需刻意死记。</p>` : ''}
      <div class="done-actions">
        ${next ? `<a class="btn btn-primary btn-lg" href="#/lesson/${esc(next)}">下一颗星</a>` : ''}
        <a class="btn" href="#/map">回到星图</a>
        <a class="btn" href="#/home">今日页</a>
      </div>
    </div>
  </div>`;

  if (first) celebrate();
  newAch.forEach((a, i) => setTimeout(() => achievementToast(a), 600 + i * 900));
}
