/**
 * 周回と到達記録（仕様書 §10）
 * 純粋関数のみ。localStorage への書き込みは save.js が担当する。
 */

import { ENDING_IDS } from '../data/endings.js';

export function emptyProgress() {
  return { endings: {}, seenTexts: [] };
}

export function recordEnding(p, id) {
  return { ...p, endings: { ...p.endings, [id]: true } };
}

export function markSeen(p, keys) {
  const set = new Set([...p.seenTexts, ...keys]);
  return { ...p, seenTexts: [...set] };
}

export function hasSeen(p, key) {
  return p.seenTexts.includes(key);
}

/**
 * 既読判定の鍵。
 *
 * ★場面番号だけでは足りない。同じ場面でも、選んだ道によって文面が変わる
 * （相方が折れているか、隠したか、など）。読んでいない文を「既読」にしてしまう。
 * 文面そのものを潰して鍵にすれば、文が変わった瞬間からまた送られる。
 *
 * 保存するのでできるだけ短くする（FNV-1a を 36進数に）。
 */
export function textKey(sceneCode, lines) {
  const src = lines.join('\u0001');
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${sceneCode}.${h.toString(36)}`;
}

/** 到達したエンディングの一覧（未到達は null）。コレクション表示用 */
export function collected(p) {
  return ENDING_IDS.map((id) => (p.endings[id] ? id : null));
}

export function collectedCount(p) {
  return ENDING_IDS.filter((id) => p.endings[id]).length;
}
