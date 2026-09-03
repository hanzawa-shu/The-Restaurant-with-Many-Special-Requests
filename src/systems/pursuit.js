/**
 * 復路の追跡（ターンフロー §4）
 *
 * 実時間は使わない。プレイヤーが1部屋進むと山猫も1部屋進むので、
 * 通常は D は変わらない。余分なターンとペナルティだけが D を削る。
 */

import { ROOMS } from '../data/rooms.js';
import { canRun, consumeReturn } from './resources.js';
import { solversFor } from './items.js';

/** その部屋で実際に発生する障害（条件を満たさなければ null） */
export function obstacleOf(s, roomN) {
  const ob = ROOMS[roomN]?.obstacle;
  if (!ob) return null;
  return ob.when(s) ? ob : null;
}

/** 障害に対して取れる手 */
export function obstacleOptions(s, roomN) {
  const ob = obstacleOf(s, roomN);
  if (!ob) return [];
  const opts = solversFor(s, ob).map((id) => ({ id: `use_${id}`, item: id }));
  if (ob.forceLabel) {
    opts.push({ id: 'force', turns: ob.forceTurns ?? 2 });
  } else {
    // 解けない障害は、通過はできるがペナルティを受ける
    opts.push({ id: 'endure', penalty: ob.penalty ?? 1 });
  }
  return opts;
}

/**
 * その部屋の精算。
 * 順序が重要: 距離を削る → 腹を減らす → 走れるか判定する。
 * 消費で H が 0 になった部屋から、すでに走れない扱いになる。
 */
export function resolveRoom(s) {
  // 1部屋につき1ターンが基本。余分に使った分だけ距離が詰まる
  s.D -= s.turnExtra;
  s.D -= s.penalty;
  // 復路でも腹は減る。ただし玄関（1室・終点）は「到着」なので消費しない。
  // 6室ぶん課すと、どのルートでも玄関で必ず H=0 になり踏み込めなくなる
  if (s.room !== 1) consumeReturn(s);
  if (!canRun(s)) s.D -= 1;   // 走れない
  s.turnExtra = 0;
  s.penalty = 0;
  return s;
}

export function isCaught(s) {
  return s.D <= 0;
}

/** TrueEnd に踏み込める条件（仕様書 §8.3） */
export function canCharge(s) {
  return s.items.includes('dog_whistle') && s.partnerPresent && s.H > 0;
}
