#!/usr/bin/env node
/**
 * docs/プロンプト集.md / docs/アセット一覧.md / docs/場面一覧.md を生成する。
 *
 *   node scripts/gen-prompts.mjs
 *
 * ★この2つのドキュメントは手で書かない。
 * 散文とコードを二重管理すると必ずずれる（実際にずれた）。
 * 出典は src/data/assets.js だけ。
 */

import fs from 'node:fs';
import { ASSETS, RECIPES, STYLE_BASE, promptFor, isCutout } from '../src/data/assets.js';
import { SCENE_LIST } from '../src/systems/scenes.js';
import { BGM, SE, SE_OPTIONAL, sePromptFor, bgmFor } from '../src/data/audio.js';

const ORDER = ['floor', 'wall', 'backdrop', 'sign', 'prop', 'detail', 'actor', 'face', 'animal', 'scene'];
const group = (id) => ASSETS.filter((a) => a.r === id);

// ------------------------------------------------------------------ プロンプト集

function prompts() {
  const L = [];
  L.push('# プロンプト集');
  L.push('');
  L.push('**このファイルは生成物。手で編集しない。**');
  L.push('出典は `src/data/assets.js`。変更したら `npm run gen:docs` で作り直す。');
  L.push('');
  L.push('## 使い方');
  L.push('');
  L.push('各アセットのコードブロックを**そのまま丸ごとコピーして貼る**。');
  L.push('組み立てや読み替えは要らない。判断が必要なら、それは仕様の不備なので直す。');
  L.push('');
  L.push('## 絶対の禁止事項');
  L.push('');
  L.push('### 1. 看板の文字を画像に含めない');
  L.push('');
  L.push('AI画像生成は日本語の文字をまともに描けない（崩れた漢字、存在しない字形）。');
  L.push('しかも生成し直すたびに変わる。**看板は文字のない板だけを生成し、文字は Canvas 2D で描く。**');
  L.push('');
  L.push('### 2. 影と遠近を焼き込まない');
  L.push('');
  L.push('ライティング・影・遠近は Three.js が付ける。');
  L.push('絵に影が描かれていると影が二重になり、即座に破綻する。');
  L.push('例外は「一枚絵」（結末）だけ。3D空間に置かないため。');
  L.push('');
  L.push('### 3. 原作に描写があるものは、原作の記述を優先する');
  L.push('');
  L.push('見た目を思いつきで足すと、原作と食い違う。実際に食い違っていた例:');
  L.push('');
  L.push('| 対象 | 誤り | 原作 |');
  L.push('|---|---|---|');
  L.push('| 厨房の扉 | 真鍮の鍵穴が1つ | **大きなかぎ穴が二つつき、銀いろのホークとナイフの形が切りだしてある** |');
  L.push('| 塩壺 | 素焼きの壺 | **立派な青い瀬戸の塩壺** |');
  L.push('');
  L.push('迷ったら青空文庫の原文を読む。仕様書 §7.0 に該当箇所を引いてある。');
  L.push('');
  L.push('### 4. 面にマゼンタ背景を指定しない');
  L.push('');
  L.push('床・壁・背景は板いっぱいに貼るテクスチャなので、');
  L.push('背景を抜く必要がないどころか**抜けてはいけない**。');
  L.push('ローダーもこの3種類はクロマキーを通さない（`chromaKey.js` の `SURFACE`）。');
  L.push('');
  L.push('## レシピ');
  L.push('');
  L.push('レシピが画角と技術指定の両方を決める。だから');
  L.push('`STYLE_BASE ＋ 対象 ＋ レシピ` を連結すれば、判断の余地なく完成する。');
  L.push('');
  L.push('| レシピ | 枚数 | マゼンタ背景 | 透過処理 | 保存形式 |');
  L.push('|---|---|---|---|---|');
  for (const id of ORDER) {
    const r = RECIPES[id];
    const n = group(id).length;
    if (!n) continue;
    L.push(`| \`${id}\` ${r.label} | ${n} | ${r.cut ? '**必要**' : '不要' } | ${r.cut ? '実行時に抜く' : 'そのまま使う'} | ${r.fmt} |`);
  }
  L.push('');
  L.push('## STYLE_BASE（全アセット共通・変更禁止）');
  L.push('');
  L.push('```');
  L.push(STYLE_BASE);
  L.push('```');
  L.push('');
  L.push('絵柄の一貫性はここだけで担保している。一字も変えない。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('# 全アセットの完成プロンプト');
  L.push('');
  for (const id of ORDER) {
    const list = group(id);
    if (!list.length) continue;
    const r = RECIPES[id];
    L.push(`## ${r.label}（${list.length}枚）`);
    L.push('');
    L.push(r.cut
      ? 'マゼンタ背景で生成する。ローダーが実行時に抜く。'
        + '**保存は PNG。** JPEG にするとマゼンタの縁に色が滲み、抜いたあとに輪郭が残る。'
      : '**マゼンタ背景にしない。** 板いっぱいに貼るので抜いてはいけない。'
        + '**保存は JPEG。** 透明を持つ必要がないので、PNG にすると無駄に重くなる。');
    L.push('');
    for (const a of list) {
      L.push(`### \`${a.p}\``);
      L.push('');
      L.push(`${a.use}${a.wired === false ? '（**まだコードで使っていない**）' : ''}`);
      L.push('');
      L.push('```');
      L.push(promptFor(a));
      L.push('```');
      L.push('');
    }
  }
  L.push('---');
  L.push('');
  L.push('## 生成の運用ルール');
  L.push('');
  L.push('1. 生成物は **必ず `assets/raw/` に元のまま保存する。** AI生成は同じ絵が二度と出ない');
  L.push('2. 抜き板は `raw/` に置けばローダーが実行時にマゼンタを抜く。手作業で綺麗に抜いた版は `assets/textures/` に置くと優先される');
  L.push('3. 面（床・壁・背景）はどちらに置いてもよい。クロマキーを通さない');
  L.push('4. **看板・札に文字が混入した画像は捨てて再生成する。** 文字は Canvas 2D で描く');
  L.push('5. 絵柄がズレた画像は捨てる前に、Three.js のライティングとカラーグレーディングで吸収を試す（設計書 §4.5）');
  L.push('6. **床は向きのある幾何模様を避ける。** ヘリンボーンやシェブロンは継ぎ目のずれが一目で分かり、');
  L.push('   鏡張りで逃げることもできない（反転すると V 字の折り返しが継ぎ目より目立つ）。');
  L.push('   幅の違う板を不規則に並べる、といった絵にすれば両方隠れる。');
  L.push('   `mountain/ground.png` のように**鏡張りで敷く床**は、継ぎ目を合わせる必要がまったくない。');
  L.push('7. **形式とピクセル数はツールが勝手に決めることがある。** 従わなくてよい。');
  L.push('   プロンプトの指定どおりに出なかったら、`npm run fit:assets` で下見して `-- --apply` で揃える');
  L.push('   （面は JPEG に変換して縮小、抜き板は PNG のまま縮小。元のファイルは `assets/_原本/` に退避される）。');
  L.push('   ★**「重い」の原因を取り違えないこと。** 面が 2MB を超えるのはピクセル数ではなく PNG で保存したせい。');
  L.push('   同じ 1024x1024 の絵が JPEG なら 1/4 になる（実測 2206KB → 515KB）。');
  L.push('8. **壁は床より明るく生成する。** キー光が上から来るので、同じ明度だと壁が半分の明るさになる（設計書 §4.4.1）');
  L.push('9. **「同じものの差分」は、必ず元の絵を参照して生成する。**');
  L.push('   別々に生成すると木目も位置も合わず、重ねたときに継ぎ目が見える。');
  L.push('   参照画像（img2img）や同一シードで、変える部分だけを変える。該当する組:');
  L.push('');
  const PAIRS = [
    ['rooms/06_kitchendoor/kitchen_door.png', 'rooms/06_kitchendoor/kitchen_door_eyes.png', '鍵穴から眼玉が覗いているだけの差分'],
    ['rooms/01_entrance/chandelier.png', 'rooms/01_entrance/chandelier_dark.png', '明かりが消えているだけの差分'],
    ['rooms/04_wardrobe/coat_rack.png', 'rooms/04_wardrobe/rack_toppled.png', '倒れているだけの差分'],
    ['rooms/04_wardrobe/mirror_ornate.png', 'rooms/04_wardrobe/mirror_cracked.png', '割れているだけの差分'],
    ['rooms/05_oilroom/cream_jar.png', 'rooms/05_oilroom/cream_spilled.png', 'こぼれているだけの差分'],
    ['rooms/06_kitchendoor/serving_table.png', 'rooms/06_kitchendoor/butcher_cloth.png', '染みがあるだけの差分'],
    ['characters/dog/alive.png', 'characters/dog/fallen.png', '同じ犬2匹。倒れているだけの差分'],
    ['characters/player/stage0.png', 'characters/player/stage1.png', '同じ人物。脱いだ段階だけの差分'],
  ];
  L.push('| 元 | 差分 | 変えるところ |');
  L.push('|---|---|---|');
  for (const [a, b, why] of PAIRS) L.push(`| \`${a}\` | \`${b}\` | ${why} |`);
  L.push('');
  L.push('   立ち絵は stage0 → stage1 → stage2 → stage3 と順に参照して繋ぐ。');
  L.push('   同じ人物に見えなければ、服を脱いでいく話が成立しない。');
  L.push('');
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------ アセット一覧

function list() {
  const L = [];
  const wired = ASSETS.filter((a) => a.wired !== false);
  const later = ASSETS.filter((a) => a.wired === false);

  L.push(`# アセット一覧（全${ASSETS.length}枚）`);
  L.push('');
  L.push('**このファイルは生成物。手で編集しない。**');
  L.push('出典は `src/data/assets.js`。変更したら `npm run gen:docs` で作り直す。');
  L.push('');
  L.push('ローダーは3段で探す（設計書 §5.1）。');
  L.push('');
  L.push('1. `assets/textures/<path>` — あればそのまま使う');
  L.push('2. `assets/raw/<path>` — 抜き板ならマゼンタを抜いて使う');
  L.push('3. 仮テクスチャ — まだ無いもの。ファイル名を描いて示す');
  L.push('');
  L.push('**つまり `raw/` に置いた時点で動く。** 未生成の枚数は画面左上に出る。');
  L.push('');
  L.push(`| 分類 | 枚数 |`);
  L.push('|---|---|');
  for (const id of ORDER) {
    const n = group(id).length;
    if (n) L.push(`| ${RECIPES[id].label} | ${n} |`);
  }
  L.push(`| **合計** | **${ASSETS.length}** |`);
  L.push('');
  L.push(later.length
    ? `うち ${wired.length}枚が現在のコードで使われており、${later.length}枚は後の工程で使う。`
    : `**全${wired.length}枚が場面に配線済み。** 生成して \`assets/raw/\` に置けば、そのまま画面に出る。`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('## いま使われているもの');
  L.push('');
  L.push('| 済 | ファイル | レシピ | 用途 |');
  L.push('|---|---|---|---|');
  for (const a of wired) {
    L.push(`| ☐ | \`${a.p}\` | ${RECIPES[a.r].label} | ${a.use} |`);
  }
  L.push('');
  if (later.length) {
    L.push('## 後の工程で使うもの');
    L.push('');
    L.push('| 済 | ファイル | レシピ | 用途 |');
    L.push('|---|---|---|---|');
    for (const a of later) {
      L.push(`| ☐ | \`${a.p}\` | ${RECIPES[a.r].label} | ${a.use} |`);
    }
    L.push('');
  } else {
    L.push('**全アセットが場面に配線済み。** 生成した絵は置いた瞬間に画面に出る。');
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('## 生成の優先順位');
  L.push('');
  L.push('**絵がなくても遊べる状態は既にできている。** 以下の順で入れると、早い段階で見た目の方向性を判定できる。');
  L.push('');
  L.push('1. **面の5枚**（`common/floor_*`, `common/wall_*`, `mountain/ground`）— これだけで部屋が成立するか分かる');
  L.push('2. **`characters/player/stage0.png` と `partner/stage0.png`** — 接地とスケールの検証。**ここでチープさの有無が決まる**');
  L.push('3. **`rooms/06_kitchendoor/kitchen_door.png` と `keyhole_eyes_door.png` / `keyhole_eyes_eyes.png`** — 最重要カットを先に検証する');
  L.push('4. **`common/signboard_blank.png`** — 板と Canvas の文字の重なりを検証（全6室で共有）');
  L.push('5. 残りの家具・小物');
  L.push('6. 復路の差分');
  L.push('7. 立ち絵の残り段階');
  L.push('8. 山道・犬');
  L.push('9. 表情差分・猟師・結末の一枚絵');
  L.push('');
  L.push('> **2 と 3 を早期に確認することが最も重要。** キャラが浮いて見えるか、鍵穴のカットが機能するか。');
  L.push('> この2点が駄目なら、残りを生成しても意味がない。');
  L.push('');
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------ 場面一覧

function scenes() {
  const L = [];
  L.push('# 場面一覧（テスト・不具合報告用）');
  L.push('');
  L.push('不具合を報告するときは **`S12`** のような番号か **`[O3b]`** のようなコードで指定してください。');
  L.push('番号は画面右上に常に出ています（クリックすると調整用の詳細が開きます）。');
  L.push('');
  L.push('定義は `src/systems/scenes.js`。**並び順は物語順に固定**しており、');
  L.push('番号は配列の位置から決まるため、途中に挿入すると以降がずれます。');
  L.push('');
  L.push('到達しうる場面がすべて登録されていることは `test/reachability.test.mjs` が検証しています');
  L.push('（総当たり探索で未登録の場面が1つでもあれば失敗します）。');
  L.push('');
  L.push('> このファイルは生成物です。`npm run gen:docs` で作り直します。手で書かないこと。');
  L.push('');
  L.push('| 番号 | コード | 場面 |');
  L.push('|---|---|---|');
  SCENE_LIST.forEach(({ no, code, name }) => {
    L.push(`| S${String(no).padStart(2, '0')} | ${code} | ${name} |`);
  });
  L.push('');
  return L.join('\n');
}


// ------------------------------------------------------------------ 音源集

function audio() {
  const L = [];
  L.push('# 音源集');
  L.push('');
  L.push('**このファイルは生成物。手で編集しない。**');
  L.push('出典は `src/data/audio.js`。変更したら `npm run gen:docs` で作り直す。');
  L.push('');
  L.push('## 方針');
  L.push('');
  L.push('1. **曲は増やさず、使い回して意味を変える。**');
  L.push('   同じサロンワルツが、往路では「上等な料理店の音楽」に、');
  L.push('   調理の結末では「客のために鳴り続けている音楽」に聞こえる。');
  L.push('   曲を足すより、同じ曲が別の意味になるほうが効く。');
  L.push('2. **効果音は「その音がないと何が起きたか分からない」ものだけ。**');
  L.push('   足すほど画面は賑やかになるが、そのぶん静けさが減る。');
  L.push('   本作は止まった絵と文章で見せているので、静けさは資産である。');
  L.push('3. **鳴らす判断は `src/data/audio.js` の純粋関数に置く。**');
  L.push('   どの場面で何が鳴るかはテストで検証する。');
  L.push('');

  L.push('## BGM');
  L.push('');
  L.push('| id | 曲 | 使う場面 |');
  L.push('|---|---|---|');
  for (const [id, b] of Object.entries(BGM)) {
    L.push(`| \`${id}\` | ${b.label} | ${b.use} |`);
  }
  L.push('');

  const missing = Object.entries(BGM).filter(([, b]) => b.prompt);
  if (missing.length) {
    L.push('### 足りていない曲');
    L.push('');
    for (const [id, b] of missing) {
      L.push(`#### \`${id}\` — ${b.label}`);
      L.push('');
      L.push(b.use);
      L.push('');
      L.push('```');
      L.push(b.prompt);
      L.push('```');
      L.push('');
      L.push(`置き場所: \`${b.file}\``);
      L.push('');
    }
  }

  L.push('### 場面と曲の対応（`bgmFor()` の出力）');
  L.push('');
  L.push('| 番号 | 場面 | 曲 |');
  L.push('|---|---|---|');
  for (const sc of SCENE_LIST) {
    const [step, room] = sc.key.split('@');
    const state = step === 'ending'
      ? { phase: 'ENDING', ending: room, step }
      : { phase: PHASE_OF(step), room: Number(room), step };
    L.push(`| S${String(sc.no).padStart(2, '0')} | ${sc.name} | ${BGM[bgmFor(state)].label} |`);
  }
  L.push('');

  L.push('## 効果音');
  L.push('');
  L.push('**この7つだけ。** 1周あたりの回数を添えてある。');
  L.push('1〜2回しか鳴らないものは、その1回が物語の要になっているものだけ残した。');
  L.push('');
  L.push('| id | 音 | 長さ | 回数／周 | 役目 |');
  L.push('|---|---|---|---|---|');
  for (const [id, e] of Object.entries(SE)) {
    L.push(`| \`${id}\` | ${e.label} | ${e.sec}s | ${e.uses} | ${e.use} |`);
  }
  L.push('');
  L.push('### プロンプト（そのままコピーする）');
  L.push('');
  for (const [id, e] of Object.entries(SE)) {
    L.push(`#### \`${id}\` — ${e.label}`);
    L.push('');
    L.push('```');
    L.push(sePromptFor(id));
    L.push('```');
    L.push('');
    L.push(`置き場所: \`assets/SE/${id}.wav\``);
    L.push('');
  }

  L.push('## 鳴らし続けるもの');
  L.push('');
  for (const [id, e] of Object.entries(SE_OPTIONAL)) {
    L.push(`#### \`${id}\` — ${e.label}`);
    L.push('');
    L.push(e.use);
    L.push('');
    L.push('```');
    L.push(sePromptFor(id));
    L.push('```');
    L.push('');
    L.push(`置き場所: \`assets/SE/${id}.wav\``);
    L.push('');
  }
  return L.join('\n');
}

/** 場面の鍵から phase を戻す（音源集の表を作るためだけの逆引き） */
function PHASE_OF(step) {
  if (step.startsWith('m')) return 'MOUNTAIN';
  if (step.startsWith('r_') || step === 'caught') return 'RETURN';
  if (step === 'reveal' || step === 'eyes' || step === 'eyes2') return 'REVEAL';
  return 'OUTBOUND';
}

fs.writeFileSync('docs/プロンプト集.md', prompts());
fs.writeFileSync('docs/アセット一覧.md', list());
fs.writeFileSync('docs/場面一覧.md', scenes());
fs.writeFileSync('docs/音源集.md', audio());
console.log(`生成: プロンプト集(${ASSETS.length}枚) / アセット一覧 / 場面一覧(${SCENE_LIST.length}場面) / 音源集(BGM ${Object.keys(BGM).length}曲・SE ${Object.keys(SE).length}種)`);
