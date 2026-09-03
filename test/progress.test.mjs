/**
 * 周回まわり（Phase 5）
 *
 * 到達記録と既読判定は「2周目の体験」を直接決める。
 * ここが壊れると、判断の場面まで早送りされる／同じ文を何周も送られる、
 * のどちらかになる。どちらも遊びを損なうので、純粋な部分は必ず押さえる。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress, recordEnding, markSeen, hasSeen, textKey,
  collected, collectedCount,
} from '../src/systems/progress.js';
import { ENDING_IDS } from '../src/data/endings.js';
import { isSkippableStep } from '../src/systems/game.js';
import { SCENE_LIST } from '../src/systems/scenes.js';
import { drive, ROUTE_REFUSE_ALL } from './_drive.mjs';

test('到達記録は積み上がり、同じ結末を二度数えない', () => {
  let p = emptyProgress();
  assert.equal(collectedCount(p), 0);
  p = recordEnding(p, 'COOKED');
  p = recordEnding(p, 'COOKED');
  assert.equal(collectedCount(p), 1);
  p = recordEnding(p, 'TRUE');
  assert.equal(collectedCount(p), 2);
  assert.deepEqual(collected(p), ['COOKED', null, null, null, 'TRUE']);
});

test('既読の鍵は文面が変われば変わる', () => {
  const a = textKey('O2a', ['——廊下', '［看板］']);
  const b = textKey('O2a', ['——廊下', '［看板］', 'もう一行']);
  const c = textKey('O2b', ['——廊下', '［看板］']);
  assert.notEqual(a, b, '文が増えたら別の鍵になる');
  assert.notEqual(a, c, '場面が違えば別の鍵になる');
  assert.equal(a, textKey('O2a', ['——廊下', '［看板］']), '同じ入力なら同じ鍵');
});

test('既読の鍵は場面番号で始まる（読めば何の文か分かる）', () => {
  assert.match(textKey('R6a', ['あ']), /^R6a\./);
});

test('markSeen / hasSeen', () => {
  let p = emptyProgress();
  const k = textKey('M1', ['山の斜面。']);
  assert.equal(hasSeen(p, k), false);
  p = markSeen(p, [k]);
  assert.equal(hasSeen(p, k), true);
  p = markSeen(p, [k]);
  assert.equal(p.seenTexts.length, 1, '同じ鍵は増えない');
});

/**
 * ★これが Phase 5 でもっとも大事な性質。
 * 判断の場面まで早送りされると、選択がボタンを押す作業に落ちる。
 */
test('★判断・反転・結末の場面は、既読でも早送りできない', () => {
  const MUST_TYPE = new Set([
    'o_judge', 'o_hide', 'o_reward',
    'reveal', 'eyes', 'eyes2',
    'caught', 'r_partner', 'r_fire', 'r_final', 'ending',
  ]);
  // 短縮してよい場面（2周目の待ち時間を削るため）
  const MAY_SKIP = new Set([
    'm1', 'm2', 'm3', 'o_free', 'r_obstacle', 'r_pickup', 'r_look',
  ]);

  /**
   * 場面表（SCENE_LIST）は reachability テストが「到達しうる場面を漏れなく載せている」
   * ことを保証している。だからここを回せば、実装した全場面を検査できる。
   * 新しい場面を足して分類を決め忘れると、ここで落ちる。
   */
  const steps = new Set(SCENE_LIST.map((sc) => sc.key.split('@')[0]));
  for (const step of steps) {
    const skippable = isSkippableStep(step);
    if (MUST_TYPE.has(step)) {
      assert.equal(skippable, false, `${step} は早送り禁止でなければならない`);
    } else if (MAY_SKIP.has(step)) {
      assert.equal(skippable, true, `${step} は短縮できるべき`);
    } else {
      assert.fail(`場面 ${step} の早送り可否が決まっていない`);
    }
  }
  // 表の側にも漏れがないこと
  for (const step of MUST_TYPE) {
    assert.ok(steps.has(step), `${step} が場面表に無い`);
  }
});

test('結末に到達したら、その結末が記録できる', () => {
  const s = drive([...ROUTE_REFUSE_ALL, 'salt']);
  const p = recordEnding(emptyProgress(), s.ending);
  assert.equal(collectedCount(p), 1);
  assert.ok(ENDING_IDS.includes(s.ending));
});
