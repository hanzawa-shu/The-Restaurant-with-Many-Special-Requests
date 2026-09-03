/**
 * 場面 → 何を見せるか の対応表（Phase 4）
 *
 * ★進行のロジックは systems/game.js（リデューサ）が持つ。ここは持たない。
 * ここが持つのは「その場面でどう見せるか」だけ。
 *
 * main.js に散らばらせると、場面が増えるたびに if が積み上がって読めなくなる。
 * 表にしておけば、新しい場面の見せ方を1行足すだけで済む。
 */

/** カメラが寄る場面。画面が寄る＝重要な選択が来た、という文法 */
const CLOSE_STEPS = new Set([
  'o_judge', 'o_hide', 'o_reward',
  'reveal',
  'r_fire', 'r_partner', 'caught', 'r_final',
]);

/** 相方を捨てるかどうかを決める場面。照明・彩度・カメラをまとめて変える */
const MOMENT_STEPS = new Set(['caught', 'r_partner']);

/**
 * その場面だけに出す板。
 * 部屋ではなく step に紐づくので、部屋のレイアウトとは別に持つ。
 */
const EXTRA_PROPS = {
  // 山道カット1。まだ生きている犬
  m1: [
    { tex: 'characters/dog/alive.png', kind: 'dog', x: -3.5, z: -0.5, w: 2.8, h: 1.9 },
  ],
  /**
   * 玄関で扉を突き破って飛び込んでくる犬。
   * ★役者に重ねない。扉（x=-1.2）から入ってくるが、そのまま扉の前に置くと
   * 主人公（x=-0.45）と完全に重なる。左手前へ抜けた瞬間として置く。
   */
  r_final: [
    { tex: 'characters/dog/charging.png', kind: 'dog', x: -2.75, z: -1.5, w: 2.8, h: 1.7 },
  ],
};

/** 結末の一枚絵。背景板として立てる */
const ENDING_ART = {
  COOKED: 'endings/cooked.png',
  TOGETHER: 'endings/together.png',
  ALONE: 'endings/alone.png',
  ORIGINAL: 'endings/original.png',
  TRUE: 'endings/true.png',
};

/**
 * 鍵穴を覗いたカット。2つの step でひとつの流れを作る。
 *
 *   eyes   扉の一枚絵。かぎ穴は黒く、まだ何もいない
 *   eyes2  扉が溶けて、その黒からそのまま眼玉が現れる
 *
 * ★扉の絵に眼玉の板を重ねて座標を合わせる案は捨てた。
 *   かぎ穴の位置は生成された絵ごとに動くので、決め打ちすると必ずずれる。
 *   同じ画角の2枚をクロスディゾルブすれば、位置合わせが要らない。
 *   かぎ穴の黒と眼玉の背景の黒が同じなので、そこが眼になったように見える。
 */
const EYES_STEPS = new Set(['eyes', 'eyes2']);

/**
 * @returns {{
 *   lighting: 'OUTBOUND'|'RETURN'|'MOMENT',
 *   grade: 'moment'|null,
 *   shot: 'WIDE'|'CLOSE'|'FOCUS'|'PARTNER',
 *   focusPath: string|null,
 *   actorsVisible: boolean,
 *   fullFrame: {art: string}|null,
 *   keyhole: {reveal: boolean}|null,
 *   preZoom: string|null,
 *   extras: Array<object>,
 * }}
 */
export function presentationFor(state, v) {
  const step = state.step;
  const ending = state.phase === 'ENDING';
  const inReturn = state.phase === 'RETURN' || ending;
  const moment = MOMENT_STEPS.has(step);

  // 覗いた瞬間だけ、部屋を消して一枚絵にする（扉→眼玉の2段）
  const eyes = EYES_STEPS.has(step);
  // 覗いた直後の厨房前は、扉が閉じたことが主役なので寄せたままにする
  const afterEyes = state.phase === 'RETURN' && state.room === 6;

  let shot = 'WIDE';
  if (v.focus) shot = 'FOCUS';
  else if (moment) shot = 'PARTNER';
  else if (CLOSE_STEPS.has(step) || afterEyes) shot = 'CLOSE';

  return {
    // 眼玉の一枚絵は照明を受けない板なので、プリセットは何でもよい。
    // ただし暗い側に寄せておくと明転の落差が小さくて済む
    lighting: moment ? 'MOMENT' : (inReturn || eyes ? 'RETURN' : 'OUTBOUND'),
    grade: moment ? 'moment' : null,
    shot,
    focusPath: v.focus ?? null,
    // 何かに寄っているあいだは役者を出さない（対象の手前を塞ぐため）
    actorsVisible: !ending && !eyes && !v.focus,
    fullFrame: ending && ENDING_ART[state.ending]
      ? { art: ENDING_ART[state.ending] }
      : null,
    // 鍵穴のカット。2枚を重ねて置き、reveal で扉を溶かして眼玉に入れ替える
    keyhole: eyes ? { reveal: step === 'eyes2' } : null,
    // 暗転の前にここへ寄る。寄る対象は「移動前の部屋」に建っている板なので、
    // 建て替えより先に動かさないと間に合わない
    preZoom: step === 'eyes' ? 'keyhole' : null,
    extras: EXTRA_PROPS[step] ?? [],
  };
}

/** 場所が変わったかどうか。暗転を掛けるかの判定に使う */
export function placeKey(state) {
  if (state.phase === 'MOUNTAIN') return `M:${state.step}`;
  if (state.phase === 'ENDING') return `E:${state.ending}`;
  // ★扉と眼玉は同じ「場所」にする。ここで場所が変わると暗転が挟まり、
  //   溶けて入れ替わるのが見えなくなる
  if (EYES_STEPS.has(state.step)) return 'EYES';   // 一枚絵。部屋ではない
  return `${state.phase}:${state.room}`;
}

/** 部屋そのものが変わったか。歩かせるかの判定に使う */
export function roomChanged(state, prevRoom, prevPhase) {
  const inShop = (ph) => ph === 'OUTBOUND' || ph === 'REVEAL' || ph === 'RETURN';
  return prevRoom !== null && state.room !== prevRoom
    && inShop(state.phase) && inShop(prevPhase);
}
