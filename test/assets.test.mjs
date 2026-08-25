import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ASSETS, RECIPES, promptFor, pixelsFor, isCutout } from '../src/data/assets.js';

/**
 * アセットの一覧（src/data/assets.js）とコードのずれを検出する。
 *
 * 散文のドキュメントとコードを二重管理していた結果、
 * コードが使う6枚が一覧から漏れていた。同じことを繰り返さないための検査。
 */

/**
 * アセットのパスを直値で持つファイル。
 * ★テンプレート文字列で組み立てるとここで拾えないので、必ず直値で書く。
 */
const SOURCES = [
  'src/data/layout.js',
  'src/render/stage.js',
  'src/scenes/presentation.js',
  'src/systems/game.js',
];

function pathsInCode() {
  const found = new Set();
  for (const f of SOURCES) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/'([a-z0-9_]+(?:\/[a-z0-9_]+)*\.png)'/g)) {
      found.add(m[1]);
    }
  }
  return found;
}

test('コードが参照するアセットは、すべて一覧に載っている', () => {
  const listed = new Set(ASSETS.map((a) => a.p));
  const missing = [...pathsInCode()].filter((p) => !listed.has(p));
  assert.deepEqual(missing, [], `一覧に無いアセットを参照している: ${missing.join(', ')}`);
});

test('配線済みと書いたアセットは、実際にコードから参照されている', () => {
  const used = pathsInCode();
  const stale = ASSETS.filter((a) => a.wired !== false && !used.has(a.p)).map((a) => a.p);
  assert.deepEqual(stale, [],
    `配線済みのはずが参照されていない（wired: false を付けるか、実装する）: ${stale.join(', ')}`);
});

test('レシピはすべて定義済みで、面にはマゼンタ背景を指定していない', () => {
  for (const a of ASSETS) {
    assert.ok(RECIPES[a.r], `${a.p}: 未定義のレシピ ${a.r}`);
  }
  for (const [id, r] of Object.entries(RECIPES)) {
    const hasMagenta = /magenta/i.test(r.tech);
    assert.equal(hasMagenta, r.cut,
      `レシピ ${id}: cut=${r.cut} なのにマゼンタ指定が ${hasMagenta}。` +
      '面（床・壁・背景）にマゼンタを指定してはいけない');
  }
});

test('完成プロンプトに矛盾した指定が混ざっていない', () => {
  for (const a of ASSETS) {
    const p = promptFor(a);
    if (!isCutout(a.r)) {
      assert.ok(!/magenta/i.test(p), `${a.p}: 面なのにマゼンタ背景を指定している`);
      assert.ok(!/isolated subject/i.test(p), `${a.p}: 面なのに isolated subject を指定している`);
    }
    /**
     * 床の継ぎ目。
     * 鏡張り（mirror: true）で敷く床は継ぎ目が必ず一致するので、
     * 継ぎ目を合わせる指定は要らない。むしろ余計な制約になる。
     */
    if (a.r === 'floor') {
      if (a.mirror) {
        assert.ok(!/tileable|tile seamlessly/.test(p),
          `${a.p}: 鏡張りなのに継ぎ目を合わせる指定が残っている（要らない制約）`);
      } else {
        assert.ok(/tileable/.test(p), `${a.p}: 床なのに tileable の指定がない`);
      }
    }
    // 看板は文字を Canvas 2D で描くので、絵に文字が入ってはいけない
    assert.ok(/no text, no lettering/.test(p), `${a.p}: 文字を禁止する指定がない`);
  }
});

test('鏡張りの指定は、向きのない絵にだけ付いている', () => {
  // 板張りや市松に鏡張りを使うと、反転した折り返しが継ぎ目より目立つ
  const DIRECTIONAL = /plank|parquet|herringbone|chevron|checkerboard|tiles/i;
  for (const a of ASSETS.filter((x) => x.mirror)) {
    assert.ok(!DIRECTIONAL.test(a.s),
      `${a.p}: 向きのある絵に鏡張りを指定している（反転が見える）`);
  }
});

test('アセットのパスに重複がない', () => {
  const seen = new Set();
  for (const a of ASSETS) {
    assert.ok(!seen.has(a.p), `重複: ${a.p}`);
    seen.add(a.p);
  }
});

test('★保存形式は、透明が必要かどうかだけで決まる', () => {
  // 全部 PNG にしていたのが、面が 2MB を超えていた原因。
  // 面は端まで絵で埋まるので透明を持つ意味がなく、JPEG なら 1/4 になる。
  // 逆に抜き板を JPEG にすると、マゼンタの縁に色が滲んで輪郭が残る。
  for (const [id, r] of Object.entries(RECIPES)) {
    assert.ok(r.fmt, `${id}: 保存形式が決まっていない`);
    assert.equal(r.fmt, r.cut ? 'PNG' : 'JPEG',
      `${id}: 抜き板は PNG、面は JPEG（いまは ${r.fmt}）`);
  }
});

test('プロンプトの末尾に、比率とピクセル数と保存形式が入っている', () => {
  for (const a of ASSETS) {
    const last = promptFor(a).split('\n').pop();
    const [w, h] = pixelsFor(a);
    assert.match(last, new RegExp(`aspect ratio ${a.ar[0]}:${a.ar[1]}`), `${a.p}: 比率がない`);
    assert.match(last, new RegExp(`output ${w} x ${h} pixels`), `${a.p}: ピクセル数がない`);
    assert.match(last, /(PNG|JPEG)$/, `${a.p}: 保存形式がない`);
  }
});

test('★マゼンタの判定は、検査と実行時で同じ式である', async () => {
  const { isKeyed, magentaness } = await import('../src/render/keyRule.js');
  // 生成AIが出すマゼンタは緑が残る。実測値をそのまま置く。
  // 「緑が 60 未満」で切っていたころ、これを「マゼンタでない」と誤判定し、
  // 綺麗に抜ける絵を作り直させてしまった
  const 実測 = [
    [253, 77, 251, 'umbrella_stand'],
    [247, 72, 239, 'gun_rack'],
    [255, 72, 252, 'deer_mount'],
    [252, 49, 243, 'ammo_box'],
    [255, 0, 255, '完全なマゼンタ'],
  ];
  for (const [r, g, b, name] of 実測) {
    assert.ok(isKeyed(r, g, b),
      `${name} (${r},${g},${b}) は抜けるはず（マゼンタらしさ ${magentaness(r, g, b)}）`);
  }
  // 絵の側は抜けてはいけない
  for (const [r, g, b, name] of [[131, 105, 57, '眼玉の中央'], [200, 190, 170, '生成りの壁']]) {
    assert.ok(!isKeyed(r, g, b), `${name} を抜いてしまう`);
  }
});

/**
 * ★寄る対象は、その部屋に実際に建っている板でなければならない。
 *
 * rooms.js の examine.focus は文字列で書く。layout.js の tex と一字でも違うと
 * main.js が anchors.props から引けず、カメラは寄らないのに役者だけ消える。
 * 実際に玄関がそうなっていた（'rooms/01_entrance/signboard_blank.png' と書いてあったが
 * 実体は 'common/signboard_blank.png'）。「人が消えるだけ」で例外も警告も出ないので、
 * 遊んで気づくしかない類の不具合。ここで止める。
 */
test('★「調べる」で寄る板は、その部屋に建っている', async () => {
  const { ROOMS } = await import('../src/data/rooms.js');
  const { LAYOUT, ROOM_ID } = await import('../src/data/layout.js');

  for (const [n, room] of Object.entries(ROOMS)) {
    const focus = room.examine?.focus;
    if (!focus) continue;
    const L = LAYOUT[ROOM_ID[n]];
    const placed = [...L.props, ...(L.retProps ?? [])].map((p) => p.tex);
    assert.ok(
      placed.includes(focus),
      `${n}室 ${room.name} の examine.focus「${focus}」がこの部屋に無い。`
      + ` 建っているのは ${placed.join(' / ')}`
    );
  }
});
