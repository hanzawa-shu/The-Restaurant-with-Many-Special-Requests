/**
 * 注文の多い料理店 — エントリ
 *
 * ここは配線だけを持つ。
 *   systems/ … ゲームロジック（three を知らない）
 *   scenes/  … 場面 → 何を見せるか の対応表
 *   render/  … Three.js（状態を書き換えない）
 *   ui/      … DOM（選択結果を返すだけ）
 * 依存の向きは一方通行（設計書 §2）。
 */

import * as THREE from 'three';
import { createRenderer } from './render/grading.js';
import {
  createCamera, updateCamera, setShot, snapShot, focusOn, ASPECT,
} from './render/camera.js';
import { createLights, applyPreset } from './render/lighting.js';
import {
  buildRoom, buildMountain, buildFullFrame, buildKeyholeCut, revealEyes, animateCut,
  setActors, hideActors, animateActors,
  walkActors, setStageInstant, setSignText, setExtras, setActorsVisible, anchors,
} from './render/stage.js';
import { initFade, crossFade, setInstant as setFadeInstant } from './ui/fade.js';
import { presentationFor, placeKey, roomChanged } from './scenes/presentation.js';
import { missingAssets } from './render/chromaKey.js';
import { createUI } from './ui/overlay.js';
import { createVignette } from './ui/vignette.js';
import { createTitle } from './ui/title.js';
import { createAudio } from './ui/audio.js';
import { createSettings } from './ui/settings.js';
import { loadProgress, clearProgress, loadVolume, saveVolume } from './systems/save.js';
import { bgmFor, seForScene, DEFAULT_VOLUME } from './data/audio.js';

const el = {
  app: document.getElementById('app'),
  frame: document.getElementById('frame'),
  canvas: document.getElementById('stage'),
  overlay: document.getElementById('overlay'),
  vignette: document.getElementById('vignette'),
  debug: document.getElementById('debug'),
  rotate: document.getElementById('rotate-notice'),
};

// ---------------------------------------------------------------- 3D の土台

const renderer = createRenderer(el.canvas);
const scene = new THREE.Scene();
const camera = createCamera();
const lights = createLights(scene);
applyPreset(scene, lights, 'OUTBOUND');
initFade(el.frame);
const vignette = createVignette(el.vignette);

// ---------------------------------------------------------------- 音

const audio = createAudio(loadVolume(DEFAULT_VOLUME));
const settings = createSettings(el.frame, {
  get: () => audio.getVolume(),
  set(ch, step) { saveVolume(audio.setVolume(ch, step)); },
});

// ---------------------------------------------------------------- 状態の反映

let buildToken = 0;
let prevScene = null;
let prevPlace = null;
let prevRoom = null;
let prevPhase = null;
let prevStep = null;
let prevLook = null;   // 役者の見た目。変わるなら、変わる前にログを読ませる

async function syncStage(state, v, pres) {
  const token = ++buildToken;

  applyPreset(scene, lights, pres.lighting);
  el.canvas.classList.toggle('moment', pres.grade === 'moment');

  /**
   * 鍵穴を覗いたカット。扉と眼玉の2枚を重ねて置き、溶かして入れ替える。
   * ★建て直さないこと。step が eyes → eyes2 に進んでも同じ板を使い続けるので、
   *   溶けている途中で組み直すと切り替わりが飛ぶ（buildKeyholeCut が鍵で弾く）。
   */
  if (pres.keyhole) {
    await buildKeyholeCut(scene);
    if (token !== buildToken) return;
    revealEyes(pres.keyhole.reveal);
    await setExtras(scene, []);
    hideActors();
    return;
  }

  // 結末は、部屋を消して一枚絵を見せる
  if (pres.fullFrame) {
    await buildFullFrame(scene, pres.fullFrame.art);
    if (token !== buildToken) return;
    await setExtras(scene, []);
    hideActors();
    return;
  }

  if (state.phase === 'MOUNTAIN') {
    await buildMountain(scene, state.step);
    if (token !== buildToken) return;
    await setActors(scene, {
      clothing: 0,
      hasGun: state.hasGun,
      partnerPresent: state.partnerPresent,
      visible: pres.actorsVisible,
    });
  } else {
    await buildRoom(scene, state.room, state.phase === 'RETURN' ? 'RETURN' : 'OUTBOUND');
    if (token !== buildToken) return;
    await setActors(scene, {
      clothing: v.stages.clothing,
      hasGun: v.stages.hasGun,
      partnerPresent: state.partnerPresent,
      // 何かに寄っているあいだは役者を出さない。対象の手前を塞ぐため。
      // ★可視判定はここに一本化する。カメラ側だけで消しても、
      //   あとから解決する setActors が上書きしてしまう
      visible: pres.actorsVisible,
    });
  }
  if (token !== buildToken) return;

  await setExtras(scene, pres.extras);
  if (token !== buildToken) return;

  // 看板の文字は毎回焼き直す。板は共有物なので合成は新しい canvas で行う
  // 鍵穴の眼玉は、復路で扉のテクスチャが差し替わることで出る
  setSignText(v.signLines);
}

function syncCamera(state, v, pres) {
  const sceneKey = `${state.phase}:${state.room}:${state.step}:${state.ending ?? ''}`;

  // 「調べる」で対象に寄る。テキストだけ変わって何も起きないのを避ける
  if (pres.shot === 'FOCUS') {
    const m = anchors.props.find((p) => p.name === pres.focusPath);
    if (m) {
      // 板の寸法をそのまま渡す。距離は camera.js が画角から逆算する
      focusOn(m.position, m.geometry.parameters.width, m.geometry.parameters.height);
      prevScene = sceneKey;
      return;
    }
  }

  // 相方を捨てるかどうかの場面は、相方に寄る
  if (pres.shot === 'PARTNER' && anchors.partner) {
    const g = anchors.partner.geometry.parameters;
    focusOn(anchors.partner.position, g.width, g.height);
    prevScene = sceneKey;
    return;
  }

  const shot = pres.shot === 'CLOSE' ? 'CLOSE' : 'WIDE';
  if (sceneKey !== prevScene) {
    // 場面が変わったら補間しない。またいで滑ると嘘になる
    snapShot(camera, shot);
    prevScene = sceneKey;
  } else {
    setShot(shot);
  }
}

/** 暗転の前に対象へ寄る。rAF が止まる隠しタブでも先へ進めるよう時間で切る */
function zoomInto(name) {
  const target = anchors[name];
  if (!target) return Promise.resolve();
  // 鍵穴だけを見る。小さく渡すほど強く寄る
  focusOn(target.position, 0.5, 0.5);
  if (instant) return Promise.resolve();
  return new Promise((r) => setTimeout(r, 900));
}

let instant = false;

/**
 * onState は「見せ終わるまでの Promise」を返す。
 * 呼び出し側（overlay）はこれを待ってから文字送りを始める。
 */
const ui = createUI(el.overlay, {
  /** 結末画面の「タイトルへ」 */
  onTitle() { showTitle(); },

  /** 選択肢を押したとき。何の音を鳴らすかは data/audio.js が決めている */
  onChoice(se) { if (se) audio.playSe(se); },

  /**
   * 読み終えたテキスト枠を押したとき。
   * ★寄りを解くのは「次の選択肢を押したとき」ではなく「読み終えたとき」。
   * 読み終わっているのに画面が対象に張りついたままだと、進行が止まって見える。
   */
  onFocusEnd() {
    setShot('WIDE');
    setActorsVisible(true);
  },

  /**
   * @param {Function} holdForLog 場面を変える前にログを読ませて待つ（ui/overlay.js）
   */
  onState(state, v, holdForLog) {
    const pres = presentationFor(state, v);
    vignette.setLevel(v.stages.hunger);

    /**
     * 音。★鳴らすものの判断は data/audio.js（純粋関数）が持つ。
     * ここは「場面が変わったから鳴らす」という配線だけを持つ。
     */
    audio.playBgm(bgmFor(state));
    /**
     * 鼓動。★周縁の脈（ui/vignette.js）と同じ段階で入り切りする。
     * 音と絵が別の理由で動くと、どちらも「何かの演出」に見えて意味が薄れる。
     */
    if (v.stages.hunger >= 3) audio.playSe('heartbeat', { loop: true });
    else audio.stopSe('heartbeat');
    if (state.step !== prevStep) {
      const se = seForScene(state.step);
      if (se) audio.playSe(se);
      prevStep = state.step;
    }

    const place = placeKey(state);
    const moved = prevPlace !== null && place !== prevPlace;
    const walked = roomChanged(state, prevRoom, prevPhase);

    prevPlace = place;
    prevRoom = state.room;
    prevPhase = state.phase;

    /**
     * ★見た目が変わる前にログを読ませる（設計書 §11.1.9）。
     *
     * ログは「いま起きたこと」なので、それを引き起こした場面のまま読ませないと
     * 順序が入れ替わる。実際に2箇所で入れ替わっていた。
     *   ・犬を埋めた話が、山猫軒を見つけた場面で流れる
     *   ・服を脱いだ話が、すでに脱いだ姿の上で流れる
     *
     * カメラは待たせない。「調べる」は寄ってから読むのが正しい順序である。
     */
    const look = `${v.stages.clothing}/${v.stages.hasGun}/${state.partnerPresent}`;
    const looksChanged = prevLook !== null && look !== prevLook;
    prevLook = look;

    if (!moved) {
      // カメラは即座に動かし、板の建て替えは待てるように Promise を返す
      syncCamera(state, v, pres);
      if (!looksChanged) return syncStage(state, v, pres);
      return (async () => {
        await holdForLog();
        await syncStage(state, v, pres);
      })();
    }

    return (async () => {
      await holdForLog();
      // ★暗転の前に対象へ寄る。寄る先は「まだ建っている前の部屋」の板なので、
      //   syncStage より先に動かさないと消えてしまう
      if (pres.preZoom) await zoomInto(pres.preZoom);
      else if (walked) await walkActors(state.phase === 'RETURN' ? 'OUT' : 'IN');
      // 扉の音は暗転に重ねる。部屋が変わったときだけ（場面では決まらない）
      if (walked || (prevRoom === null && state.phase !== 'MOUNTAIN')) audio.playSe('door');
      // ★建て替えとカメラのスナップは必ず真っ黒のあいだに終える。
      // 明転後にスナップすると、そこで画面が飛ぶ
      await crossFade(async () => {
        await syncStage(state, v, pres);
        syncCamera(state, v, pres);
      });
    })();
  },
}, { defer: true });   // 先にタイトル画面を見せる

// ---------------------------------------------------------------- タイトル

/**
 * タイトルの背景は山道の最後のカット（山猫軒の発見）を使い回す。
 * 「どなたもどうかお入りください」の札が立っている画がそのまま扉になる。
 */
async function showTitle() {
  el.overlay.classList.add('hidden');
  vignette.setLevel(0);
  audio.playBgm(bgmFor(null));
  audio.stopSe('heartbeat');
  prevStep = null;
  prevLook = null;
  await crossFade(async () => {
    /**
     * ★照明と彩度を往路に戻す。
     * 結末は復路の赤い光で終わるので、戻さないとタイトルが赤いままになる
     * （実際にそうなった）。タイトルは「まだ何も起きていない」画でなければならない。
     */
    applyPreset(scene, lights, 'OUTBOUND');
    el.canvas.classList.remove('moment');
    await buildMountain(scene, 'm3');
    await setActors(scene, {
      clothing: 0, hasGun: true, partnerPresent: true, visible: false,
    });
    setSignText(['どなたもどうかお入りください', '決してご遠慮はありません']);
    snapShot(camera, 'WIDE');
  });
  // ★次に始まる場面が必ず暗転を挟むように、場所を「タイトル」として覚えておく。
  //   ここを空にしておくと、タイトルから山道へ画面が飛ぶ
  prevPlace = 'TITLE';
  prevRoom = null;
  prevPhase = null;
  prevScene = null;
  title.show(ui.getProgress());
}

const title = createTitle(el.frame, {
  onStart() {
    // ★ここが音の解禁点。ブラウザは利用者の操作なしに音を鳴らせない
    audio.unlock();
    audio.playSe('door');
    title.hide();
    el.overlay.classList.remove('hidden');
    ui.begin();
  },
  onClear() {
    clearProgress();
    ui.reloadProgress();
    return loadProgress();
  },
});

// ---------------------------------------------------------------- 画面

function resize() {
  const w = el.frame.clientWidth;
  const h = el.frame.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = ASPECT;   // 枠が常に16:9なので固定
  camera.updateProjectionMatrix();
}

/** 縦持ちの案内を出しておく時間 */
const ROTATE_NOTICE_MS = 3800;

let portraitNow = null;
let rotateTimer = 0;

/**
 * 縦持ちなら案内を数秒だけ出す。★止めない。
 *
 * アイソメのジオラマは縦構図では成立しない（設計書 §8）ので横向きを薦めるが、
 * iOS の向きロック中は端末を倒しても縦のままになる。プレイヤーに外す手立てが
 * ないものを通行止めにしてはいけない。薦めるだけにして、あとは通す。
 *
 * resize は URL バーの伸縮などでも何度も来る。向きが変わった瞬間だけ出す。
 */
function checkOrientation() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const portrait = coarse && window.innerHeight > window.innerWidth;
  if (portrait === portraitNow) return;
  portraitNow = portrait;

  clearTimeout(rotateTimer);
  el.rotate.classList.toggle('shown', portrait);
  if (portrait) {
    rotateTimer = setTimeout(() => el.rotate.classList.remove('shown'), ROTATE_NOTICE_MS);
  }
}

// ---------------------------------------------------------------- ループ

const clock = new THREE.Clock();
let frames = 0;
let fps = 0;
let lastFpsAt = performance.now();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  updateCamera(camera, dt);
  animateActors(clock.elapsedTime);
  animateCut(dt);
  vignette.update(dt);
  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now - lastFpsAt >= 500) {
    fps = Math.round((frames * 1000) / (now - lastFpsAt));
    frames = 0;
    lastFpsAt = now;
    updateDebug();
  }
  requestAnimationFrame(tick);
}

function updateDebug() {
  if (!el.debug) return;
  el.debug.textContent =
    `three r${THREE.REVISION}  ${el.frame.clientWidth}x${el.frame.clientHeight}  ` +
    `${fps}fps  未生成 ${missingAssets().length}枚`;
}

// ---------------------------------------------------------------- 起動

window.addEventListener('resize', () => { resize(); checkOrientation(); });
window.addEventListener('orientationchange', () => { resize(); checkOrientation(); });

resize();
checkOrientation();
updateDebug();
requestAnimationFrame(tick);
showTitle();

// 開発用。ブラウザから状態を覗いて調整するため
window.__demo8 = {
  THREE, renderer, scene, camera, lights, ui, anchors,
  missingAssets, resize,
  // カメラ補間は rAF で回している。隠しタブでは rAF が止まるので、
  // 検証時はこれを直接叩いて進める
  updateCamera, setShot, snapShot, animateActors,
  focusOn, walkActors, presentationFor, vignette, title, showTitle, audio, settings,
  /** 自動検証用。フェードと文字送りを即時化する */
  setInstant(v) { instant = v; setFadeInstant(v); setStageInstant(v); ui.setInstant(v); },
};
