/**
 * 結末の到達記録（仕様書 §10）
 *
 * ★結末画面とタイトル画面の両方で同じものを出す。
 * overlay.js の中に書いていたのでタイトルから使えなかった。表示は一箇所に持つ。
 *
 * 未到達は「？？？」で伏せる。数だけ見せて中身は見せない。
 * 何が残っているか分かってしまうと、探す理由が消える。
 */

import { ENDINGS, ENDING_IDS } from '../data/endings.js';
import { collectedCount } from '../systems/progress.js';

/**
 * @param {object} progress
 * @param {{compact?: boolean, highlight?: string|null}} [opt]
 *   compact   タイトル画面用。見出しを短くする
 *   highlight いま到達した結末。1つだけ光らせる
 */
export function collectionEl(progress, opt = {}) {
  const n = collectedCount(progress);
  const root = document.createElement('div');
  root.className = 'collection' + (opt.compact ? ' compact' : '');

  const head = document.createElement('p');
  head.className = 'collection-head';
  head.textContent = `見た結末  ${n} / ${ENDING_IDS.length}`;
  root.appendChild(head);

  const list = document.createElement('div');
  list.className = 'collection-list';
  for (const id of ENDING_IDS) {
    const e = ENDINGS[id];
    const got = !!progress.endings[id];
    const slot = document.createElement('span');
    slot.className = 'slot'
      + (got ? ' got' : '')
      + (opt.highlight === id ? ' fresh' : '');
    slot.textContent = got ? `${e.no}. ${e.title}` : `${e.no}. ？？？`;
    list.appendChild(slot);
  }
  root.appendChild(list);

  // 全部見た人にだけ出す一行。周回の終わりを示す
  if (n === ENDING_IDS.length) {
    const done = document.createElement('p');
    done.className = 'collection-done';
    /**
     * ★「原作を読め」とは書かない（成果指標から外している）。
     * 五つ見た人にだけ、店の仕掛けを一行で指し示す。
     */
    done.textContent = '——五つとも見た。どの道でも、店は同じ言葉で迎えた。';
    root.appendChild(done);
  }
  return root;
}
