/**
 * 音の再生（設計書 §13）
 *
 * ★どの場面で何が鳴るかは `data/audio.js`（純粋関数）が決める。
 * ここが持つのは「どう鳴らすか」だけ。依存の向きは他と同じ一方通行。
 *
 * 実装をBGMとSEで分けてある。理由は容量。
 *   BGM … `<audio>` で流す。6曲を WebAudio でデコードすると 300MB 級になる
 *   SE  … WebAudio。短いので展開しても軽く、重ねて鳴らせて遅れない
 *
 * ★音は利用者の操作なしに鳴らせない（ブラウザの制限）。
 * タイトルの「店に入る」を解禁点にする。ちょうど良い位置にボタンがある。
 *
 * ★音源が無くても遊べること。画像と同じで、無ければ黙るだけにする。
 */

import { BGM, SE, SE_OPTIONAL, seFile, VOLUME_STEPS, clampStep } from '../data/audio.js';

const FADE_MS = 1100;      // 曲の入れ替わり
const SE_ALL = { ...SE, ...SE_OPTIONAL };

export function createAudio(volume) {
  let vol = { bgm: clampStep(volume?.bgm ?? 2), se: clampStep(volume?.se ?? 3) };
  let unlocked = false;
  let curId = null;

  // --- BGM。2つ持って交互に使う（片方を絞りながら、もう片方を上げる）
  const players = [makePlayer(), makePlayer()];
  let active = 0;

  function makePlayer() {
    const el = document.createElement('audio');
    el.loop = true;
    el.preload = 'none';
    el.volume = 0;
    return { el, fade: 0, want: 0 };
  }

  function bgmLevel() { return VOLUME_STEPS[vol.bgm]; }
  function seLevel() { return VOLUME_STEPS[vol.se]; }

  /**
   * 音量を時間で寄せる。
   *
   * ★描画のループ（requestAnimationFrame）に乗せない。
   * rAF はタブが背面に回ると止まるので、切り替えの途中で音量が固まる。
   * ——実際に、背面のタブでは曲が 0.03 のまま上がらなかった。
   * 時計から差分を取って自分で回す（設計書 §11.2 と同じ考え方）。
   */
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.5);
    last = now;
    for (const p of players) {
      if (p.fade === p.want) continue;
      const step = (dt * 1000) / FADE_MS;
      p.fade = p.want > p.fade
        ? Math.min(p.want, p.fade + step)
        : Math.max(p.want, p.fade - step);
      p.el.volume = Math.max(0, Math.min(1, p.fade * bgmLevel()));
      // 絞りきったら止める。鳴らしっぱなしにすると次の再生で頭から出ない
      if (p.fade === 0 && !p.el.paused) p.el.pause();
    }
  }, 50);

  /**
   * 曲を切り替える。
   * ★同じ曲なら何もしない。往路の5室で切れると台無しになる。
   */
  function playBgm(id) {
    if (id === curId) return;
    curId = id;
    const track = BGM[id];
    if (!track) return;

    const next = players[active ^ 1];
    const prev = players[active];
    prev.want = 0;

    next.el.src = encodeURI(track.file);   // ファイル名が日本語なので必須
    next.fade = 0;
    next.el.volume = 0;
    next.want = 1;
    active ^= 1;
    if (unlocked) next.el.play().catch(() => { /* 音源が無い／まだ鳴らせない */ });
  }

  // --- SE。WebAudio で鳴らす
  let ctx = null;
  const buffers = new Map();   // id -> AudioBuffer | null（null は「無い」）
  const loops = new Map();     // id -> source（鳴らし続けているもの）

  async function buffer(id) {
    if (buffers.has(id)) return buffers.get(id);
    const p = (async () => {
      try {
        const res = await fetch(seFile(id));
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        return null;       // 無ければ黙る
      }
    })();
    buffers.set(id, p);
    return p;
  }

  async function playSe(id, { loop = false } = {}) {
    const def = SE_ALL[id];
    if (!def || !unlocked || !ctx || seLevel() === 0) return;
    if (loop && loops.has(id)) return;

    const buf = await buffer(id);
    if (!buf) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = ctx.createGain();
    /**
     * ★素材ごとの音量差をここで吸収する。
     * 無料素材は音量が揃っていない（実測で RMS に 20dB の開きがあった）。
     * 波形を書き換えず、鳴らすときに掛ける。素材を差し替えても
     * data/audio.js の gain を直すだけで済む。
     */
    g.gain.value = (def.gain ?? 1) * seLevel();
    src.connect(g).connect(ctx.destination);
    // 頭に無音がある素材は、そこを飛ばして鳴らす（押した瞬間に遅れて聞こえる）
    src.start(0, def.offset ?? 0);
    if (loop) loops.set(id, src);
  }

  function stopSe(id) {
    const src = loops.get(id);
    if (!src) return;
    try { src.stop(); } catch { /* すでに止まっている */ }
    loops.delete(id);
  }

  /** 利用者が最初に押したとき。ここで初めて音が出せるようになる */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
      ctx?.resume?.();
    } catch { ctx = null; }
    const p = players[active];
    if (p.el.src) p.el.play().catch(() => {});
  }

  return {
    unlock,
    /** 自動検証用。鳴っているものを覗く */
    debug: () => ({
      unlocked,
      curId,
      ctx: ctx ? ctx.state : null,
      players: players.map((p) => ({
        src: p.el.src ? decodeURI(p.el.src).split('/').pop() : null,
        paused: p.el.paused,
        vol: +p.el.volume.toFixed(3),
        fade: +p.fade.toFixed(2),
        err: p.el.error ? p.el.error.code : null,
      })),
      se: [...buffers.keys()],
    }),
    playBgm,
    playSe,
    stopSe,
    getVolume: () => ({ ...vol }),
    /** @param {'bgm'|'se'} ch @param {number} step 0〜4 */
    setVolume(ch, step) {
      vol = { ...vol, [ch]: clampStep(step) };
      for (const p of players) {
        p.el.volume = Math.max(0, Math.min(1, p.fade * bgmLevel()));
        /**
         * ★消音にしたら止める。音量0で流し続けても意味がなく、
         * 通信と電池を使うだけ。戻したときは同じところから再開する。
         */
        if (bgmLevel() === 0) { if (!p.el.paused) p.el.pause(); }
        else if (unlocked && p.want > 0 && p.el.paused) p.el.play().catch(() => {});
      }
      if (ch === 'se' && seLevel() === 0) for (const id of [...loops.keys()]) stopSe(id);
      return { ...vol };
    },
  };
}
