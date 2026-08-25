/**
 * 音の唯一の出典（single source of truth）
 *
 * ★docs/音源集.md は、このファイルから `npm run gen:docs` で生成する。手で書かない。
 * 画像（assets.js）と同じ扱い。散文と実装を二重管理すると必ずずれる。
 *
 * 方針は3つ。
 *
 * 1. **曲は増やさず、使い回して意味を変える。**
 *    同じサロンワルツが、往路では「上等な料理店の音楽」に、
 *    調理の結末では「客のために鳴り続けている音楽」に聞こえる。
 *    曲を足すより、同じ曲が別の意味になるほうが効く。
 *
 * 2. **効果音は「その音がないと何が起きたか分からない」ものだけ。**
 *    足すほど画面は賑やかになるが、静けさが失われる。
 *    本作は止まった絵と文章で見せているので、静けさは資産である。
 *
 * 3. **鳴らす判断はここ（純粋関数）に置く。** 再生の都合は render/ui 側に置く。
 *    どの場面で何が鳴るかはテストで検証できる状態にしておく。
 */

// ------------------------------------------------------------------ BGM

/**
 * 6曲。ファイル名は生成時のまま（日本語）。
 * ★読み込むときは encodeURI を通すこと。
 */
export const BGM = {
  forest: {
    file: 'assets/BGM/不気味な森の風音.mp3',
    label: '不気味な森の風音',
    use: 'タイトル画面／山道 M1〜M3。まだ何も起きていないが、もう普通ではない',
  },
  salon: {
    file: 'assets/BGM/大正風サロンワルツ.mp3',
    label: '大正風サロンワルツ',
    use: '往路 O1〜O5。上等な西洋料理店の顔。'
       + '★結末1（調理）でも同じ曲を鳴らす——客のための音楽が鳴ったまま調理される',
  },
  drone: {
    file: 'assets/BGM/絶望の金属ドローン.mp3',
    label: '絶望の金属ドローン',
    use: '反転 V6／鍵穴 V6e・V6f／相方を捨てる2場面／結末2（共倒れ）。'
       + '旋律を止めることで「音楽が終わった」ことを伝える',
  },
  dark: {
    file: 'assets/BGM/狂気の暗黒ワルツ.mp3',
    label: '狂気の暗黒ワルツ',
    use: '復路 R6〜R1。同じ三拍子が歪んで戻ってくる',
  },
  solo: {
    file: 'assets/BGM/孤独なソロワルツ.mp3',
    label: '孤独なソロワルツ',
    use: '結末3（独り）。相方を失った側の三拍子',
  },
  dawn: {
    file: 'assets/BGM/夜明けの弦楽.mp3',
    label: '夜明けの弦楽',
    use: '結末4（原作）／結末5（TrueEnd）。生還した二人。'
       + '往路のワルツの遠い親戚にしてある——三拍子が崩れて戻ってくる',
  },
};

/**
 * 状態 → 鳴らす曲。
 * ★純粋関数。three も DOM も知らない。
 */
export function bgmFor(state) {
  if (!state) return 'forest';                 // タイトル画面
  if (state.phase === 'ENDING') {
    return {
      COOKED: 'salon',      // 客用の音楽が鳴り続けている
      TOGETHER: 'drone',
      ALONE: 'solo',
      ORIGINAL: 'dawn',
      TRUE: 'dawn',
    }[state.ending] ?? 'drone';
  }
  /**
   * ★相方を捨てるかどうかの2場面だけ、旋律を止める。
   * 照明と彩度も落としている場面（presentation.js の MOMENT_STEPS）と揃える。
   * 「音楽が終わった」ことで、ここが他と違うと分かる。
   */
  if (state.step === 'caught' || state.step === 'r_partner') return 'drone';
  if (state.phase === 'MOUNTAIN') return 'forest';
  if (state.phase === 'RETURN') return 'dark';
  if (state.step === 'reveal' || state.step === 'eyes' || state.step === 'eyes2') return 'drone';
  return 'salon';                               // 往路
}

// ------------------------------------------------------------------ 効果音

const SE_STYLE =
  'dry acoustic recording, close mic, no reverb tail, no synthesizer, '
  + 'no modern cinematic whoosh or riser, no music, mono, 44.1kHz, wav';

/**
 * 効果音。**この7つだけ**。
 *
 * ★「その音がないと何が起きたか分からない」ものに絞ってある。
 * 足すほど画面は賑やかになるが、そのぶん静けさが減る。
 * 本作は止まった絵と文章で見せているので、静けさは資産である。
 *
 * uses は1周あたりのおおよその回数。1〜2回しか鳴らないものは、
 * その1回が物語の要になっているものだけ残した。
 */
export const SE = {
  select: {
    label: '決定',
    sec: 0.2,
    // 実測 0.21s / RMS -31.1dB。★頭に 0.09s の無音があるので、そこから鳴らす
    gain: 1.8, offset: 0.085,
    uses: '約40回／周。すべての選択肢とチップ',
    use: '選択肢を押したとき。いちばん多く鳴るので、いちばん小さく短くする',
    s: 'a single dry knock of a fingertip on a lacquered wooden tray, '
     + 'very short, soft, no resonance',
  },
  door: {
    label: '扉',
    sec: 1.0,
    // 実測 1.43s / RMS -18.3dB
    gain: 0.82,
    uses: '約13回／周。往路6室・復路6室・店に入る',
    use: '部屋を移るとき（暗転に重ねる）。本作の拍を刻む音',
    s: 'a heavy western wooden door opening and closing once, '
     + 'brass latch clicking, a short wooden creak, an old building',
  },
  metal: {
    label: '金物',
    sec: 0.6,
    // 実測 0.76s / RMS -15.8dB
    gain: 0.55,
    uses: '約6回／周。鉄砲を置く・拾う、金物を預ける、小物を隠す',
    use: '金属を手放す／拾うとき。奪われていく感覚を音で持たせる',
    s: 'small metal objects set down onto a wooden tray, '
     + 'a rifle butt resting against a wooden rack, dull and heavy, not bright',
  },
  cloth: {
    label: '衣ずれ',
    sec: 0.9,
    // 実測 0.88s / RMS -29.4dB
    gain: 1.5,
    uses: '約3回／周。鍵穴に顔を寄せる、衣服を脱ぐ',
    use: '身体が動くとき。かぎ穴に顔を寄せる場面の「間」をここで作る',
    s: 'wool clothing rustling as someone leans in slowly, '
     + 'one quiet controlled breath, nothing else',
  },
  eyes: {
    label: '眼玉',
    sec: 1.8,
    // 実測 1.00s / RMS -10.4dB / ピーク 0dB。溶け込み(1.9s)より短いので頭で鳴らす
    gain: 0.66,
    uses: '1回／周。★最重要',
    use: '★かぎ穴の向こうに眼玉が現れる瞬間。'
       + 'この1音のために他を静かにしてある。絵の溶け込み（1.9秒）に合わせる',
    s: 'a low descending groan of stressed wood, '
     + 'and inside it the wet guttural purr of a large cat, rising slightly at the end, '
     + 'no impact hit, no orchestral stinger',
  },
  steps: {
    label: '背後の足音',
    sec: 2.0,
    // 実測 0.84s / モノラル / RMS -16.0dB。★頭に無音があるのでループはしない
    gain: 0.5,
    uses: '約4回／周。追いつかれた場面、復路の障害',
    use: '追ってくるものの気配。ループさせて距離が詰まる場面に敷く',
    s: 'slow deliberate footsteps on a hard floor coming closer, '
     + 'the faint scrape of a claw between steps, seamless loop',
  },
  crash: {
    label: '犬が飛び込む',
    sec: 1.4,
    // 実測 2.46s / RMS -11.1dB / ピーク 0dB
    gain: 0.8,
    uses: '1回／周。復路の終点',
    use: '玄関の扉を犬が突き破る。物語で唯一「こちら側」から来る音',
    s: 'a wooden door bursting apart, splintering planks, '
     + 'immediately followed by two large dogs barking once, close and loud',
  },
};

/**
 * 一周のあいだ鳴り続けるもの。上の7種とは別に持つ（数え方が違う）。
 * ★周縁の脈（ui/vignette.js）と同じ段階で入り切りする。
 * 音と絵が別の理由で動くと、どちらも「何かの演出」に見えて意味が薄れる。
 */
export const SE_OPTIONAL = {
  heartbeat: {
    label: '鼓動（ループ）',
    sec: 2.0,
    // 実測 1.46s / RMS -12.0dB。背景に敷くので大きく下げる
    gain: 0.13, loop: true,
    uses: '空腹段階3以上のあいだ鳴らし続ける（周縁の脈と同じ段階）',
    use: '周縁の暗さと揺れに合わせる。数値を出さずに衰弱を伝える手段をもう一つ増やす',
    s: 'a slow human heartbeat heard from inside the body, '
     + 'muffled, two beats per cycle, seamless loop, very low frequency',
  },
};

/** 完成した効果音のプロンプト。判断の余地はない */
export function sePromptFor(id) {
  const e = SE[id] ?? SE_OPTIONAL[id];
  if (!e) return null;
  return [e.s, `about ${e.sec} seconds`, SE_STYLE].join(', ');
}

/** 実際に鳴らす効果音の一覧（任意のものは含めない） */
export const SE_IDS = Object.keys(SE);

/** 効果音のファイル。無ければ黙る（画像と同じ3段フォールバックの考え方） */
export function seFile(id) {
  return `assets/SE/${id}.wav`;
}

/**
 * 選択に対して鳴らす音。
 *
 * ★id だけでは決まらない。同じ「従う」でも、銃器室は鉄砲を置く音で、
 * 衣裳室は服を脱ぐ音になる。部屋まで見て決める。
 *
 * @param {string} id 押した選択肢
 * @param {object} s  押す**前**の状態
 */
export function seForChoice(id, s) {
  if (id === 'peek' || id === 'lean') return 'cloth';

  const room = s?.room;
  const OBEY = ['obey', 'partial', 'hide_confirm'];
  if (OBEY.includes(id)) {
    if (room === 3) return 'metal';   // 鉄砲と金物を預ける
    return 'cloth';                   // 髪を整える・脱ぐ・塗る
  }
  if (id === 'take') {
    if (s?.step === 'r_pickup') return room === 3 ? 'metal' : 'cloth';
    return 'metal';                   // 山道で首輪の笛を外す
  }
  if (id === 'fire') return 'metal';
  return 'select';
}

/**
 * 場面そのものに紐づく音。その場面に入った瞬間に1回だけ鳴らす。
 * ★扉の音はここに入れない。部屋が変わったかどうかは場面では決まらない。
 */
export function seForScene(step) {
  if (step === 'eyes2') return 'eyes';
  if (step === 'caught') return 'steps';
  if (step === 'r_final') return 'crash';
  return null;
}

// ------------------------------------------------------------------ 音量

/**
 * 音量は5段階。★連続の滑り子にしない。
 * 細かく決められても、決めたい人はいない。押した回数で分かるほうがよい。
 *
 * 値は耳で等間隔に感じるように取ってある（等差にすると小さい側が効かない）。
 */
export const VOLUME_STEPS = [0, 0.15, 0.35, 0.62, 1.0];
export const VOLUME_LABELS = ['消音', '小', '中', '大', '最大'];
export const DEFAULT_VOLUME = { bgm: 2, se: 3 };

/** 段階を 0〜4 に収める */
export function clampStep(n) {
  return Math.max(0, Math.min(VOLUME_STEPS.length - 1, Math.round(n) || 0));
}
