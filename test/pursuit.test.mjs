import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, D_INIT } from '../src/systems/state.js';
import { obstacleOf, obstacleOptions, resolveRoom, isCaught, canCharge } from '../src/systems/pursuit.js';

test('厨房前の扉は常に閉まっている', () => {
  const s = createState();
  const ob = obstacleOf(s, 6);
  assert.ok(ob);
  assert.equal(ob.kind, 'locked_door');
});

test('足跡は「泥を落とした」場合だけ発生する', () => {
  const s = createState();
  assert.equal(obstacleOf(s, 2), null, '従っていなければ足跡は残らない');
  s.obeyed[2] = true;
  assert.equal(obstacleOf(s, 2).kind, 'footprints');
});

test('匂いは「香水を振った」場合だけ発生する', () => {
  const s = createState();
  assert.equal(obstacleOf(s, 5), null);
  s.obeyed[5] = true;
  assert.equal(obstacleOf(s, 5).kind, 'smell');
});

test('扉はペンナイフか懐中時計で開く。両方なければ体当たり', () => {
  const s = createState();
  let ids = obstacleOptions(s, 6).map((o) => o.id);
  assert.ok(ids.includes('use_penknife'));
  assert.ok(ids.includes('use_pocket_watch'));

  s.items = [];
  ids = obstacleOptions(s, 6).map((o) => o.id);
  assert.deepEqual(ids, ['force'], '手立てがなければ体当たりだけ');
});

test('解けない障害は通過できるが必ずペナルティを受ける', () => {
  const s = createState();
  s.obeyed[5] = true;
  s.items = [];                       // マッチを渡してしまった
  const ids = obstacleOptions(s, 5).map((o) => o.id);
  assert.deepEqual(ids, ['endure']);
});

test('余分なターンとペナルティだけが距離を削る', () => {
  const s = createState();
  s.room = 5; s.D = D_INIT; s.H = 12; s.hasGun = false; s.hasCoat = false;
  resolveRoom(s);
  assert.equal(s.D, D_INIT, '1部屋1ターンなら距離は変わらない');

  s.turnExtra = 1; resolveRoom(s);
  assert.equal(s.D, D_INIT - 1);

  s.penalty = 2; resolveRoom(s);
  assert.equal(s.D, D_INIT - 3);
});

test('復路でも部屋ごとに腹が減る。重いほど余計に減る', () => {
  const light = createState();
  light.room = 5; light.H = 10; light.hasGun = false; light.hasCoat = false;
  resolveRoom(light);
  assert.equal(light.H, 9, '軽い体なら 1');

  const heavy = createState();
  heavy.room = 5; heavy.H = 10;   // 鉄砲と外套を持ったまま
  resolveRoom(heavy);
  assert.equal(heavy.H, 8, '重い体なら 2');
});

test('玄関（終点）では腹が減らない', () => {
  const s = createState();
  s.room = 1; s.H = 5; s.hasGun = false; s.hasCoat = false;
  resolveRoom(s);
  assert.equal(s.H, 5, '到着地点では消費しない');
});

test('走れないと部屋ごとに距離を失う', () => {
  const s = createState();
  s.room = 1; s.D = 3; s.H = 0;
  resolveRoom(s);
  assert.equal(s.D, 2);
});

test('距離が0以下で追いつかれる', () => {
  const s = createState();
  s.D = 1;  assert.equal(isCaught(s), false);
  s.D = 0;  assert.equal(isCaught(s), true);
  s.D = -1; assert.equal(isCaught(s), true);
});

test('踏み込む条件は「笛・相方・走れる体力」の3つすべて', () => {
  const s = createState();
  s.items = ['dog_whistle']; s.partnerPresent = true; s.H = 5;
  assert.equal(canCharge(s), true);

  s.items = [];             assert.equal(canCharge(s), false, '笛がない');
  s.items = ['dog_whistle'];
  s.partnerPresent = false; assert.equal(canCharge(s), false, '相方がいない');
  s.partnerPresent = true;
  s.H = 0;                  assert.equal(canCharge(s), false, '走れない');
});
