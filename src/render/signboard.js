/**
 * 看板の文字（設計書 §6）
 *
 * ★看板の文字を AI 生成画像に含めることは禁止。
 * AI画像生成は日本語の文字をまともに描けない（崩れた漢字、存在しない字形）。
 * しかも生成し直すたびに変わる。文字は必ずここで描く。
 *
 * 板のテクスチャ（AI生成）に文字を合成して1枚の面にする。
 * 別の板を重ねる方式は z-fighting を起こし、ライティングも二重になるので採らない。
 */

import * as THREE from 'three';

const FONT = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif';

/** 縦書きで90度回転させる字。約物と長音 */
const ROTATE = new Set('ー〜～―─‐-−（）()「」『』〔〕【】〈〉《》…‥：；');
/** 縦書きで右上に寄せる字 */
const TOP_RIGHT = new Set('、。，．');
/** 小書きの字。わずかに右上へ */
const SMALL = new Set('ぁぃぅぇぉゃゅょっァィゥェォャュョッ');

/**
 * 板のテクスチャに縦書きの文字を合成して、新しいテクスチャを返す。
 *
 * @param {HTMLCanvasElement|ImageBitmap} plank 板の元画像
 * @param {string[]} lines 右の列から順に並べる
 */
export function composeSign(plank, lines, opt = {}) {
  const w = plank.width;
  const h = plank.height;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  // findPanel が読み出すので willReadFrequently を立てる
  const c = cv.getContext('2d', { willReadFrequently: true });

  c.clearRect(0, 0, w, h);
  c.drawImage(plank, 0, 0, w, h);

  if (lines && lines.length) {
    drawVertical(c, lines, findPanel(c, w, h), opt);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.aspect = w / h;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 板の「書ける面」を絵から見つける。
 *
 * ★固定の割合（画像の 16%〜84% など）で決め打ちしてはいけない。
 * 板の絵は AI 生成で、吊り鎖・彫りの枠・支柱まで一緒に描かれてくる。
 * 決め打ちの枠は鎖の上や枠の外に文字を置いてしまう（実際にそうなっていた）。
 *
 * この絵柄では、書字面は「まわりの枠より明るい無地の矩形」で必ずある。
 * 明るい画素の行・列の連続を探せば、絵が変わっても追従する。
 * 見つからなければ（枠のない板・暗い板）画像全体から少し内側を返す。
 */
function findPanel(c, w, h) {
  const fallback = { x: w * 0.10, y: h * 0.12, w: w * 0.80, h: h * 0.76 };
  // 走査は縮小して行う。板の絵は 1000px 級なので全画素見る必要がない
  const N = 96;
  const sx = Math.max(1, Math.floor(w / N));
  const sy = Math.max(1, Math.floor(h / N));
  const cols = Math.floor(w / sx);
  const rows = Math.floor(h / sy);
  if (cols < 8 || rows < 8) return fallback;

  const p = c.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(cols * rows);
  let lo = 255;
  let hi = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = ((j * sy + (sy >> 1)) * w + i * sx + (sx >> 1)) * 4;
      // 透明な部分（抜いた外側）は暗いものとして扱う
      const v = p[k + 3] < 128 ? 0
        : 0.299 * p[k] + 0.587 * p[k + 1] + 0.114 * p[k + 2];
      lum[j * cols + i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (hi - lo < 24) return fallback;   // 明暗がない＝枠を見分けられない

  // 一番明るい側の 15% を「無地の面」とみなす
  const th = hi - (hi - lo) * 0.15;

  /**
   * 「半分以上が明るい」区間のうち最長を返す。
   *
   * ★数える範囲（from..to）を必ず渡す。
   * 以前は常に反対側の**全長**に対して半分を数えていた。書字面が板の半分ほどの
   * 高さしかないと、面の中の列でも「明るい行 24 / 全 48 行」でちょうど境目に乗り、
   * 通るか落ちるかが画素のゆらぎで決まっていた。実際に 807x831 の板で
   * 252x338（板の 31%）しか拾えず、文字が本来の 4割の大きさで、
   * しかも面の右下に寄って描かれていた。
   *
   * 面の高さの中で数えれば判定が意味を持つ。行→列→行と絞り込めば収束する。
   */
  const run = (n, from, to, at) => {
    const m = to - from + 1;
    if (m <= 0) return null;
    let best = null;
    let cur = null;
    for (let a = 0; a < n; a++) {
      let bright = 0;
      for (let b = from; b <= to; b++) if (at(a, b) >= th) bright++;
      if (bright * 2 >= m) {
        cur = cur ?? { a, b: a };
        cur.b = a;
      } else {
        if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur;
        cur = null;
      }
    }
    if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur;
    return best;
  };

  const byRow = (j, i) => lum[j * cols + i];
  const byCol = (i, j) => lum[j * cols + i];

  // 1回目は板の全幅で行を拾う（面は板に対して十分横に広いので、これは当たる）
  let vr = run(rows, 0, cols - 1, byRow);
  if (!vr) return fallback;
  // 2回目はその行の中だけで列を拾う。ここで初めて割合が意味を持つ
  const hr = run(cols, vr.a, vr.b, byCol);
  if (!hr) return fallback;
  // 3回目は絞った列で行を取り直す（枠の彫りに引っぱられた分を戻す）
  vr = run(rows, hr.a, hr.b, byRow) ?? vr;

  // 小さすぎる当たりは誤検出。板の 3割に届かないものは使わない
  if ((vr.b - vr.a) < rows * 0.3 || (hr.b - hr.a) < cols * 0.3) return fallback;

  // 見つけた面から少しだけ内側に入る。縁の際に字を置くと窮屈に見える
  const pad = 0.05;
  const y0 = vr.a * sy;
  const y1 = (vr.b + 1) * sy;
  const x0 = hr.a * sx;
  const x1 = (hr.b + 1) * sx;
  return {
    x: x0 + (x1 - x0) * pad,
    y: y0 + (y1 - y0) * pad,
    w: (x1 - x0) * (1 - pad * 2),
    h: (y1 - y0) * (1 - pad * 2),
  };
}

/** 列の送り。字の大きさに対する倍率 */
const LEAD = 1.30;

/**
 * 文面を、面の形に合わせて列へ折り返す。
 *
 * ★1文の1列を固定にすると、面の形と文面の長さが噛み合わない。
 * 15字2列の文面を横長の板に置くと、字は高さで決まる小ささのまま
 * 板の中央に細く浮く（実際にそう見えていた）。
 * 折り返す位置を変えれば、どんな形の面でも字を最大にできる。
 *
 * @returns {{cols: string[], len: number, size: number}}
 */
function layout(lines, box) {
  const longest = Math.max(...lines.map((l) => [...l].length));
  let best = null;

  for (let len = 2; len <= longest; len++) {
    const cols = [];
    for (const line of lines) cols.push(...wrap(line, len));
    // 実際に使う列数と、実際に一番長い列で大きさを決める
    const tall = Math.max(...cols.map((x) => [...x].length));
    const size = Math.min(box.w / (cols.length * LEAD), box.h / (tall + 0.3));
    if (!best || size > best.size) best = { cols, len: tall, size };
  }
  return best;
}

/** 1文を len 字ずつの列に割る。句読点は前の列に残す（行頭禁則） */
function wrap(line, len) {
  const ch = [...line];
  const out = [];
  let i = 0;
  while (i < ch.length) {
    let n = Math.min(len, ch.length - i);
    while (i + n < ch.length && TOP_RIGHT.has(ch[i + n])) n++;
    out.push(ch.slice(i, i + n).join(''));
    i += n;
  }
  return out.length ? out : [''];
}

/**
 * 縦書き。Canvas 2D に縦書き API はないので1文字ずつ配置する。
 * 列は右から左へ、字は上から下へ。
 */
function drawVertical(c, lines, box, opt) {
  const plan = layout(lines, box);
  const cols = plan.cols.length;
  const maxChars = plan.len;
  const size = Math.floor(plan.size);
  lines = plan.cols;
  if (size < 4) return;

  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = opt.color ?? '#2a1d12';

  const step = size * LEAD;
  // 組んだ全体を面の中央に置く
  const right = box.x + box.w / 2 + (cols * step) / 2;
  const top = box.y + (box.h - size * (maxChars + 0.3)) / 2;

  lines.forEach((line, ci) => {
    // 右の列から順に
    const cx = right - step * (ci + 0.5);
    [...line].forEach((ch, i) => {
      const cy = top + size * (i + 0.65);
      glyph(c, ch, cx, cy, size);
    });
  });
}

function glyph(c, ch, cx, cy, size) {
  if (ROTATE.has(ch)) {
    c.save();
    c.translate(cx, cy);
    c.rotate(Math.PI / 2);
    c.fillText(ch, 0, 0);
    c.restore();
    return;
  }
  if (TOP_RIGHT.has(ch)) {
    c.fillText(ch, cx + size * 0.30, cy - size * 0.30);
    return;
  }
  if (SMALL.has(ch)) {
    c.fillText(ch, cx + size * 0.06, cy - size * 0.06);
    return;
  }
  c.fillText(ch, cx, cy);
}
