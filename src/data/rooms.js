/**
 * 6室の定義（仕様書 §4 / §8）
 *
 * air       … 部屋に入ったときの一行。★絵で見せられないものだけを書く
 *              （匂い・温度・音）。見えているものを文で繰り返さない
 * sign      … 看板の文面（原作の文面を採用。Canvas 2D で描画する）
 * demands   … その部屋で店が要求してくる小物
 * surrender … 従うと必ず失う「重量を持つもの」（gun / coat）
 * obstacle  … 復路でその部屋に発生する障害
 */

export const ROOMS = {
  1: {
    n: 1, id: 'entrance', name: '玄関',
    air: '外の風の音が、扉一枚で消えた。',
    // ★原作の「扉の裏の一行」を使う。歓迎の裏に、もう一行ある
    demandText: '硝子戸の裏に、もう一行。\n'
              + '「ことに肥ったお方や若いお方は、大歓迎いたします」',
    sign: ['当軒は注文の多い料理店ですから', 'どうかそこはご承知ください'],
    judgment: false,
    tutorial: true,
    examine: {
      label: '看板を調べる',
      // ★寄る対象は「板の実際のパス」で書く。layout.js の tex と一字でも違うと
      //   anchors.props から引けず、寄らずに役者だけ消える（実際にそうなっていた）。
      //   test/assets.test.mjs が突き合わせている
      focus: 'common/signboard_blank.png',
      // ★寄って見える絵と食い違うことを書かない。
      //   「小さな札が打ちつけてある」と書いていたが、板の絵にそんな札はない。
      //   文字は Canvas 2D が描くので、絵に無いものを文で足すと必ずずれる。
      text: '吊り鎖はまだ鈍く光っている。\n' +
            '彫りの溝に、埃がひとつも溜まっていない。\n' +
            '——この山で、誰が拭いたのか。',
    },
    obstacle: null,   // 復路の終点。障害ではなく犬が来る
  },

  2: {
    n: 2, id: 'corridor', name: '廊下',
    air: '奥の方から、かすかに湯気の匂いがする。',
    sign: ['お客さまがた、ここで髪をきちんとして', 'それからはきものの泥を落してください'],
    /**
     * ★判断の場面（o_judge）で突きつける一行。
     * 看板の全文は部屋に入ったときに読ませてある。決断のときは繰り返さず、
     * 敬語をはがした「注文」だけを短く出す。丁寧な掲示が命令に変わる瞬間。
     */
    order: '髪をきちんと。はきものの泥を落とす。',
    judgment: true,
    demands: [],
    surrender: [],
    obeyLabel: '髪を整え、靴の泥を落とす',
    obeyText: '櫛を通し、ブラシで靴の泥を落とす。\n'
            + '鏡のなかの二人が、少しだけ客らしくなった。\n'
            + '——扉の裏に、続きがあった。\n'
            + '「注文はずいぶん多いでしょうが、どうか一々こらえて下さい」',
    refuseText: '櫛には触らなかった。\n'
              + '泥のついた靴のまま、磨いた床を踏んでいく。\n'
              + '床の艶が、靴の下で曇った。',
    examine: {
      label: '姿見を調べる',
      focus: 'rooms/02_corridor/mirror_tall.png',
      text: '曇った鏡に、二人が映っている。\n'
          + 'どちらも、ひどく腹をすかせた顔をしている。\n'
          + '鏡の隅だけ、綺麗に拭いてある。',
    },
    obstacle: {
      kind: 'footprints',
      when: (s) => s.obeyed[2],   // 泥を落とした＝足跡が残る
      text: '磨いた床に、自分たちの足跡が点々と並んでいる。\n'
          + '歩いてきた道が、そのまま残っている。',
      solvedBy: ['glasses'],
      solveText: '眼鏡をかけると、壁の下に配膳用の小窓が見えた。\n'
               + '這えば通れる。床は踏まずに済む。',
      penalty: 1,
      penaltyText: '跡を消す手立てがない。\n背後の足音が、ひとつ分だけ近づいた。',
    },
  },

  3: {
    n: 3, id: 'gunroom', name: '銃器室',
    air: '油の匂い。それから、鉄の匂い。',
    sign: ['鉄砲と弾丸をここへ置いてください'],
    order: '鉄砲と弾丸を置く。金物も、みんな。',
    judgment: true,
    demands: ['penknife', 'dog_whistle'],
    demandText: '小卓に、もう一枚。\n「その他、金物類もお預かりいたします」',
    surrender: ['gun'],
    obeyLabel: '鉄砲を置き、金物もすべて預ける',
    obeyText: '鉄砲を架に立てかける。\n'
            + '肩が軽くなった。ずいぶん長く担いでいたのだと分かる。',
    refuseText: '鉄砲は渡さない。\n'
              + '看板は何も言わない。\n'
              + '奥へ続く扉が、静かに開いている。',
    examine: {
      label: '鹿の首を調べる',
      focus: 'rooms/03_gunroom/deer_mount.png',
      text: '壁の鹿。角のあいだにも埃がない。\n'
          + '首の切り口が、まだ濡れている。',
    },
    obstacle: null,   // 障害はない。ここは罠（鉄砲が置いてある）
    pickup: { kind: 'gun', label: '鉄砲を拾う', leaveLabel: '置いていく' },
  },

  4: {
    n: 4, id: 'wardrobe', name: '衣裳室',
    air: '暖かい。壁の向こうで、水を使う音がしている。',
    sign: ['どうか帽子と外套と靴をおとりください',
           'ネクタイピン、カフスボタン、眼鏡、財布',
           'その他金物類、ことに尖ったものは',
           'みんなここに置いてください'],
    order: '帽子と外套と靴。眼鏡も、財布も、尖ったものも。',
    judgment: true,
    demands: ['pocket_watch', 'glasses', 'matches', 'dog_whistle'],
    surrender: ['coat'],
    obeyLabel: '帽子と外套と靴を脱ぎ、金物もすべて置く',
    obeyText: '下着だけになった。床は氷のようだ。\n'
            + 'それなのに、部屋の空気は暖かい。\n'
            + '——扉の横で、黒塗りの金庫が口を開けている。\n'
            + '鍵まで添えてあった。',
    refuseText: '外套は脱がない。\n'
              + '看板はやはり何も言わない。\n'
              + '「まだお済みでないようですが、どうぞお先へ」',
    examine: {
      label: '鏡を調べる',
      focus: 'rooms/04_wardrobe/mirror_ornate.png',
      text: '大きな鏡。下着姿の自分が映っている。\n'
          + '縁の内側に、細い傷がいくつも走っている。\n'
          + '爪の幅くらいの間隔で、並んで。',
    },
    obstacle: null,   // 障害はない。ここは誘惑（外套が置いてある）
    pickup: { kind: 'coat', label: '外套と靴を拾う', leaveLabel: '置いていく' },
  },

  5: {
    n: 5, id: 'oilroom', name: '香油室',
    air: '甘い匂いと、酢の匂いが混ざっている。',
    sign: ['壺のなかのクリームを顔や手足にすっかり塗ってください',
           '早くあなたの頭に瓶の中の香水をよく振りかけてください'],
    order: 'クリームを顔と手足に。香水を頭に。',
    judgment: true,
    demands: ['dog_whistle'],
    demandText: '壁に、もう一枚。\n「まだお持ちのようですね。お預かりします」',
    surrender: [],
    applies: 'cream',
    obeyLabel: 'クリームを塗り、香水を振りかける',
    obeyText: '顔と手足に、白いものを塗り込む。\n'
            + '酢のような匂いの香水を、頭に振りかける。\n'
            + '——扉の裏に、小さな壺がもう一つ。\n'
            + '「クリームをよく塗りましたか、耳にもよく塗りましたか」',
    refuseText: '壺には触らなかった。\n'
              + '覗くと、白いものに粒が浮いている。\n'
              + '菓子に使うものではない。',
    examine: {
      label: 'クリームの壺を調べる',
      focus: 'rooms/05_oilroom/cream_jar.png',
      text: '白いクリーム。指ですくうと、粒がざらつく。\n'
          + '舐めてみる。塩の味がした。\n'
          + '——これを、顔に塗るのか。',
    },
    obstacle: {
      kind: 'smell',
      when: (s) => s.obeyed[5],   // 香水を振った＝匂いで位置がバレる
      text: '自分の頭から、酢のような匂いが立っている。\n'
          + '風の通る方へ、真っ直ぐ流れていく。',
      solvedBy: ['matches'],
      solveText: 'マッチを擦り、髪の先を焼く。\n'
               + '焦げた匂いが、甘い匂いを覆った。',
      penalty: 1,
      penaltyText: '匂いは消せない。\n扉の向こうで、鼻を鳴らす音がした。',
    },
  },

  6: {
    n: 6, id: 'kitchendoor', name: '厨房前',
    air: 'この扉の向こうが、いちばん暖かい。',
    sign: ['いろいろ注文が多くてうるさかったでしょう',
           'お気の毒でした。もうこれだけです',
           'どうかからだ中に、壺の中の塩を',
           'たくさんよくもみ込んでください'],
    judgment: false,
    reveal: true,
    obstacle: {
      kind: 'locked_door',
      when: () => true,
      text: '来た道の扉が閉まっている。押しても引いても動かない。\n'
          + 'こちら側に、把手がない。',
      solvedBy: ['penknife', 'pocket_watch'],
      solveText: {
        penknife: 'ペンナイフを隙間に差し込む。\n閂が、思ったより簡単に外れた。',
        pocket_watch: '懐中時計の鎖を隙間から通し、閂に引っ掛けて持ち上げる。\n静かに開いた。',
      },
      forceLabel: '体当たりする',
      forceText: '肩から二度ぶつけて、ようやく閂が折れた。\n音が、廊下の先まで響いた。',
      forceTurns: 2,
    },
  },
};

/** 往路の判断室（仕様書 §4.2）。判断は4室である */
export const JUDGMENT_ROOMS = [2, 3, 4, 5];

/** 復路の巡回順（ターンフロー §4） */
export const RETURN_ORDER = [6, 5, 4, 3, 2, 1];
