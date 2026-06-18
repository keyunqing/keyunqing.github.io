/**
 * 练习题渲染器：负责 5 种题型的交互呈现，被「课程」与「复习」两个场景共用。
 * 每题完成后通过 onResult({ correct, rating }) 通知会话控制器。
 */
import { esc, renderBreakdown } from './components.js';
import { speak, speakSlow } from '../audio.js';

const RATE_BTNS = [
  { r: 1, key: '1', label: '忘了', hint: '完全想不起来', cls: 'rate-again' },
  { r: 2, key: '2', label: '困难', hint: '勉强想起来', cls: 'rate-hard' },
  { r: 3, key: '3', label: '良好', hint: '想了一下读出来了', cls: 'rate-good' },
  { r: 4, key: '4', label: '轻松', hint: '脱口而出', cls: 'rate-easy' },
];

/** 单词详情反馈块（答题后展示） */
function feedbackHTML(w, ok) {
  return `
  <div class="ex-feedback ${ok === false ? 'wrong' : ok === true ? 'right' : ''}">
    ${ok === true ? '<div class="fb-verdict right">✓ 正确</div>' : ''}
    ${ok === false ? '<div class="fb-verdict wrong">✗ 再看一眼</div>' : ''}
    <div class="fb-word">
      <div class="fb-breakdown">${renderBreakdown(w)}</div>
      <button class="icon-btn" data-say="${esc(w.w)}" title="朗读">🔊</button>
      <button class="icon-btn" data-say-slow="${esc(w.w)}" title="慢速">🐢</button>
    </div>
    <div class="fb-meaning">${esc(w.meaning)}</div>
    ${w.sentence ? `<div class="fb-sentence" data-say-sent="${esc(w.sentence)}">${esc(w.sentence)}<span class="fb-sentence-cn">${esc(w.sentenceCn)}</span></div>` : ''}
  </div>`;
}

function bindSayButtons(root) {
  root.querySelectorAll('[data-say]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); speak(b.dataset.say); })
  );
  root.querySelectorAll('[data-say-slow]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); speakSlow(b.dataset.saySlow); })
  );
  root.querySelectorAll('[data-say-sent]').forEach((b) =>
    b.addEventListener('click', () => speak(b.dataset.saySent, { rate: 0.85 }))
  );
}

/**
 * 渲染一道练习题
 * @param {HTMLElement} box 容器
 * @param {object} ex 练习对象
 * @param {{onResult: (res:{correct:boolean, rating:number}) => void}} opts
 * @returns {() => void} 清理函数
 */
export function renderExercise(box, ex, { onResult }) {
  let keyHandler = null;
  let done = false;
  const w = ex.word;

  const finish = (correct, rating) => {
    if (done) return;
    done = true;
    onResult({ correct, rating: rating ?? (correct ? 3 : 1) });
  };

  /** 显示反馈 + 继续按钮 */
  const showContinue = (correct, extraDelay = 0) => {
    const fb = box.querySelector('.ex-feedback-slot');
    fb.innerHTML = feedbackHTML(w, correct) +
      `<button class="btn btn-primary ex-continue">继续 <kbd>Enter</kbd></button>`;
    bindSayButtons(fb);
    speak(w.w);
    fb.querySelector('.ex-continue').addEventListener('click', () => finish(correct));
    keyHandler = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(correct); }
    };
    if (correct && extraDelay > 0) setTimeout(() => finish(correct), extraDelay);
  };

  // ============ 各题型 ============
  const renderers = {
    /** 见词能读：自评闪卡 */
    flash() {
      box.innerHTML = `
        <div class="ex-prompt">看到这个词，试着<strong>读出声</strong>，再核对答案</div>
        <div class="ex-bigword">${esc(w.w)}</div>
        <div class="ex-feedback-slot">
          <button class="btn btn-primary ex-reveal">显示答案 <kbd>空格</kbd></button>
        </div>`;
      const reveal = () => {
        const fb = box.querySelector('.ex-feedback-slot');
        fb.innerHTML = feedbackHTML(w, null) +
          `<div class="rate-row">${RATE_BTNS.map((b) =>
            `<button class="btn rate-btn ${b.cls}" data-r="${b.r}"><span>${b.label}</span><small>${b.hint}</small><kbd>${b.key}</kbd></button>`
          ).join('')}</div>`;
        bindSayButtons(fb);
        speak(w.w);
        fb.querySelectorAll('.rate-btn').forEach((btn) =>
          btn.addEventListener('click', () => {
            const r = Number(btn.dataset.r);
            finish(r >= 3, r);
          })
        );
        keyHandler = (e) => {
          const r = Number(e.key);
          if (r >= 1 && r <= 4) finish(r >= 3, r);
        };
      };
      box.querySelector('.ex-reveal').addEventListener('click', reveal);
      keyHandler = (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      };
    },

    /** 听音辨词 */
    listen() {
      box.innerHTML = `
        <div class="ex-prompt">听发音，选出正确的单词</div>
        <button class="play-big" title="再听一遍">🔊</button>
        <div class="opt-grid">
          ${ex.options.map((o, i) =>
            `<button class="btn opt-btn" data-i="${i}"><kbd>${i + 1}</kbd>${esc(o.w)}</button>`
          ).join('')}
        </div>
        <div class="ex-feedback-slot"></div>`;
      const playBtn = box.querySelector('.play-big');
      playBtn.addEventListener('click', () => speak(w.w));
      setTimeout(() => speak(w.w), 250);

      const choose = (i) => {
        if (done || box.querySelector('.opt-btn.right')) return;
        const ok = i === ex.answer;
        box.querySelectorAll('.opt-btn').forEach((b, bi) => {
          b.disabled = true;
          if (bi === ex.answer) b.classList.add('right');
          if (bi === i && !ok) b.classList.add('wrong');
        });
        showContinue(ok, 1800);
      };
      box.querySelectorAll('.opt-btn').forEach((b) =>
        b.addEventListener('click', () => choose(Number(b.dataset.i)))
      );
      keyHandler = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= ex.options.length && !box.querySelector('.opt-btn.right')) choose(n - 1);
      };
    },

    /** 听音能写 */
    spell() {
      box.innerHTML = `
        <div class="ex-prompt">听发音，拼写这个单词</div>
        <button class="play-big" title="再听一遍">🔊</button>
        <div class="ex-hint">${esc(w.meaning)}</div>
        <div class="spell-row">
          <input class="spell-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入单词…" />
          <button class="btn btn-primary spell-submit">检查</button>
          <button class="icon-btn" data-say-slow="${esc(w.w)}" title="慢速">🐢</button>
        </div>
        <div class="ex-feedback-slot"></div>`;
      bindSayButtons(box);
      const input = box.querySelector('.spell-input');
      box.querySelector('.play-big').addEventListener('click', () => speak(w.w));
      setTimeout(() => { speak(w.w); input.focus(); }, 250);

      const submit = () => {
        if (done || box.querySelector('.ex-feedback')) return;
        const val = input.value.trim().toLowerCase();
        if (!val) return;
        const ok = val === w.w.toLowerCase();
        input.disabled = true;
        input.classList.add(ok ? 'right' : 'wrong');
        box.querySelector('.spell-submit').disabled = true;
        showContinue(ok, 1600);
      };
      box.querySelector('.spell-submit').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); }
      });
    },

    /** 拼读组装 */
    assemble() {
      let built = [];
      box.innerHTML = `
        <div class="ex-prompt">按发音顺序，把音块拼成这个单词</div>
        <div class="asm-target">
          <button class="play-big" title="听发音">🔊</button>
          <span class="ex-hint">${esc(w.meaning)}</span>
        </div>
        <div class="asm-built"></div>
        <div class="asm-pool">
          ${ex.tokens.map((t, i) =>
            `<button class="btn chip" data-i="${i}">${esc(t.t)}</button>`
          ).join('')}
        </div>
        <div class="asm-actions">
          <button class="btn asm-clear">清空</button>
          <button class="btn btn-primary asm-check">检查 <kbd>Enter</kbd></button>
        </div>
        <div class="ex-feedback-slot"></div>`;
      box.querySelector('.play-big').addEventListener('click', () => speak(w.w));
      setTimeout(() => speak(w.w), 250);

      const builtBox = box.querySelector('.asm-built');
      const renderBuilt = () => {
        builtBox.innerHTML = built.length
          ? built.map((b, bi) => `<button class="chip chip-built" data-bi="${bi}">${esc(b.t)}</button>`).join('')
          : '<span class="asm-placeholder">点击下方音块…</span>';
        builtBox.querySelectorAll('.chip-built').forEach((c) =>
          c.addEventListener('click', () => {
            const item = built.splice(Number(c.dataset.bi), 1)[0];
            box.querySelector(`.asm-pool [data-i="${item.i}"]`).disabled = false;
            renderBuilt();
          })
        );
      };
      renderBuilt();

      box.querySelectorAll('.asm-pool .chip').forEach((c) =>
        c.addEventListener('click', () => {
          c.disabled = true;
          built.push({ t: c.textContent, i: c.dataset.i });
          renderBuilt();
        })
      );
      box.querySelector('.asm-clear').addEventListener('click', () => {
        built = [];
        box.querySelectorAll('.asm-pool .chip').forEach((c) => (c.disabled = false));
        renderBuilt();
      });
      const check = () => {
        if (done || box.querySelector('.ex-feedback')) return;
        const ok = built.map((b) => b.t).join('|') === ex.answer.join('|');
        box.querySelector('.asm-check').disabled = true;
        showContinue(ok, 1600);
      };
      box.querySelector('.asm-check').addEventListener('click', check);
      keyHandler = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); check(); }
        if (e.key === 'Backspace' && built.length) {
          const item = built.pop();
          box.querySelector(`.asm-pool [data-i="${item.i}"]`).disabled = false;
          renderBuilt();
        }
      };
    },

    /** 规律直觉：高亮部分发什么音 */
    sound() {
      box.innerHTML = `
        <div class="ex-prompt">高亮的部分，发什么音？</div>
        <div class="ex-bigword bk-display">${renderBreakdown(w)}</div>
        <div class="opt-grid opt-grid-sound">
          ${ex.options.map((o, i) =>
            `<button class="btn opt-btn" data-i="${i}"><kbd>${i + 1}</kbd><span class="opt-ipa">${esc(o.ipa)}</span><small>${esc(o.nameCn)}</small></button>`
          ).join('')}
        </div>
        <div class="ex-feedback-slot"></div>`;
      const choose = (i) => {
        if (done || box.querySelector('.opt-btn.right')) return;
        const ok = i === ex.answer;
        box.querySelectorAll('.opt-btn').forEach((b, bi) => {
          b.disabled = true;
          if (bi === ex.answer) b.classList.add('right');
          if (bi === i && !ok) b.classList.add('wrong');
        });
        showContinue(ok, 1800);
      };
      box.querySelectorAll('.opt-btn').forEach((b) =>
        b.addEventListener('click', () => choose(Number(b.dataset.i)))
      );
      keyHandler = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= ex.options.length && !box.querySelector('.opt-btn.right')) choose(n - 1);
      };
    },
  };

  box.className = `exercise ex-${ex.type}`;
  (renderers[ex.type] || renderers.flash)();

  const globalKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    keyHandler && keyHandler(e);
  };
  document.addEventListener('keydown', globalKey);
  return () => document.removeEventListener('keydown', globalKey);
}
