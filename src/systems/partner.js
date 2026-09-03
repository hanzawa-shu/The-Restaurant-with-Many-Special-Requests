/**
 * 相方の状態と台詞（仕様書 §11.1）
 *
 * 折れる = 心変わりではなく屈服。最後まで疑っている。ただし体が持たない。
 * 折れたあとは疑問を口にしない ＝ 6室目で警告が出ない（仕様書 §7.1）。
 */

import { PARTNER_LINES, PARTNER_BREAK, partnerStage } from '../data/dialogue.js';

export { partnerStage };

/**
 * P が 0 に達したら折れる。折れる直前に必ず予告の台詞が出ているので、
 * プレイヤーには「止められたかもしれない」余地が残る。
 * 予告なしに折らせると設計が破綻する（仕様書 §1.2 の制約）。
 */
export function checkBreak(s) {
  if (!s.partnerBroken && s.P <= 0) {
    s.partnerBroken = true;
    return PARTNER_BREAK;
  }
  return null;
}

/** 台詞を1つ選ぶ。乱数は使わない（テストを決定的にするため） */
export function partnerLine(s, roomN) {
  if (s.partnerBroken) return PARTNER_LINES[0][0];
  const lines = PARTNER_LINES[partnerStage(s.P)];
  return lines[roomN % lines.length];
}

/** 折れた相方は指示に自動で従う。所持していた小物も差し出してしまう */
export function autoObeyIfBroken(s, roomN) {
  return s.partnerBroken;
}

/** 6室目で「鍵穴を覗く」に注意が向くか（仕様書 §7.1） */
export function givesRevealWarning(s) {
  return !s.partnerBroken;
}
