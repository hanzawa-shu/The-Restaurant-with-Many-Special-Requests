/**
 * タイトル画面（仕様書 §10）
 *
 * ★背景に専用の絵は用意しない。山道の最後のカット（山猫軒の発見）をそのまま使う。
 * 「どなたもどうかお入りください」の札が立っている画がタイトルなので、
 * 押した瞬間から店の招きに応じたことになる。アセットは1枚も増えない。
 *
 * 結末の記録はここに置く。周回の起点と、集めたものを見る場所を同じにする。
 */

import { collectionEl } from './collection.js';
import { collectedCount } from '../systems/progress.js';

export function createTitle(root, { onStart, onClear } = {}) {
  const el = document.createElement('div');
  el.className = 'title';

  const inner = document.createElement('div');
  inner.className = 'title-inner';
  el.appendChild(inner);

  const h = document.createElement('h1');
  h.className = 'title-main';
  h.textContent = '注文の多い料理店';
  inner.appendChild(h);

  const by = document.createElement('p');
  by.className = 'title-by';
  by.textContent = '宮沢賢治　1924';
  inner.appendChild(by);

  const box = document.createElement('div');
  box.className = 'title-record';
  inner.appendChild(box);

  const start = document.createElement('button');
  start.className = 'choice emphasis title-start';
  start.type = 'button';
  inner.appendChild(start);

  const help = document.createElement('p');
  help.className = 'title-help';
  help.textContent = '文章はどこを押しても送れる。H で文字を隠す。戻ることはできない。';
  inner.appendChild(help);

  const wipe = document.createElement('button');
  wipe.className = 'title-wipe';
  wipe.type = 'button';
  inner.appendChild(wipe);

  root.appendChild(el);

  let armed = false;   // 「記録を消す」の二段確認

  start.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    onStart?.();
  });

  /**
   * ★確認ダイアログ（confirm）は使わない。
   * ブラウザのモーダルは他の入力を全部止めてしまう。
   * 一度目の押下でボタンの文字が変わる二段確認にする。
   */
  wipe.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!armed) {
      armed = true;
      wipe.textContent = '本当に消す';
      wipe.classList.add('armed');
      return;
    }
    armed = false;
    const p = onClear?.();
    if (p) fill(p);
  });

  function fill(progress) {
    const n = collectedCount(progress);
    box.innerHTML = '';
    if (n > 0) box.appendChild(collectionEl(progress, { compact: true }));
    start.textContent = n > 0 ? 'もう一度、店に入る' : '店に入る';
    wipe.textContent = '記録を消す';
    wipe.classList.remove('armed');
    wipe.style.display = n > 0 ? '' : 'none';
    armed = false;
  }

  return {
    /** @param {object} progress いまの到達記録 */
    show(progress) {
      fill(progress);
      el.classList.add('shown');
    },
    hide() {
      el.classList.remove('shown');
    },
    isShown: () => el.classList.contains('shown'),
  };
}
