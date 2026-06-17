/**
 * 数据管线：将 phonics-app 的 rules-master.json 编译为声径的课程数据 data/course.json。
 *
 * 输出结构：
 *  - chapters  16 个章节（星座），按学习顺序排列
 *  - rules     107 条拼读规律（星），含讲解、例词
 *  - words     全局去重词库（SRS 卡片的数据源）
 *  - sequence  全局学习顺序（规律 id 数组）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../phonics-app/data/rules-master.json');
const OUT = path.resolve(__dirname, '../data/course.json');

const master = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/** 规范化一个例词条目 */
function normalizeWord(e) {
  if (!e || !e.word) return null;
  return {
    w: e.word,
    breakdown: e.breakdown || e.word,
    highlight: e.highlight && e.highlight.type ? e.highlight : null,
    syllables: Array.isArray(e.syllables) ? e.syllables : null,
    tokenFlags: Array.isArray(e.tokenFlags) && e.tokenFlags.length ? e.tokenFlags : null,
    meaning: e.meaning || '',
    sentence: e.sentence || '',
    sentenceCn: e.sentence_cn || '',
  };
}

const sequence = master.scopeSequence.filter((id) => master.rules.some((r) => r.id === id));
const seqIndex = new Map(sequence.map((id, i) => [id, i]));

// ---- 编译规律 ----
const rules = {};
for (const r of master.rules) {
  const seen = new Map();
  for (const list of [r.examples || [], r.words || []]) {
    for (const e of list) {
      const n = normalizeWord(e);
      if (n && !seen.has(n.w.toLowerCase())) seen.set(n.w.toLowerCase(), n);
    }
  }
  rules[r.id] = {
    id: r.id,
    chapterId: r.category,
    graphemes: r.graphemes || [],
    ipa: r.sound?.ipa || '',
    nameCn: r.sound?.name_cn || '',
    nameEn: r.sound?.name_en || '',
    explainZh: r.tts?.zh || '',
    explainEn: r.tts?.en || '',
    notes: r.notes || [],
    position: r.position || [],
    examples: [...seen.values()],
  };
}

// ---- 编译章节 ----
const chapters = master.categories
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((c) => ({
    id: c.id,
    order: c.order,
    title: c.name_cn,
    titleEn: c.name_en,
    ruleIds: sequence.filter((id) => rules[id]?.chapterId === c.id),
  }))
  .filter((c) => c.ruleIds.length > 0);

// ---- 全局去重词库（首次出现的规律作为该词的"主规律"） ----
const words = {};
for (const ruleId of sequence) {
  for (const e of rules[ruleId].examples) {
    const key = e.w.toLowerCase();
    if (!words[key]) {
      words[key] = { ...e, ruleId, ruleIds: [ruleId] };
    } else if (!words[key].ruleIds.includes(ruleId)) {
      words[key].ruleIds.push(ruleId);
    }
  }
}

const course = {
  meta: {
    generated: new Date().toISOString(),
    source: 'phonics-app rules-master.json (https://github.com/cocojojo5213/phonics-app)',
    ruleCount: sequence.length,
    wordCount: Object.keys(words).length,
  },
  chapters,
  rules,
  words,
  sequence,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(course));
console.log(
  `course.json 已生成：${chapters.length} 章节 / ${sequence.length} 规律 / ${Object.keys(words).length} 词`
);
