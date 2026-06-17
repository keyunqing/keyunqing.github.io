/**
 * 全局状态存储与持久化。
 * 所有用户数据（进度、记忆卡片、成长数据、设置）都保存在 localStorage，
 * 支持导出 / 导入 JSON 备份。
 */

const KEY = 'soundpath.v1';

/** 默认状态 */
function defaultState() {
  return {
    version: 1,
    profile: {
      createdAt: Date.now(),
      dailyLessonGoal: 2, // 每日新规律数
      dailyReviewGoal: 40, // 每日复习卡片数
      retention: 0.9, // FSRS 目标保留率
      voiceURI: null,
      rate: 0.92,
      theme: 'dark',
      onboarded: false,
    },
    // 规律学习进度：{ [ruleId]: { status: 'learned', at, score } }
    rules: {},
    // 记忆卡片：{ [wordId]: FSRS card }
    cards: {},
    game: {
      xp: 0,
      streak: { current: 0, best: 0, lastDay: '' },
      // 每日统计：{ 'YYYY-MM-DD': { xp, reviews, newWords, lessons, correct, total, ms } }
      daily: {},
      // 各能力维度累计：correct/total
      skills: {
        decode: { c: 0, t: 0 },
        listen: { c: 0, t: 0 },
        spell: { c: 0, t: 0 },
        assemble: { c: 0, t: 0 },
        sound: { c: 0, t: 0 },
      },
      achievements: {}, // { id: timestamp }
    },
    ai: { baseUrl: '', apiKey: '', model: '' },
    coach: { history: [], lastBriefDay: '', brief: null },
  };
}

let state = load();
let saveTimer = null;
const listeners = new Set();

// 关闭页面前强制落盘，避免防抖期间丢数据
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* 忽略 */ }
  });
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // 浅合并，保证新版本字段存在
    const def = defaultState();
    return {
      ...def,
      ...parsed,
      profile: { ...def.profile, ...parsed.profile },
      game: {
        ...def.game,
        ...parsed.game,
        skills: { ...def.game.skills, ...(parsed.game?.skills || {}) },
        streak: { ...def.game.streak, ...(parsed.game?.streak || {}) },
      },
      ai: { ...def.ai, ...parsed.ai },
      coach: { ...def.coach, ...parsed.coach },
    };
  } catch {
    return defaultState();
  }
}

/** 获取状态（直接可变引用，修改后须调用 save()） */
export function getState() {
  return state;
}

/** 持久化（防抖）并通知订阅者 */
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('保存失败', e);
    }
  }, 150);
  listeners.forEach((fn) => fn(state));
}

/** 订阅状态变化 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 今天的日期键 YYYY-MM-DD（本地时区） */
export function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 获取（并初始化）今天的统计对象 */
export function todayStats() {
  const key = todayKey();
  if (!state.game.daily[key]) {
    state.game.daily[key] = { xp: 0, reviews: 0, newWords: 0, lessons: 0, correct: 0, total: 0, ms: 0 };
  }
  return state.game.daily[key];
}

/** 导出全部数据为 JSON 字符串 */
export function exportData() {
  return JSON.stringify(state, null, 2);
}

/** 导入数据，成功返回 true */
export function importData(json) {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.version) return false;
    state = parsed;
    localStorage.setItem(KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(state));
    return true;
  } catch {
    return false;
  }
}

/** 清空全部数据 */
export function resetData() {
  state = defaultState();
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((fn) => fn(state));
}
