/**
 * テクスチャ → 板ポリ（設計書 §4.1 / §4.2）
 *
 * カメラは回転しない（ズームのみ）ので、板を固定の方位でカメラに正対させれば
 * 破綻しない。動的なビルボード計算は不要。
 */

import * as THREE from 'three';

/**
 * ★ alphaTest を設定しないと影が長方形になる。絶対に外さない。
 * これが 2D ゲームが「浮いて見える」最大の原因を潰している。
 */
const ALPHA_TEST = 0.5;

function standardMaterial(texture, transparent) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1.0,
    transparent,
    alphaTest: transparent ? ALPHA_TEST : 0,
    side: THREE.DoubleSide,
  });
}

/**
 * 照明を受けない板。
 * 結末の一枚絵のように「絵として完成しているもの」は、
 * 場面のライトで色を変えてはいけない。
 */
function basicMaterial(texture, transparent) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent,
    alphaTest: transparent ? ALPHA_TEST : 0,
    side: THREE.DoubleSide,
  });
}

/**
 * 床。水平配置（rotation.x = -PI/2）。
 *
 * ★絵が正方形でなくても、タイルが伸びないようにする。
 * 縦横比 a の絵を正方形の一枡に貼ると縦に a 倍伸びるので、
 * v 方向の繰り返しを a 倍にして打ち消す。
 * こうしておけば 16:9 の絵でもタイルは正方形に見える。
 */
export function makeFloor(texture, size = 9, tiles = 3, { mirror = false } = {}) {
  const a = texture?.userData?.aspect || 1;
  /**
   * 鏡張りにすると、隣り合う枡が反転して貼られるので継ぎ目が必ず一致する。
   * 絵の側で継ぎ目を合わせる必要がなくなる。
   * ただし反転が見えるので、向きのある絵（板張り・市松）には使わない。
   */
  texture.wrapS = texture.wrapT = mirror
    ? THREE.MirroredRepeatWrapping
    : THREE.RepeatWrapping;
  texture.repeat.set(tiles, tiles * a);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    standardMaterial(texture, false)
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.name = 'floor';
  return m;
}

/**
 * 壁。垂直配置。ry で向きを指定する。
 *
 * ★絵の比が面と違っても伸ばさない。はみ出す方を切り落として中央を使う
 * （CSS の background-size: cover と同じ考え方）。
 */
export function makeWall(texture, w, h, x, z, ry) {
  const a = texture?.userData?.aspect;
  if (a > 0) {
    const p = w / h;
    if (a > p) {
      // 絵が面より横長 → 高さを合わせ、左右を切る
      const r = p / a;
      texture.repeat.set(r, 1);
      texture.offset.set((1 - r) / 2, 0);
    } else {
      // 絵が面より縦長 → 幅を合わせ、上下を切る
      const r = a / p;
      texture.repeat.set(1, r);
      texture.offset.set(0, (1 - r) / 2);
    }
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    standardMaterial(texture, false)
  );
  m.position.set(x, h / 2, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  m.name = 'wall';
  return m;
}

/**
 * 立て板（家具・キャラ・看板）。
 *
 * ★w と h は「収める枠」であって、板の寸法そのものではない。
 * 絵の縦横比に合わせて、枠のなかに収まる最大の寸法にする。
 * こうしておけば、生成した絵の比が枠と違っても伸びない。
 * （クロマキーが不透明部分まで切り詰めているので、比は絵の実体を表す）
 *
 * @param {number} azimuth カメラの水平方位。この向きに正対させる
 * @param {number|null} y  省略すると下端を y=0 に接地させる
 * @param {boolean} fit    false にすると枠の寸法をそのまま使う（背景板など）
 * @param {number} tilt    板を後ろへ倒す角（ラジアン）。0 なら垂直
 */
export function makeBillboard(texture, w, h, {
  x = 0, z = 0, y = null, azimuth = 0, shadow = true,
  unlit = false, fit = true, tilt = 0, receive = false,
} = {}) {
  let W = w;
  let H = h;
  const ar = texture?.userData?.aspect;
  if (fit && ar > 0) {
    if (ar > w / h) { W = w; H = w / ar; }   // 絵が枠より横長 → 幅に合わせる
    else { H = h; W = h * ar; }              // 絵が枠より縦長 → 高さに合わせる
  }

  const material = (unlit ? basicMaterial : standardMaterial)(texture, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), material);

  /**
   * ★板を後ろへ倒す（tilt）。
   *
   * 低くて平たいもの（靴置きなど）を垂直の板で立てると、絵が正面図なので
   * 「床に貼った紙」に見える。少し倒すと上端が奥へ逃げ、俯瞰のカメラと
   * 絵の向きが噛み合う。
   *
   * 回転の順序は 'YXZ' にする。既定の 'XYZ' だと X の回転が世界軸で先に効くので、
   * 方位（Y）を持つ板がねじれる（seam.js で同じ罠を踏んでいる）。
   * 'YXZ' なら方位を向けたあとの板の横軸まわりに倒れる。
   *
   * 倒すと板の中心のまわりに回るので下端が浮く。接地させる場合は
   * 下端が y=0 に残るように高さを取り直す（cos で縮んだ分だけ下げる）。
   */
  m.rotation.order = 'YXZ';
  m.rotation.y = azimuth;
  m.rotation.x = -tilt;
  const baseY = y === null ? (H / 2) * Math.cos(tilt) : y;
  m.position.set(x, baseY, z);
  m.castShadow = shadow;
  /**
   * 影を受けるのは、床と同じ水平面に寝かせた板だけ（敷物）。
   * 立て板が影を受けると、絵の中の凹凸と関係なく縞が乗って汚れる。
   * 寝かせた板は床の続きなので、床と同じように役者の影が落ちないと浮く。
   */
  m.receiveShadow = receive;
  return m;
}

/** テクスチャだけ差し替える（往路 → 復路の見た目の反転に使う） */
export function swapTexture(mesh, texture) {
  mesh.material.map = texture;
  mesh.material.needsUpdate = true;
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      // テクスチャは chromaKey.js のキャッシュが持つので破棄しない
      o.material.dispose();
    }
  });
}
