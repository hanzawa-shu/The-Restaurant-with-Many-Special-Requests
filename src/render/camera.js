/**
 * カメラ（設計書 §4.3）
 *
 * 完全な平行投影（OrthographicCamera）は立体感が出ず、それは
 * 「チープさ」そのものになる。FOV 28 のわずかな遠近が、アイソメの
 * 見た目を保ちながら奥行きを感じさせる。
 *
 * 決断の瞬間だけ寄る（仕様書 §4.2）。アセット追加はゼロ。
 * 画面が寄る＝重要な選択が来た、という文法をプレイヤーに刻む。
 */

import * as THREE from 'three';

export const ASPECT = 16 / 9;

/** 引き（部屋を見せる）／寄り（決断） */
/**
 * 注視点を 1.2 に置いているのは、DOM のパネルが画面下 4割を覆うため。
 * ブラウザ上で各板を投影して測り、主題がパネルの上に収まる値を選んだ。
 * 注視点を上げると役者がパネルに隠れ、下げすぎると壁の看板が画面外に出る。
 */
export const SHOT = {
  WIDE:  { pos: [4.8, 4.2, 5.8], look: [0, 1.2, 0] },
  CLOSE: { pos: [3.7, 3.3, 4.5], look: [0, 1.2, 0] },
};

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(28, ASPECT, 0.1, 100);
  cam.position.set(...SHOT.WIDE.pos);
  cam.lookAt(...SHOT.WIDE.look);
  return cam;
}

/** 板をこの角度に向けると固定カメラに正対する。カメラは回転しないので定数でよい */
export const AZIMUTH = Math.atan2(SHOT.WIDE.pos[0], SHOT.WIDE.pos[2]);

/**
 * 引きのカメラの正面いっぱいに置く板の、姿勢と大きさ。
 *
 * ★視線に垂直な面にするのが要点。
 * 垂直な壁として置くと、カメラが俯瞰で傾いているぶん画角の計算が合わず、
 * 中心も画面中央から外れる（実際に外れて、絵の中央だけが写った）。
 * 視線に正対させれば 2*dist*tan(fov/2) がそのまま使える。
 */
export function fullFrameAt(dist) {
  const cam = createCamera();
  cam.updateMatrixWorld(true);
  const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  return {
    pos: cam.position.clone().addScaledVector(dir, dist),
    quat: cam.quaternion.clone(),
    w: h * cam.aspect,
    h,
  };
}

const target = {
  pos: new THREE.Vector3(...SHOT.WIDE.pos),
  look: new THREE.Vector3(...SHOT.WIDE.look),
};
const current = {
  pos: new THREE.Vector3(...SHOT.WIDE.pos),
  look: new THREE.Vector3(...SHOT.WIDE.look),
};

export function setShot(name) {
  const s = SHOT[name] ?? SHOT.WIDE;
  target.pos.set(...s.pos);
  target.look.set(...s.look);
}

/**
 * 特定の板に寄る（フィードバック対応）。
 * 「調べる」でテキストだけ変わると、何も起きていないように見える。
 *
 * ★対象の高さから距離を当て推量してはいけない。
 * 以前は `dist = 高さ * 2.9` としていたが、これだと対象が画面の 69% を占める。
 * 画面下 45% はテキスト枠が覆っているので、収まるのは 55% しかない。
 * 幅も見ていなかったので、横長の板は左右がはみ出していた。
 * （実際に、ほとんどの「調べる」で対象が画面に収まっていなかった）
 *
 * 画角から逆算する。
 *   距離 d での見える高さ 2H = 2*d*tan(fov/2)
 *   枠の上に残る帯の高さ    = 2H*(1-PANEL_COVER)
 * 高さと幅の両方が帯に収まる距離のうち、遠い方を採る。
 *
 * さらにカメラと注視点を同じだけ真下へずらして、対象を帯の中央へ持ち上げる。
 * 両方を同じベクトルで動かすので、カメラの向きは変わらない（構図の文法を壊さない）。
 */

/**
 * テキスト枠が画面の下を覆う割合。style.css の .panel の高さと対で決める。
 * 枠 34% ＋ 下の余白 3% ＝ 37%。少し余裕を見て 0.40。
 */
export const PANEL_COVER = 0.40;
/** 帯のなかにどれだけ余裕を残すか */
const FIT = 0.84;
const TAN = Math.tan(THREE.MathUtils.degToRad(28 / 2));

/** 固定カメラの前方向と上方向。向きは変わらないので定数でよい */
const AXES = (() => {
  const cam = createCamera();
  cam.updateMatrixWorld(true);
  return {
    dir: new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion),
  };
})();

/**
 * @param {THREE.Vector3} pos 対象の中心
 * @param {number} w 対象の幅（板の寸法）
 * @param {number} h 対象の高さ
 */
export function focusOn(pos, w, h) {
  const byHeight = h / (2 * TAN * FIT * (1 - PANEL_COVER));
  const byWidth = w / (2 * TAN * ASPECT * FIT);
  // 近すぎると板の粗が見える。上限は「これ以上離すと寄った意味がない」線ではなく、
  // 大きい板が収まるだけの余地を残す（8 で止めていたので看板が枠いっぱいになっていた）
  const d = Math.min(Math.max(byHeight, byWidth, 1.7), 14);
  const shift = PANEL_COVER * d * TAN;

  target.look.copy(pos).addScaledVector(AXES.up, -shift);
  target.pos.copy(target.look).addScaledVector(AXES.dir, -d);
}

/** 指数的に近づける。フレームレートに依存しない補間 */
export function updateCamera(cam, dt) {
  const k = 1 - Math.exp(-dt * 3.2);
  current.pos.lerp(target.pos, k);
  current.look.lerp(target.look, k);
  cam.position.copy(current.pos);
  cam.lookAt(current.look);
}

/** 場面を切り替えるときは補間せず即座に合わせる */
export function snapShot(cam, name) {
  setShot(name);
  current.pos.copy(target.pos);
  current.look.copy(target.look);
  cam.position.copy(current.pos);
  cam.lookAt(current.look);
}
