#!/usr/bin/env node
/**
 * 投入したアセットを検査する。
 *
 *   node scripts/check-assets.mjs
 *
 * 見るもの:
 *   - 置き場所が正しいか（抜き板を textures/ に置くとマゼンタが残る）
 *   - 縦横比が板と合っているか（合っていないと絵が伸びる）
 *   - 抜き板にマゼンタ背景があるか／面に無いか
 *   - 床が正方形で、継ぎ目がつながるか
 *   - 容量
 *
 * PNG は zlib だけで読む（外部依存なし）。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { ASSETS, RECIPES, pixelsFor } from '../src/data/assets.js';
// ★実行時のクロマキーと同じ判定を使う。別々に持つと必ず食い違う
import { isKeyed } from '../src/render/keyRule.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'demo8-check-'));

/** 中身が PNG かどうか。拡張子は信じない */
function isPng(buf) {
  return buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
}

/** PNG 以外は sips で PNG に変換してから読む（macOS 前提） */
function readAsPng(file) {
  const buf = fs.readFileSync(file);
  if (isPng(buf)) return { buf, converted: null };
  const out = path.join(TMP, path.basename(file).replace(/\.[^.]+$/, '') + '-' + Math.random().toString(36).slice(2) + '.png');
  execFileSync('sips', ['-s', 'format', 'png', file, '--out', out], { stdio: 'ignore' });
  return { buf: fs.readFileSync(out), converted: detectFormat(buf) };
}

function detectFormat(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'JPEG';
  if (buf.length > 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'WebP';
  if (buf.length > 2 && buf.toString('ascii', 0, 2) === 'BM') return 'BMP';
  return '不明な形式';
}

// ------------------------------------------------------------ PNG を読む

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG ではない');
  let off = 8;
  let ihdr = null;
  const idat = [];
  let plte = null;
  let trns = null;

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], interlace: data[12],
      };
    } else if (type === 'PLTE') plte = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('IHDR がない');
  if (ihdr.interlace) throw new Error('インターレースPNGは未対応');
  if (ihdr.depth !== 8) throw new Error(`ビット深度 ${ihdr.depth} は未対応（8のみ）`);

  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (!CH) throw new Error(`カラータイプ ${ihdr.color} は未対応`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * CH;
  const px = Buffer.alloc(ihdr.h * stride);

  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? cur[i - CH] : 0;
      const b = prev ? prev[i] : 0;
      const c = (prev && i >= CH) ? prev[i - CH] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 0xff;
    }
  }

  const at = (x, y) => {
    const i = y * stride + x * CH;
    if (ihdr.color === 3) {
      const idx = px[i];
      const al = trns && idx < trns.length ? trns[idx] : 255;
      return [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2], al];
    }
    if (ihdr.color === 0) return [px[i], px[i], px[i], 255];
    if (ihdr.color === 4) return [px[i], px[i], px[i], px[i + 1]];
    if (ihdr.color === 2) return [px[i], px[i + 1], px[i + 2], 255];
    return [px[i], px[i + 1], px[i + 2], px[i + 3]];
  };

  return { ...ihdr, channels: CH, hasAlpha: ihdr.color === 4 || ihdr.color === 6 || !!trns, at };
}

// ------------------------------------------------------------ 判定

function analyse(img) {
  const step = Math.max(1, Math.floor(Math.min(img.w, img.h) / 240));
  let n = 0, mag = 0, clear = 0;
  for (let y = 0; y < img.h; y += step) {
    for (let x = 0; x < img.w; x += step) {
      const [r, g, b, a] = img.at(x, y);
      n++;
      if (a < 16) clear++;
      else if (isKeyed(r, g, b)) mag++;
    }
  }
  return { magenta: mag / n, clear: clear / n };
}

/** 継ぎ目がつながるか。左右と上下の端の差を測る */
function seamError(img) {
  let d = 0, n = 0;
  const stepY = Math.max(1, Math.floor(img.h / 200));
  for (let y = 0; y < img.h; y += stepY) {
    const L = img.at(0, y), R = img.at(img.w - 1, y);
    d += Math.abs(L[0] - R[0]) + Math.abs(L[1] - R[1]) + Math.abs(L[2] - R[2]);
    n += 3;
  }
  const stepX = Math.max(1, Math.floor(img.w / 200));
  for (let x = 0; x < img.w; x += stepX) {
    const T = img.at(x, 0), B = img.at(x, img.h - 1);
    d += Math.abs(T[0] - B[0]) + Math.abs(T[1] - B[1]) + Math.abs(T[2] - B[2]);
    n += 3;
  }
  return d / n;   // 0 に近いほどつながる
}

// ------------------------------------------------------------ 単発の検査

/**
 * 引数でファイルを渡すと、そのファイルだけ調べる。
 *   node scripts/check-assets.mjs assets/raw/common/floor_tile.png.png
 * 置き場所や命名を確かめたいときに使う。
 */
if (process.argv.length > 2) {
  for (const f of process.argv.slice(2)) {
    if (!fs.existsSync(f)) { console.log(`${f}: ない`); continue; }
    const bytes = fs.statSync(f).size;
    let img, conv = null;
    try {
      const got = readAsPng(f);
      conv = got.converted;
      img = decodePng(got.buf);
    } catch (e) { console.log(`${f}: 読めない（${e.message}）`); continue; }
    const st = analyse(img);
    const se = seamError(img);
    const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    const corners = [
      img.at(2, 2), img.at(img.w - 3, 2),
      img.at(2, img.h - 3), img.at(img.w - 3, img.h - 3),
    ];
    // 一番多い色（粗く量子化して数える）
    const bins = new Map();
    const step2 = Math.max(1, Math.floor(Math.min(img.w, img.h) / 160));
    for (let y = 0; y < img.h; y += step2) {
      for (let x = 0; x < img.w; x += step2) {
        const [r, g, b, a] = img.at(x, y);
        if (a < 16) continue;
        const k = `${r >> 5},${g >> 5},${b >> 5}`;
        bins.set(k, (bins.get(k) || 0) + 1);
      }
    }
    const total = [...bins.values()].reduce((n, v) => n + v, 0) || 1;
    const top = [...bins].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, v]) => {
        const [r, g, b] = k.split(',').map((n) => (+n << 5) + 16);
        return `${hex([r, g, b])} ${(v / total * 100).toFixed(0)}%`;
      });
    console.log(
      `${f}\n` +
      `  ${img.w}x${img.h}  比 ${(img.w / img.h).toFixed(2)}  ${Math.round(bytes / 1024)}KB` +
      `  ${conv ? '中身 ' + conv : '中身 PNG'}  アルファ ${img.hasAlpha ? 'あり' : 'なし'}\n` +
      `  マゼンタ ${(st.magenta * 100).toFixed(0)}%  透明 ${(st.clear * 100).toFixed(0)}%  端の差 ${se.toFixed(0)}\n` +
      `  四隅 ${corners.map(hex).join(' ')}\n` +
      `  多い色 ${top.join('  /  ')}`
    );
  }
  process.exit(0);
}

// ------------------------------------------------------------ 実行

const problems = [];
const notes = [];
const rows = [];

for (const a of ASSETS) {
  const r = RECIPES[a.r];
  const tex = `assets/textures/${a.p}`;
  const raw = `assets/raw/${a.p}`;
  const where = fs.existsSync(tex) ? 'textures' : fs.existsSync(raw) ? 'raw' : null;
  if (!where) continue;

  /**
   * ★両方に置いてあると textures/ が勝つ。
   * raw/ に新しい絵を置いても、textures/ に古い絵が残っていれば使われない。
   * 実際にこれで「差し替えたのに変わらない」が起きた。
   */
  if (fs.existsSync(tex) && fs.existsSync(raw)) {
    const tm = fs.statSync(tex).mtimeMs;
    const rm = fs.statSync(raw).mtimeMs;
    problems.push(
      `${a.p}: textures/ と raw/ の両方にある。**textures/ が使われる**` +
      (rm > tm ? '（raw/ の方が新しいのに無視されている）' : '') +
      ' → どちらか一方にする'
    );
  }

  const file = where === 'textures' ? tex : raw;
  const bytes = fs.statSync(file).size;
  let img, converted = null;
  try {
    const got = readAsPng(file);
    converted = got.converted;
    img = decodePng(got.buf);
  } catch (e) {
    problems.push(`${a.p}: 読めない（${e.message}）`);
    continue;
  }

  // ★拡張子が .png でも中身が別形式なことがある。
  // 面はそれでよい（透明が要らないので JPEG の方が軽い。読み込みは中身で判別される）。
  // 抜き板だけは駄目。JPEG には透明が無く、マゼンタの縁に色が滲む
  if (converted && r.cut) {
    problems.push(
      `${a.p}: 中身が ${converted}（拡張子は .png） → 抜き板は透明が要る。PNG で作り直す`
    );
  }

  const st = analyse(img);
  const gotAr = img.w / img.h;
  const wantAr = a.ar ? a.ar[0] / a.ar[1] : null;
  const arOff = wantAr ? Math.abs(gotAr - wantAr) / wantAr : 0;

  rows.push({
    p: a.p, r: a.r, where, w: img.w, h: img.h, kb: Math.round(bytes / 1024),
    ar: gotAr, want: wantAr, mag: st.magenta, clear: st.clear,
    seam: a.r === 'floor' ? seamError(img) : null,
  });

  // --- 置き場所とマゼンタ ---
  if (r.cut) {
    if (where === 'textures' && st.magenta > 0.02) {
      problems.push(`${a.p}: マゼンタが残ったまま textures/ にある → raw/ へ移す（ローダーが実行時に抜く）`);
    } else if (where === 'textures' && st.clear < 0.02) {
      problems.push(`${a.p}: textures/ にあるが透明部分がない → 背景が抜けていない。raw/ へ移すか、抜いてから置く`);
    } else if (where === 'raw' && st.magenta < 0.02) {
      problems.push(`${a.p}: raw/ にあるがマゼンタ背景がない → 抜けない。マゼンタ背景で作り直す`);
    }
  } else if (st.magenta > 0.02) {
    problems.push(`${a.p}: 面（${r.label}）なのにマゼンタが入っている → 背景なしで作り直す`);
  }

  /**
   * 縦横比。
   * ★抜き板は、クロマキーが不透明部分まで切り詰めてから
   * 絵の比に合わせて板を作るので、比が違っても伸びない。
   * ただし余白が無駄なピクセルになるので、目安として知らせる。
   * 面は板いっぱいに貼るので、比が違うと本当に伸びる。
   */
  if (wantAr && arOff > 0.12) {
    const msg = `${a.p}: 縦横比が目安と違う（実物 ${img.w}x${img.h} = ${gotAr.toFixed(2)} / 目安 ${a.ar[0]}:${a.ar[1]} = ${wantAr.toFixed(2)}）`;
    /**
     * ★縦横比は板の側で吸収する。
     *   抜き板 … 不透明部分に切り詰めてから、絵の比で板を作る
     *   壁     … はみ出す方を切り落として中央を使う（cover）
     *   床     … 繰り返し数で打ち消す
     * どれも伸びないので、比のずれは「無駄」の指摘に留める。
     */
    notes.push(`${msg} → 伸びはしないが余白や切り落としが出る`);
  }

  /**
   * 床の継ぎ目。
   * ★縦横比は makeFloor が繰り返し数で打ち消すので、正方形でなくても伸びない。
   * ただし継ぎ目のつながりはコードでは直せない。
   */
  if (a.r === 'floor') {
    if (Math.abs(gotAr - 1) > 0.05) {
      notes.push(`${a.p}: 正方形でない（${img.w}x${img.h}）→ 伸びはしないが、正方形の方が無駄がない`);
    }
    const se = seamError(img);
    if (a.mirror) {
      // 鏡張りは継ぎ目が必ず一致するので、端の差は問題にならない
      notes.push(`${a.p}: 鏡張りで敷くので継ぎ目は見ない（端の差 ${se.toFixed(0)}）`);
    } else if (se > 40) {
      problems.push(`${a.p}: 継ぎ目がつながらない（端の差 ${se.toFixed(0)}）→ タイルの目地が見える。コードでは直せない`);
    } else if (se > 24) {
      // ★この数字だけでは見えるかどうか決まらない。
      // 板幅が不規則な絵だと、端の差 30 でも継ぎ目は判別できなかった（実機で確認）。
      // 逆に市松のような規則的な絵は小さい差でも一目で分かる。
      notes.push(
        `${a.p}: 端の差 ${se.toFixed(0)}。絵柄が不規則なら見えない（実機で確かめる）`
      );
    }
  }

  // --- 抜き板は対象が孤立しているか ---
  if (r.cut && st.magenta > 0.02 && st.magenta < 0.35) {
    notes.push(
      `${a.p}: マゼンタが ${(st.magenta * 100).toFixed(0)}% しかない → 対象が孤立しておらず、背景が板に写り込む`
    );
  }

  // --- 解像度と容量 ---
  //
  // ★「重い」の原因を取り違えないこと。ここを間違えて
  //   「目標どおりの絵に縮小しろ」と言ってしまった（実際には縮まない）。
  //   分けて考える。
  //     ピクセルが目標より大きい → 縮小で直る
  //     ピクセルは目標どおりで重い
  //       面     → 原因は PNG。JPEG にすれば 1/4 になる
  //       抜き板 → PNG が必要（マゼンタの縁が滲むと輪郭が残る）。これ以上は減らない
  //
  // 判定は長辺で見る。軸ごとに比べると、縦横が入れ替わった絵を「大きい」と
  // 誤判定する（縮めても直らない。比率のずれは別に報告している）。
  const [wantW, wantH] = pixelsFor(a);
  const kb = Math.round(bytes / 1024);
  const wantLong = Math.max(wantW, wantH);
  const gotLong = Math.max(img.w, img.h);

  if (gotLong > wantLong * 1.1) {
    problems.push(
      `${a.p}: ${img.w}x${img.h} は目標 ${wantW}x${wantH} より大きい（${kb}KB）`
      + ' → npm run fit:assets で縮む'
    );
  } else if (!r.cut && bytes > 900 * 1024) {
    problems.push(
      `${a.p}: ${kb}KB。ピクセルは目標どおりで、原因は PNG で保存されていること。`
      + 'JPEG にすれば約1/4 → npm run fit:assets'
    );
  } else if (r.cut && bytes > 1400 * 1024) {
    // 抜き板は PNG のままにするしかない。手の打ちようが無いので「不備」ではない
    notes.push(
      `${a.p}: ${kb}KB。ピクセルも形式も正しい。`
      + '抜き板は PNG が必要なのでこれ以上は減らない（水彩の粒子は圧縮できない）'
    );
  }
}

// ------------------------------------------------------------ 迷子のファイル

/**
 * 一覧に無いファイルを拾う。
 * 置き場所の間違いや命名ミス（floor_tile.png.png など）はここで見つかる。
 */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (!e.name.startsWith('.')) out.push(f);
  }
  return out;
}

const listed = new Set();
for (const a of ASSETS) {
  listed.add(`assets/textures/${a.p}`);
  listed.add(`assets/raw/${a.p}`);
}
const orphans = [...walk('assets/textures'), ...walk('assets/raw')]
  .filter((f) => !listed.has(f));

for (const f of orphans) {
  notes.push(`${f}: 一覧に無いので読み込まれない → 名前か置き場所を確かめる`);
}

// ------------------------------------------------------------ 出力

console.log(`検査した画像: ${rows.length} / ${ASSETS.length} 枚\n`);
console.log('置き場所  レシピ      寸法        比    必要比  マゼンタ 透明  容量   ファイル');
console.log('-'.repeat(106));
for (const x of rows) {
  console.log(
    x.where.padEnd(9) +
    x.r.padEnd(11) +
    `${x.w}x${x.h}`.padEnd(12) +
    x.ar.toFixed(2).padEnd(6) +
    (x.want ? x.want.toFixed(2) : '  - ').padEnd(8) +
    `${(x.mag * 100).toFixed(0)}%`.padEnd(8) +
    `${(x.clear * 100).toFixed(0)}%`.padEnd(6) +
    `${x.kb}KB`.padEnd(7) +
    x.p
  );
}

console.log('');
if (!problems.length) {
  console.log('直すべき不備: なし');
} else {
  console.log(`直すべき不備 ${problems.length}件`);
  console.log('');
  for (const p of problems) console.log('  ✗ ' + p);
}
if (notes.length) {
  console.log('');
  console.log(`直さなくても動くもの ${notes.length}件`);
  console.log('');
  for (const p of notes) console.log('  △ ' + p);
}
