/**
 * 成长体系：XP / 等级 / 连续学习 / 成就 / 能力维度。
 * 设计原则：奖励"长期坚持"与"真实掌握"，而非机械刷题。
 */
import { getState, save, todayKey, todayStats } from './store.js';
import { learnedCount, masteredWordCount, trackedWordCount, getCourse, isLearned } from './course.js';

/** 等级头衔（面向成年人的成长叙事，而非儿童化奖杯） */
const TITLES = [
  '启程者', '拾音者', '听径者', '辨音者', '解码学徒',
  '解码者', '词汇猎手', '音节旅人', '流畅读者', '规律行家',
  '声径向导', '解码大师', '语感铸造者', '声径宗师',
];

/** 升到第 n 级所需的累计 XP */
function xpForLevel(n) {
  return Math.round(60 * Math.pow(n, 1.7));
}

/** 根据 XP 计算等级信息 */
export function levelInfo(xp = getState().game.xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    xp,
    pct: Math.min(1, (xp - cur) / (next - cur)),
    toNext: next - xp,
  };
}

/** 增加 XP（同时计入今日统计） */
export function addXP(n) {
  const st = getState();
  st.game.xp += n;
  todayStats().xp += n;
}

/** 记录今日有学习行为，更新连续天数 */
export function touchStreak() {
  const st = getState();
  const today = todayKey();
  const s = st.game.streak;
  if (s.lastDay === today) return;
  const yesterday = todayKey(Date.now() - 86400000);
  s.current = s.lastDay === yesterday ? s.current + 1 : 1;
  s.best = Math.max(s.best, s.current);
  s.lastDay = today;
}

/**
 * 记录一次练习结果
 * @param {'decode'|'listen'|'spell'|'assemble'|'sound'} kind 能力维度
 * @param {boolean} correct 是否正确
 */
export function recordExercise(kind, correct) {
  const st = getState();
  const skill = st.game.skills[kind];
  if (skill) {
    skill.t += 1;
    if (correct) skill.c += 1;
  }
  const day = todayStats();
  day.total += 1;
  if (correct) day.correct += 1;
  touchStreak();
}

/** 记录完成一课 */
export function recordLesson() {
  todayStats().lessons += 1;
  touchStreak();
  addXP(30);
}

/** 记录一次复习卡片 */
export function recordReview(isNewWord = false) {
  const day = todayStats();
  day.reviews += 1;
  if (isNewWord) day.newWords += 1;
  touchStreak();
}

/** 五维能力雷达：0~1 */
export function skillRadar() {
  const st = getState();
  const acc = (s) => (s.t >= 5 ? s.c / s.t : s.t > 0 ? (s.c / s.t) * (s.t / 5) : 0);
  const sk = st.game.skills;
  // 坚持维度：连续天数（30 天封顶）与活跃天数综合
  const activeDays = Object.keys(st.game.daily).length;
  const persist = Math.min(1, st.game.streak.best / 30) * 0.6 + Math.min(1, activeDays / 60) * 0.4;
  return [
    { key: 'decode', label: '见词能读', value: acc(sk.decode) },
    { key: 'listen', label: '听音辨词', value: acc(sk.listen) },
    { key: 'spell', label: '听音能写', value: acc(sk.spell) },
    { key: 'sound', label: '规律直觉', value: acc(sk.sound) },
    { key: 'persist', label: '持续力', value: persist },
  ];
}

/** 成就定义 */
export const ACHIEVEMENTS = [
  { id: 'first_lesson', name: '第一道光', desc: '完成第一条拼读规律', icon: '✦', check: () => learnedCount() >= 1 },
  { id: 'rules_10', name: '初见星空', desc: '点亮 10 条规律', icon: '✶', check: () => learnedCount() >= 10 },
  { id: 'rules_50', name: '半壁星图', desc: '点亮 50 条规律', icon: '✸', check: () => learnedCount() >= 50 },
  { id: 'rules_all', name: '满天星辰', desc: '点亮全部规律', icon: '❖', check: () => learnedCount() >= getCourse().sequence.length },
  { id: 'streak_3', name: '三日之约', desc: '连续学习 3 天', icon: '◉', check: (st) => st.game.streak.current >= 3 },
  { id: 'streak_7', name: '七日成径', desc: '连续学习 7 天', icon: '◎', check: (st) => st.game.streak.current >= 7 },
  { id: 'streak_30', name: '月不间断', desc: '连续学习 30 天', icon: '☀', check: (st) => st.game.streak.current >= 30 },
  { id: 'streak_100', name: '百日之功', desc: '连续学习 100 天', icon: '✹', check: (st) => st.game.streak.current >= 100 },
  { id: 'words_100', name: '百词在途', desc: '100 个单词进入记忆系统', icon: '♪', check: () => trackedWordCount() >= 100 },
  { id: 'words_500', name: '五百词海', desc: '500 个单词进入记忆系统', icon: '♫', check: () => trackedWordCount() >= 500 },
  { id: 'words_1500', name: '词汇行家', desc: '1500 个单词进入记忆系统', icon: '♬', check: () => trackedWordCount() >= 1500 },
  { id: 'mastered_100', name: '稳如磐石', desc: '稳定记住 100 个单词', icon: '◆', check: () => masteredWordCount() >= 100 },
  { id: 'mastered_500', name: '深植于心', desc: '稳定记住 500 个单词', icon: '◇', check: () => masteredWordCount() >= 500 },
  { id: 'reviews_1000', name: '千锤百炼', desc: '累计复习 1000 次', icon: '⟳', check: (st) => Object.values(st.game.daily).reduce((s, d) => s + d.reviews, 0) >= 1000 },
  { id: 'chapter_first', name: '星座点亮', desc: '完整点亮一个章节', icon: '✧', check: () => getCourse().chapters.some((c) => c.ruleIds.every(isLearned)) },
  { id: 'xp_5000', name: '声径常客', desc: '累计获得 5000 XP', icon: '✪', check: (st) => st.game.xp >= 5000 },
];

/** 检查并解锁新成就，返回本次新解锁列表 */
export function checkAchievements() {
  const st = getState();
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!st.game.achievements[a.id] && a.check(st)) {
      st.game.achievements[a.id] = Date.now();
      unlocked.push(a);
    }
  }
  if (unlocked.length) save();
  return unlocked;
}
