/**
 * localStorage の読み書き。systems の中で唯一の副作用。
 *
 * プレイ途中のセーブは実装しない。12分で終わり、しかも一方通行なので、
 * 途中セーブを許すと判断のやり直しが可能になり、一方通行の緊張が無効化される。
 * 中断したら最初から。これは不便ではなく設計の一部（設計書 §9）。
 */

import { emptyProgress } from './progress.js';

const KEY = 'demo8.progress.v1';
const AUDIO_KEY = 'demo8.audio.v1';

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw);
    return { ...emptyProgress(), ...p };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;   // プライベートブラウジング等
  }
}

export function clearProgress() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}


/**
 * 音量の設定。進捗とは別に持つ。
 * ★「記録を消す」で音量まで消さない。結末の記録と音量は別のものである。
 */
export function loadVolume(fallback) {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return { ...fallback };
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

export function saveVolume(v) {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify(v)); return true; } catch { return false; }
}
