/**
 * 音量の設定（設計書 §13.7）
 *
 * ★滑り子（スライダー）にしない。5段階の点を押す形にする。
 * 細かく決められても、細かく決めたい人はいない。
 * 押した回数で分かるほうが速く、指でも狙いやすい。
 *
 * 開く場所は2つ（タイトルと本編）だが、作るものは1つにする。
 */

import { VOLUME_LABELS, VOLUME_STEPS } from '../data/audio.js';

/**
 * @param {HTMLElement} root  置き場所
 * @param {{ get: () => {bgm:number, se:number}, set: (ch:string, step:number) => void }} hooks
 */
export function createSettings(root, hooks) {
  const wrap = document.createElement('div');
  wrap.className = 'settings';

  const btn = document.createElement('button');
  btn.className = 'settings-btn';
  btn.type = 'button';
  btn.textContent = '♪';
  btn.title = '音量';
  wrap.appendChild(btn);

  const box = document.createElement('div');
  box.className = 'settings-box';
  wrap.appendChild(box);

  const rows = {};
  for (const [ch, label] of [['bgm', '音楽'], ['se', '効果音']]) {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const name = document.createElement('span');
    name.className = 'settings-name';
    name.textContent = label;
    row.appendChild(name);

    const dots = [];
    for (let i = 0; i < VOLUME_STEPS.length; i++) {
      const d = document.createElement('button');
      d.className = 'settings-dot';
      d.type = 'button';
      d.title = VOLUME_LABELS[i];
      d.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        hooks.set(ch, i);
        paint();
      });
      row.appendChild(d);
      dots.push(d);
    }

    const val = document.createElement('span');
    val.className = 'settings-value';
    row.appendChild(val);

    box.appendChild(row);
    rows[ch] = { dots, val };
  }

  function paint() {
    const v = hooks.get();
    for (const ch of ['bgm', 'se']) {
      const n = v[ch];
      rows[ch].dots.forEach((d, i) => d.classList.toggle('on', i <= n && n > 0));
      rows[ch].val.textContent = VOLUME_LABELS[n];
    }
  }

  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    wrap.classList.toggle('open');
    paint();
  });

  // 外を押したら閉じる。開いたままだと絵を隠す
  const close = () => wrap.classList.remove('open');
  root.addEventListener('pointerdown', close);
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());

  root.appendChild(wrap);
  paint();

  return { el: wrap, paint, close };
}
