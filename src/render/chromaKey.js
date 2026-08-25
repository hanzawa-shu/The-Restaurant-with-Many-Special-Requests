/**
 * テクスチャの読み込み（設計書 §5）
 *
 * AI画像生成は透過PNGを安定して出せない（そもそも JPEG で出てくることもある）ため、
 * マゼンタ(#FF00FF)背景で生成し、実行時に抜く。ビルド工程がないので前処理は行わない。
 *
 * 3段フォールバック:
 *   1. assets/textures/<path>  手作業で作った透過PNG。そのまま使う
 *   2. assets/raw/<path>       生成そのまま。抜き板はマゼンタを抜いて使う
 *   3. 仮テクスチャ            まだ生成していないもの。ファイル名を描いて示す
 *
 * ★抜き板は、抜いたあとに「対象が写っている範囲」まで切り詰める。
 * そうすれば絵の縦横比も余白も自動で分かるので、
 * 生成側が縦横比を厳密に合わせる必要がなくなる。
 */

import * as THREE from 'three';
import { makePlaceholder } from './placeholder.js';
// ★判定は keyRule.js に一本化。検査スクリプトと同じ式でなければならない
import { magentaness, KEY_HI, KEY_LO } from './keyRule.js';

/** 面（床・壁・背景・一枚絵）はマゼンタを抜かない。板いっぱいに貼るため */
const SURFACE = new Set(['floor', 'wall', 'backdrop', 'scene']);

const cache = new Map();
const missing = new Set();

/** まだ存在しないアセットの一覧。制作の進捗確認に使う */
export function missingAssets() {
  return [...missing].sort();
}

/**
 * @param {string} path  例 'characters/player/stage0.png'
 * @param {'floor'|'wall'|'backdrop'|'scene'|'prop'|'sign'|'actor'|'dog'|'eyes'|'face'} kind
 */
export async function loadTexture(path, kind = 'prop', opt = {}) {
  const ck = `${path}|${kind}`;
  if (cache.has(ck)) return cache.get(ck);

  const p = (async () => {
    // 1. 透過済みを優先
    const ready = await fetchBitmap(`assets/textures/${path}`);
    if (ready) return toTexture(SURFACE.has(kind) ? ready : trim(ready), opt);

    // 2. 生成そのまま。抜き板だけマゼンタを抜く
    const raw = await fetchBitmap(`assets/raw/${path}`);
    if (raw) return toTexture(SURFACE.has(kind) ? raw : trim(keyOut(raw)), opt);

    // 3. 仮テクスチャ
    missing.add(path);
    return toTexture(makePlaceholder(path, kind), opt);
  })();

  cache.set(ck, p);
  return p;
}

/**
 * DOM に直接置ける canvas を返す（相方の肖像など）。
 * テクスチャと同じ3段フォールバックを通る。
 */
export async function loadCanvas(path, kind = 'prop') {
  const src = await (async () => {
    const ready = await fetchBitmap(`assets/textures/${path}`);
    if (ready) return SURFACE.has(kind) ? ready : trim(ready);
    const raw = await fetchBitmap(`assets/raw/${path}`);
    if (raw) return SURFACE.has(kind) ? raw : trim(keyOut(raw));
    missing.add(path);
    return makePlaceholder(path, kind);
  })();

  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  cv.getContext('2d').drawImage(src, 0, 0);
  return cv;
}

/** fetch で確認するので、404 がコンソールにエラーとして出ない */
async function fetchBitmap(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    // 拡張子が .png でも中身は JPEG のことがある。createImageBitmap は中身で判断する
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function toCanvas(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(src, 0, 0);
  return cv;
}

/**
 * マゼンタ背景を抜く。
 * 二段の閾値で、縁は半透明にしつつ紫の滲みも中和する。
 */
function keyOut(src) {
  const cv = toCanvas(src);
  const c = cv.getContext('2d', { willReadFrequently: true });
  const data = c.getImageData(0, 0, cv.width, cv.height);
  const p = data.data;

  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const m = magentaness(r, g, b);
    if (m >= KEY_HI) {
      p[i + 3] = 0;
    } else if (m > KEY_LO) {
      const t = (m - KEY_LO) / (KEY_HI - KEY_LO);
      p[i + 3] = Math.round(p[i + 3] * (1 - t));
      // 縁に残る紫を、欠けている緑の水準へ寄せて中和する
      p[i]     = Math.round(r + (g - r) * t);
      p[i + 2] = Math.round(b + (g - b) * t);
    }
  }
  c.putImageData(data, 0, 0);
  return cv;
}

/**
 * 不透明な部分だけに切り詰める。
 *
 * ★これがあるおかげで、生成側が縦横比や余白を合わせる必要がなくなる。
 * 16:9 の絵の中に縦長の対象が描かれていても、対象の範囲だけを切り出すので
 * 板に貼ったときに伸びない。
 */
function trim(src) {
  const cv = src instanceof HTMLCanvasElement ? src : toCanvas(src);
  const c = cv.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = cv;
  const p = c.getImageData(0, 0, w, h).data;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (p[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // 全面が透明、または切り詰める余地がない
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === w - 1 && maxY === h - 1)) return cv;

  const pad = 2;   // 縁を1〜2px残すと羽が切れない
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - x0;
  const ch = Math.min(h, maxY + pad + 1) - y0;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}

function toTexture(source, opt) {
  /**
   * ★ImageBitmap をそのまま渡してはいけない。
   *
   * three は ImageBitmap に対して flipY を適用できない（GPU へ上げる際の
   * UNPACK_FLIP_Y_WEBGL が効かないため）。既定の flipY=true を信じて渡すと、
   * 貼った絵が上下逆さまになる。
   *
   * 抜き板は keyOut()/trim() が canvas を返すので無事だったが、
   * 面（床・壁・背景・一枚絵）は生の ImageBitmap を渡していたため、
   * **山道の背景と結末の一枚絵が上下反転して表示されていた**（家が逆さに立つ）。
   * canvas を経由すれば flipY が正しく効く。
   */
  const src = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
    ? toCanvas(source)
    : source;
  const tex = new THREE.CanvasTexture(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  // 板の縦横比を決めるのに使う（billboard.js が読む）
  tex.userData.aspect = src.width / src.height;
  if (opt.repeat) {
    // 実際の繰り返し数は makeFloor が絵の比を見て決める
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}
