/**
 * ゲーム進行の純粋リデューサ（ターンフロー全体）
 *
 * three を import しない。副作用も乱数も持たない。
 *   view(s)      … いま何を見せ、何を選ばせるか
 *   choose(s,id) … 選択を1つ適用して新しい状態を返す（不変）
 *
 * この形にしておくと、reachability.test.mjs が選択のグラフを
 * 総当たり探索して「5種すべてに到達可能」を機械的に保証できる。
 */

import { createState, cloneState, hashState, D_INIT } from './state.js';
import { ROOMS, RETURN_ORDER } from '../data/rooms.js';
import { ITEMS, itemName } from '../data/items.js';
import { ENDINGS } from '../data/endings.js';
import {
  MOUNTAIN_REACTION, REVEAL_WARNING, RETURN_PARTNER, CAUGHT,
} from '../data/dialogue.js';
import {
  REWARD, weight, clothingStage, canRun, hungerLevel,
  consume, grantReward, eatOrWarm,
} from './resources.js';
import { demandedHere, loseItems, addItem, surrenderBig } from './items.js';
import { checkBreak, partnerLine, partnerStage, givesRevealWarning } from './partner.js';
import { obstacleOf, obstacleOptions, resolveRoom, isCaught, canCharge } from './pursuit.js';
import { judgeEnding } from './endings.js';
import { sceneOf } from './scenes.js';

export { createState, cloneState, hashState };

const clamp0 = (v) => Math.max(0, v);

function log(s, ...lines) {
  for (const l of lines) {
    if (Array.isArray(l)) {
      for (const x of l) s.log.push(...String(x).split('\n'));
    } else if (l != null) {
      // 改行を含む文字列は段落に分ける。1行に潰れると読みにくい
      s.log.push(...String(l).split('\n'));
    }
  }
}

// ------------------------------------------------------------------ view

export function isEnd(s) {
  return s.phase === 'ENDING';
}

export function view(s) {
  const body = [];
  const choices = [];
  const R = ROOMS[s.room];
  /**
   * 場面の見出し（「——廊下」など）。
   *
   * ★本文に混ぜない。本文の1行として流すと、ページ送りで下に流れて
   * 「どこにいるか」が画面から消える（実際に消えていた）。
   * 見出しは枠の上に据え置きにして、送りもページも使わない。
   */
  let head = null;

  switch (s.step) {
    // ---------------------------------------------------------- 山道
    case 'm1':
      body.push(
        '山の斜面。枯れた草が、乾いた音を立てている。',
        '案内の猟師とはぐれてから、ずいぶん歩いた。',
        '「なあ。腹が減った。もう戻らないか」'
      );
      choices.push({ id: 'advance', label: '先へ進む' });
      break;

    case 'm2':
      body.push(
        '白熊のような犬が二疋、そろってめまいを起こして倒れた。',
        'しばらく吠って、それから泡を吐いて動かなくなった。',
        '二疋とも、同じ方を向いている。',
        '首輪に、銀の小さな笛。'
      );
      choices.push(
        { id: 'bury',  label: '犬を埋めて弔う', hint: '時間と体力を使う' },
        { id: 'take',  label: '笛だけ取って進む' },
        { id: 'leave', label: '何もせず進む' }
      );
      break;

    case 'm3':
      body.push(
        '草の海のなかに、西洋造りの一軒家が立っている。',
        '白い壁。硝子窓。玄関には、赤い煉瓦の段。',
        '——ここまで、人の足跡はひとつも無かった。'
      );
      choices.push({ id: 'enter', label: '店に入る' });
      break;

    // ---------------------------------------------------------- 往路
    case 'o_free': {
      head = `——${R.name}`;
      /**
       * ★部屋に入ったときの一行。絵で見せられないもの（匂い・温度・音）だけ。
       * 見えているものを文で繰り返さない。判断の場面（o_judge）には入れない
       * ——決断の画面は短いほうがよい。
       */
      if (R.air) body.push(R.air, '');
      body.push('［看板］');
      body.push(...R.sign.map((l) => `　${l}`));
      if (R.demandText) body.push('', R.demandText);

      if (R.examine && !s.examined[s.room]) {
        choices.push({ id: 'examine', label: R.examine.label });
      }
      if (s.room !== 1 && !s.talked[s.room]) {
        choices.push({ id: 'talk', label: '相方に話す' });
      }

      if (!R.judgment) {
        // 1室目は「調べる」を一度使うまで進めない（仕様書 §4.1）
        const ok = !!s.examined[s.room];
        choices.push({
          id: 'advance', label: '奥へ進む', enabled: ok,
          hint: ok ? undefined : 'まだ見ていないものがある',
        });
      } else {
        // 判断は別のステップに分ける。ここでカメラが寄る（設計書 §4.3）
        choices.push({ id: 'to_judge', label: '看板の前に立つ' });
      }
      break;
    }

    case 'o_judge': {
      /**
       * ★看板の全文をここで繰り返さない。
       * 部屋に入った時点（o_free）で読ませてあるので、同じ5行を続けて2度読ませると
       * 「注文が増えていく」圧が読み流されてしまう。決断の画面では敬語をはがし、
       * 要求そのものを一行だけ突きつける。掲示（［看板］）が命令（［注文］）に変わる。
       * order を持たない部屋のために、看板の全文を出す道も残しておく。
       */
      if (R.order) {
        body.push('［注文］', `　${R.order}`);
      } else {
        body.push('［看板］');
        body.push(...R.sign.map((l) => `　${l}`));
        if (R.demandText) body.push('', R.demandText);
      }
      body.push('', '——どうする。');
      choices.push({ id: 'obey', label: R.obeyLabel });
      if (demandedHere(s, s.room).length > 0) {
        choices.push({ id: 'partial', label: '一部を隠して従う' });
      }
      choices.push({ id: 'refuse', label: '従わない' });
      break;
    }

    case 'o_hide': {
      const held = demandedHere(s, s.room);
      // 本文は固定にする。選択状態はチップの見た目で示す
      body.push(
        '掌に握り込めるものだけは、隠しておける。',
        '渡すか、握るか。押すたびに入れ替わる。'
      );
      for (const id of held) {
        choices.push({
          id: `toggle_${id}`,
          label: itemName(id),
          chip: true,
          on: s.hideSel.includes(id),
          hint: ITEMS[id].note,
        });
      }
      choices.push({ id: 'hide_confirm', label: 'これで指示に応じる' });
      break;
    }

    case 'o_reward':
      body.push(
        '扉の隙間から、暖かい湯気が流れてきた。',
        '小さな前菜が、皿にひとつ載っている。',
        'ひと口ぶんしかない。'
      );
      choices.push({ id: 'reward_self', label: '自分が受け取る' });
      choices.push({
        id: 'reward_partner', label: '相方に譲る',
        enabled: !s.partnerBroken,
        hint: s.partnerBroken ? '相方はもう受け取らない' : undefined,
      });
      break;

    // ---------------------------------------------------------- 反転
    case 'reveal': {
      head = `——${R.name}`;
      if (R.air) body.push(R.air, '');
      body.push('［看板］');
      body.push(...R.sign.map((l) => `　${l}`));
      if (givesRevealWarning(s)) body.push('', REVEAL_WARNING);
      choices.push({ id: 'salt', label: '壺の塩を体中にもみこむ' });
      if (!s.examined[6]) choices.push({ id: 'examine_jar', label: '壺を調べる' });
      choices.push({
        id: 'peek', label: '鍵穴を覗く',
        // ★相方が生きていれば、この選択肢に注意が向くようにする。
        // 折れていれば強調しない（＝支えなかった者には警告が届かない）
        emphasis: givesRevealWarning(s),
        hint: givesRevealWarning(s) ? '相方が気にしている' : undefined,
      });
      break;
    }

    /**
     * 覗いた瞬間。
     * ★原文の順序を守る（奥にもう一枚扉 → 二つの鍵穴 → 扉の字 → 「おまけに」眼玉）。
     * ここだけ一枚絵に切り替え、鍵穴に寄って暗転してから出す。
     */
    case 'eyes':
      body.push(
        '奥の方に、まだ一枚扉があった。',
        '大きなかぎ穴が二つつき、銀いろのホークとナイフの形が切りだしてある。',
        '',
        '［扉の字］',
        '　いや、わざわざご苦労です。',
        '　大へん結構にできました。',
        '　さあさあおなかにおはいりください。'
      );
      // ★ここで一度切る。覗きこむのは店の指示ではなく、プレイヤーの意思にする。
      //   自分で近づいたから眼玉と目が合う、という順序でないと怖くならない
      choices.push({ id: 'lean', label: 'かぎ穴に目を近づける' });
      break;

    /**
     * 眼玉が現れる。原文の「おまけに」の一行だけを置く。
     * 絵（扉→眼玉のクロスディゾルブ）が主役なので、文章は足さない。
     */
    case 'eyes2':
      body.push(
        '——おまけに、かぎ穴からはきょろきょろと二つの青い眼玉が、こっちをのぞいていた。'
      );
      choices.push({ id: 'look_away', label: '目をそらす' });
      break;

    // ---------------------------------------------------------- 復路
    case 'r_obstacle': {
      const ob = obstacleOf(s, s.room);
      head = `——${R.name}（逆走）`;
      body.push(ob.text);
      for (const o of obstacleOptions(s, s.room)) {
        if (o.id === 'force') choices.push({ id: 'force', label: ob.forceLabel });
        else if (o.id === 'endure') choices.push({ id: 'endure', label: '構わず進む' });
        else choices.push({ id: o.id, label: `${itemName(o.item)}を使う` });
      }
      break;
    }

    case 'r_pickup': {
      const p = R.pickup;
      head = `——${R.name}（逆走）`;
      if (p.kind === 'gun') {
        body.push(
          '床に、自分の鉄砲が転がっている。',
          '埃をかぶっている。誰も触っていない。'
        );
      } else {
        body.push(
          '脱ぎ捨てた外套と靴が、きちんと畳んで積まれている。',
          '内ポケットに、あの前菜が入ったままだ。'
        );
      }
      choices.push({
        id: 'take', label: p.label,
        hint: p.kind === 'coat' ? '腹は満たされるが、重くなる' : '重くなる',
      });
      choices.push({ id: 'leave', label: p.leaveLabel });
      break;
    }

    case 'r_fire':
      body.push(
        '鉄砲を構えた。',
        '暗がりの奥で、何かが低く息をしている。'
      );
      choices.push({ id: 'fire', label: '撃つ' });
      choices.push({ id: 'dont_fire', label: '撃たない' });
      break;

    case 'r_partner':
      body.push(
        '相方は、もう自分では走れない。',
        '床に手をついて、こちらを見上げている。'
      );
      choices.push({ id: 'support', label: '肩を貸す', hint: '距離を失う' });
      choices.push({ id: 'abandon', label: '置いていく' });
      break;

    case 'r_look':
      head = `——${R.name}（逆走）`;
      body.push(returnRoomFlavor(s, s.room));
      choices.push({ id: 'advance', label: '先へ進む' });
      break;

    case 'caught':
      body.push(CAUGHT.prompt);
      choices.push({ id: 'push', label: '相方を突き飛ばす' });
      choices.push({ id: 'hold', label: '突き飛ばさない' });
      break;

    case 'r_final': {
      head = '——玄関（逆走）';
      body.push(
        '扉が開かない。押しても引いても動かない。',
        '二人は泣いた。泣いて泣いて泣いた。',
        '',
        /**
         * ★原作の「鍵穴の眼玉はたちまちなくなり」をここに置いてはいけない。
         * 原作の二人は鍵穴の部屋から動かないが、本作は6室を逆走してきているので、
         * 玄関に眼玉は無い。原作の「たちまちなくなる」という運びだけを残して、
         * 消えるものを**背後の気配**に置き換える。
         */
        'そのとき——白熊のような犬が二疋、扉をつきやぶって室の中に飛び込んできた。',
        '追ってきていた気配が、たちまちなくなった。',
        '犬どもは一声高く吠えて、いきなり奥の扉に飛びついた。',
        '戸はがたりとひらき、犬どもは吸い込まれるように飛んで行った。'
      );
      const ok = canCharge(s);
      choices.push({ id: 'flee', label: '逃げる' });
      choices.push({
        id: 'charge', label: '犬に続いて踏み込む',
        enabled: ok,
        hint: ok ? undefined : chargeBlockReason(s),
      });
      break;
    }

    // ---------------------------------------------------------- 結末
    case 'ending': {
      const e = ENDINGS[s.ending];
      head = `［エンディング ${e.no}］ ${e.title}`;
      body.push(...e.lines);
      break;
    }
  }

  return {
    phase: s.phase,
    room: s.room,
    roomName: R?.name ?? '',
    // 場面の見出し。枠の上に据え置きにする（送らない・ページに数えない）
    head,
    // 場面の一意識別（テスト・不具合報告用）
    scene: sceneOf(s),
    // 「調べる」で寄る対象の板（テクスチャのパス）
    focus: s.focus ?? null,
    // 1秒あたりの文字数。情緒を出したい場面は遅くする
    speed: speedFor(s),
    // 既読なら文字送りを飛ばしてよいか。判断の場面は飛ばさない
    skippable: isSkippableStep(s.step),
    // 文字の枠を小さくしたい場面。絵が主役のカットで絵を潰さないため
    panel: (s.step === 'eyes' || s.step === 'eyes2') ? 'small' : null,
    // 相方の表情。P の段階を台詞以外でも伝える（仕様書 §11）
    partnerFace: partnerSpeaks(s) ? faceFor(s) : null,
    // 3D 空間の看板に焼く文面。板は復路でもそのまま掛かっている
    signLines: signLinesFor(s),
    log: s.log,
    /**
     * ★本文は必ず「1要素＝1行」で返す。
     * 改行を含む文字列をそのまま渡すと、ページ送りは1行と数えるのに
     * 画面では2行になり、枠からあふれる（実際にあふれていた）。
     * ログ側は log() が同じことをしている。
     */
    body: body.flatMap((l) => String(l ?? '').split('\n')),
    choices: choices.map((c) => ({ enabled: true, ...c })),
    ending: s.ending,
    // 演出用（数値は画面に出さない / 仕様書 §11）
    stages: {
      hunger: hungerLevel(s),
      partner: partnerStage(s.P),
      clothing: clothingStage(s),
      hasGun: s.hasGun,
      hasCoat: s.hasCoat,
    },
    // Phase 1 の調整用。Phase 5 で表示を落とす
    debug: {
      H: s.H, P: s.P, D: s.D, W: weight(s),
      items: [...s.items], obeyed: { ...s.obeyed },
      broken: s.partnerBroken, run: canRun(s),
    },
  };
}

/**
 * 相方の表情。P の段階に対応させる（仕様書 §11）。
 * ★台詞だけでは段階が伝わりにくい。顔で一目で分かるようにする。
 */
const FACE_BY_STAGE = [
  'characters/partner/face_surrender.png',   // 0 折れた
  'characters/partner/face_begging.png',     // 1
  'characters/partner/face_begging.png',     // 2
  'characters/partner/face_confused.png',    // 3
  'characters/partner/face_doubt.png',       // 4 元気
];

/**
 * 相方の肖像を出す場面か。
 *
 * ★出しっぱなしにしない。物を調べているあいだも顔が並んでいると、
 * 顔は「そこにいる」以上のことを何も伝えなくなる。
 * 喋ったときだけ出せば、顔が出たこと自体が合図になる。
 */
const SPEAKING_STEPS = new Set([
  'm1',         // 「なあ、腹が減った。もう戻らないか」
  'r_partner',  // 走れなくなった相方に寄る場面
  'caught',     // 追いつかれた場面の問いかけ
]);

function partnerSpeaks(s) {
  if (s.spoke) return true;                       // choose() が台詞をログに積んだ
  if (SPEAKING_STEPS.has(s.step)) return true;    // 本文そのものが相方の言葉
  return s.step === 'reveal' && givesRevealWarning(s);
}

function faceFor(s) {
  if (!s.partnerPresent || s.phase === 'ENDING') return null;
  // 覗いた直後は、段階に関係なく絶望の顔
  if (s.phase === 'RETURN' && s.room === 6) return 'characters/partner/face_despair.png';
  // 踏み込める場面まで来た相方は、覚悟の顔
  if (s.step === 'r_final' && canCharge(s)) return 'characters/partner/face_resolve.png';
  if (s.partnerBroken) return FACE_BY_STAGE[0];
  return FACE_BY_STAGE[partnerStage(s.P)];
}

/**
 * 文字送りの速さ。
 * 玄関で扉が開かず泣く場面は、速いと情緒が流れてしまう。
 */
const SPEED = { eyes: 14, eyes2: 12, r_final: 15, ending: 24 };

/**
 * ★既読でも早送りしてはいけない場面（仕様書 §10）。
 *
 * 判断の重さは「読むのにかかる時間」で作っている。
 * 2周目に看板の説明が一瞬で出るのは助かるが、
 * 決断の文まで一瞬で出ると、選択がボタンを押す作業に落ちる。
 * 部屋の描写と「調べる」だけを短縮する。
 */
const NO_SKIP = new Set([
  'o_judge', 'o_hide', 'o_reward',   // 従うか／隠すか／報酬を誰が取るか
  'reveal', 'eyes', 'eyes2',         // 反転と鍵穴
  'caught', 'r_partner', 'r_fire',   // 相方を捨てるか／撃つか
  'r_final', 'ending',               // 玄関の最後と結末
]);

/**
 * その場面の文を、既読なら早送りしてよいか。
 * ★step だけで決まる。状態を組み立てずに検査できるよう、外に出しておく
 * （test/progress.test.mjs が場面表と突き合わせている）。
 */
export function isSkippableStep(step) {
  return !NO_SKIP.has(step);
}

function speedFor(s) {
  return SPEED[s.step] ?? 34;
}

/** 看板に載せる文面。文字は Canvas 2D で描く（AI生成に文字を含めない） */
function signLinesFor(s) {
  if (s.step === 'm3') {
    return ['どなたもどうかお入りください', '決してご遠慮はありません'];
  }
  if (s.phase === 'MOUNTAIN' || s.phase === 'ENDING') return null;
  if (s.step === 'eyes' || s.step === 'eyes2') return null;   // 一枚絵の場面。看板は出さない
  /**
   * ★覗いたあとの厨房前は、奥の扉の字が見えている（原作準拠）。
   * 原作では塩の字と奥の扉の字は別の扉に書かれているが、
   * 本作は文字を看板の板に集約しているので、同じ板の字が変わる形にする。
   * 「同じ板を読み返したら文面が変わっている」という怖さが出る。
   */
  if (s.phase === 'RETURN' && s.room === 6) {
    return ['いや、わざわざご苦労です', '大へん結構にできました', 'さあさあおなかにおはいりください'];
  }
  return ROOMS[s.room]?.sign ?? null;
}

function chargeBlockReason(s) {
  if (!s.items.includes('dog_whistle')) return '犬を呼ぶ手立てがない';
  if (!s.partnerPresent) return '隣に誰もいない';
  return '走れる体力がない';
}

function returnRoomFlavor(s, n) {
  switch (n) {
    case 6: return '皿が積み上げてある。白い布の染みは、まだ乾いていない。';
    case 5: return '壺が倒れ、白いものが床に広がっている。塩の粒が浮いている。';
    case 4: return '衣裳掛けが倒れている。鏡に、長い割れ目が走っている。';
    case 3: return '銃架は空。弾薬箱の蓋が開いている。中身はない。';
    case 2: return '磨いた床。姿見に、下着姿の自分が映っている。';
    case 1: return '玄関。明かりはひとつも点いていない。';
    default: return '';
  }
}

// ------------------------------------------------------------------ choose

export function choose(s0, id) {
  const s = cloneState(s0);
  s.log = [];
  // 「調べる」で寄る対象。描画専用なので hashState には含めない
  s.focus = null;
  /**
   * 相方が口をひらいたか。肖像を出すかどうかだけに使う。
   * ★常に出していると、棚や鏡を調べているときも顔が並んで意味を失う。
   *   「喋ったときだけ出る」なら、顔が出た＝相方が何か言った、になる。
   * 描画専用なので hashState には含めない。
   */
  s.spoke = false;

  switch (s.step) {
    // ---------------------------------------------------------- 山道
    case 'm1':
      s.step = 'm2';
      return s;

    case 'm2':
      if (id === 'bury') {
        s.H = clamp0(s.H - 2);
        addItem(s, 'dog_whistle');
        s.dogBuried = true;
        log(s, '土を掘り、二疋を並べて埋めた。首輪の笛だけ、手に残った。', MOUNTAIN_REACTION.bury);
        s.spoke = true;
      } else if (id === 'take') {
        addItem(s, 'dog_whistle');
        log(s, '首輪から笛を外した。犬はそのままにした。', MOUNTAIN_REACTION.take);
        s.spoke = true;
      } else {
        log(s, '犬に触れず、そのまま歩き出した。', MOUNTAIN_REACTION.leave);
        s.spoke = true;
      }
      s.step = 'm3';
      return s;

    case 'm3':
      s.phase = 'OUTBOUND';
      s.room = 1;
      s.step = 'o_free';
      return s;

    // ---------------------------------------------------------- 往路
    case 'o_free': {
      const R = ROOMS[s.room];
      if (id === 'examine') {
        s.examined[s.room] = true;
        s.focus = R.examine.focus ?? null;
        log(s, R.examine.text);
        return s;
      }
      if (id === 'talk') {
        s.talked[s.room] = true;
        log(s, `「${partnerLine(s, s.room)}」`);
        s.spoke = true;
        return s;
      }
      if (id === 'advance') {
        return advanceOutbound(s);
      }
      if (id === 'to_judge') {
        s.step = 'o_judge';
        return s;
      }
      return s;
    }

    case 'o_judge': {
      const R = ROOMS[s.room];
      if (id === 'obey') {
        const taken = demandedHere(s, s.room);
        log(s, R.obeyText);
        if (taken.length) log(s, `${taken.map(itemName).join('、')}も、みな預けた。`);
        loseItems(s, taken);
        return applyObedience(s, REWARD.obey);
      }
      if (id === 'partial') {
        s.hideSel = [];
        s.step = 'o_hide';
        return s;
      }
      if (id === 'refuse') {
        log(s, R.refuseText);
        s.obeyed[s.room] = false;
        consume(s);
        log(s, checkBreak(s));
        s.pendingReward = 0;
        return advanceOutbound(s);
      }
      return s;
    }

    case 'o_hide': {
      if (id.startsWith('toggle_')) {
        const item = id.slice('toggle_'.length);
        s.hideSel = s.hideSel.includes(item)
          ? s.hideSel.filter((x) => x !== item)
          : [...s.hideSel, item];
        return s;
      }
      if (id === 'hide_confirm') {
        const held = demandedHere(s, s.room);
        const given = held.filter((x) => !s.hideSel.includes(x));
        loseItems(s, given);
        /**
         * ★順序と言い回しに注意。
         * 鉄砲や外套は obeyText が描いているので、それを先に出す。
         * 小物だけを見て「何も差し出さなかった」と書くと、
         * 鉄砲を置いたのに何も渡していないように読めてしまう。
         */
        log(s, ROOMS[s.room].obeyText);
        if (given.length) log(s, `${given.map(itemName).join('、')}も預けた。`);
        if (s.hideSel.length) {
          log(s, `${s.hideSel.map(itemName).join('、')}だけは、掌に握り込んだ。`);
        }
        s.hideSel = [];
        return applyObedience(s, REWARD.partial);
      }
      return s;
    }

    case 'o_reward': {
      const amount = s.pendingReward;
      s.pendingReward = 0;
      if (id === 'reward_partner' && !s.partnerBroken) {
        grantReward(s, amount, 'partner');
        log(s, '相方に渡した。黙って受け取り、少しだけ顔色が戻った。');
      } else {
        grantReward(s, amount, 'self');
        log(s, '自分が食べた。腹の底が、少しだけ暖かくなった。');
      }
      return advanceOutbound(s);
    }

    // ---------------------------------------------------------- 反転
    case 'reveal': {
      if (id === 'examine_jar') {
        s.examined[6] = true;
        s.focus = 'rooms/06_kitchendoor/salt_jar.png';
        log(s, '立派な青い瀬戸の塩壺。中身は塩。ただし、ずいぶん粗い。',
               '菜っ葉の匂いがする。塩でよく揉んだ、菜っ葉の匂いだ。');
        return s;
      }
      if (id === 'salt') {
        s.saltApplied = true;
        return toEnding(s);
      }
      if (id === 'peek') {
        log(s, '鍵穴に顔を寄せた。');
        s.step = 'eyes';
        return s;
      }
      return s;
    }

    case 'eyes': {
      if (id !== 'lean') return s;
      s.step = 'eyes2';
      return s;
    }

    case 'eyes2': {
      if (id !== 'look_away') return s;
      log(s,
        '戸の中で、こそこそ声がする。',
        '「だめだよ。もう気がついたよ。塩をもみこまないようだよ」',
        s.dogBuried ? '' : null,
        s.dogBuried ? '——遠くで、聞いたはずのない声が鳴った気がした。' : null
      );
      s.phase = 'RETURN';
      // 犬を弔った者には犬が近くにいる
      s.D = D_INIT + (s.dogBuried ? 1 : 0);
      s.room = 6;
      resetRoomFlags(s);
      s.step = nextReturnStep(s);
      return s;
    }

    // ---------------------------------------------------------- 復路
    case 'r_obstacle': {
      const ob = obstacleOf(s, s.room);
      if (id === 'force') {
        s.turnExtra += (ob.forceTurns ?? 2) - 1;
        log(s, ob.forceText);
      } else if (id === 'endure') {
        s.penalty += ob.penalty ?? 1;
        log(s, ob.penaltyText);
      } else if (id.startsWith('use_')) {
        const item = id.slice('use_'.length);
        const t = typeof ob.solveText === 'string' ? ob.solveText : ob.solveText[item];
        log(s, t);
      }
      s.obstacleHandled = true;
      s.step = nextReturnStep(s);
      return s;
    }

    case 'r_pickup': {
      const p = ROOMS[s.room].pickup;
      s.pickupHandled = true;
      if (id === 'take') {
        s.turnExtra += 1;
        if (p.kind === 'gun') {
          s.hasGun = true;
          log(s, '鉄砲を拾い上げた。肩に食い込む重さが戻ってきた。');
          s.step = 'r_fire';
          return s;
        }
        s.hasCoat = true;
        eatOrWarm(s, 3);
        log(s, '外套を着て、靴を履いた。震えが止まった。', 'そして、重い。');
      } else {
        log(s, '手を出さなかった。');
      }
      s.step = nextReturnStep(s);
      return s;
    }

    case 'r_fire': {
      if (id === 'fire') {
        s.gunFired = true;
        s.penalty += 1;
        log(s,
          '暗がりへ撃った。',
          '当たった。当たったはずだ。',
          '——何も起こらなかった。'
        );
      } else {
        log(s, '引き金は引かなかった。');
      }
      s.step = nextReturnStep(s);
      return s;
    }

    case 'r_partner': {
      // ★選択は明示的に判定する。既定で「置いていく」に落とすと、
      // 未知の id が来たときに相方を勝手に見捨てることになる
      if (id === 'support') {
        s.returnPartnerHandled = true;
        s.D -= 2;
        log(s, RETURN_PARTNER.support);
        s.spoke = true;
        s.step = nextReturnStep(s);
        return s;
      }
      if (id === 'abandon') {
        s.returnPartnerHandled = true;
        s.abandonedPartner = true;
        s.partnerPresent = false;
        log(s, RETURN_PARTNER.abandon);
        s.spoke = true;
        return toEnding(s);
      }
      return s;
    }

    case 'r_look':
      s.step = nextReturnStep(s);
      return s;

    case 'caught': {
      if (id !== 'push' && id !== 'hold') return s;
      s.caught = true;
      if (id === 'push') {
        s.pushedPartner = true;
        s.partnerPresent = false;
        log(s, CAUGHT.push);
        s.spoke = true;
      } else {
        log(s, CAUGHT.hold);
        s.spoke = true;
      }
      return toEnding(s);
    }

    case 'r_final': {
      if (id !== 'flee' && id !== 'charge') return s;
      if (id === 'charge' && canCharge(s)) {
        s.chargedIn = true;
      }
      return toEnding(s);
    }

    default:
      return s;
  }
}

// ------------------------------------------------------------------ 内部

/**
 * 従属の共通処理。
 * ★ 順序が重要（ターンフロー §2.2 の [5][6][7]）
 *    所持状態の更新 → 消費 → 報酬
 *    鉄砲を置いた部屋では、置いたあとの軽い体で消費する。
 */
function applyObedience(s, reward) {
  s.obeyed[s.room] = true;
  surrenderBig(s, s.room);
  consume(s);
  log(s, checkBreak(s));
  s.pendingReward = reward;
  s.step = 'o_reward';
  return s;
}

function advanceOutbound(s) {
  if (s.room < 5) {
    s.room += 1;
    s.step = 'o_free';
    return s;
  }
  s.phase = 'REVEAL';
  s.room = 6;
  s.step = 'reveal';
  return s;
}

function resetRoomFlags(s) {
  s.obstacleHandled = false;
  s.pickupHandled = false;
  s.looked = false;
  s.turnExtra = 0;
  s.penalty = 0;
}

/**
 * 復路のサブステップを順に消化し、すべて済んだら距離を精算して次の部屋へ進む。
 * 決めることが何もない部屋も、必ず一度は見せる（r_look）。
 */
function nextReturnStep(s) {
  // その部屋でまだ決めていないことがあるか
  if (!s.obstacleHandled && obstacleOf(s, s.room)) return 'r_obstacle';
  if (!s.pickupHandled && pickupAvailable(s)) return 'r_pickup';
  if (!s.returnPartnerHandled && s.partnerBroken) return 'r_partner';
  if (!s.looked && !s.obstacleHandled && !s.pickupHandled) {
    s.looked = true;
    return 'r_look';
  }

  // 精算
  resolveRoom(s);
  if (isCaught(s)) return 'caught';
  if (s.room === 1) return 'r_final';

  const i = RETURN_ORDER.indexOf(s.room);
  s.room = RETURN_ORDER[i + 1];
  resetRoomFlags(s);
  return nextReturnStep(s);
}

function pickupAvailable(s) {
  const p = ROOMS[s.room]?.pickup;
  if (!p) return false;
  if (p.kind === 'gun') return !s.hasGun;
  if (p.kind === 'coat') return !s.hasCoat;
  return false;
}

function toEnding(s) {
  s.phase = 'ENDING';
  s.step = 'ending';
  s.ending = judgeEnding(s);
  return s;
}
