/**
 * アセットが未生成の間に使う仮テクスチャ。
 *
 * 68枚のうち1枚も存在しない状態から Phase 2〜4 を進めるために必要。
 * 「何が足りないか」が画面で分かるよう、ファイル名を描き込む。
 * 実物が assets/ に置かれた瞬間、ローダーが自動でそちらを使う。
 */

const CACHE = new Map();

const INK = '#e8dfcd';
const DIM = 'rgba(232,223,205,0.35)';

/** 種類ごとに見た目を変える。板の役割が一目で分かるようにする */
export function makePlaceholder(path, kind = 'prop') {
  const key = `${kind}:${path}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const cv = document.createElement('canvas');
  const c = cv.getContext('2d');

  switch (kind) {
    case 'floor':  drawFloor(cv, c);  break;
    case 'wall':   drawWall(cv, c);   break;
    case 'actor':  drawActor(cv, c);  break;
    case 'sign':     drawSign(cv, c);     break;
    case 'backdrop': drawBackdrop(cv, c); break;
    case 'eyes':     drawEyes(cv, c);     break;
    case 'dog':      drawDogs(cv, c, path); break;
    case 'face':     drawFace(cv, c);     break;
    case 'scene':    drawScene(cv, c, path); break;
    default:       drawProp(cv, c);   break;
  }

  if (!['floor', 'wall', 'backdrop', 'eyes', 'dog', 'face', 'scene'].includes(kind)) label(cv, c, path);
  CACHE.set(key, cv);
  return cv;
}

function drawFloor(cv, c) {
  cv.width = cv.height = 256;
  c.fillStyle = '#6b5a45';
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(0,0,0,0.22)';
  c.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
    c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
  }
}

function drawWall(cv, c) {
  cv.width = 256; cv.height = 256;
  // 壁は床より明るく（キー光が上から来るので、同じ明度だと黒く沈む）
  c.fillStyle = '#a89078';
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.fillRect(0, 176, 256, 80);          // 腰板
  c.strokeStyle = 'rgba(0,0,0,0.14)';
  c.lineWidth = 2;
  for (let x = 16; x < 256; x += 48) {
    c.beginPath(); c.moveTo(x, 176); c.lineTo(x, 256); c.stroke();
  }
}

function drawActor(cv, c) {
  cv.width = 256; cv.height = 512;
  c.clearRect(0, 0, 256, 512);
  c.fillStyle = INK;
  c.beginPath(); c.arc(128, 92, 46, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(128, 138);
  c.bezierCurveTo(196, 168, 200, 300, 178, 372);
  c.lineTo(78, 372);
  c.bezierCurveTo(56, 300, 60, 168, 128, 138);
  c.fill();
  // 脚の隙間。影が「絵の形」に落ちているかの検証点になる
  c.fillRect(94, 372, 26, 138);
  c.fillRect(136, 372, 26, 138);
}

function drawSign(cv, c) {
  cv.width = 384; cv.height = 512;
  c.clearRect(0, 0, 384, 512);
  c.fillStyle = '#8a6f4a';
  roundRect(c, 24, 24, 336, 464, 10); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 6;
  roundRect(c, 44, 44, 296, 424, 6); c.stroke();
}

/** 山道の背景。壁と区別できるよう、空と地平のある情景として描く */
function drawBackdrop(cv, c) {
  cv.width = 1024; cv.height = 512;
  const sky = c.createLinearGradient(0, 0, 0, 320);
  sky.addColorStop(0, '#7c7f6a');
  sky.addColorStop(1, '#b9ab84');
  c.fillStyle = sky;
  c.fillRect(0, 0, 1024, 320);
  c.fillStyle = '#5f5а3f'.replace('а', 'a');
  c.beginPath();
  c.moveTo(0, 320);
  for (let x = 0; x <= 1024; x += 128) {
    c.lineTo(x, 300 - Math.sin(x / 150) * 46);
  }
  c.lineTo(1024, 512); c.lineTo(0, 512);
  c.fill();
  c.fillStyle = '#6e6146';
  c.fillRect(0, 400, 1024, 112);
}

function drawProp(cv, c) {
  cv.width = 256; cv.height = 256;
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(232,223,205,0.72)';
  roundRect(c, 40, 40, 176, 216, 12); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 4;
  roundRect(c, 40, 40, 176, 216, 12); c.stroke();
}

/**
 * 白熊のような犬が二疋（原文準拠）。倒れている姿。
 * ★一疋だけだと原作と食い違う。首輪の笛も描く。
 */
function drawDogs(cv, c, path = '') {
  // 同じ 'dog' でも姿勢が違う。倒れた姿で「生きている」を描いてはいけない
  const pose = /alive/.test(path) ? 'stand' : /charging/.test(path) ? 'leap' : 'fallen';
  cv.width = 512; cv.height = pose === 'fallen' ? 256 : 320;
  c.clearRect(0, 0, cv.width, cv.height);

  if (pose !== 'fallen') { drawUprightDogs(c, cv, pose); return; }

  const dog = (ox, oy, flip) => {
    c.save();
    c.translate(ox, oy);
    if (flip) c.scale(-1, 1);
    c.fillStyle = '#e8dfcd';
    // 胴
    c.beginPath();
    c.ellipse(0, 0, 92, 42, -0.06, 0, Math.PI * 2);
    c.fill();
    // 頭（横倒し）
    c.beginPath();
    c.ellipse(-96, 14, 40, 31, -0.25, 0, Math.PI * 2);
    c.fill();
    // 鼻先
    c.beginPath();
    c.ellipse(-132, 24, 17, 13, -0.3, 0, Math.PI * 2);
    c.fill();
    // 投げ出した脚
    c.fillStyle = '#ded4bf';
    for (const [x, y, w, h] of [[-28, 34, 17, 46], [16, 36, 17, 42], [56, 30, 15, 38]]) {
      c.save(); c.translate(x, y); c.rotate(0.32);
      c.fillRect(-w / 2, 0, w, h); c.restore();
    }
    // 尾
    c.strokeStyle = '#ded4bf'; c.lineWidth = 13; c.lineCap = 'round';
    c.beginPath(); c.moveTo(86, 6); c.quadraticCurveTo(126, -6, 138, 22); c.stroke();
    // 首輪と銀の笛
    c.strokeStyle = '#8a6f4a'; c.lineWidth = 8;
    c.beginPath(); c.arc(-72, 12, 30, -0.5, 1.5); c.stroke();
    c.fillStyle = '#cfd6dd';
    c.beginPath(); c.ellipse(-62, 44, 8, 14, 0.4, 0, Math.PI * 2); c.fill();
    c.restore();
  };
  dog(178, 96, false);
  dog(352, 176, true);
}

/** 立っている／飛びかかっている犬。倒れた姿とは別に描く */
function drawUprightDogs(c, cv, pose) {
  const leap = pose === 'leap';
  const one = (ox, oy, scale) => {
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    if (leap) c.rotate(-0.28);
    c.fillStyle = '#e8dfcd';
    // 胴
    c.beginPath(); c.ellipse(0, 0, 86, 40, 0, 0, Math.PI * 2); c.fill();
    // 首と頭
    c.beginPath(); c.ellipse(-84, leap ? -26 : -34, 26, 22, -0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-108, leap ? -44 : -58, 34, 28, -0.35, 0, Math.PI * 2); c.fill();
    // 鼻先
    c.beginPath(); c.ellipse(-142, leap ? -50 : -62, 16, 12, -0.3, 0, Math.PI * 2); c.fill();
    // 耳
    c.beginPath(); c.moveTo(-104, -84); c.lineTo(-88, -116); c.lineTo(-76, -80); c.fill();
    // 脚
    c.fillStyle = '#ded4bf';
    const legs = leap
      ? [[-52, 30, -0.9], [-18, 34, -0.5], [34, 30, 0.7], [64, 26, 1.0]]
      : [[-52, 34, 0.02], [-18, 36, -0.02], [34, 36, 0.02], [64, 34, -0.02]];
    for (const [x, y, r] of legs) {
      c.save(); c.translate(x, y); c.rotate(r);
      c.fillRect(-8, 0, 16, 56); c.restore();
    }
    // 尾
    c.strokeStyle = '#ded4bf'; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.moveTo(82, -6);
    c.quadraticCurveTo(126, leap ? 18 : -34, 140, leap ? 40 : -56);
    c.stroke();
    // 首輪と銀の笛
    c.strokeStyle = '#8a6f4a'; c.lineWidth = 8;
    c.beginPath(); c.arc(-86, -30, 24, 0.2, 2.4); c.stroke();
    c.fillStyle = '#cfd6dd';
    c.beginPath(); c.ellipse(-98, -4, 7, 12, 0.2, 0, Math.PI * 2); c.fill();
    // 飛びかかる姿は口を開く
    if (leap) {
      c.fillStyle = '#3a1f1c';
      c.beginPath(); c.ellipse(-134, -34, 18, 9, -0.35, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };
  one(190, cv.height - 78, 1.0);
  one(360, cv.height - 62, 0.86);
}

/**
 * 結末の一枚絵。風景の仮テクスチャを使うと内容を誤解させるので、
 * 「ここに一枚絵が入る」ことだけを示す。
 */
function drawScene(cv, c, path) {
  cv.width = 1024; cv.height = 576;
  c.fillStyle = '#14100e';
  c.fillRect(0, 0, 1024, 576);
  c.strokeStyle = 'rgba(232,223,205,0.22)';
  c.lineWidth = 3;
  c.strokeRect(40, 40, 944, 496);
  c.fillStyle = 'rgba(232,223,205,0.30)';
  c.textAlign = 'center';
  c.font = '600 30px ui-monospace, monospace';
  c.fillText(path.split('/').pop().replace('.png', ''), 512, 286);
  c.font = '400 20px "Hiragino Mincho ProN", serif';
  c.fillText('結末の一枚絵（未生成）', 512, 330);
}

/** 相方の顔。肖像枠に出すので、頭と肩だけ描く */
function drawFace(cv, c) {
  cv.width = cv.height = 256;
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = '#e8dfcd';
  // 肩
  c.beginPath();
  c.moveTo(24, 256);
  c.bezierCurveTo(40, 196, 96, 176, 128, 176);
  c.bezierCurveTo(160, 176, 216, 196, 232, 256);
  c.fill();
  // 頭
  c.beginPath(); c.ellipse(128, 112, 62, 74, 0, 0, Math.PI * 2); c.fill();
  // 眼鏡（相方の特徴）
  c.strokeStyle = 'rgba(60,44,30,0.75)'; c.lineWidth = 6;
  c.beginPath(); c.arc(104, 108, 20, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(152, 108, 20, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(124, 108); c.lineTo(132, 108); c.stroke();
}

/**
 * 鍵穴からこちらを覗く二つの青い眼玉（原文準拠）。
 * 本作で最も重要な1カット。実物のアセットが来るまでの仮。
 */
function drawEyes(cv, c) {
  cv.width = 256; cv.height = 128;
  c.clearRect(0, 0, 256, 128);
  for (const x of [88, 168]) {
    const g = c.createRadialGradient(x, 64, 2, x, 64, 30);
    g.addColorStop(0, '#dff4ff');
    g.addColorStop(0.35, '#4ec3ff');
    g.addColorStop(1, 'rgba(20,60,90,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, 64, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#07131c';
    c.beginPath(); c.ellipse(x, 64, 4, 13, 0, 0, Math.PI * 2); c.fill();
  }
}

function label(cv, c, path) {
  const name = path.split('/').pop().replace('.png', '');
  c.font = '600 20px ui-monospace, monospace';
  c.textAlign = 'center';
  c.fillStyle = DIM;
  c.fillText(name.slice(0, 22), cv.width / 2, cv.height - 14);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
