/**
 * 決断の数と追跡距離の範囲（資料との整合性）
 *
 * ★仕様書と README に載る数字を、実装から測って固定する。
 * 「決断9回」「プレイ時間12分」のような数字は、読んだ人が信じるので
 * 実装とずれたまま放置してはいけない。ここが落ちたら、どちらかが嘘をついている。
 *
 * `reachability.test.mjs` が「行き止まりがない／5種すべてに到達できる」を
 * 総当たりで保証している。こちらはその探索から**数値の範囲**を取り出す。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, view, choose, hashState, isEnd } from '../src/systems/game.js';
import { D_INIT } from '../src/systems/state.js';
import {
  drive, ROUTE_REFUSE_ALL, ROUTE_TRUE_OUTBOUND, RETURN_TRUE,
} from './_drive.mjs';

/**
 * 「決断」として数える step。
 * ★探索（調べる・話す）と小物の入れ替え（チップ）は数えない。
 * 押しても物語が進まないものを決断に数えると、数字が意味を失う。
 */
const OUTBOUND_DECISIONS = new Set(['m2', 'o_judge', 'o_reward']);
const RETURN_DECISIONS = new Set([
  'reveal', 'r_obstacle', 'r_pickup', 'r_fire', 'r_partner', 'caught', 'r_final',
]);

/** 入力列をたどって、決断の回数を往路／反転以降に分けて数える */
function countDecisions(ids) {
  let s = createState();
  const out = [];
  const ret = [];
  for (const id of ids) {
    const v = view(s);
    const usable = v.choices.filter((c) => c.enabled !== false).length;
    if (usable >= 2 && OUTBOUND_DECISIONS.has(s.step)) out.push(`${s.step}@${s.room}`);
    if (usable >= 2 && RETURN_DECISIONS.has(s.step)) ret.push(`${s.step}@${s.room}`);
    s = choose(s, id);
  }
  return { ending: s.ending, out, ret };
}

const OPEN = (dog) => ['advance', dog, 'enter', 'examine', 'advance'];

test('★仕様書 §0 の決断の数が実装と一致する', () => {
  // 全拒否 → 塩をもみこむ。報酬が出ないので往路は最小
  const cooked = countDecisions([
    ...ROUTE_REFUSE_ALL, 'salt',
  ]);
  assert.equal(cooked.ending, 'COOKED');
  assert.equal(cooked.out.length, 5, '往路の最小は 山道1＋判断室4');
  assert.equal(cooked.ret.length, 1, '反転の3択だけ');

  // TrueEnd 想定ルート
  const t = countDecisions([...ROUTE_TRUE_OUTBOUND, ...RETURN_TRUE, 'charge']);
  assert.equal(t.ending, 'TRUE');
  assert.equal(t.out.length, 8, '山道1＋判断室4＋報酬配分3（1室は拒否で報酬なし）');
  assert.deepEqual(t.ret, [
    'reveal@6', 'r_obstacle@6', 'r_pickup@4', 'r_pickup@3', 'r_obstacle@2', 'r_final@1',
  ]);
});

/**
 * 往路の最大は 9（山道1＋判断室4＋報酬配分4）。
 * ★仕様書 §0 の「9回」はこの最大値であって、遊べば必ず9回になる訳ではない。
 */
test('往路の決断は最大9回。ただし相方を保たせないと9回にならない', () => {
  // ★全部自分で取ると、4室目までに P が尽きて相方が折れる。
  //   折れると「相方に譲る」が選べなくなり、報酬の場面が決断でなくなる（8回）。
  const selfish = countDecisions([
    ...OPEN('bury'),
    'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self',
    'salt',
  ]);
  assert.equal(selfish.out.length, 8, '相方が折れるので最後の報酬は選べない');

  // 一度でも譲れば相方が保ち、4回とも選べる ＝ 9回
  const shared = countDecisions([
    ...OPEN('bury'),
    'to_judge', 'obey', 'reward_partner',
    'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self',
    'salt',
  ]);
  assert.equal(shared.out.length, 9, '仕様書 §0 の 9回はこの上限');
});

/**
 * ★追跡距離 D の範囲。
 * 減算が重なっても発散しないこと、そして「常に D<=0」ではないことを見る。
 * D<=0 は詰みではない（追いつかれた場面を経て必ず結末に着く）が、
 * どの道でも必ず 0 以下になるなら、逃げる緊張が成立していない。
 */
test('★追跡距離 D が発散せず、逃げ切れる道も残っている', () => {
  const canon = (s) => {
    const t = { ...s, talked: {}, examined: s.examined[1] ? { 1: true } : {} };
    if (s.phase === 'RETURN' || s.phase === 'ENDING') t.P = 0;
    return hashState(t);
  };

  const seen = new Set();
  const start = createState();
  const stack = [start];
  seen.add(canon(start));

  let dMin = Infinity;
  let dMax = -Infinity;
  let caught = 0;
  let escaped = 0;

  while (stack.length) {
    const s = stack.pop();
    if (s.phase === 'RETURN' || s.phase === 'ENDING') {
      dMin = Math.min(dMin, s.D);
      dMax = Math.max(dMax, s.D);
    }
    if (s.step === 'caught') caught++;
    if (s.step === 'r_final') escaped++;
    if (isEnd(s)) continue;
    for (const c of view(s).choices.filter((x) => x.enabled !== false)) {
      const next = choose(s, c.id);
      const h = canon(next);
      if (!seen.has(h)) { seen.add(h); stack.push(next); }
    }
  }

  // 上限は初期値＋弔いの1。これを超えるなら加算が壊れている
  assert.equal(dMax, D_INIT + 1, `D の上限が ${dMax}（弔いの +1 を含めて ${D_INIT + 1} のはず）`);
  // 下限は捕捉判定（D<=0）を少し下回るだけ。深く沈むなら減算が重なりすぎている
  assert.ok(dMin >= -3, `D が ${dMin} まで沈んだ。減算が重なりすぎている`);
  assert.ok(dMin <= 0, '一度も追いつかれないなら、追跡が機能していない');

  assert.ok(caught > 0, '追いつかれる道が存在しない');
  assert.ok(escaped > 0, '玄関まで逃げ切れる道が存在しない');
});

/**
 * ★「折れた相方を支えるか」はどこで起きるか。
 * 両資料に「復路で1回だけ」とあるだけで場所が書かれていなかったので、
 * 実装がどう決めているかをここで固定する。
 *
 * P は復路では減らない（consumeReturn は H だけ）。つまり partnerBroken は
 * 復路に入る時点で確定していて、途中で折れることはない。
 * よって発生は必ず**最初の部屋＝厨房前（6室）**、その部屋の障害を片付けた直後。
 */
test('★折れた相方の場面は、復路の最初の部屋（厨房前）で1回だけ起きる', () => {
  // 全拒否だと報酬がゼロで、5室目で相方が折れる
  const s = drive([...ROUTE_REFUSE_ALL, 'peek', 'lean', 'look_away', 'use_penknife']);
  assert.equal(s.partnerBroken, true, '復路に入る時点で折れている');
  assert.equal(s.step, 'r_partner');
  assert.equal(s.room, 6, '厨房前で起きる');

  // 支えたあとは二度と出ない
  const after = choose(s, 'support');
  assert.equal(after.returnPartnerHandled, true);
  let t = after;
  for (let i = 0; i < 40 && !isEnd(t); i++) {
    assert.notEqual(t.step, 'r_partner', '二度目が出た');
    const v = view(t);
    t = choose(t, v.choices.find((c) => c.enabled !== false).id);
  }
});
