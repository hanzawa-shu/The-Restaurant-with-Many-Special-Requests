/**
 * テスト用のドライバ。ファイル名が *.test.mjs ではないので
 * node --test の対象にはならない。
 */
import { createState, view, choose } from '../src/systems/game.js';

/** 選択 id の列を順に適用する。存在しない／無効な選択は即座に失敗させる */
export function drive(script, s = createState()) {
  script.forEach((id, i) => {
    const v = view(s);
    const c = v.choices.find((x) => x.id === id);
    if (!c) {
      throw new Error(
        `[${i}] step=${s.step} room=${s.room} に選択「${id}」がない。` +
        `候補: ${v.choices.map((x) => x.id).join(', ')}`
      );
    }
    if (!c.enabled) {
      throw new Error(`[${i}] step=${s.step} の「${id}」は無効（${c.hint ?? ''}）`);
    }
    s = choose(s, id);
  });
  return s;
}

// ---------------------------------------------------------------- 典型ルート

/** 山道 → 1室目のチュートリアルまで */
const OPEN = (dog) => ['advance', dog, 'enter', 'examine', 'advance'];

/** 言われた通りにする */
export const ROUTE_OBEY_ALL = [
  ...OPEN('leave'),
  'to_judge', 'obey', 'reward_self',
  'to_judge', 'obey', 'reward_self',
  'to_judge', 'obey', 'reward_self',
  'to_judge', 'obey', 'reward_self',
];

/** 何も従わない */
export const ROUTE_REFUSE_ALL = [
  ...OPEN('leave'),
  'to_judge', 'refuse', 'to_judge', 'refuse',
  'to_judge', 'refuse', 'to_judge', 'refuse',
];

/**
 * TrueEnd 想定ルート（仕様書 §6.4）
 *
 * 犬を弔い、大きいものは渡し、小物は守り、相方に一度は譲る。
 * 2室目には従う——泥を落とすと復路に足跡が残るが、眼鏡を隠しておけば
 * 代償なしで解ける。従って得た +4 の方が価値が高い。
 */
export const ROUTE_TRUE_OUTBOUND = [
  ...OPEN('bury'),
  'to_judge', 'obey', 'reward_self',
  'to_judge', 'partial', 'toggle_penknife', 'toggle_dog_whistle', 'hide_confirm', 'reward_partner',
  'to_judge', 'partial', 'toggle_dog_whistle', 'toggle_glasses', 'toggle_matches', 'hide_confirm', 'reward_self',
  'to_judge', 'refuse',
];

/** 上記の続き。玄関まで一度も距離を失わずに逆走する */
export const RETURN_TRUE = [
  'peek', 'lean', 'look_away',
  'use_penknife',   // 6室 厨房前の閉じた扉
  'advance',        // 5室 香油室（香水を塗っていないので匂いなし）
  'leave',          // 4室 外套を拾わない（H に余裕がある）
  'leave',          // 3室 鉄砲を拾わない（罠）
  'use_glasses',    // 2室 廊下の足跡を抜け道で回避
  'advance',        // 1室 玄関
];

/**
 * 相方に大きい報酬を早く譲った、H が薄いルート。
 * このルートは外套を拾わないと3室目で飢えて捕まる（＝誘惑が機能している）。
 */
export const ROUTE_THIN_OUTBOUND = [
  ...OPEN('bury'),
  'to_judge', 'obey', 'reward_partner',
  'to_judge', 'partial', 'toggle_penknife', 'toggle_dog_whistle', 'hide_confirm', 'reward_self',
  'to_judge', 'partial', 'toggle_dog_whistle', 'toggle_glasses', 'toggle_matches', 'hide_confirm', 'reward_self',
  'to_judge', 'refuse',
];
