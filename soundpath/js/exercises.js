/**
 * 练习生成器：根据规律 / 单词与记忆状态，生成多种类型的练习题。
 * 题型设计对应五种核心能力：
 *  - flash    见词能读（自评式闪卡，FSRS 四档评分）
 *  - listen   听音辨词（音 → 形）
 *  - spell    听音能写（音 → 拼写）
 *  - assemble 拼读组装（按发音单元重组单词，强化"解码"而非整词死记）
 *  - sound    规律直觉（高亮字母组合 → 判断发音）
 */
import { getCourse, getRule } from './course.js';
import { getState } from './store.js';

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const sample = (arr, n) => shuffle(arr).slice(0, n);

/** 单词相似度（用于挑选有迷惑性的选项） */
function similarity(a, b) {
  let s = 0;
  if (a[0] === b[0]) s += 2;
  if (a[a.length - 1] === b[b.length - 1]) s += 1;
  if (Math.abs(a.length - b.length) <= 1) s += 2;
  const setB = new Set(b);
  let common = 0;
  for (const ch of new Set(a)) if (setB.has(ch)) common++;
  s += common / Math.max(a.length, b.length);
  return s;
}

/** 为目标词挑选 n 个迷惑词 */
export function pickDistractors(word, n = 3) {
  const all = Object.keys(getCourse().words).filter((w) => w !== word.toLowerCase());
  // 先在随机子集中找最相似的，保证速度与多样性
  const pool = sample(all, Math.min(220, all.length));
  return pool
    .sort((a, b) => similarity(b, word.toLowerCase()) - similarity(a, word.toLowerCase()))
    .slice(0, n)
    .map((w) => getCourse().words[w]);
}

/** 题型：听音辨词 */
function makeListen(wordObj) {
  const distractors = pickDistractors(wordObj.w, 3);
  const options = shuffle([wordObj, ...distractors]);
  return {
    type: 'listen',
    skill: 'listen',
    word: wordObj,
    options,
    answer: options.findIndex((o) => o.w === wordObj.w),
  };
}

/** 题型：听音能写 */
function makeSpell(wordObj) {
  return { type: 'spell', skill: 'spell', word: wordObj };
}

/** 题型：拼读组装 */
function makeAssemble(wordObj) {
  const tokens = wordObj.breakdown.split('|');
  if (tokens.length < 2) return makeListen(wordObj);
  // 加入 1~2 个干扰音块
  const COMMON = ['ch', 'sh', 'th', 'ai', 'ee', 'oa', 'ar', 'er', 'b', 'd', 'm', 's', 't', 'p', 'l', 'n'];
  const extras = sample(COMMON.filter((t) => !tokens.includes(t)), tokens.length >= 4 ? 1 : 2);
  return {
    type: 'assemble',
    skill: 'decode',
    word: wordObj,
    tokens: shuffle([...tokens.map((t, i) => ({ t, id: i })), ...extras.map((t, i) => ({ t, id: -1 - i }))]),
    answer: tokens,
  };
}

/** 题型：规律直觉（这个字母组合发什么音？） */
function makeSound(wordObj, rule) {
  if (!rule || !rule.ipa || !wordObj.highlight) return makeListen(wordObj);
  const course = getCourse();
  const others = course.sequence
    .map((id) => course.rules[id])
    .filter((r) => r.id !== rule.id && r.ipa && r.ipa !== rule.ipa);
  // 优先选「同字形不同发音」的规律作干扰项（如 ea 的多种读音）
  const sameGrapheme = others.filter((r) => r.graphemes.some((g) => rule.graphemes.includes(g)));
  const pool = [...new Map([...sameGrapheme, ...sample(others, 12)].map((r) => [r.ipa, r])).values()];
  const distractors = pool.slice(0, 3);
  if (distractors.length < 2) return makeListen(wordObj);
  const options = shuffle([rule, ...distractors]).map((r) => ({ ipa: r.ipa, nameCn: r.nameCn }));
  return {
    type: 'sound',
    skill: 'sound',
    word: wordObj,
    rule,
    options,
    answer: options.findIndex((o) => o.ipa === rule.ipa),
  };
}

/** 题型：见词能读闪卡（FSRS 自评） */
function makeFlash(wordObj) {
  return { type: 'flash', skill: 'decode', word: wordObj };
}

/**
 * 为一节课（一条规律）生成引导练习序列。
 * 节奏：先认（听辨）→ 再拆（组装/规律）→ 后产出（拼写）。
 */
export function buildLessonQuiz(ruleId, count = 8) {
  const rule = getRule(ruleId);
  const words = rule.examples.slice(0, 10);
  if (!words.length) return [];
  const quiz = [];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const makers = [
    () => makeListen(pick()),
    () => makeSound(pick(), rule),
    () => makeAssemble(pick()),
    () => makeListen(pick()),
    () => makeAssemble(pick()),
    () => makeSound(pick(), rule),
    () => makeSpell(pick()),
    () => makeSpell(pick()),
  ];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    let ex = makers[i % makers.length]();
    // 避免同一题型连续出现同一个词
    let guard = 0;
    while (seen.has(ex.type + ex.word.w) && guard++ < 5) ex = makers[i % makers.length]();
    seen.add(ex.type + ex.word.w);
    quiz.push(ex);
  }
  return quiz;
}

/**
 * 为复习卡片选择练习方式。
 * 记忆越成熟，题型越偏"产出型"（拼写）；新卡偏识别型。
 */
export function buildReviewExercise(wordObj) {
  const card = getState().cards[wordObj.w.toLowerCase()];
  const s = card?.s || 0;
  const rule = getRule(wordObj.ruleId);
  let kinds;
  if (s < 3) kinds = ['flash', 'listen'];
  else if (s < 10) kinds = ['flash', 'listen', 'assemble', 'sound'];
  else kinds = ['spell', 'assemble', 'flash', 'sound'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  switch (kind) {
    case 'listen': return makeListen(wordObj);
    case 'spell': return makeSpell(wordObj);
    case 'assemble': return makeAssemble(wordObj);
    case 'sound': return makeSound(wordObj, rule);
    default: return makeFlash(wordObj);
  }
}
