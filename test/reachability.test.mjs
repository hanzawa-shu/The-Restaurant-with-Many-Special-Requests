import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, view, choose, hashState, isEnd } from '../src/systems/game.js';
import { ENDING_IDS } from '../src/data/endings.js';
import { SCENE_LIST } from '../src/systems/scenes.js';
import {
  drive, ROUTE_REFUSE_ALL, ROUTE_TRUE_OUTBOUND, RETURN_TRUE, ROUTE_THIN_OUTBOUND,
} from './_drive.mjs';

/**
 * このファイルが本作でもっとも重要なテストである。
 * 一方通行かつ周回前提のゲームで、到達不能なエンディングが混入するのが最悪の事故。
 */

// ------------------------------------------------------- 5種の到達を実証する

test('1 調理: 鍵穴を覗かず塩をもみこむ', () => {
  const s = drive([...ROUTE_REFUSE_ALL, 'salt']);
  assert.equal(s.ending, 'COOKED');
});

test('2 共倒れ: 全拒否で飢え、追いつかれて手を離さない', () => {
  const s = drive([
    ...ROUTE_REFUSE_ALL,
    'peek', 'lean', 'look_away',
    'use_penknife',   // 厨房前の扉
    'support',        // 折れた相方を支える（距離を2失う）
    'hold',           // 追いつかれた
  ]);
  assert.equal(s.ending, 'TOGETHER');
  assert.equal(s.caught, true);
});

test('3 独り（突き飛ばす）', () => {
  const s = drive([
    ...ROUTE_REFUSE_ALL,
    'peek', 'lean', 'look_away', 'use_penknife', 'support', 'push',
  ]);
  assert.equal(s.ending, 'ALONE');
  assert.equal(s.pushedPartner, true);
});

test('3 独り（復路で置いていく）', () => {
  const s = drive([
    ...ROUTE_REFUSE_ALL,
    'peek', 'lean', 'look_away', 'use_penknife', 'abandon',
  ]);
  assert.equal(s.ending, 'ALONE');
  assert.equal(s.abandonedPartner, true);
});

test('4 原作: 玄関まで逃げ切り、踏み込まない', () => {
  const s = drive([...ROUTE_TRUE_OUTBOUND, ...RETURN_TRUE, 'flee']);
  assert.equal(s.ending, 'ORIGINAL');
  assert.equal(s.D, 4, '一度も距離を失っていない（弔いの +1 を含む）');
});

test('5 TrueEnd: 同じ道で、最後に踏み込む', () => {
  const s = drive([...ROUTE_TRUE_OUTBOUND, ...RETURN_TRUE, 'charge']);
  assert.equal(s.ending, 'TRUE');
  assert.ok(s.items.includes('dog_whistle'), '笛を守り抜いた');
  assert.equal(s.partnerPresent, true, '相方が隣にいる');
  assert.ok(s.H > 0, '走れる体力が残っている');
});

test('犬を見捨てると TrueEnd に到達できない', () => {
  // 山道で「何もせず進む」を選ぶと笛が手に入らない
  const outbound = ROUTE_TRUE_OUTBOUND
    .map((c) => (c === 'bury' ? 'leave' : c))
    .filter((c) => c !== 'toggle_dog_whistle');
  const s = drive([...outbound, ...RETURN_TRUE]);
  const v = view(s);
  const charge = v.choices.find((c) => c.id === 'charge');
  assert.equal(charge.enabled, false, '踏み込めない');
  assert.equal(charge.hint, '犬を呼ぶ手立てがない');
});

// ------------------------------------------------------- 復路の天秤が機能するか

test('★外套は「条件付きの正解」である: 飢えていれば拾うのが正しい', () => {
  // 相方に大きい報酬を早く譲ったため H が薄いルート
  const thin = [...ROUTE_THIN_OUTBOUND, 'peek', 'lean', 'look_away', 'use_penknife', 'advance'];
  assert.equal(drive(thin).H, 2, '衣裳室に入る時点で H=2');
  const tail = ['leave', 'use_glasses', 'advance'];

  // 拾わない → 玄関で飢えており、踏み込めない
  const without = drive([...thin, 'leave', ...tail]);
  assert.equal(without.H, 0, '飢えた');
  const noCharge = view(without).choices.find((c) => c.id === 'charge');
  assert.equal(noCharge.enabled, false);
  assert.equal(noCharge.hint, '走れる体力がない');
  assert.equal(drive([...thin, 'leave', ...tail, 'flee']).ending, 'ORIGINAL',
    '原作エンドまでしか行けない');

  // 拾う → 腹が満たされ、走り続けられるので距離も守れる
  const withCoat = drive([...thin, 'take', ...tail]);
  assert.ok(withCoat.H > 0, '外套の前菜で腹が満たされた');
  assert.equal(withCoat.hasCoat, true);
  assert.ok(withCoat.D > without.D,
    '走れない状態が3室続く方が、重量の1ターンより高くつく');
  assert.equal(drive([...thin, 'take', ...tail, 'charge']).ending, 'TRUE');
});

test('★満たされているなら外套は拾うべきでない（距離を1失うだけ）', () => {
  const fed = [...ROUTE_TRUE_OUTBOUND, 'peek', 'lean', 'look_away', 'use_penknife', 'advance'];
  const tail = ['leave', 'use_glasses', 'advance'];
  const skip = drive([...fed, 'leave', ...tail]);
  const take = drive([...fed, 'take', ...tail]);

  assert.equal(drive([...fed, 'leave', ...tail, 'charge']).ending, 'TRUE');
  assert.equal(drive([...fed, 'take', ...tail, 'charge']).ending, 'TRUE');
  assert.ok(take.D < skip.D, '拾うと距離を1失う');
  assert.ok(skip.H > 0, '拾わなくても走れる');
});

test('★鉄砲は罠である: 拾って撃つと追いつかれる', () => {
  const upTo = [...ROUTE_TRUE_OUTBOUND, 'peek', 'lean', 'look_away', 'use_penknife', 'advance', 'leave'];

  const skip = drive([...upTo, 'leave', 'use_glasses', 'advance']);
  assert.equal(skip.step, 'r_final', '拾わなければ玄関に着く');

  const fired = drive([...upTo, 'take', 'fire', 'use_glasses', 'advance']);
  assert.equal(fired.gunFired, true);
  assert.ok(fired.D < skip.D, '距離を失う');
  assert.ok(fired.H < skip.H, '重量ぶん余計に消耗する');
  assert.equal(fired.step, 'caught', '拾って撃つと追いつかれる');
});

test('★犬を弔うと犬が近くにいる（情を選ぶ代償に見返りがある）', () => {
  const buried = drive([...ROUTE_TRUE_OUTBOUND, 'peek', 'lean', 'look_away']);
  const notBuried = drive([
    ...ROUTE_TRUE_OUTBOUND.map((c) => (c === 'bury' ? 'take' : c)), 'peek', 'lean', 'look_away',
  ]);
  assert.equal(buried.D, 4, '弔えば距離に余裕ができる');
  assert.equal(notBuried.D, 3);
  assert.ok(buried.H < notBuried.H, 'ただし弔いには体力を払う');
});

test('相方を突き飛ばしたあとは TrueEnd に到達できない', () => {
  const s = drive([...ROUTE_REFUSE_ALL, 'peek', 'lean', 'look_away', 'use_penknife', 'abandon']);
  assert.equal(s.partnerPresent, false);
  assert.notEqual(s.ending, 'TRUE');
});

// ------------------------------------------------------- 全経路の総当たり探索

test('全選択経路を探索して、行き止まりがなく5種すべてに到達できる', () => {
  /**
   * 素朴に全状態を数えると1200万を超えて発散する。
   * 2つの健全な抽象化で 37,559 状態に畳む。どちらも手抜きではなく、
   * 「畳んでも到達可能なエンディングの集合が変わらない」ことが保証できる。
   *
   * (1) 演出フラグを落とす
   *     examined / talked は、1室目の「調べる」を除いてゲーム的な効果を持たない。
   *     ログを出し、その選択肢を消すだけ。状態空間を512倍に膨らませるので、
   *     examined[1] だけ残して落とす。
   *
   * (2) 復路以降の P を畳む
   *     復路で P は一度も読まれない。読まれるのは partnerBroken フラグだけ。
   *     エンディング判定式もフラグしか読まない。
   *     H は復路でも消費されるので畳めない（Phase 1 の欠陥3の修正で、
   *     復路にも空腹消費が入った）。
   */
  const canonical = (s) => {
    const t = { ...s, talked: {}, examined: s.examined[1] ? { 1: true } : {} };
    if (s.phase === 'RETURN' || s.phase === 'ENDING') {
      // H は復路でも消費されるので畳めない。P だけ畳む（復路で読まれないため）
      t.P = 0;
    }
    return hashState(t);
  };

  const MAX = 900_000;
  const seen = new Set();
  const start = createState();
  const stack = [start];
  seen.add(canonical(start));

  const reached = new Set();
  const byPhase = {};
  let visited = 0;
  let terminals = 0;

  while (stack.length) {
    const s = stack.pop();
    visited++;
    byPhase[s.phase] = (byPhase[s.phase] ?? 0) + 1;
    assert.ok(visited <= MAX, `探索が ${MAX} 状態を超えた`);

    if (isEnd(s)) {
      terminals++;
      assert.ok(ENDING_IDS.includes(s.ending), `未知のエンディング: ${s.ending}`);
      reached.add(s.ending);
      continue;
    }

    const v = view(s);
    const usable = v.choices.filter((c) => c.enabled);
    assert.ok(
      usable.length > 0,
      `行き止まり: phase=${s.phase} step=${s.step} room=${s.room}`
    );

    for (const c of usable) {
      const next = choose(s, c.id);
      const h = canonical(next);
      if (!seen.has(h)) {
        seen.add(h);
        stack.push(next);
      }
    }
  }

  assert.deepEqual(
    [...reached].sort(),
    [...ENDING_IDS].sort(),
    `到達できないエンディングがある: ${ENDING_IDS.filter((e) => !reached.has(e))}`
  );

  console.log(`      探索した状態 ${visited} / 終端 ${terminals} / 内訳`, byPhase);
});

test('到達しうるすべての場面がシーン表に登録されている', () => {
  const canonical = (s) => {
    const t = { ...s, talked: {}, examined: s.examined[1] ? { 1: true } : {} };
    if (s.phase === 'RETURN' || s.phase === 'ENDING') t.P = 0;
    return hashState(t);
  };

  const seen = new Set();
  const start = createState();
  const stack = [start];
  seen.add(canonical(start));

  const hit = new Set();
  const unregistered = new Set();

  while (stack.length) {
    const s = stack.pop();
    const v = view(s);
    if (v.scene.no === 0) unregistered.add(v.scene.name);
    else hit.add(v.scene.code);

    if (isEnd(s)) continue;
    for (const c of v.choices.filter((x) => x.enabled)) {
      const next = choose(s, c.id);
      const h = canonical(next);
      if (!seen.has(h)) { seen.add(h); stack.push(next); }
    }
  }

  assert.deepEqual([...unregistered], [], '未登録の場面がある');

  // 表にあるのに到達できない場面は、設計の穴か表の残骸
  const unreachable = SCENE_LIST.filter((x) => !hit.has(x.code));
  console.log(`      登録 ${SCENE_LIST.length} / 到達 ${hit.size}`);
  if (unreachable.length) {
    console.log('      到達しなかった場面:', unreachable.map((x) => `S${x.no}[${x.code}] ${x.name}`).join(' / '));
  }
});
