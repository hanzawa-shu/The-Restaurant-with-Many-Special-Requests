/**
 * 小物の所持・要求・喪失（仕様書 §5）
 */

import { ROOMS } from '../data/rooms.js';

/** その部屋で店が要求してくる小物のうち、まだ持っているもの */
export function demandedHere(s, roomN) {
  const demands = ROOMS[roomN]?.demands ?? [];
  return demands.filter((id) => s.items.includes(id));
}

export function hasItem(s, id) {
  return s.items.includes(id);
}

export function addItem(s, id) {
  if (!s.items.includes(id)) s.items.push(id);
  return s;
}

export function loseItems(s, ids) {
  s.items = s.items.filter((id) => !ids.includes(id));
  return s;
}

/** 従うと必ず失う「重量を持つもの」を手放す */
export function surrenderBig(s, roomN) {
  for (const kind of ROOMS[roomN]?.surrender ?? []) {
    if (kind === 'gun') s.hasGun = false;
    if (kind === 'coat') s.hasCoat = false;
  }
  return s;
}

/** 復路で拾える小物のうち、その障害を解けるもの */
export function solversFor(s, obstacle) {
  if (!obstacle?.solvedBy) return [];
  return obstacle.solvedBy.filter((id) => s.items.includes(id));
}
