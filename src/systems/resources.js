/**
 * H / P / W の計算と消費（仕様書 §6）
 *
 * 実時間の概念はない。すべて「部屋を1つ進む」＝1ターンで処理する。
 */

import { H_MAX, P_MAX } from './state.js';

/** 従属の度合いに応じた報酬（仕様書 §4.2） */
export const REWARD = { obey: 4, partial: 2, refuse: 0 };

/**
 * 相方の1ターンあたりの消耗。
 * P 初期値 8 に対して 2 なので、一度も報酬を譲らなければ
 * 5室目（往路の最後）で必ず折れる。折れれば6室目の警告が出ない。
 * ＝「言われた通りにした者は、最後の警告も失う」
 */
export const P_DRAIN = 2;

/**
 * 重量。独立ゲージではなく、常に所持状態から再計算する。
 * 小物は重量に影響しない（掌に握れるサイズだから）。
 */
export function weight(s) {
  return (s.hasGun ? 2 : 0) + (s.hasCoat ? 1 : 0);
}

/**
 * 立ち絵の服装段階（0〜3）。ターンフロー §2.3
 * 鉄砲は独立レイヤーなのでここには含まれない。
 */
export function clothingStage(s) {
  if (s.obeyed[5]) return 3;   // クリームと香水
  if (s.obeyed[4]) return 2;   // 下着姿
  if (s.obeyed[2]) return 1;   // 帽子を取り、靴を清めた
  return 0;                    // 正装
}

/** H が 0 だと走れない。ゲームオーバーではなく、復路で毎室 D-1 になる */
export function canRun(s) {
  return s.H > 0;
}

/** 空腹の演出段階（0〜4）。0 が満たされている状態。数値は画面に出さない */
export function hungerLevel(s) {
  if (s.H >= 10) return 0;
  if (s.H >= 7) return 1;
  if (s.H >= 4) return 2;
  if (s.H >= 1) return 3;
  return 4;
}

const clampH = (v) => Math.max(0, Math.min(H_MAX, v));
const clampP = (v) => Math.max(0, Math.min(P_MAX, v));

/**
 * 往路の消費。従ったかどうかに関係なく必ず発生する。
 * 拒否した者は報酬を得られず、重量ぶんの追加消費だけを払う。
 *
 * ★ 呼ぶ順序が重要。所持状態を更新した「あと」に呼ぶこと。
 *   鉄砲を置いた部屋では、置いたあとの軽い体で消費する（仕様書 §6.4）。
 */
export function consume(s) {
  s.H = clampH(s.H - (1 + weight(s)));
  s.P = clampP(s.P - P_DRAIN);
  return s;
}

/** 報酬の配分。原資は店がよこした暖かさと前菜であり、主人公の持ち物ではない */
export function grantReward(s, amount, to) {
  if (amount <= 0) return s;
  if (to === 'partner') {
    if (s.partnerBroken) return s;   // 折れた相方は回復しない
    s.P = clampP(s.P + amount);
  } else {
    s.H = clampH(s.H + amount);
  }
  return s;
}

/**
 * 復路1部屋あたりの空腹消費。
 *
 * ★これがないと復路が空回りする（Phase 1 で実際に空回りしていた）。
 * H が復路で意味を持たないと、外套の「+3」に価値が生まれず、
 * 衣裳室の「誘惑」も銃器室の「罠」も天秤として成立しない。
 *
 * 往路の 1+W ほど重くはしない。復路は6室あり、そこで 1+W を課すと
 * どのルートでも確実に飢え死にする。重量は半分だけ効かせる。
 */
export function returnDrain(s) {
  return 1 + Math.floor(weight(s) / 2);
}

/** 復路の消費。P は減らない（相方の限界は往路でしか動かない） */
export function consumeReturn(s) {
  s.H = clampH(s.H - returnDrain(s));
  return s;
}

/** 拾得による回復（復路の衣裳室） */
export function eatOrWarm(s, amount) {
  s.H = clampH(s.H + amount);
  return s;
}
