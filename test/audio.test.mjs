/**
 * 音の割り当て（Phase 5.5）
 *
 * ★曲を「どの場面で鳴らすか」は純粋関数（audio.js の bgmFor）に置いてある。
 * 再生の実装を入れる前に、割り当てだけを先に検証できる状態にしておく。
 *
 * ここが守るのは2つ。
 *   ・到達しうる全場面に、必ず曲が決まっていること（無音の穴を作らない）
 *   ・音源集.md と実装がずれないこと（ファイルの有無も見る）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BGM, SE, SE_OPTIONAL, SE_IDS, bgmFor, sePromptFor } from '../src/data/audio.js';
import { SCENE_LIST } from '../src/systems/scenes.js';

/** 場面の鍵（step@room）から、bgmFor に渡せる状態を組み立てる */
function stateOf(key) {
  const [step, tail] = key.split('@');
  if (step === 'ending') return { phase: 'ENDING', ending: tail, step };
  const phase = step.startsWith('m') ? 'MOUNTAIN'
    : (step.startsWith('r_') || step === 'caught') ? 'RETURN'
      : (step === 'reveal' || step === 'eyes' || step === 'eyes2') ? 'REVEAL'
        : 'OUTBOUND';
  return { phase, room: Number(tail), step };
}

test('★到達しうるすべての場面に曲が決まっている', () => {
  for (const sc of SCENE_LIST) {
    const id = bgmFor(stateOf(sc.key));
    assert.ok(BGM[id], `S${sc.no} ${sc.name} の曲 "${id}" が BGM に無い`);
  }
});

test('タイトル画面（状態なし）でも曲が決まる', () => {
  assert.ok(BGM[bgmFor(null)], 'タイトルの曲が決まっていない');
});

test('★同じ曲を使い回している（曲数より場面数がずっと多い）', () => {
  const used = new Set(SCENE_LIST.map((sc) => bgmFor(stateOf(sc.key))));
  assert.ok(used.size <= Object.keys(BGM).length);
  assert.ok(
    SCENE_LIST.length > used.size * 4,
    `場面 ${SCENE_LIST.length} に対して曲 ${used.size}。使い回しが足りていない`
  );
});

test('置いてある曲は全部どこかで鳴る（死蔵しない）', () => {
  const used = new Set([bgmFor(null), ...SCENE_LIST.map((sc) => bgmFor(stateOf(sc.key)))]);
  for (const id of Object.keys(BGM)) {
    assert.ok(used.has(id), `${id}（${BGM[id].label}）がどの場面でも鳴らない`);
  }
});

/**
 * ★「まだ無い曲」は prompt を持たせて明示する。
 * 黙って欠けていると、鳴らないことに気づかないまま進んでしまう。
 */
test('ファイルが無い曲には、生成用のプロンプトが書いてある', () => {
  for (const [id, b] of Object.entries(BGM)) {
    const exists = fs.existsSync(b.file);
    if (!exists) {
      assert.ok(b.prompt, `${id} のファイルが無いのに prompt が書かれていない: ${b.file}`);
    } else {
      assert.ok(!b.prompt, `${id} は生成済みなので prompt は消す: ${b.file}`);
    }
  }
});

test('★効果音は7種まで。増やすなら意図して増やす', () => {
  assert.equal(SE_IDS.length, 7,
    '効果音を増減した。静けさを失っていないか確かめてから、この数を直すこと');
});

test('効果音は id が重複せず、全部プロンプトが引ける', () => {
  const ids = [...SE_IDS, ...Object.keys(SE_OPTIONAL)];
  assert.equal(new Set(ids).size, ids.length, 'id が重複している');
  for (const id of ids) {
    const p = sePromptFor(id);
    assert.ok(p && p.length > 40, `${id} のプロンプトが短すぎる`);
    assert.match(p, /seconds/, `${id} のプロンプトに長さが入っていない`);
  }
});

/**
 * ★この作品の音は「乾いた生音」に統一する。
 * 電子音や映画的な効果を1つ混ぜると、水彩と銅版画の画作りから浮く。
 * 否定の指定が全部のプロンプトに入っていることを確かめる。
 */
test('効果音のプロンプトに、禁じている音の指定が入っている', () => {
  for (const id of SE_IDS) {
    const p = sePromptFor(id);
    assert.match(p, /no synthesizer/, `${id}: 電子音を禁じていない`);
    assert.match(p, /no modern cinematic whoosh/, `${id}: 映画的な効果を禁じていない`);
    assert.match(p, /no music/, `${id}: 旋律を禁じていない（BGM と喧嘩する）`);
  }
});

test('効果音には、1周あたりの回数と役目が書いてある', () => {
  for (const [id, e] of Object.entries(SE)) {
    assert.ok(e.uses, `${id} に回数が書かれていない`);
    assert.ok(e.use && e.use.length > 10, `${id} に役目が書かれていない`);
    assert.ok(e.sec > 0 && e.sec <= 3, `${id} の長さ ${e.sec}s は効果音として長すぎる`);
  }
});
