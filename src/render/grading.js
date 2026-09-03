/**
 * レンダラの設定と色調の統一（設計書 §4.5）
 *
 * AI画像生成は生成ごとに絵柄・彩度・光がズレる。それを実行時に上塗りして
 * 統一するのが目的。共通のライト・共通のフォグ・共通のトーンマッピングを
 * 通すことが、68枚のばらつきに対する最大の防御になる。
 * 2D 実装では画像を1枚ずつ手で調整しなければ得られない効果である。
 */

import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  // r184 で PCFSoftShadowMap は廃止済み
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}
