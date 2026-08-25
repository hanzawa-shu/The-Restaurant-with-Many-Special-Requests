/**
 * エンディング判定式（仕様書 §9.1）
 *
 * 5種すべてに到達可能であることは reachability.test.mjs が保証する。
 */

export function judgeEnding(s) {
  if (s.saltApplied) return 'COOKED';
  if (s.caught) return s.pushedPartner ? 'ALONE' : 'TOGETHER';
  if (s.abandonedPartner) return 'ALONE';

  // 玄関に到達し、犬が来た
  if (s.chargedIn) return 'TRUE';
  return 'ORIGINAL';
}
