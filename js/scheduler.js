/**
 * 复习调度器：连接 FSRS 算法、词库与用户状态。
 * 负责：新词入库、到期队列、评分更新。
 */
import { getState, save } from './store.js';
import { getCourse } from './course.js';
import { newCard, review, cardRetention, Rating } from './fsrs.js';
import { recordReview } from './gamify.js';

export { Rating };

/** 每课进入记忆系统的例词上限（防止卡片数量失控） */
export const WORDS_PER_LESSON = 8;

/** 学完一条规律后，将其核心例词加入记忆系统 */
export function addCardsForRule(ruleId, now = Date.now()) {
  const st = getState();
  const rule = getCourse().rules[ruleId];
  const added = [];
  for (const e of rule.examples.slice(0, WORDS_PER_LESSON)) {
    const id = e.w.toLowerCase();
    if (!st.cards[id]) {
      st.cards[id] = newCard(now);
      added.push(id);
    }
  }
  save();
  return added;
}

/** 当前到期的卡片队列（含新卡），按优先级排序 */
export function dueCards(now = Date.now()) {
  const st = getState();
  const course = getCourse();
  const due = [];
  for (const [id, card] of Object.entries(st.cards)) {
    if (card.due <= now && course.words[id]) {
      due.push({ id, card, word: course.words[id] });
    }
  }
  // 旧卡按"最可能遗忘"优先；新卡靠后（先巩固旧的，再接收新的）
  return due.sort((a, b) => {
    const aNew = a.card.state === 'new' ? 1 : 0;
    const bNew = b.card.state === 'new' ? 1 : 0;
    if (aNew !== bNew) return aNew - bNew;
    return cardRetention(a.card, now) - cardRetention(b.card, now);
  });
}

/** 未来 n 天每天的到期数量预测（用于成长页图表） */
export function dueForecast(days = 7, now = Date.now()) {
  const st = getState();
  const counts = new Array(days).fill(0);
  for (const card of Object.values(st.cards)) {
    const diff = Math.floor((card.due - now) / 86400000);
    if (diff >= 0 && diff < days) counts[diff] += 1;
    else if (diff < 0) counts[0] += 1; // 已过期的都算今天
  }
  return counts;
}

/**
 * 给卡片评分，更新记忆模型。
 * @returns 更新后的卡片
 */
export function gradeCard(wordId, rating, now = Date.now()) {
  const st = getState();
  const card = st.cards[wordId];
  if (!card) return null;
  const wasNew = card.state === 'new';
  st.cards[wordId] = review(card, rating, now, st.profile.retention);
  recordReview(wasNew);
  save();
  return st.cards[wordId];
}

/** 记忆系统整体健康度：平均可提取性 */
export function memoryHealth(now = Date.now()) {
  const cards = Object.values(getState().cards).filter((c) => c.state !== 'new');
  if (!cards.length) return null;
  const sum = cards.reduce((s, c) => s + cardRetention(c, now), 0);
  return sum / cards.length;
}
