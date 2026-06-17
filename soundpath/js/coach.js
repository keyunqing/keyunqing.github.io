/**
 * AI 教练体系。
 * 双层设计：
 *  1. 本地分析教练 —— 完全离线，基于真实学习数据生成每日简报、弱点分析与鼓励，
 *     保证产品没有任何外部依赖也有"被陪伴"的体验。
 *  2. 云端 LLM 教练 —— 用户可配置任意 OpenAI 兼容接口（DeepSeek / OpenAI / Ollama 等），
 *     对话时自动携带学习数据摘要，成为真正"懂你"的私人导师。
 */
import { getState, todayKey } from './store.js';
import { getCourse, getRule, learnedCount, masteredWordCount, trackedWordCount, nextRuleId } from './course.js';
import { levelInfo, skillRadar } from './gamify.js';
import { dueCards } from './scheduler.js';

const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** 找出最薄弱的规律（按所属卡片的遗忘次数与低稳定性排序） */
export function weakRules(limit = 3) {
  const st = getState();
  const course = getCourse();
  const score = new Map();
  for (const [wid, card] of Object.entries(st.cards)) {
    const w = course.words[wid];
    if (!w) continue;
    const weakness = (card.lapses || 0) * 2 + (card.reps > 1 && card.s < 4 ? 1 : 0);
    if (weakness > 0) score.set(w.ruleId, (score.get(w.ruleId) || 0) + weakness);
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => getRule(id))
    .filter(Boolean);
}

/** 学习数据摘要（供本地简报与 LLM 上下文共用） */
export function learnerSummary() {
  const st = getState();
  const lv = levelInfo();
  const days = Object.keys(st.game.daily).length;
  const radar = skillRadar();
  const weak = weakRules(3);
  return {
    level: lv.level,
    title: lv.title,
    xp: st.game.xp,
    streak: st.game.streak.current,
    bestStreak: st.game.streak.best,
    activeDays: days,
    learnedRules: learnedCount(),
    totalRules: getCourse().sequence.length,
    trackedWords: trackedWordCount(),
    masteredWords: masteredWordCount(),
    dueCount: dueCards().length,
    skills: Object.fromEntries(radar.map((r) => [r.label, Math.round(r.value * 100) + '%'])),
    weakRules: weak.map((r) => `${r.graphemes.join('/')}（${r.nameCn}）`),
  };
}

/** 生成今日简报（本地，无需网络） */
export function dailyBrief() {
  const st = getState();
  const s = learnerSummary();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const lines = [];

  // 开场
  if (s.activeDays <= 1 && s.learnedRules === 0) {
    lines.push(`${greeting}。欢迎来到声径。英语单词的拼写和发音之间藏着一套规律，掌握它们，你就能"见词能读、听音能写"。我们从今天开始，一颗星一颗星地点亮它。`);
  } else if (s.streak >= 3) {
    lines.push(`${greeting}。你已经连续学习 ${s.streak} 天了——成年人的学习，拼的从来不是爆发力，而是这种持续。`);
  } else if (st.game.streak.lastDay && st.game.streak.lastDay !== todayKey() && st.game.streak.lastDay !== todayKey(Date.now() - 86400000)) {
    lines.push(`${greeting}。有几天没见了，没关系——中断不是失败，回来才是关键。今天我们轻松一点，先从复习找回手感。`);
  } else {
    lines.push(`${greeting}。`);
  }

  // 今日任务
  if (s.dueCount > 0) {
    lines.push(`记忆系统显示有 ${s.dueCount} 个单词正处在"将忘未忘"的最佳复习点，现在复习它们，效率最高。`);
  }
  const next = nextRuleId();
  if (next) {
    const r = getRule(next);
    lines.push(`今天的新内容是「${r.graphemes.join(' / ')}」—— ${r.nameCn}。`);
  } else {
    lines.push(`所有规律都已点亮，接下来交给记忆系统，把它们变成长在身上的直觉。`);
  }

  // 弱点提醒
  if (s.weakRules.length) {
    lines.push(`另外我注意到，${s.weakRules[0]} 这条规律的单词你忘得比较多，复习时会适当多照顾它。`);
  }

  // 收尾
  lines.push(pickOne([
    '不求快，求每天都在。',
    '十五分钟就够，贵在今天也来了。',
    '你正在做的事，是给未来的自己修一条路。',
    '规律会忘，但直觉会留下——这正是我们训练的目标。',
    '慢慢来，比较快。',
  ]));

  return lines;
}

/** 本地弱点分析报告 */
export function weaknessReport() {
  const st = getState();
  const course = getCourse();
  const weak = weakRules(5);
  if (!weak.length) return null;
  return weak.map((r) => {
    const words = Object.entries(st.cards)
      .filter(([wid, c]) => course.words[wid]?.ruleId === r.id && (c.lapses > 0 || (c.reps > 1 && c.s < 4)))
      .sort((a, b) => (b[1].lapses || 0) - (a[1].lapses || 0))
      .slice(0, 6)
      .map(([wid]) => course.words[wid]);
    return { rule: r, words };
  });
}

/** 是否已配置云端 LLM */
export function aiConfigured() {
  const { apiKey, model } = getState().ai;
  return Boolean(apiKey && model);
}

/**
 * 调用 OpenAI 兼容接口与教练对话。
 * @param {Array<{role:string, content:string}>} messages 对话历史（不含 system）
 * @returns {Promise<string>} 教练回复
 */
export async function chatWithCoach(messages) {
  const { baseUrl, apiKey, model } = getState().ai;
  const summary = learnerSummary();
  const system = `你是「声径 SoundPath」的私人英语教练，面对的是一位中文母语的成年学习者。
他正在通过自然拼读规律 + 间隔重复记忆系统建立英语解码能力。

你的风格：像一位真诚、专业、温和的私人教练——不居高临下、不空洞打气、不儿童化。
你的职责：解答英语发音/拼读/词汇问题；基于数据指出问题与进步；在用户气馁时给予真实可信的鼓励。
回答用中文（英语示例除外），简洁、口语化，避免长篇大论。

这位学习者的实时数据：
${JSON.stringify(summary, null, 2)}`;

  const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages.slice(-12)],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`接口返回 ${res.status}：${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('接口未返回内容');
  return content.trim();
}
