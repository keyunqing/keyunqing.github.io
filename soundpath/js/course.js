/**
 * 课程引擎：加载课程数据，提供规律 / 单词 / 章节的访问与解锁逻辑。
 */
import { getState } from './store.js';

let course = null;

/**
 * 加载课程数据（应用启动时调用一次）。
 * @param {object} [preloaded] 直接注入数据（供 Node 测试使用）
 */
export async function loadCourse(preloaded) {
  if (course) return course;
  if (preloaded) {
    course = preloaded;
    return course;
  }
  const res = await fetch('./data/course.json');
  course = await res.json();
  return course;
}

export function getCourse() {
  return course;
}

export function getRule(id) {
  return course.rules[id];
}

export function getWord(id) {
  return course.words[id];
}

export function getChapters() {
  return course.chapters;
}

/** 全局学习顺序中某规律的序号 */
export function ruleIndex(id) {
  return course.sequence.indexOf(id);
}

/** 规律是否已学完 */
export function isLearned(ruleId) {
  return getState().rules[ruleId]?.status === 'learned';
}

/**
 * 规律是否已解锁。
 * 解锁规则：序列中第一个未学的规律，以及它之前的所有规律。
 * 为减少卡顿感，额外向前开放 2 个"预览位"。
 */
export function isUnlocked(ruleId) {
  const idx = ruleIndex(ruleId);
  if (idx < 0) return false;
  const frontier = nextRuleIndex();
  return idx <= frontier + 2;
}

/** 下一个待学规律在序列中的下标 */
export function nextRuleIndex() {
  const st = getState();
  for (let i = 0; i < course.sequence.length; i++) {
    if (st.rules[course.sequence[i]]?.status !== 'learned') return i;
  }
  return course.sequence.length;
}

/** 下一个待学的规律 id（全部学完返回 null） */
export function nextRuleId() {
  const i = nextRuleIndex();
  return i < course.sequence.length ? course.sequence[i] : null;
}

/** 已学规律数量 */
export function learnedCount() {
  const st = getState();
  return course.sequence.filter((id) => st.rules[id]?.status === 'learned').length;
}

/**
 * 规律的掌握度 0~1：基于其例词卡片的记忆稳定情况。
 * 未学 = 0；学完但未复习 ≈ 0.4 起步。
 */
export function ruleMastery(ruleId) {
  const st = getState();
  if (st.rules[ruleId]?.status !== 'learned') return 0;
  const rule = course.rules[ruleId];
  const cards = rule.examples
    .map((e) => st.cards[e.w.toLowerCase()])
    .filter(Boolean);
  if (!cards.length) return 0.4;
  // 稳定性 >= 21 天视为完全掌握
  const score =
    cards.reduce((sum, c) => sum + Math.min(1, (c.s || 0) / 21), 0) / cards.length;
  return 0.4 + score * 0.6;
}

/** 章节进度 { learned, total, mastery } */
export function chapterProgress(chapter) {
  const learned = chapter.ruleIds.filter(isLearned).length;
  const mastery =
    chapter.ruleIds.reduce((s, id) => s + ruleMastery(id), 0) /
    (chapter.ruleIds.length || 1);
  return { learned, total: chapter.ruleIds.length, mastery };
}

/** 已进入记忆系统的单词数 */
export function trackedWordCount() {
  return Object.keys(getState().cards).length;
}

/** 稳定记住的单词数（稳定性 >= 7 天） */
export function masteredWordCount() {
  return Object.values(getState().cards).filter((c) => (c.s || 0) >= 7).length;
}
