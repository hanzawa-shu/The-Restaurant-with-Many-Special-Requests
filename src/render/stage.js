/**
 * ステージの構築（設計書 §4.1）
 *
 * 状態を受け取って絵にするだけ。ゲーム状態は書き換えない。
 * 同じ3Dシーンを往路と復路で使い回し、テクスチャとライティングだけ差し替える。
 */

import * as THREE from 'three';
import { loadTexture } from './chromaKey.js';
import { composeSign } from './signboard.js';
import { makeFloor, makeWall, makeBillboard, disposeTree } from './billboard.js';
import { addBackdropSeam } from './seam.js';
import { AZIMUTH, fullFrameAt } from './camera.js';
import { LAYOUT, MOUNTAIN, ROOM_ID } from '../data/layout.js';
import { isMirrored } from '../data/assets.js';

const ROOM_SIZE = 9;
const WALL_H = 9;

/** 建てた板への参照。Phase 3 の看板描画と、Phase 4 の演出で使う */
export const anchors = {
  sign: null,       // 看板の板（Canvas 2D のテクスチャを載せる）
  keyhole: null,    // 鍵穴のある扉
  exit: null,       // 出口の扉。退室の歩きの行き先になる
  player: null,
  partner: null,
  gun: null,        // 主人公の鉄砲
  gunB: null,       // 相方の鉄砲
  props: [],
};

let group = null;
let actorGroup = null;
let builtKey = null;

/**
 * clear() 以降に await が入るので、その間に別の build が始まると
 * 「前の build が新しいグループに板を足す」という混線が起きる。
 * 実際に Phase 2 で起きた（玄関に山道の板が混ざり、子が8個ではなく14個になった）。
 * 各 build は自分のグループ参照を握り、現行でなければ何もしない。
 */
function clear(scene) {
  if (group) { scene.remove(group); disposeTree(group); }
  group = new THREE.Group();
  group.name = 'stage';
  scene.add(group);
  anchors.sign = null;
  anchors.keyhole = null;
  anchors.exit = null;
  anchors.props = [];
  plates.door = null;
  plates.eyes = null;
  return group;
}

/**
 * 部屋を建てる。同じ部屋・同じ向きなら建て直さない。
 * @param {'OUTBOUND'|'RETURN'} direction
 */
export async function buildRoom(scene, roomNumber, direction) {
  const id = ROOM_ID[roomNumber];
  const key = `${id}:${direction}`;
  if (builtKey === key) return anchors;
  builtKey = key;

  const L = LAYOUT[id];
  const g = clear(scene);
  if (!L) return anchors;

  const returning = direction === 'RETURN';

  const [floorTex, wallA, wallB] = await Promise.all([
    loadTexture(L.floor, 'floor', { repeat: true }),
    loadTexture(L.walls[0], 'wall'),
    loadTexture(L.walls[1], 'wall'),
  ]);
  if (g !== group) return anchors;

  g.add(makeFloor(floorTex, ROOM_SIZE, 3, { mirror: isMirrored(L.floor) }));
  g.add(makeWall(wallA, ROOM_SIZE, WALL_H, 0, -ROOM_SIZE / 2, 0));
  g.add(makeWall(wallB, ROOM_SIZE, WALL_H, -ROOM_SIZE / 2, 0, Math.PI / 2));

  const list = [...L.props, ...(returning ? L.retProps ?? [] : [])];
  await Promise.all(list.map(async (p) => {
    // 復路では意味の反転したテクスチャに差し替える
    const path = returning && p.ret ? p.ret : p.tex;
    const tex = await loadTexture(path, p.kind ?? 'prop');
    if (g !== group) return;
    const mesh = makeBillboard(tex, p.w, p.h, {
      x: p.x, z: p.z, y: p.y ?? null,
      azimuth: p.ry ?? AZIMUTH,
    });
    mesh.name = path;
    warnIfClipping(mesh, p, path);
    g.add(mesh);
    anchors.props.push(mesh);
    if (p.sign) { anchors.sign = mesh; mesh.userData.plank = tex.image; }
    if (p.keyhole) anchors.keyhole = mesh;
    if (p.exit) anchors.exit = mesh;
  }));

  return anchors;
}

/**
 * 山道の地面板。
 *
 * ★24 は「板の縁を画面の外へ出す」ための大きさ。
 * 14 だと板の縁（x=-7 と z=-7）が背景板より手前に来る場所があり、
 * 画面の左右で縁の直線が見えていた。広げれば縁は必ず背景板の裏に隠れ、
 * 隠すべき境目が「背景板との交線」1本だけになる。
 * 見える範囲は変わらない（タイルの数は同じ大きさになるよう合わせる）。
 */
const GROUND = 24;
const GROUND_TILES = 7;      // 14 に 4 枚と同じ枡の大きさ
/** 背景板を立てる距離。交線の位置でもある */
const BACK_DIST = 7;
/** 交線に立てる草の帯 */
const EDGE_W = 18;
const EDGE_H = 1.2;   // 役者(2.2)の腰ほど。これ以上高いと生垣に見える

/** 山道の1カットを建てる */
export async function buildMountain(scene, cut) {
  const key = `mountain:${cut}`;
  if (builtKey === key) return anchors;
  builtKey = key;

  const M = MOUNTAIN[cut];
  const g = clear(scene);
  if (!M) return anchors;

  // 地面を絞ると、その奥の縁がそのまま「地平線」になる。
  // 背景板はその縁のすぐ後ろに立てる
  const ground = await loadTexture('mountain/ground.png', 'floor', { repeat: true });
  if (g !== group) return anchors;
  g.add(makeFloor(ground, GROUND, GROUND_TILES, { mirror: isMirrored('mountain/ground.png') }));

  /**
   * ★地面板の遠い縁を隠す。
   *
   * 板の縁がそのまま幾何学的な直線として見えるので、
   * 「板の上に絵を立てた」構造が分かってしまう（タイトルで特に目立つ）。
   *   1. 縁に沿って接触の影を敷く（絵は使わない）
   *   2. その上に枯れ草の帯を立てて、不規則なシルエットで直線を壊す
   * 影だけだと直線は残り、草だけだと隙間から直線が見える。両方でひとつの対策。
   */
  const edge = await loadTexture('mountain/grass_edge.png', 'prop');
  if (g !== group) return anchors;
  // fit:false で枠の寸法をそのまま使う（交線の長さいっぱいに伸ばす）
  const grass = makeBillboard(edge, EDGE_W, EDGE_H, {
    x: -Math.sin(AZIMUTH) * (BACK_DIST - 0.12),
    z: -Math.cos(AZIMUTH) * (BACK_DIST - 0.12),
    y: EDGE_H / 2, azimuth: AZIMUTH, shadow: false, fit: false,
  });
  grass.name = 'mountain/grass_edge.png';
  g.add(grass);

  // ★影は草より後に、草より手前へ置く。根元の明るい塗りを沈める
  addBackdropSeam(g, { dist: BACK_DIST, width: EDGE_W, azimuth: AZIMUTH });

  // 背景板はカメラの視線に正対させ、視線方向の奥に置く。
  // z 軸に平行に置くと、固定カメラの方位（約40度）とずれて斜めに見える
  const back = await loadTexture(M.backdrop, 'backdrop');
  if (g !== group) return anchors;
  g.add(makeBackdrop(back, { dist: BACK_DIST, w: 22, h: 9, y: 1.6 }));

  await Promise.all((M.props ?? []).map(async (p) => {
    const tex = await loadTexture(p.tex, p.kind ?? 'prop');
    if (g !== group) return;
    const mesh = makeBillboard(tex, p.w, p.h, {
      x: p.x, z: p.z, y: p.y ?? null, azimuth: p.ry ?? AZIMUTH,
    });
    mesh.name = p.tex;
    g.add(mesh);
    anchors.props.push(mesh);
    if (p.sign) { anchors.sign = mesh; mesh.userData.plank = tex.image; }
  }));

  return anchors;
}

/**
 * 板が壁にめり込んでいないか検査する。
 * カメラ正対の既定角のまま壁際に置くと必ずめり込む（Phase 4 で実際に起きた）。
 */
function warnIfClipping(mesh, p, path) {
  const half = p.w / 2;
  const dx = half * Math.cos(mesh.rotation.y);
  const dz = -half * Math.sin(mesh.rotation.y);
  const limit = -ROOM_SIZE / 2 + 0.02;
  const minZ = Math.min(p.z + dz, p.z - dz);
  const minX = Math.min(p.x + dx, p.x - dx);
  if (minZ < limit || minX < limit) {
    console.warn(
      `[layout] ${path} が壁にめり込んでいます（z=${minZ.toFixed(2)} x=${minX.toFixed(2)}、壁は ${limit.toFixed(2)}）。` +
      ' 壁掛けなら ry を明示してください（奥壁 ry:0 / 左壁 ry:Math.PI/2）'
    );
  }
}

/**
 * 背景板。視線方向の奥に、カメラに正対させて立てる。
 * z 軸に平行に置くと固定カメラの方位（約40度）とずれて斜めに見える。
 *
 * 高さと中心は、絵の地平線がカメラの注視高さ付近に来るように決める。
 * 下端を y=0 に接地させると空が画面外へ出てしまう。
 */
function makeBackdrop(tex, { dist, w, h, y, unlit = false, fit = false }) {
  const b = makeBillboard(tex, w, h, {
    x: -Math.sin(AZIMUTH) * dist,
    z: -Math.cos(AZIMUTH) * dist,
    y, azimuth: AZIMUTH, shadow: false, unlit, fit,
  });
  // 抜いたものは透明部分を残す（余りを暗闇として見せる）
  b.material.transparent = fit;
  b.material.alphaTest = 0;
  b.name = 'backdrop';
  return b;
}

// ------------------------------------------------------------------ 結末

/**
 * 結末の場面。一枚絵を背景板として立て、猟師がいる結末では前に置く。
 * 部屋を消して、絵だけを見せる。
 */
/**
 * 一枚絵の板をカメラから離す距離。
 * 猟師の板（カメラから約10.5）より奥にしないと、猟師が絵に隠れる。
 */
const FULL_DIST = 14;

/**
 * 結末の場面。一枚絵を画角いっぱいに立てて、部屋を消す。
 *
 * ★猟師の板を絵の手前に重ねるのはやめた。
 * 結末の絵が完成した構図になったので、切り抜きを前に置くと
 * 二重に猟師が写る（結末5）か、照明の違う板が浮く（結末4）。
 * 絵の中で語りきれているものを、コードで足さない。
 */
export async function buildFullFrame(scene, art) {
  const key = `full:${art}`;
  if (builtKey === key) return anchors;
  builtKey = key;

  const g = clear(scene);
  const tex = await loadTexture(art, 'scene');
  if (g !== group) return anchors;
  // ★一枚絵は「画面いっぱい」でなければ意味がない。
  //   部屋の背景板と同じ置き方（垂直な壁・26x13）では画角に収まらず、中央だけが写る。
  //   視線に正対させて、画角ちょうどの大きさで置く
  const f = fullFrameAt(FULL_DIST);
  // ★一枚絵は照明を受けない。場面のライトで色が変わってはいけない
  const b = makeBillboard(tex, f.w, f.h, { y: 0, shadow: false, unlit: true, fit: false });
  b.position.copy(f.pos);
  b.quaternion.copy(f.quat);
  b.name = 'fullframe';
  g.add(b);
  return anchors;
}

/**
 * 鍵穴を覗いたカット（2枚重ね）
 *
 * ★1枚絵で「暗闇に眼玉」を出すより、2枚に分けて溶かし込むほうが怖い。
 *   1. 扉の板だけを見せる。かぎ穴は黒く、まだ何もいない
 *   2. プレイヤーが「目を近づける」を選ぶ
 *   3. 扉が溶けて、その黒からそのまま眼玉が現れる
 *
 * かぎ穴の黒と眼玉の背景の黒が同じなので、単純なクロスディゾルブで
 * 「かぎ穴が眼玉に変わった」ように見える。位置合わせは要らない。
 *
 * 溶け終わったあとも、眼玉の板をごくゆっくり近づけ続ける。
 * 読んでいるあいだに間合いが詰まるので、落ち着いて読めない。
 */
const CUT_DOOR = 'rooms/06_kitchendoor/keyhole_eyes_door.png';
const CUT_EYES = 'rooms/06_kitchendoor/keyhole_eyes_eyes.png';
/** 溶ける時間（秒）。速いと「切り替わった」だけになる */
const DISSOLVE = 1.9;
/** 溶けたあとの寄り。1秒あたりの倍率と上限 */
const CREEP = 0.006;
const CREEP_MAX = 0.13;

const plates = {
  door: null,
  eyes: null,
  /** 0 = 扉だけ / 1 = 眼玉だけ */
  t: 0,
  on: false,
  creep: 0,
};

/**
 * 画角いっぱいに、絵を切り取って敷く（CSS の background-size: cover と同じ）。
 * 収める（contain）と余白が出るが、この2枚は縁まで絵なので切るほうが正しい。
 */
function coverPlate(tex, f) {
  const ar = tex?.userData?.aspect || 1;
  const frame = f.w / f.h;
  const w = ar > frame ? f.h * ar : f.w;
  const h = ar > frame ? f.h : f.w / ar;
  const b = makeBillboard(tex, w, h, { y: 0, shadow: false, unlit: true, fit: false });
  b.position.copy(f.pos);
  b.quaternion.copy(f.quat);
  b.material.transparent = true;
  b.material.alphaTest = 0;
  return b;
}

export async function buildKeyholeCut(scene) {
  if (builtKey === 'keyhole') return anchors;
  builtKey = 'keyhole';

  const g = clear(scene);
  const [dTex, eTex] = await Promise.all([
    loadTexture(CUT_DOOR, 'scene'),
    loadTexture(CUT_EYES, 'scene'),
  ]);
  if (g !== group) return anchors;

  const f = fullFrameAt(FULL_DIST);
  // 眼玉は扉のわずかに奥。扉が薄くなるとそのまま出てくる
  const back = fullFrameAt(FULL_DIST + 0.05);

  plates.eyes = coverPlate(eTex, back);
  plates.eyes.name = 'cut-eyes';
  plates.eyes.material.opacity = 1;
  g.add(plates.eyes);

  plates.door = coverPlate(dTex, f);
  plates.door.name = 'cut-door';
  plates.door.material.opacity = 1;
  g.add(plates.door);

  plates.t = 0;
  plates.on = false;
  plates.creep = 0;
  applyCut();
  return anchors;
}

/** 眼玉を出すか。true にした瞬間から溶けはじめる */
export function revealEyes(on) {
  if (plates.on === on) return;
  plates.on = on;
  if (instant) { plates.t = on ? 1 : 0; applyCut(); }
}

function applyCut() {
  if (!plates.door || !plates.eyes) return;
  // 扉が薄くなるだけ。奥の眼玉は不透明なので、そのままクロスディゾルブになる
  plates.door.material.opacity = 1 - plates.t;
  plates.door.visible = plates.t < 1;
  const k = 1 + 0.05 * plates.t + plates.creep;
  plates.eyes.scale.set(k, k, 1);
}

/** 毎フレーム呼ぶ。溶けと、そのあとの寄りを進める */
export function animateCut(dt) {
  if (!plates.door) return;
  const to = plates.on ? 1 : 0;
  if (plates.t !== to) {
    const step = dt / DISSOLVE;
    plates.t = to > plates.t ? Math.min(to, plates.t + step) : Math.max(to, plates.t - step);
  } else if (plates.on && plates.creep < CREEP_MAX) {
    plates.creep = Math.min(CREEP_MAX, plates.creep + CREEP * dt);
  }
  applyCut();
}

// ------------------------------------------------------------------ 場面ごとの板

let extraGroup = null;
let extraKey = null;

/**
 * その場面だけに出す板（山道の生きた犬、玄関に飛び込む犬など）。
 * 部屋ではなく step に紐づくので、部屋とは別のグループで持つ。
 */
export async function setExtras(scene, list) {
  const key = JSON.stringify(list ?? []);
  if (key === extraKey) return;
  extraKey = key;

  if (!extraGroup) {
    extraGroup = new THREE.Group();
    extraGroup.name = 'extras';
    scene.add(extraGroup);
  }
  for (const c of [...extraGroup.children]) {
    extraGroup.remove(c);
    disposeTree(c);
  }

  const g = extraGroup;
  await Promise.all((list ?? []).map(async (p) => {
    const tex = await loadTexture(p.tex, p.kind ?? 'prop');
    if (g !== extraGroup) return;
    const m = makeBillboard(tex, p.w, p.h, {
      x: p.x, z: p.z, y: p.y ?? null, azimuth: p.ry ?? AZIMUTH,
    });
    m.name = p.tex;
    g.add(m);
  }));
}

// ------------------------------------------------------------------ 看板

/**
 * 看板に縦書きの文字を焼く（設計書 §6）。
 *
 * 板のテクスチャはローダーのキャッシュが持っている共有物なので、
 * そこへ直接描くと他の部屋の看板まで汚染する。必ず新しい canvas に
 * 板を写してから文字を載せる。
 */
export function setSignText(lines) {
  const sign = anchors.sign;
  if (!sign || !sign.userData.plank) return;

  const key = (lines ?? []).join('|');
  if (sign.userData.textKey === key) return;
  sign.userData.textKey = key;

  const prev = sign.material.map;
  sign.material.map = composeSign(sign.userData.plank, lines);
  sign.material.needsUpdate = true;
  // 前回合成したテクスチャだけを破棄する（板の元画像は破棄しない）
  if (prev && prev !== sign.userData.plankTexture) prev.dispose?.();
}

/**
 * 鍵穴からこちらを覗く二つの青い眼玉について。
 *
 * ★以前は「眼玉だけの小片を扉に重ねる」実装だったが、破棄した。
 * 扉と眼玉を別々に生成すると木目も鍵穴の位置も合わず、小片の縁が見える。
 * 実際に「二つの目が嵌った装飾パネル」が生成され、
 * 暗い扉の上に明るい四角が浮いた。
 *
 * いまは扉ごと差し替える。
 *   往路 kitchen_door.png       … 鍵穴の奥は真っ黒
 *   復路 kitchen_door_eyes.png  … 同じ扉。鍵穴から眼玉が覗いている
 *
 * layout の ret が差し替えるので、専用のコードは要らない。
 * 「覗いてから犬が来るまで」＝復路の厨房前 と、ret の適用範囲が一致する。
 */


const ACTOR_H = 2.2;

/**
 * 立ち絵のパス。
 * ★テンプレート文字列で組み立てると、アセットの同期検査で拾えない。
 * 直値の表にしておく（test/assets.test.mjs が突き合わせる）。
 */
const ACTOR_TEX = {
  player: [
    'characters/player/stage0.png',
    'characters/player/stage1.png',
    'characters/player/stage2.png',
    'characters/player/stage3.png',
  ],
  partner: [
    'characters/partner/stage0.png',
    'characters/partner/stage1.png',
    'characters/partner/stage2.png',
    'characters/partner/stage3.png',
  ],
};

/**
 * 二人の紳士を配置する。
 * 服装は「従った回数」ではなく服従フラグから決まる線形4段階（ターンフロー §2.3）。
 * 鉄砲は独立レイヤーなので、下着姿で鉄砲を抱えた状態も正しく描ける。
 */
export async function setActors(scene, { clothing, hasGun, partnerPresent, visible = true }) {
  if (!actorGroup) {
    actorGroup = new THREE.Group();
    actorGroup.name = 'actors';
    scene.add(actorGroup);
  }
  while (actorGroup.children.length) {
    const c = actorGroup.children.pop();
    disposeTree(c);
  }
  /**
   * ★見えないときも板は建てる。
   * 以前は visible=false で早く返していたので、あとから setActorsVisible(true) を
   * 呼んでも中身が空で、二人が戻ってこなかった（「調べる」を読み終えて寄りを解いた瞬間）。
   * 板を建てる費用はテクスチャがキャッシュ済みなので無視できる。
   */
  actorGroup.visible = visible;

  const stage = Math.max(0, Math.min(3, clothing));
  const [pTex, qTex] = await Promise.all([
    loadTexture(ACTOR_TEX.player[stage], 'actor'),
    loadTexture(ACTOR_TEX.partner[stage], 'actor'),
  ]);

  /**
   * 奥に立たせると画面上で高い位置に来る。UIパネルに足元が隠れるのを避ける。
   *
   * ★x は看板と扉を塞がない位置に決めてある。
   * 看板は奥壁の左（x=-3.6）にあり、二人を左に寄せると主人公の頭が文面に重なる。
   * 逆に右へ寄せすぎると扉の開口を塞ぎ、相方が画面外に出る。
   * ブラウザで並べて確かめた値なので、動かすなら看板と扉を必ず見直す。
   */
  anchors.player = makeBillboard(pTex, 1.1, ACTOR_H, { x: -0.45, z: -1.8, azimuth: AZIMUTH });
  actorGroup.add(anchors.player);

  if (partnerPresent) {
    anchors.partner = makeBillboard(qTex, 1.05, ACTOR_H * 0.95, { x: 1.25, z: -1.15, azimuth: AZIMUTH });
    actorGroup.add(anchors.partner);
  } else {
    anchors.partner = null;
  }

  if (hasGun) {
    // 原作の二人はどちらも猟銃を持っている。hasGun は二人ぶんを表す1つの旗
    const [gA, gB] = await Promise.all([
      loadTexture('characters/player/rifle_held.png', 'prop'),
      loadTexture('characters/partner/rifle_held.png', 'prop'),
    ]);
    anchors.gun = makeBillboard(gA, 0.5, 1.5, {
      x: 0.05, z: -1.75, y: 1.1, azimuth: AZIMUTH,
    });
    actorGroup.add(anchors.gun);
    if (partnerPresent) {
      anchors.gunB = makeBillboard(gB, 0.48, 1.45, {
        x: 1.72, z: -1.1, y: 1.05, azimuth: AZIMUTH,
      });
      actorGroup.add(anchors.gunB);
    } else {
      anchors.gunB = null;
    }
  } else {
    anchors.gun = null;
    anchors.gunB = null;
  }
}

export function hideActors() {
  if (actorGroup) actorGroup.visible = false;
}

/**
 * 何かに寄っているあいだは役者を消す。
 * 対象と カメラ のあいだに立って手前を塞ぐため（Phase 4 で実際にそうなった）。
 */
export function setActorsVisible(v) {
  if (actorGroup) actorGroup.visible = !!v;
}

let instant = false;
export function setStageInstant(v) { instant = !!v; }

/**
 * 部屋を出る動き（フィードバック対応）。
 *
 * ★扉をくぐらせない。`common/door_frame.png` は**閉じた扉**（ノブ付きの木の扉）で、
 * 中央の暗い部分はガラスであって開口ではない。以前は扉の位置まで進めたあと
 * さらに奥へ押し込んで縮めていたので、閉じた扉に突っ込んで見えていた。
 * **扉の前で止める。** 通り抜けは暗転が引き受ける（扉の音もそこで鳴る）。
 *
 * ★二人を同じ点へ寄せない。同じ座標に板が重なると絵が二重に描かれて濁る。
 * 主人公が先、相方が半歩後ろ、という並びを保ったまま動かす。
 *
 * ★復路は「奥へ縮める」を掛けない。往路の処理を使い回していたので、
 * 手前に歩いたあと奥へ引き戻されて見えていた。手前へ出したらそのまま。
 *
 * 行き先は部屋に置いた出口の扉（layout の exit: true）から取る。
 * これがないと、看板の方へ歩いていく。
 *
 * @param {'IN'|'OUT'} dir IN=奥の扉へ（往路）／OUT=手前へ（復路）
 */
export function walkActors(dir = 'IN', walkMs = 520, holdMs = 220) {
  const actors = { player: anchors.player, partner: anchors.partner };
  if (!actors.player && !actors.partner) return Promise.resolve();

  const door = anchors.exit;
  const base = dir === 'IN'
    ? (door ? { x: door.position.x, z: door.position.z + 1.5 } : { x: -1.2, z: -2.9 })
    : { x: 0.7, z: 1.6 };

  /**
   * 二人の立ち位置の差。
   *
   * ★ずらす向きが要点。カメラは方位 40 度から見ているので、
   * 単に x をずらしても画面の奥行き方向にずれて、手前の一人が奥の一人を隠す。
   * **画面の横方向**（視線に垂直な水平線）に沿ってずらすと、二人とも見える。
   *   画面の横 = (cos40°, 0, -sin40°) ≒ (0.77, 0, -0.64)
   * 主人公を画面左、相方を画面右に置く（普段の並びと同じ）。
   */
  const SIDE = 0.72;
  const sx = Math.cos(AZIMUTH) * SIDE;
  const sz = -Math.sin(AZIMUTH) * SIDE;
  const spread = {
    player: [-sx, -sz],
    partner: [sx, sz],
  };

  // 誰がどれだけ動くかを先に出す。鉄砲は持ち主と同じだけ動かす
  const delta = {};
  for (const k of ['player', 'partner']) {
    const m = actors[k];
    if (!m) continue;
    delta[k] = {
      dx: base.x + spread[k][0] - m.position.x,
      dz: base.z + spread[k][1] - m.position.z,
    };
  }

  const list = [];
  const add = (m, owner) => {
    if (m && delta[owner]) list.push({ m, x: m.position.x, z: m.position.z, owner });
  };
  add(anchors.player, 'player');
  add(anchors.partner, 'partner');
  add(anchors.gun, 'player');
  add(anchors.gunB, 'partner');
  if (!list.length) return Promise.resolve();

  const apply = (e) => {
    for (const f of list) {
      f.m.position.x = f.x + delta[f.owner].dx * e;
      f.m.position.z = f.z + delta[f.owner].dz * e;
    }
    // 上下の刻み。板ポリで脚は動かせないので、これで歩いているように見せる
    const bob = Math.abs(Math.sin(e * Math.PI * 4)) * 0.035 * (1 - e * 0.5);
    for (const m of [anchors.player, anchors.partner]) {
      if (m && m.userData.baseH !== undefined) {
        m.position.y = m.userData.baseH / 2 + bob;
      }
    }
  };

  if (instant) { apply(1); return Promise.resolve(); }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      apply(1);
      resolve();
    };
    /**
     * ★保険。requestAnimationFrame はタブが隠れると止まる。
     * 遷移の途中で別のタブに移られると、ここで止まったまま戻らず
     * ゲームが進まなくなる。時間切れで必ず終わらせる。
     */
    const guard = setTimeout(finish, (walkMs + holdMs) * 2 + 600);

    const t0 = performance.now();
    const step = (now) => {
      if (settled) return;
      const t = now - t0;
      if (t < walkMs) {
        const u = t / walkMs;
        apply(u * u * (3 - 2 * u));
        requestAnimationFrame(step);
      } else if (t < walkMs + holdMs) {
        // 扉の前で一拍置く。ここで扉の音が鳴り、そのまま暗転に入る
        apply(1);
        requestAnimationFrame(step);
      } else {
        finish();
      }
    };
    requestAnimationFrame(step);
  });
}

/**
 * 待機モーション（フィードバック対応）。
 *
 * 板ポリなので歩かせられないが、微動だにしないと人形に見える。
 * 呼吸（縦方向のわずかな伸縮）とごく小さな揺れだけを入れる。
 * ★足元は必ず床に残す。scale.y を変えたら position.y も合わせる。
 */
export function animateActors(t) {
  for (const m of [anchors.player, anchors.partner]) {
    if (!m) continue;
    if (m.userData.baseH === undefined) m.userData.baseH = m.geometry.parameters.height;
    const ph = m === anchors.partner ? 1.7 : 0;
    const k = 1 + Math.sin(t * 1.15 + ph) * 0.014;      // 呼吸
    m.scale.y = k;
    m.position.y = (m.userData.baseH * k) / 2;          // 足元を床に残す
    m.rotation.z = Math.sin(t * 0.53 + ph) * 0.007;     // わずかな揺れ
  }
  if (anchors.gun && anchors.player) {
    anchors.gun.rotation.z = anchors.player.rotation.z;
    anchors.gun.position.y = 1.1 + (anchors.player.scale.y - 1) * 1.1;
  }
  if (anchors.gunB && anchors.partner) {
    anchors.gunB.rotation.z = anchors.partner.rotation.z;
    anchors.gunB.position.y = 1.05 + (anchors.partner.scale.y - 1) * 1.05;
  }
}
