import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/systems/state.js';
import { judgeEnding } from '../src/systems/endings.js';
import { ENDING_IDS } from '../src/data/endings.js';

const base = () => createState();

test('塩をもみこんだら調理エンド（他の何より優先される）', () => {
  const s = base();
  s.saltApplied = true;
  s.chargedIn = true;              // 矛盾する状態でも
  assert.equal(judgeEnding(s), 'COOKED');
});

test('追いつかれて突き飛ばさなければ共倒れ', () => {
  const s = base();
  s.caught = true;
  assert.equal(judgeEnding(s), 'TOGETHER');
});

test('追いつかれて突き飛ばしたら独り', () => {
  const s = base();
  s.caught = true; s.pushedPartner = true;
  assert.equal(judgeEnding(s), 'ALONE');
});

test('復路で相方を置いていったら独り', () => {
  const s = base();
  s.abandonedPartner = true;
  assert.equal(judgeEnding(s), 'ALONE');
});

test('玄関に到達して逃げたら原作エンド', () => {
  const s = base();
  assert.equal(judgeEnding(s), 'ORIGINAL');
});

test('踏み込んだら TrueEnd', () => {
  const s = base();
  s.chargedIn = true;
  assert.equal(judgeEnding(s), 'TRUE');
});

test('判定式はどの状態でも5種のいずれかを返す（総当たり）', () => {
  const flags = ['saltApplied', 'caught', 'pushedPartner', 'abandonedPartner', 'chargedIn'];
  for (let mask = 0; mask < (1 << flags.length); mask++) {
    const s = base();
    flags.forEach((f, i) => { s[f] = !!(mask & (1 << i)); });
    const e = judgeEnding(s);
    assert.ok(ENDING_IDS.includes(e), `mask=${mask} で ${e}`);
  }
});
