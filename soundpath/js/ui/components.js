/**
 * 共享 UI 组件与工具：HTML 转义、拼读分解渲染、Toast、弹窗、SVG 图表。
 */

/** HTML 转义 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const VOWELISH = /[aeiou]/i;

/**
 * 渲染单词的拼读分解（彩色音块）。
 * @param {object} w 词条 { breakdown, highlight, tokenFlags }
 * @param {object} [opts] { plain: 不高亮 }
 * @returns {string} HTML
 */
export function renderBreakdown(w, opts = {}) {
  const tokens = (w.breakdown || w.w).split('|');
  const hl = opts.plain ? null : w.highlight;
  const silent = new Set(
    (w.tokenFlags || []).filter((f) => f.flag === 'silent').map((f) => f.index)
  );

  const isHl = (token, i) => {
    if (!hl || hl.type === 'none') return false;
    if (hl.type === 'split') return (hl.indices || []).includes(i);
    if (hl.type === 'index') {
      const idxs = hl.indices || (hl.index != null ? [hl.index] : []);
      return idxs.includes(i);
    }
    return hl.value && token.toLowerCase() === hl.value.toLowerCase();
  };

  return tokens
    .map((t, i) => {
      const cls = ['bk-token'];
      if (silent.has(i)) cls.push('bk-silent');
      else if (isHl(t, i)) cls.push('bk-hl');
      else if (VOWELISH.test(t)) cls.push('bk-vowel');
      else cls.push('bk-cons');
      return `<span class="${cls.join(' ')}">${esc(t)}</span>`;
    })
    .join('');
}

/** 音节展示，如 mag/net */
export function renderSyllables(w) {
  if (!w.syllables || w.syllables.length < 2) return '';
  return w.syllables.map((s) => esc(s.split('|').join(''))).join('<span class="syl-dot">·</span>');
}

/** Toast 提示 */
export function toast(msg, type = 'info', duration = 2600) {
  const root = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, duration);
}

/** 成就解锁提示 */
export function achievementToast(a) {
  toast(
    `<span class="ach-icon">${a.icon}</span><span><strong>成就解锁 · ${esc(a.name)}</strong><br><small>${esc(a.desc)}</small></span>`,
    'achievement',
    4200
  );
}

/**
 * 模态弹窗
 * @returns {() => void} 关闭函数
 */
export function modal(html, opts = {}) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `<div class="modal ${opts.wide ? 'modal-wide' : ''}">${html}</div>`;
  const close = () => {
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 250);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap && !opts.locked) close();
  });
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return close;
}

/** SVG 进度环 */
export function ring(pct, size = 64, stroke = 6, cls = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, pct)));
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
      transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-fg"/>
  </svg>`;
}

/** 五维能力雷达图 SVG */
export function radarSVG(items, size = 240) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 36;
  const n = items.length;
  const pt = (i, ratio) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * R * ratio, cy + Math.sin(ang) * R * ratio];
  };
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const grid = gridLevels
    .map((lv) => {
      const pts = items.map((_, i) => pt(i, lv).join(',')).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    })
    .join('');
  const axes = items
    .map((_, i) => {
      const [x, y] = pt(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;
    })
    .join('');
  const valuePts = items.map((it, i) => pt(i, Math.max(0.04, it.value)).join(',')).join(' ');
  const labels = items
    .map((it, i) => {
      const [x, y] = pt(i, 1.22);
      const pctText = Math.round(it.value * 100) + '%';
      return `<text x="${x}" y="${y - 5}" text-anchor="middle" class="radar-label">${esc(it.label)}</text>
              <text x="${x}" y="${y + 11}" text-anchor="middle" class="radar-value">${pctText}</text>`;
    })
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="radar">
    ${grid}${axes}
    <polygon points="${valuePts}" fill="var(--accent-fade)" stroke="var(--accent)" stroke-width="2"/>
    ${labels}
  </svg>`;
}

/** 学习热力图（最近 weeks 周） */
export function heatmap(daily, weeks = 17) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 从本周日往前推
  const end = new Date(today);
  const startOffset = end.getDay();
  const totalDays = weeks * 7;
  const cells = [];
  const p = (n) => String(n).padStart(2, '0');
  for (let i = totalDays - 1 - (6 - startOffset); i >= -(6 - startOffset); i--) {
    const d = new Date(today.getTime() - i * 86400000);
    if (d > today) {
      cells.push(`<div class="hm-cell hm-future"></div>`);
      continue;
    }
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const stat = daily[key];
    const activity = stat ? stat.reviews + stat.total + stat.lessons * 5 : 0;
    let lv = 0;
    if (activity > 0) lv = 1;
    if (activity >= 15) lv = 2;
    if (activity >= 40) lv = 3;
    if (activity >= 80) lv = 4;
    const tip = stat
      ? `${key}：${stat.reviews} 复习 / ${stat.lessons} 课 / ${stat.xp} XP`
      : `${key}：未学习`;
    cells.push(`<div class="hm-cell hm-${lv}" title="${tip}"></div>`);
  }
  return `<div class="heatmap" style="grid-template-rows: repeat(7, 1fr)">${cells.join('')}</div>`;
}

/** 简单柱状图 SVG */
export function barChart(values, labels, width = 320, height = 120) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const bw = width / n;
  const bars = values
    .map((v, i) => {
      const h = (v / max) * (height - 30);
      const x = i * bw + bw * 0.18;
      const y = height - 22 - h;
      return `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${Math.max(2, h)}" rx="3" class="bar"/>
        <text x="${i * bw + bw / 2}" y="${height - 8}" text-anchor="middle" class="bar-label">${esc(labels[i])}</text>
        ${v > 0 ? `<text x="${i * bw + bw / 2}" y="${y - 5}" text-anchor="middle" class="bar-value">${v}</text>` : ''}`;
    })
    .join('');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="barchart">${bars}</svg>`;
}

/** 庆祝粒子效果 */
export function celebrate() {
  const colors = ['#f5b54a', '#6ee7c8', '#7aa7ff', '#f97b9c', '#c9a8ff'];
  const root = document.body;
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.left = 35 + Math.random() * 30 + '%';
    s.style.top = '38%';
    s.style.background = colors[i % colors.length];
    s.style.setProperty('--dx', (Math.random() - 0.5) * 420 + 'px');
    s.style.setProperty('--dy', -(80 + Math.random() * 320) + 'px');
    s.style.setProperty('--rot', Math.random() * 720 + 'deg');
    s.style.animationDelay = Math.random() * 0.12 + 's';
    root.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }
}
