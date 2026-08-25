import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../src/systems/state.js';
import { partnerStage, checkBreak, partnerLine, givesRevealWarning } from '../src/systems/partner.js';

test('P の段階は 0〜4 に収まり、単調である', () => {
  let prev = -1;
  for (let p = 0; p <= 12; p++) {
    const st = partnerStage(p);
    assert.ok(st >= 0 && st <= 4);
    assert.ok(st >= prev, 'P が増えるほど段階は下がらない');
    prev = st;
  }
});

test('P が 0 になると折れる。折れる瞬間に台詞が返る', () => {
  const s = createState();
  s.P = 1;
  assert.equal(checkBreak(s), null, 'まだ折れていない');
  s.P = 0;
  const lines = checkBreak(s);
  assert.ok(Array.isArray(lines) && lines.length > 0, '折れる台詞が返る');
  assert.equal(s.partnerBroken, true);
});

test('一度折れたら二度目は台詞を返さない', () => {
  const s = createState();
  s.P = 0;
  checkBreak(s);
  assert.equal(checkBreak(s), null);
});

test('折れた相方は沈黙する（疑問を提示しない）', () => {
  const s = createState();
  s.partnerBroken = true;
  assert.equal(partnerLine(s, 3), '……');
  assert.equal(givesRevealWarning(s), false, '6室目で警告が出ない');
});

test('折れていない相方は6室目で警告を出す', () => {
  const s = createState();
  assert.equal(givesRevealWarning(s), true);
});

test('台詞の選択は決定的である（乱数を使わない）', () => {
  const s = createState();
  assert.equal(partnerLine(s, 3), partnerLine(s, 3));
});

test('★5段階すべてが実際のプレイで通る（デッドコンテンツを作らない）', () => {
  // P は 8 から始まり、判断室ごとに 2 減って 8→6→4→2→0 を辿る
  const seen = new Set();
  for (const p of [8, 6, 4, 2, 0]) seen.add(partnerStage(p));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4],
    '取りうる P の値で全段階に入らない。閾値が実際の値とずれている');
});

test('段階ごとに台詞が用意されている', async () => {
  const { PARTNER_LINES } = await import('../src/data/dialogue.js');
  for (let st = 0; st <= 4; st++) {
    assert.ok(PARTNER_LINES[st]?.length > 0, `段階 ${st} の台詞がない`);
  }
});
