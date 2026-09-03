/**
 * 空腹の周縁演出（仕様書 §11 / 設計書 §7.1）
 *
 * ★数値は画面に出さない。H は「視界の狭まり」でだけ伝える。
 * ゲージを出すと、プレイヤーは物語ではなく数字を見て判断しはじめる。
 *
 * 段階は5つ（0〜4）。暗さだけでなく**揺れ**を付ける。
 * 暗いだけなら「そういう画作り」に見えてしまい、自分が弱っている感じが出ない。
 * 心拍のような二拍の脈と、ゆっくりした横揺れを重ねる。
 *
 * ★毎フレーム書き換えるのは opacity と transform だけにする。
 * box-shadow や background を毎フレーム書くと画面全体の再描画になる。
 * 段階が変わったときだけ、暗くなり始める半径（--vig-in）を書き換える。
 */

/** 段階ごとの「暗くなり始める半径」と最大の濃さ */
const LEVELS = [
  { inner: '80%', alpha: 0.00 },
  { inner: '58%', alpha: 0.38 },
  { inner: '48%', alpha: 0.54 },
  { inner: '38%', alpha: 0.68 },
  { inner: '28%', alpha: 0.82 },
];

/** 脈の周期（秒）。弱るほど速い */
const PERIOD = [0, 3.4, 2.9, 2.3, 1.7];
/** 揺れの大きさ。0 なら完全に静止 */
const SWAY = [0, 0.10, 0.18, 0.28, 0.40];

/**
 * 心拍の波形。u は 0〜1。
 * 立ち上がりが速く、二拍目が小さく続く形にすると脈に見える。
 */
function beat(u) {
  const first = Math.exp(-13 * u);
  const second = u >= 0.20 ? Math.exp(-13 * (u - 0.20)) * 0.55 : 0;
  return Math.min(1, first + second);
}

export function createVignette(el) {
  let level = 0;
  let shown = 0;      // 実際に出している段階（段階変化をなめらかにする）
  let t = 0;

  function applyLevel(n) {
    el.style.setProperty('--vig-in', LEVELS[n].inner);
  }
  applyLevel(0);

  return {
    /** @param {number} n 0〜4 */
    setLevel(n) {
      level = Math.max(0, Math.min(LEVELS.length - 1, n | 0));
    },

    /** 毎フレーム呼ぶ */
    update(dt) {
      t += dt;

      // 段階の移動は遅らせる。切り替わりが見えると演出ではなく表示になる
      const k = 1 - Math.exp(-dt * 0.9);
      shown += (level - shown) * k;

      // 整数段階の半径は段階が変わったときだけ書く（再描画を避ける）
      const near = Math.round(shown);
      if (near !== applyLevel.last) {
        applyLevel(near);
        applyLevel.last = near;
      }

      const lo = LEVELS[Math.floor(shown)] ?? LEVELS[0];
      const hi = LEVELS[Math.min(LEVELS.length - 1, Math.ceil(shown))] ?? lo;
      const f = shown - Math.floor(shown);
      const alpha = lo.alpha + (hi.alpha - lo.alpha) * f;
      const sway = SWAY[Math.round(shown)] ?? 0;
      const period = PERIOD[Math.round(shown)] || 1;

      const b = sway > 0 ? beat((t % period) / period) : 0;
      // ★脈で濃さを振る。基準を上限より低く取っておかないと、
      //   上限で頭打ちになって脈が消える（実測して 0.82 に下げた）
      el.style.opacity = String(Math.min(0.97, alpha * (1 + sway * 0.7 * b)));

      // ゆっくりした横揺れ。周期をずらして重ねると、規則的に見えない
      const amp = sway * 14;
      const x = amp * Math.sin(t * 0.71);
      const y = amp * 0.6 * Math.sin(t * 0.53 + 1.1);
      const s = 1.03 + sway * 0.02 * b;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    },
  };
}
