/**
 * 「教练」页：每日简报、弱点分析（本地），以及可选的 LLM 对话教练。
 */
import { getState, save } from '../store.js';
import { dailyBrief, weaknessReport, aiConfigured, chatWithCoach } from '../coach.js';
import { esc, renderBreakdown, toast } from './components.js';
import { speak } from '../audio.js';

export function renderCoach(view) {
  const st = getState();
  const report = weaknessReport();
  const configured = aiConfigured();

  view.innerHTML = `
  <div class="page page-coach">
    <header class="page-head">
      <h1>你的教练</h1>
      <p class="page-sub">基于你的真实学习数据 —— 不灌鸡汤，只说有用的</p>
    </header>

    <section class="coach-brief card">
      <div class="coach-avatar">导</div>
      <div class="coach-lines">${dailyBrief().map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    </section>

    ${report ? `
    <section class="card">
      <h2 class="card-title">弱点诊断 <small>这些规律的单词你忘得最多</small></h2>
      ${report.map(({ rule, words }) => `
        <div class="weak-block">
          <div class="weak-head">
            <span class="grapheme-pill">${esc(rule.graphemes.join(' / '))}</span>
            <span class="weak-name">${esc(rule.nameCn)}</span>
            <a class="btn btn-sm" href="#/lesson/${esc(rule.id)}">重学这条规律</a>
          </div>
          ${words.length ? `<div class="weak-words">${words.map((w) =>
            `<button class="chip weak-word" data-w="${esc(w.w)}" title="${esc(w.meaning)}">${renderBreakdown(w)}</button>`
          ).join('')}</div>` : ''}
        </div>`).join('')}
    </section>` : `
    <section class="card">
      <h2 class="card-title">弱点诊断</h2>
      <p class="muted">目前数据还不够。随着复习的积累，我会在这里指出你最容易忘的规律和单词。</p>
    </section>`}

    <section class="card chat-card">
      <h2 class="card-title">和教练聊聊 ${configured ? '' : '<small>需要先配置 AI 接口</small>'}</h2>
      ${configured ? `
      <div class="chat-log" id="chat-log">
        ${(st.coach.history || []).map((m) => `<div class="chat-msg chat-${m.role}">${esc(m.content)}</div>`).join('')}
        ${!(st.coach.history || []).length ? '<p class="muted chat-hint">可以问我：某个单词为什么这么读？ea 有几种发音？我最近的进步怎么样？怎么安排学习节奏？</p>' : ''}
      </div>
      <div class="chat-input-row">
        <input id="chat-input" type="text" placeholder="问点什么…（教练了解你的全部学习数据）" />
        <button class="btn btn-primary" id="chat-send">发送</button>
        <button class="btn btn-sm" id="chat-clear" title="清空对话">清空</button>
      </div>` : `
      <p class="muted">配置任意 OpenAI 兼容接口（DeepSeek、OpenAI、本地 Ollama 等）后，教练可以结合你的学习数据进行真人般的对话辅导。<br>未配置时，上方的简报与诊断依然完全可用。</p>
      <a class="btn" href="#/settings">前往设置</a>`}
    </section>
  </div>`;

  // 弱词点击发音
  view.querySelectorAll('.weak-word').forEach((b) =>
    b.addEventListener('click', () => speak(b.dataset.w))
  );

  if (!configured) return;

  const log = view.querySelector('#chat-log');
  const input = view.querySelector('#chat-input');
  const sendBtn = view.querySelector('#chat-send');
  const scrollBottom = () => (log.scrollTop = log.scrollHeight);
  scrollBottom();

  const append = (role, content) => {
    const div = document.createElement('div');
    div.className = `chat-msg chat-${role}`;
    div.textContent = content;
    log.querySelector('.chat-hint')?.remove();
    log.appendChild(div);
    scrollBottom();
    return div;
  };

  let busy = false;
  const send = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    input.value = '';
    sendBtn.disabled = true;
    const st = getState();
    st.coach.history = st.coach.history || [];
    st.coach.history.push({ role: 'user', content: text });
    append('user', text);
    const pending = append('assistant', '思考中…');
    try {
      const reply = await chatWithCoach(st.coach.history);
      pending.textContent = reply;
      st.coach.history.push({ role: 'assistant', content: reply });
      st.coach.history = st.coach.history.slice(-40);
      save();
    } catch (e) {
      pending.textContent = '教练暂时联系不上：' + e.message;
      pending.classList.add('chat-error');
    } finally {
      busy = false;
      sendBtn.disabled = false;
      scrollBottom();
    }
  };

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  view.querySelector('#chat-clear').addEventListener('click', () => {
    getState().coach.history = [];
    save();
    toast('对话已清空');
    renderCoach(view);
  });
}
