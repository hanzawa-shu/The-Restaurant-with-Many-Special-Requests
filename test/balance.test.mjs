import { test } from 'node:test';
import assert from 'node:assert/strict';
import { view } from '../src/systems/game.js';
import { weight } from '../src/systems/resources.js';
import { drive, ROUTE_OBEY_ALL, ROUTE_REFUSE_ALL, ROUTE_TRUE_OUTBOUND } from './_drive.mjs';

/**
 * 仕様書 §6.4 に書いた3ルートの数値と、実装が一致することを保証する。
 * ここがズレたら、仕様書と実装のどちらかが嘘をついている。
 */

test('全服従: H=12 / 丸腰 / 小物ゼロ / そして相方が折れている', () => {
  const s = drive(ROUTE_OBEY_ALL);
  assert.equal(s.H, 12, 'H');
  assert.equal(s.P, 0, 'P が尽きている');
  assert.equal(s.partnerBroken, true,
    '★言われた通りにした者は、6室目の警告を失う');
  assert.equal(s.hasGun, false, '鉄砲を置いた');
  assert.equal(s.hasCoat, false, '外套を脱いだ');
  assert.equal(weight(s), 0, '軽い');
  assert.deepEqual(s.items, [], '小物をすべて差し出した');
  assert.equal(s.phase, 'REVEAL');
});

test('全拒否: H=0（4室目で枯渇）/ 完全武装 / 相方も折れている', () => {
  const s = drive(ROUTE_REFUSE_ALL);
  assert.equal(s.H, 0, 'H が枯渇している');
  assert.equal(s.P, 0, 'P も尽きている（報酬を一度も得られないため）');
  assert.equal(s.partnerBroken, true);
  assert.equal(weight(s), 3, '最も重い');
  assert.equal(s.items.length, 4, '小物は全部残っている');
});

test('全拒否の H は 10 → 6 → 2 → 0 → 0 を辿る', () => {
  const trace = [];
  let s = drive(['advance', 'leave', 'enter', 'examine', 'advance']);
  trace.push(s.H);
  for (let i = 0; i < 4; i++) {
    s = drive(['to_judge', 'refuse'], s);
    trace.push(s.H);
  }
  assert.deepEqual(trace, [10, 6, 2, 0, 0]);
});

test('TrueEnd 想定ルート: 相方に譲りつつ、大きいものを渡し、小物を守る', () => {
  const s = drive(ROUTE_TRUE_OUTBOUND);
  assert.equal(s.H, 6, 'H（相方に譲ったぶん自分が消耗している）');
  assert.equal(s.P, 2, 'P（折れずに持ちこたえた）');
  assert.equal(weight(s), 0, '大きいものは全部渡した');
  assert.deepEqual(
    [...s.items].sort(),
    ['dog_whistle', 'glasses', 'matches', 'penknife'],
    '掌に握れるものだけ守り抜いた（懐中時計は差し出した）'
  );
  assert.equal(s.partnerBroken, false, '相方は折れていない');
});

test('消費は所持状態の更新後に行われる（鉄砲を置いた部屋は軽い体で消費する）', () => {
  // 3室目で鉄砲を渡すと、その部屋の消費は W=1 で計算される
  let s = drive(['advance', 'leave', 'enter', 'examine', 'advance', 'to_judge', 'obey', 'reward_self']);
  assert.equal(s.H, 10, '2室目終了時');
  s = drive(['to_judge', 'obey'], s);
  assert.equal(s.H, 8, '3室目: 1+1=2 の消費（1+3=4 ではない）');
});

test('報酬を相方に譲ると自分が消耗する（トレードオフが成立している）', () => {
  const open = ['advance', 'leave', 'enter', 'examine', 'advance'];
  const mine   = drive([...open, 'to_judge', 'obey', 'reward_self']);
  const theirs = drive([...open, 'to_judge', 'obey', 'reward_partner']);
  assert.ok(mine.H > theirs.H, '自分が受け取れば H が高い');
  assert.ok(theirs.P > mine.P, '譲れば P が高い');
  assert.equal(mine.H - theirs.H, 4, '自分が受け取れば H が +4');
  assert.equal(theirs.P - mine.P, 4, '相方に譲れば P が +4（上限12に当たらない）');
});

test('相方に一度でも譲れば折れない。一度も譲らなければ5室目で折れる', () => {
  const open = ['advance', 'leave', 'enter', 'examine', 'advance'];

  const neglected = drive([
    ...open,
    'to_judge', 'obey', 'reward_self', 'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self', 'to_judge', 'obey', 'reward_self',
  ]);
  assert.equal(neglected.partnerBroken, true, '一度も譲らなければ折れる');

  const cared = drive([
    ...open,
    'to_judge', 'obey', 'reward_partner', 'to_judge', 'obey', 'reward_self',
    'to_judge', 'obey', 'reward_self', 'to_judge', 'obey', 'reward_self',
  ]);
  assert.equal(cared.partnerBroken, false, '一度譲れば持ちこたえる');
});

test('★従い続けると腹は満たされる。これは意図した設計である', () => {
  // 従う ＝ 腹は満たされるが丸腰になる
  // 拒否 ＝ 装備は残るが飢える
  // この二律背反が本作の中核なので、全服従で H が上限に張り付くのは正しい
  const obeyed = drive(ROUTE_OBEY_ALL);
  assert.equal(obeyed.H, 12, '腹は満たされている');
  assert.deepEqual(obeyed.items, [], 'しかし何も残っていない');
  assert.equal(obeyed.hasGun, false);
  assert.equal(obeyed.hasCoat, false);

  const refused = drive(ROUTE_REFUSE_ALL);
  assert.equal(refused.H, 0, '飢えている');
  assert.equal(refused.items.length, 4, 'しかし手札は全部ある');
});

test('報酬を譲るコストは、H が上限に張り付かないルートでは実際に効く', () => {
  const selfish = ROUTE_TRUE_OUTBOUND.map((c) => (c === 'reward_partner' ? 'reward_self' : c));
  const a = drive(selfish);
  const b = drive(ROUTE_TRUE_OUTBOUND);   // 3室目の報酬を相方に譲る版

  assert.equal(a.H, 8);
  assert.equal(b.H, 6, '譲ったぶん、自分が飢える');
  assert.equal(a.partnerBroken, true, '譲らなければ相方は折れる');
  assert.equal(b.partnerBroken, false, '譲れば折れない');
});

test('折れるのは5室目である（4室目までは持ちこたえる）', () => {
  let s = drive(['advance', 'leave', 'enter', 'examine', 'advance']);
  const broken = [];
  for (const room of [2, 3, 4, 5]) {
    s = drive(['to_judge', 'obey', 'reward_self'], s);
    broken.push(s.partnerBroken);
  }
  assert.deepEqual(broken, [false, false, false, true]);
});
