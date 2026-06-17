/**
 * 「设置」页：语音、学习目标、AI 接口、数据管理。
 */
import { getState, save, exportData, importData, resetData } from '../store.js';
import { getVoices, speak } from '../audio.js';
import { chatWithCoach } from '../coach.js';
import { esc, toast, modal } from './components.js';

export function renderSettings(view) {
  const st = getState();
  const voices = getVoices();

  view.innerHTML = `
  <div class="page page-settings">
    <header class="page-head"><h1>设置</h1></header>

    <section class="card">
      <h2 class="card-title">语音</h2>
      <div class="form-row">
        <label>发音人</label>
        <select id="set-voice">
          <option value="">自动选择最佳语音</option>
          ${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${st.profile.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
        </select>
        <button class="btn btn-sm" id="test-voice">试听</button>
      </div>
      <div class="form-row">
        <label>语速 <span id="rate-val">${st.profile.rate.toFixed(2)}</span></label>
        <input type="range" id="set-rate" min="0.5" max="1.3" step="0.05" value="${st.profile.rate}" />
      </div>
      ${voices.length === 0 ? '<p class="muted">未检测到英文语音。Windows 可在「设置 → 时间和语言 → 语音」中添加英语语音包。</p>' : ''}
    </section>

    <section class="card">
      <h2 class="card-title">学习节奏</h2>
      <div class="form-row">
        <label>每日新规律目标</label>
        <select id="set-lessons">
          ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${st.profile.dailyLessonGoal === n ? 'selected' : ''}>${n} 条 / 天</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>每日复习目标</label>
        <select id="set-reviews">
          ${[20, 40, 60, 100, 150].map((n) => `<option value="${n}" ${st.profile.dailyReviewGoal === n ? 'selected' : ''}>${n} 张 / 天</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>记忆保留率目标 <span id="ret-val">${Math.round(st.profile.retention * 100)}%</span></label>
        <input type="range" id="set-retention" min="0.8" max="0.95" step="0.01" value="${st.profile.retention}" />
      </div>
      <p class="muted">保留率越高复习越频繁。90% 是效率与负担的最佳平衡点，不确定就保持默认。</p>
    </section>

    <section class="card">
      <h2 class="card-title">AI 教练接口 <small>可选 · 兼容 OpenAI 格式</small></h2>
      <div class="form-row"><label>API 地址</label><input type="text" id="ai-url" placeholder="https://api.deepseek.com（留空为 OpenAI 官方）" value="${esc(st.ai.baseUrl)}" /></div>
      <div class="form-row"><label>API Key</label><input type="password" id="ai-key" placeholder="sk-…" value="${esc(st.ai.apiKey)}" /></div>
      <div class="form-row"><label>模型名称</label><input type="text" id="ai-model" placeholder="deepseek-chat / gpt-4o-mini / …" value="${esc(st.ai.model)}" /></div>
      <div class="form-row">
        <button class="btn btn-primary" id="ai-save">保存</button>
        <button class="btn" id="ai-test">测试连接</button>
      </div>
      <p class="muted">Key 仅保存在本机，不会上传到任何服务器。</p>
    </section>

    <section class="card">
      <h2 class="card-title">数据</h2>
      <div class="form-row">
        <button class="btn" id="data-export">导出备份</button>
        <button class="btn" id="data-import">导入备份</button>
        <button class="btn btn-danger" id="data-reset">清空全部数据</button>
      </div>
      <input type="file" id="import-file" accept=".json" style="display:none" />
      <p class="muted">所有学习数据保存在本机。建议定期导出备份。</p>
    </section>

    <section class="card about">
      <h2 class="card-title">关于</h2>
      <p>声径 SoundPath v1.0 —— 面向中文母语成年人的英语解码能力成长系统。</p>
      <p class="muted">拼读规则与词汇数据基于开源项目 <a href="https://github.com/cocojojo5213/phonics-app" target="_blank">Phonics App</a>（MIT License），特此致谢。<br>记忆调度采用 FSRS 算法。语音由系统 TTS 提供，完全离线。</p>
    </section>
  </div>`;

  // ---- 语音 ----
  view.querySelector('#set-voice').addEventListener('change', (e) => {
    st.profile.voiceURI = e.target.value || null;
    save();
  });
  view.querySelector('#test-voice').addEventListener('click', () =>
    speak('Hello! Welcome to SoundPath. Practice makes progress.')
  );
  view.querySelector('#set-rate').addEventListener('input', (e) => {
    st.profile.rate = Number(e.target.value);
    view.querySelector('#rate-val').textContent = st.profile.rate.toFixed(2);
    save();
  });

  // ---- 学习节奏 ----
  view.querySelector('#set-lessons').addEventListener('change', (e) => {
    st.profile.dailyLessonGoal = Number(e.target.value);
    save();
  });
  view.querySelector('#set-reviews').addEventListener('change', (e) => {
    st.profile.dailyReviewGoal = Number(e.target.value);
    save();
  });
  view.querySelector('#set-retention').addEventListener('input', (e) => {
    st.profile.retention = Number(e.target.value);
    view.querySelector('#ret-val').textContent = Math.round(st.profile.retention * 100) + '%';
    save();
  });

  // ---- AI ----
  const saveAI = () => {
    st.ai.baseUrl = view.querySelector('#ai-url').value.trim();
    st.ai.apiKey = view.querySelector('#ai-key').value.trim();
    st.ai.model = view.querySelector('#ai-model').value.trim();
    save();
  };
  view.querySelector('#ai-save').addEventListener('click', () => {
    saveAI();
    toast('AI 配置已保存', 'success');
  });
  view.querySelector('#ai-test').addEventListener('click', async (e) => {
    saveAI();
    if (!st.ai.apiKey || !st.ai.model) return toast('请先填写 API Key 和模型名称', 'error');
    e.target.disabled = true;
    e.target.textContent = '测试中…';
    try {
      await chatWithCoach([{ role: 'user', content: '请回复"连接成功"四个字。' }]);
      toast('连接成功，教练已就位', 'success');
    } catch (err) {
      toast('连接失败：' + esc(err.message), 'error', 5000);
    } finally {
      e.target.disabled = false;
      e.target.textContent = '测试连接';
    }
  });

  // ---- 数据 ----
  view.querySelector('#data-export').addEventListener('click', () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `soundpath-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const fileInput = view.querySelector('#import-file');
  view.querySelector('#data-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const text = await file.text();
    if (importData(text)) {
      toast('导入成功', 'success');
      setTimeout(() => location.reload(), 800);
    } else {
      toast('文件格式不正确', 'error');
    }
  });
  view.querySelector('#data-reset').addEventListener('click', () => {
    const close = modal(`
      <h3>确认清空全部数据？</h3>
      <p class="muted">所有学习进度、记忆卡片、成长记录将被永久删除，且无法恢复。</p>
      <div class="modal-actions">
        <button class="btn" id="reset-cancel">取消</button>
        <button class="btn btn-danger" id="reset-confirm">确认清空</button>
      </div>`);
    document.getElementById('reset-cancel').addEventListener('click', close);
    document.getElementById('reset-confirm').addEventListener('click', () => {
      resetData();
      location.hash = '#/home';
      location.reload();
    });
  });
}
