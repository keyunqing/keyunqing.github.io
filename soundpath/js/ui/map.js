/**
 * 「星图」页：知识地图。16 个星座（章节）× 106 颗星（规律），
 * 学习进度以"点亮"的方式可视化。
 */
import { getChapters, getRule, isLearned, isUnlocked, ruleMastery, chapterProgress, learnedCount, getCourse } from '../course.js';
import { esc, toast } from './components.js';

export function renderMap(view) {
  const chapters = getChapters();
  const total = getCourse().sequence.length;
  const learned = learnedCount();

  view.innerHTML = `
  <div class="page page-map">
    <header class="page-head">
      <h1>规律星图</h1>
      <p class="page-sub">已点亮 <strong>${learned}</strong> / ${total} 颗星 —— 每一颗，都是英语拼写与发音之间的一条通路</p>
      <div class="map-total-bar"><div style="width:${(learned / total) * 100}%"></div></div>
    </header>

    ${chapters.map((ch, ci) => {
      const prog = chapterProgress(ch);
      const done = prog.learned === prog.total;
      return `
      <section class="card chapter ${done ? 'chapter-done' : ''}">
        <div class="chapter-head">
          <div>
            <span class="chapter-no">${String(ci + 1).padStart(2, '0')}</span>
            <h3>${esc(ch.title)}</h3>
            <p class="chapter-en">${esc(ch.titleEn)}</p>
          </div>
          <div class="chapter-prog">
            <span>${prog.learned}/${prog.total}</span>
            <div class="mastery-bar" title="掌握度 ${Math.round(prog.mastery * 100)}%"><div style="width:${prog.mastery * 100}%"></div></div>
          </div>
        </div>
        <div class="star-field">
          ${ch.ruleIds.map((id) => {
            const r = getRule(id);
            const learned = isLearned(id);
            const unlocked = isUnlocked(id);
            const mastery = ruleMastery(id);
            const cls = learned
              ? mastery > 0.85 ? 'star-mastered' : 'star-lit'
              : unlocked ? 'star-open' : 'star-locked';
            return `<button class="star ${cls}" data-id="${esc(id)}" title="${esc(r.nameCn)}${learned ? ` · 掌握度 ${Math.round(mastery * 100)}%` : unlocked ? ' · 可学习' : ' · 未解锁'}">
              <span class="star-g">${esc(r.graphemes.slice(0, 2).join(' '))}</span>
              <span class="star-ipa">${esc(r.ipa)}</span>
            </button>`;
          }).join('')}
        </div>
      </section>`;
    }).join('')}
  </div>`;

  view.querySelectorAll('.star').forEach((s) => {
    s.addEventListener('click', () => {
      const id = s.dataset.id;
      if (isUnlocked(id) || isLearned(id)) {
        location.hash = '#/lesson/' + id;
      } else {
        toast('先点亮前面的星，这颗自然会解锁', 'info');
      }
    });
  });
}
