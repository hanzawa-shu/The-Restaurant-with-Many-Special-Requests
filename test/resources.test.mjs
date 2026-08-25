import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/systems/state.js';
import {
  weight, clothingStage, canRun, hungerLevel,
  consume, grantReward, REWARD, P_DRAIN,
} from '../src/systems/resources.js';

test('重量は常に所持状態から再計算される', () => {
  const s = createState();
  assert.equal(weight(s), 3);                      // 鉄砲2 + 外套1
  s.hasGun = false;  assert.equal(weight(s), 1);
  s.hasCoat = false; assert.equal(weight(s), 0);
  s.hasGun = true;   assert.equal(weight(s), 2);
});

test('小物は重量に影響しない', () => {
  const s = createState();
  const before = weight(s);
  s.items = [];
  assert.equal(weight(s), before);
});

test('服装段階は服従フラグから導かれる（鉄砲は含まない）', () => {
  const s = createState();
  assert.equal(clothingStage(s), 0);
  s.obeyed[2] = true; assert.equal(clothingStage(s), 1);
  s.obeyed[3] = true; assert.equal(clothingStage(s), 1);  // 鉄砲の部屋は服装を変えない
  s.obeyed[4] = true; assert.equal(clothingStage(s), 2);
  s.obeyed[5] = true; assert.equal(clothingStage(s), 3);
});

test('消費は H が 1+重量、P が P_DRAIN', () => {
  const s = createState();
  s.H = 10; s.P = 8;
  consume(s);
  assert.equal(s.H, 6, '1 + 3');
  assert.equal(s.P, 8 - P_DRAIN);
});

test('相方は初期値8・消耗2なので、報酬を一度も譲らなければ4回目の消費で折れる', () => {
  const s = createState();
  assert.equal(s.P, 8);
  assert.equal(P_DRAIN, 2);
  for (let i = 0; i < 4; i++) consume(s);
  assert.equal(s.P, 0, '往路の最後（5室目）で尽きる');
});

test('H と P は 0 から 12 にクランプされる', () => {
  const s = createState();
  s.H = 2; s.hasGun = true; s.hasCoat = true;
  consume(s);
  assert.equal(s.H, 0, 'H は負にならない');

  s.H = 11;
  grantReward(s, REWARD.obey, 'self');
  assert.equal(s.H, 12, 'H は 12 を超えない');

  s.P = 11;
  grantReward(s, REWARD.obey, 'partner');
  assert.equal(s.P, 12, 'P は 12 を超えない');
});

test('折れた相方は報酬を受け取れない', () => {
  const s = createState();
  s.P = 0; s.partnerBroken = true;
  grantReward(s, REWARD.obey, 'partner');
  assert.equal(s.P, 0, '折れたあと P は増えない');
});

test('H が 0 だと走れない（ゲームオーバーではない）', () => {
  const s = createState();
  assert.equal(canRun(s), true);
  s.H = 0;
  assert.equal(canRun(s), false);
});

test('空腹の演出段階は 0〜4 に収まる', () => {
  const s = createState();
  for (let h = 0; h <= 12; h++) {
    s.H = h;
    const lv = hungerLevel(s);
    assert.ok(lv >= 0 && lv <= 4, `H=${h} で段階 ${lv}`);
  }
  s.H = 12; assert.equal(hungerLevel(s), 0);
  s.H = 0;  assert.equal(hungerLevel(s), 4);
});
