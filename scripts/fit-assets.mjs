#!/usr/bin/env node
/**
 * 生成された画像を、配れる大きさに揃える。
 *
 *   node scripts/fit-assets.mjs          … 何をするかだけ出す（既定。書き換えない）
 *   node scripts/fit-assets.mjs --apply  … 実際に書き換える
 *
 * ★これが要る理由。
 * プロンプトには「1024x1024, JPEG」と書いてあるが、画像生成ツールは
 * 自分の都合で形式と解像度を決めてしまう（2912x1440 の PNG が出てくる）。
 * プロンプトを直しても従うとは限らないので、受け取ったあとで機械的に吸収する。
 *
 * 方針は種類で分かれる。
 *   面（床・壁・背景・一枚絵） … 透明が要らない → JPEG に変換して縮める
 *   抜き板（小物・キャラ・表情）… 透明が要る   → PNG のまま縮めるだけ
 *
 * 変換は不可逆なので、元のファイルは assets/_原本/ に退避してから書き換える。
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ASSETS, RECIPES, pixelsFor } from '../src/data/assets.js';

const APPLY = process.argv.includes('--apply');
const QUALITY = 88;          // 実測 2206KB → 515KB。面は画面いっぱいに出るので高めにする
const KEEP = 'assets/_原本';

/** sips で寸法と形式を読む。PNG デコーダを持ち出すまでもない */
function probe(file) {
  const out = execFileSync('sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'format', file],
    { encoding: 'utf8' });
  return {
    w: +(out.match(/pixelWidth: (\d+)/)?.[1] ?? 0),
    h: +(out.match(/pixelHeight: (\d+)/)?.[1] ?? 0),
    fmt: out.match(/format: (\w+)/)?.[1] ?? '?',
  };
}

const kb = (f) => Math.round(fs.statSync(f).size / 1024);
const plan = [];
const skipped = [];

for (const a of ASSETS) {
  const r = RECIPES[a.r];
  const file = ['assets/textures/', 'assets/raw/']
    .map((d) => d + a.p).find((f) => fs.existsSync(f));
  if (!file) continue;

  const got = probe(file);
  const [wantW, wantH] = pixelsFor(a);
  const long = Math.max(wantW, wantH);
  // ★長辺だけで見る。軸ごとに比べると、縦横が入れ替わった絵を
  //   「大きい」と誤判定してしまう（縮めても直らない。比率の問題は別で報告される）。
  //   1割の余裕を持たせるのは、512 の指定に 506 が返ることがあるため
  const oversize = Math.max(got.w, got.h) > long * 1.1;
  const wantJpeg = !r.cut;
  const isJpeg = got.fmt === 'jpeg';

  // 抜き板が JPEG で来ているのは、ここでは直せない（透明が作れない）
  if (r.cut && isJpeg) {
    skipped.push(`${a.p}: 抜き板なのに中身が JPEG → PNG で作り直すしかない`);
    continue;
  }

  const toJpeg = wantJpeg && !isJpeg;
  if (!oversize && !toJpeg) continue;

  plan.push({
    file,
    p: a.p,
    種類: r.cut ? '抜き' : '面',
    前: `${got.w}x${got.h} ${got.fmt} ${kb(file)}KB`,
    作業: [oversize ? `長辺 ${long}px に縮小` : null, toJpeg ? `JPEG q${QUALITY} に変換` : null]
      .filter(Boolean).join(' + '),
    long: oversize ? long : null,
    toJpeg,
  });
}

if (!plan.length && !skipped.length) {
  console.log('揃っている。作業なし。');
  process.exit(0);
}

console.log(APPLY ? '=== 書き換える ===' : '=== 下見（--apply で実行） ===\n');
for (const x of plan) console.log(`${x.種類}  ${x.p}\n      ${x.前}  →  ${x.作業}`);

if (!APPLY) {
  if (skipped.length) {
    console.log('\n--- ここでは直せないもの ---');
    for (const m of skipped) console.log(`  ✗ ${m}`);
  }
  console.log(`\n${plan.length}件。実行するなら npm run fit:assets -- --apply`);
  process.exit(0);
}

let saved = 0;
for (const x of plan) {
  const before = fs.statSync(x.file).size;

  // 元を退避する。JPEG 化は戻せない
  const keep = path.join(KEEP, x.p);
  fs.mkdirSync(path.dirname(keep), { recursive: true });
  if (!fs.existsSync(keep)) fs.copyFileSync(x.file, keep);

  const args = [];
  if (x.toJpeg) args.push('-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITY));
  if (x.long) args.push('-Z', String(x.long));
  // 拡張子は .png のまま。中身が JPEG でも読み込みは中身で判別される
  const tmp = `${x.file}.fit`;
  execFileSync('sips', [...args, x.file, '--out', tmp], { stdio: 'ignore' });
  fs.renameSync(tmp, x.file);

  const after = fs.statSync(x.file).size;
  saved += before - after;
  console.log(`  ${x.p}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`);
}

console.log(`\n${plan.length}件。合計 ${Math.round(saved / 1024 / 1024 * 10) / 10}MB 減った。`);
console.log(`元のファイルは ${KEEP}/ にある。`);
if (skipped.length) {
  console.log('\n--- ここでは直せないもの ---');
  for (const m of skipped) console.log(`  ✗ ${m}`);
}
