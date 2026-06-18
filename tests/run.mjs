/**
 * 核心逻辑测试：FSRS 算法、课程数据完整性、练习生成器、成长体系。
 * 运行：npm test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Node 环境 shim：localStorage ----
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { review, retrievability, intervalFor, newCard, Rating } = await import('../js/fsrs.js');
const { loadCourse, getCourse, ruleMastery } = await import('../js/course.js');
const { getState } = await import('../js/store.js');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('  ✗ FAIL:', msg);
  }
}

// ============ 1. FSRS 算法 ============
console.log('[1] FSRS 记忆调度');
{
  const day = 86400000;
  const t0 = Date.now();

  // 新卡评 Good：应获得初始稳定性并排到未来
  let c = review(newCard(t0), Rating.Good, t0);
  assert(c.s > 0 && c.d >= 1 && c.d <= 10, '新卡评分后 s/d 在合法范围');
  assert(c.due > t0, 'Good 后排期在未来');

  // Easy 间隔应长于 Good，Good 长于 Hard
  const cG = review(newCard(t0), Rating.Good, t0);
  const cE = review(newCard(t0), Rating.Easy, t0);
  const cH = review(newCard(t0), Rating.Hard, t0);
  assert(cE.due > cG.due && cG.due > cH.due, '间隔排序 Easy > Good > Hard');

  // 连续按时复习 Good：稳定性应单调增长
  let cc = review(newCard(t0), Rating.Good, t0);
  let prevS = cc.s;
  let now = t0;
  for (let i = 0; i < 5; i++) {
    now = cc.due;
    cc = review(cc, Rating.Good, now);
    assert(cc.s > prevS, `第 ${i + 2} 次复习后稳定性增长 (${prevS.toFixed(1)} -> ${cc.s.toFixed(1)})`);
    prevS = cc.s;
  }
  assert(cc.s > 20, '5 次正确复习后稳定性超过 20 天');

  // 遗忘：稳定性应下降，lapses 增加，当天重现
  const before = cc.s;
  const cf = review(cc, Rating.Again, cc.due);
  assert(cf.s < before, '遗忘后稳定性下降');
  assert(cf.lapses === 1, 'lapses 计数');
  assert(cf.due - cf.last < day, '遗忘卡当天重现');

  // 可提取性曲线
  assert(Math.abs(retrievability(10, 10) - 0.9) < 0.001, 'R(S,S) = 0.9');
  assert(retrievability(0, 10) === 1, 'R(0,S) = 1');
  assert(intervalFor(10, 0.9) === 10, '目标保留率 0.9 时间隔 = S');
}

// ============ 2. 课程数据完整性 ============
console.log('[2] 课程数据');
{
  const raw = JSON.parse(
    fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/course.json'),
      'utf8'
    )
  );
  await loadCourse(raw);
  const course = getCourse();

  assert(course.chapters.length === 16, '16 个章节');
  assert(course.sequence.length >= 100, '至少 100 条规律');
  assert(Object.keys(course.words).length >= 1900, '至少 1900 个去重单词');

  // 序列中每条规律都存在且有例词
  let allValid = true;
  let withExamples = 0;
  for (const id of course.sequence) {
    const r = course.rules[id];
    if (!r) allValid = false;
    else if (r.examples.length > 0) withExamples++;
  }
  assert(allValid, '序列中所有规律均存在');
  assert(withExamples >= course.sequence.length - 12, '绝大多数规律配有例词');

  // 词条字段完整性
  let ok = true;
  for (const w of Object.values(course.words)) {
    if (!w.w || !w.breakdown || !w.ruleId) ok = false;
  }
  assert(ok, '所有词条含 w/breakdown/ruleId');

  // 章节规律覆盖序列
  const inChapters = new Set(course.chapters.flatMap((c) => c.ruleIds));
  assert(
    course.sequence.every((id) => inChapters.has(id)),
    '章节覆盖全部序列规律'
  );
}

// ============ 3. 练习生成器 ============
console.log('[3] 练习生成');
{
  const { buildLessonQuiz, buildReviewExercise, pickDistractors } = await import('../js/exercises.js');
  const course = getCourse();

  const quiz = buildLessonQuiz(course.sequence[0], 8);
  assert(quiz.length === 8, '课程练习生成 8 题');
  assert(quiz.every((q) => q.word && q.type), '每题含 word/type');

  for (const q of quiz) {
    if (q.type === 'listen' || q.type === 'sound') {
      assert(q.options.length === 4, `${q.type} 题有 4 个选项`);
      assert(q.answer >= 0 && q.answer < 4, `${q.type} 答案下标合法`);
    }
    if (q.type === 'assemble') {
      const chosen = q.answer.join('');
      assert(chosen === q.word.breakdown.split('|').join(''), 'assemble 答案与 breakdown 一致');
      assert(q.tokens.length > q.answer.length, 'assemble 含干扰音块');
    }
  }

  // 随机抽 50 个词测复习题生成
  const words = Object.values(course.words).slice(0, 50);
  let allOk = true;
  for (const w of words) {
    const ex = buildReviewExercise(w);
    if (!ex || !ex.type || !ex.word) allOk = false;
  }
  assert(allOk, '复习题生成稳定');

  const ds = pickDistractors(Object.values(course.words)[10].w, 3);
  assert(ds.length === 3 && ds.every((d) => d.w), '干扰词生成');
}

// ============ 4. 调度器 + 成长体系 ============
console.log('[4] 调度与成长');
{
  const { addCardsForRule, dueCards, gradeCard } = await import('../js/scheduler.js');
  const { levelInfo, recordExercise, checkAchievements, skillRadar } = await import('../js/gamify.js');
  const course = getCourse();

  const added = addCardsForRule(course.sequence[0]);
  assert(added.length > 0 && added.length <= 8, `每课入库卡片数合理 (${added.length})`);

  const due = dueCards();
  assert(due.length === added.length, '新卡立即进入到期队列');

  const updated = gradeCard(added[0], Rating.Good);
  assert(updated.reps === 1 && updated.due > Date.now(), '评分后卡片更新');
  assert(dueCards().length === added.length - 1, '评分后移出队列');

  // 成长
  const st = getState();
  st.rules[course.sequence[0]] = { status: 'learned', at: Date.now() };
  recordExercise('decode', true);
  recordExercise('listen', false);
  assert(st.game.streak.current >= 1, '连续天数启动');

  const lv = levelInfo(0);
  assert(lv.level === 1 && lv.title, '0 XP 为 1 级');
  assert(levelInfo(100000).level > 5, '高 XP 等级提升');

  const unlocked = checkAchievements();
  assert(unlocked.some((a) => a.id === 'first_lesson'), '解锁"第一道光"成就');

  const radar = skillRadar();
  assert(radar.length === 5 && radar.every((r) => r.value >= 0 && r.value <= 1), '五维雷达数据合法');
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
