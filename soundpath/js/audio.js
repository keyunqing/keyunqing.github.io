/**
 * 语音引擎：基于 Web Speech API 的英文朗读（完全离线、零成本）。
 * 自动挑选系统中最自然的 en-US 语音，支持语速调节。
 */
import { getState } from './store.js';

let voices = [];
let ready = false;

/** 初始化语音列表（异步加载） */
export function initAudio() {
  if (!('speechSynthesis' in window)) return;
  const refresh = () => {
    voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    ready = voices.length > 0;
  };
  refresh();
  speechSynthesis.onvoiceschanged = refresh;
}

/** 获取可选英文语音列表 */
export function getVoices() {
  return voices;
}

/** 挑选当前语音：用户设置优先，否则按质量启发式排序 */
function pickVoice() {
  const uri = getState().profile.voiceURI;
  if (uri) {
    const v = voices.find((v) => v.voiceURI === uri);
    if (v) return v;
  }
  const score = (v) => {
    let s = 0;
    if (/natural|neural|online/i.test(v.name)) s += 4;
    if (v.lang === 'en-US') s += 2;
    if (/(aria|jenny|guy|zira|david|mark)/i.test(v.name)) s += 1;
    return s;
  };
  return voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

/**
 * 朗读文本
 * @param {string} text 英文文本
 * @param {object} [opts] { rate, onend }
 */
export function speak(text, opts = {}) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = 'en-US';
  u.rate = opts.rate ?? getState().profile.rate ?? 0.92;
  u.pitch = 1;
  if (opts.onend) u.onend = opts.onend;
  speechSynthesis.speak(u);
}

/** 慢速朗读（用于跟读模仿） */
export function speakSlow(text) {
  speak(text, { rate: 0.6 });
}

export function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function audioReady() {
  return ready;
}
