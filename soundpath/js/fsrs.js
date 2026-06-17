/**
 * FSRS（Free Spaced Repetition Scheduler）记忆调度算法实现。
 * 基于 FSRS-5 公式与默认权重，比传统 SM-2 拥有更高的记忆效率：
 * 它会为每张卡片独立建模「难度 D」与「记忆稳定性 S」，
 * 并在每次复习后根据评分（1 忘记 / 2 困难 / 3 良好 / 4 轻松）更新模型，
 * 计算出下一次最佳复习时间。
 *
 * 本模块无 DOM 依赖，可在 Node 中单测。
 */

// FSRS-5 默认权重
const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // 使 R(S, S) = 0.9

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 可提取性：经过 t 天后还记得的概率 */
export function retrievability(t, s) {
  if (s <= 0) return 0;
  return Math.pow(1 + (FACTOR * t) / s, DECAY);
}

/** 在目标保留率 r 下，稳定性 s 对应的复习间隔（天） */
export function intervalFor(s, r = 0.9) {
  const days = (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, 365 * 3);
}

function initStability(g) {
  return Math.max(W[g - 1], 0.1);
}

function initDifficulty(g) {
  return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
}

function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3);
  const damped = d + delta * ((10 - d) / 9);
  // 均值回归，防止难度卡死在极端值
  return clamp(W[7] * initDifficulty(Rating.Easy) + (1 - W[7]) * damped, 1, 10);
}

function stabilityAfterRecall(d, s, r, g) {
  const hardPenalty = g === Rating.Hard ? W[15] : 1;
  const easyBonus = g === Rating.Easy ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function stabilityAfterForget(d, s, r) {
  const sf =
    W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r));
  return Math.min(sf, s); // 遗忘后稳定性不应高于遗忘前
}

/** 创建一张新卡片 */
export function newCard(now = Date.now()) {
  return {
    state: 'new', // new -> review
    s: 0, // 稳定性（天）
    d: 0, // 难度 1~10
    due: now,
    last: 0,
    reps: 0,
    lapses: 0,
  };
}

/**
 * 复习一张卡片，返回更新后的卡片。
 * @param {object} card 卡片
 * @param {1|2|3|4} g 评分
 * @param {number} now 当前时间戳
 * @param {number} retention 目标保留率（默认 0.9）
 */
export function review(card, g, now = Date.now(), retention = 0.9) {
  const c = { ...card };
  const elapsedDays = c.last ? Math.max(0, (now - c.last) / 86400000) : 0;

  if (c.state === 'new' || c.reps === 0) {
    c.s = initStability(g);
    c.d = initDifficulty(g);
  } else {
    const r = retrievability(elapsedDays, c.s);
    c.d = nextDifficulty(c.d, g);
    if (g === Rating.Again) {
      c.s = stabilityAfterForget(c.d, c.s, r);
      c.lapses += 1;
    } else {
      c.s = stabilityAfterRecall(c.d, c.s, r, g);
    }
  }

  c.reps += 1;
  c.last = now;
  c.state = 'review';

  // 忘记的卡片当天稍后重现；其余按稳定性排期
  const days = g === Rating.Again ? 0 : intervalFor(c.s, retention);
  c.due = g === Rating.Again ? now + 10 * 60 * 1000 : now + days * 86400000;
  return c;
}

/** 卡片当前的可提取性（用于展示记忆强度） */
export function cardRetention(card, now = Date.now()) {
  if (card.state === 'new' || !card.last) return 0;
  return retrievability((now - card.last) / 86400000, card.s);
}
