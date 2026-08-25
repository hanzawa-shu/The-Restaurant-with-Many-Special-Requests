/**
 * 境目に落ちる接触の影（設計書 §4.6）
 *
 * 山道は「地面板」と「奥に立てた背景板」でできている。
 * 背景板は地面を貫いて立っているので、交わったところに直線が1本できる。
 * これがそのまま見えるので、板の上に絵を立てた構造が分かってしまう。
 *
 * ★アンビエントオクルージョンの後処理は入れない。
 * 板が3枚しかないので遮蔽が出ないうえ、画面空間の陰影を水彩＋線画に掛けると
 * 灰色に濁る。狙いは同じでも、この画作りに合うやり方は
 * 「境目に沿って、片側が濃く反対へ抜ける帯を1枚置く」ことである。
 *
 * 帯は照明を受けない（basic）。場面のライトで濃さが変わると、
 * 暗い場面で影だけが浮いて見える。
 *
 * ★部屋（床↔壁）には入れていない。実機で見て違和感がなかったので、
 * 効果の薄いところに描画を増やさない。必要になったらここを呼ぶだけで足りる。
 */

import * as THREE from 'three';

/** 生成した勾配テクスチャ。濃さごとに1枚だけ作って使い回す */
const cache = new Map();

/**
 * 片側が濃く、反対側へ抜ける勾配。
 * @param {number} alpha 濃い側の不透明度
 */
function gradient(alpha) {
  const key = `g${alpha}`;
  if (cache.has(key)) return cache.get(key);

  // 幅は1でよい（片方向にしか変化しない）
  const cv = document.createElement('canvas');
  cv.width = 1;
  cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, cv.height, 0, 0);
  /**
   * ★直線的に抜くと帯の上端がまた線に見える。
   * 濃い側を急に、薄い側をゆっくり抜くと「溜まった影」に見える。
   */
  g.addColorStop(0.00, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.18, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(0.45, `rgba(0,0,0,${alpha * 0.20})`);
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, cv.width, cv.height);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/**
 * 影の帯を1枚作る。板の「下」が濃い。向きは回転で決める。
 *
 * @param {number} w 帯の長さ
 * @param {number} h 抜けきるまでの幅
 */
export function seamStrip(w, h, {
  x = 0, y = 0, z = 0, ry = 0, tilt = 0, alpha = 0.5,
} = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: gradient(alpha),
      transparent: true,
      // ★深度に書かない。書くと、あとから描く板がこの帯に隠される
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  m.position.set(x, y, z);
  /**
   * ★回転の順番を 'YXZ' にする。
   * 既定の 'XYZ' だと「先に方位、あとで倒す」の順に効くので、
   * 寝かせたい板が斜めの面になる（実機で楔形の影が出た）。
   * 先に倒して水平にし、そのあと方位を向ける。
   */
  m.rotation.order = 'YXZ';
  m.rotation.set(tilt, ry, 0);
  m.renderOrder = 2;      // 地面より後に描く
  m.name = 'seam';
  return m;
}

/**
 * 背景板と地面の交線に影を置く。
 *
 * ★隠すべき線は「地面板の縁」ではなく「背景板と地面の交線」だった。
 * 背景板は地面板を貫いて立っているので、視線方向 dist の位置に
 * カメラに正対した直線が1本できる。板の縁は地面を広げれば画面外へ出る。
 *
 * 交線の**両側**を暗くする。地面の側だけだと、線の向こうが明るい背景板のままで
 * 帯が一本の縞に見える（実機で確認した）。
 * 線をまたいで暗さが連続すると、そこに影が溜まっているように見える。
 *
 * @param {number} dist    原点から視線方向の距離（背景板と同じ値）
 * @param {number} width   帯の長さ。画面幅より広く取る
 * @param {number} azimuth カメラの水平方位
 */
export function addBackdropSeam(group, { dist, width, azimuth, front = 0.2 }) {
  const ax = -Math.sin(azimuth);
  const az = -Math.cos(azimuth);
  const flat = 1.3;   // 手前（地面）へ抜ける幅
  const up = 1.4;     // 立ち上がる高さ

  // 地面の側。寝かせて、濃い側を線へ向ける
  group.add(seamStrip(width, flat, {
    x: ax * (dist - flat / 2), z: az * (dist - flat / 2), y: 0.02,
    tilt: -Math.PI / 2, ry: azimuth, alpha: 0.42,
  }));
  /**
   * 立てる帯。★草の帯の「手前」に置く（front だけカメラ側へ寄せる）。
   *
   * 草の絵は、茎のあいだが薄いクリーム色で塗り込まれている
   * ——透けさせると線が見えてしまうので、絵としてはそれで正しい。
   * ただし明るいままだと横一本の縞に見えるので、影を草より前に出して
   * 根元を沈める。上へ抜けるので穂先は明るいまま残る。
   */
  group.add(seamStrip(width, up, {
    x: ax * (dist - front), z: az * (dist - front), y: up / 2,
    ry: azimuth, alpha: 0.5,
  }));
}
