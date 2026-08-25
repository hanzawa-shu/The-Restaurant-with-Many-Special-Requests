/**
 * ライティング（設計書 §4.4）
 *
 * 往路と復路の「意味の反転」は、ここで作る。
 * 同じテクスチャ・同じ3Dシーンのまま、プリセットを差し替えるだけで
 * 上品な西洋料理店が下ごしらえの現場に見える。
 *
 * fill（影を落とさない起こし光）は必須。Phase 0 の実測で、
 * 壁は床のちょうど半分の明るさになることが分かっている（設計書 §4.4.1）。
 */

import * as THREE from 'three';

export const PRESET = {
  OUTBOUND: {
    ambient: 0x3a3026, ambientIntensity: 0.8,
    key: 0xffd9a0, keyIntensity: 1.2, keyPos: [4, 8, 3],
    fill: 0x8a7a5c, fillIntensity: 0.75, fillPos: [5, 3, 6],
    fog: { color: 0x2a2218, near: 10, far: 34 },
  },
  /**
   * 復路。明度は往路とほぼ同じにして、色と光の偏りだけを変える。
   *
   * ★キー光の位置は必ず x>0 かつ z>0 に置く。
   * 壁は z=-4.5（法線 +z）と x=-4.5（法線 +x）にあるので、
   * 光をマイナス側に置くと壁の裏を照らすことになり、
   * カメラに向いた面が完全に黒くなる（Phase 2 で実際にそうなった）。
   *
   * ブラウザでピクセルを実測して決めた値:
   *   往路 奥壁[13,7,2] 左壁[15,8,3] 床[14,7,2]
   *   復路 奥壁[13,3,2] 左壁[ 7,2,1] 床[12,2,1]
   * 明るさは保ちつつ赤へ振れ、左壁だけが落ちて非対称になる。
   */
  /**
   * 相方を突き飛ばす／置いていく場面だけの光（フィードバック対応）。
   *
   * 「他の場面と同じ見た目なので臨場感がない」という指摘への対応。
   * 新規アセットは足さず、真上からの硬い白い光ひとつで、
   * 周囲を黒に落として二人だけを切り出す。
   */
  MOMENT: {
    ambient: 0x141820, ambientIntensity: 0.35,
    key: 0xffffff, keyIntensity: 1.7, keyPos: [1.2, 8, 3],
    fill: 0x223044, fillIntensity: 0.18, fillPos: [5, 3, 6],
    fog: { color: 0x07060a, near: 5, far: 15 },
  },
  RETURN: {
    ambient: 0x232a3a, ambientIntensity: 0.75,
    key: 0xff7a55, keyIntensity: 1.1, keyPos: [2, 7, 4],
    fill: 0x4a5a78, fillIntensity: 0.6, fillPos: [5, 3, 6],
    fog: { color: 0x1a1418, near: 14, far: 36 },
  },
};

/**
 * ライトは一度だけ作り、以後は値を書き換える。
 * 毎回 remove/add するとシャドウマップが作り直されて無駄が出る。
 */
export function createLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  // 板ポリは光に対して斜入射になりやすい。bias ではなく normalBias を使う
  key.shadow.normalBias = 0.03;
  scene.add(key);

  // 起こし光。影は落とさない（影が二重になるのを防ぐ）
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(fill);

  return { ambient, key, fill };
}

export function applyPreset(scene, lights, name) {
  const p = PRESET[name] ?? PRESET.OUTBOUND;

  lights.ambient.color.setHex(p.ambient);
  lights.ambient.intensity = p.ambientIntensity;

  lights.key.color.setHex(p.key);
  lights.key.intensity = p.keyIntensity;
  lights.key.position.set(...p.keyPos);

  lights.fill.color.setHex(p.fill);
  lights.fill.intensity = p.fillIntensity;
  lights.fill.position.set(...p.fillPos);

  if (!scene.fog) {
    scene.fog = new THREE.Fog(p.fog.color, p.fog.near, p.fog.far);
  } else {
    scene.fog.color.setHex(p.fog.color);
    scene.fog.near = p.fog.near;
    scene.fog.far = p.fog.far;
  }
  scene.background = new THREE.Color(p.fog.color);
  return p;
}
