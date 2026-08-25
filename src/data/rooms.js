/**
 * 6室の定義（仕様書 §4 / §8）
 *
 * sign      … 看板の文面（原作の文面を採用。Canvas 2D で描画する）
 * demands   … その部屋で店が要求してくる小物
 * surrender … 従うと必ず失う「重量を持つもの」（gun / coat）
 * obstacle  … 復路でその部屋に発生する障害
 */

export const ROOMS = {
  1: {
    n: 1, id: 'entrance', name: '玄関',
    sign: ['当店は注文の多い料理店ですから', 'どうかそこはご承知ください'],
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
      text: '吊り鎖はまだ鈍く光っている。縁の彫りに、埃がひとつも積もっていない。\n' +
            '——この板は、ついさっき掛けられたものだ。',
    },
    obstacle: null,   // 復路の終点。障害ではなく犬が来る
  },

  2: {
    n: 2, id: 'corridor', name: '廊下',
    sign: ['お客様がた、ここで髪をきちんとして', 'それからはきものの泥を落してください'],
    judgment: true,
    demands: [],
    surrender: [],
    obeyLabel: '髪を整え、靴の泥を落とす',
    obeyText: '櫛を使い、ブラシで靴の泥を落とす。\nレストランに入る前の身支度として、何ひとつ不自然ではない。',
    refuseText: '何もせず、そのまま奥へ進む。\n泥のついた靴のまま、上等な床を踏んでいく。',
    examine: {
      label: '姿見を調べる',
      focus: 'rooms/02_corridor/mirror_tall.png',
      text: '曇った鏡に、自分たちが映っている。\n二人とも、ひどく腹をすかせた顔をしている。',
    },
    obstacle: {
      kind: 'footprints',
      when: (s) => s.obeyed[2],   // 泥を落とした＝足跡が残る
      text: '磨かれた床に、自分たちの足跡がはっきり残っている。\nこれを辿られたら、隠れる場所などない。',
      solvedBy: ['glasses'],
      solveText: '眼鏡をかけると、壁の下に配膳用の小さな抜け道が見えた。\n足跡を残さずに通れる。',
      penalty: 1,
      penaltyText: '足跡を消す手立てがない。背後の足音が、確かに近づいた。',
    },
  },

  3: {
    n: 3, id: 'gunroom', name: '銃器室',
    sign: ['鉄砲と弾丸をここへ置いてください'],
    judgment: true,
    demands: ['penknife', 'dog_whistle'],
    demandText: 'そして小卓の上には、こう添えてある。\n「その他、金物類もお預かりいたします」',
    surrender: ['gun'],
    obeyLabel: '鉄砲を置き、金物もすべて預ける',
    obeyText: '鉄砲を架に立てかける。ずいぶん軽くなった。\n身体が軽くなったのは、確かに助かる。',
    refuseText: '鉄砲は渡さない。\n看板は何も言わない。ただ、奥へ続く扉が開いている。',
    examine: {
      label: '鹿の首を調べる',
      focus: 'rooms/03_gunroom/deer_mount.png',
      text: '壁の鹿の首。よく見ると、剥製ではない。\n——切り口が、まだ新しい。',
    },
    obstacle: null,   // 障害はない。ここは罠（鉄砲が置いてある）
    pickup: { kind: 'gun', label: '鉄砲を拾う', leaveLabel: '置いていく' },
  },

  4: {
    n: 4, id: 'wardrobe', name: '衣裳室',
    sign: ['どうか帽子と外套と靴をおとりください',
           'ネクタイピン、カフスボタン、眼鏡、財布',
           'その他金物類、ことにとがったものは',
           'みなここに置いてください'],
    judgment: true,
    demands: ['pocket_watch', 'glasses', 'matches', 'dog_whistle'],
    surrender: ['coat'],
    obeyLabel: '帽子と外套と靴を脱ぎ、金物もすべて置く',
    obeyText: '下着だけになった。床は氷のように冷たい。\nしかし部屋のなかは、なぜか暖かい。',
    refuseText: '外套は脱がない。\n看板はやはり何も言わない。「まだお済みでないようですが、どうぞお先へ」',
    examine: {
      label: '鏡を調べる',
      focus: 'rooms/04_wardrobe/mirror_ornate.png',
      text: '大きな鏡に、下着姿の自分が映っている。\n' +
            '縁に、細い引っかき傷がいくつも走っていた。\n' +
            '——内側から、爪で掻いたような跡だ。',
    },
    obstacle: null,   // 障害はない。ここは誘惑（外套が置いてある）
    pickup: { kind: 'coat', label: '外套と靴を拾う', leaveLabel: '置いていく' },
  },

  5: {
    n: 5, id: 'oilroom', name: '香油室',
    sign: ['壺のなかのクリームを顔や手足にすっかり塗ってください',
           '早くあなたの頭に瓶の中の香水をよくふりかけてください'],
    judgment: true,
    demands: ['dog_whistle'],
    demandText: '壁に、もう一枚。\n「まだお持ちですね。……お預かりします」',
    surrender: [],
    applies: 'cream',
    obeyLabel: 'クリームを塗り、香水を振りかける',
    obeyText: '顔と手足にクリームを塗る。酢のような匂いの香水を頭に振る。\n——これは、料理の話だろうか。',
    refuseText: 'クリームには触らない。香水も振らない。\n壺の中身は、思ったより粗い。',
    examine: {
      label: 'クリームの壺を調べる',
      focus: 'rooms/05_oilroom/cream_jar.png',
      text: '白いクリーム。指ですくうと、塩の粒が混じっている。\n匂いは、菓子ではない。',
    },
    obstacle: {
      kind: 'smell',
      when: (s) => s.obeyed[5],   // 香水を振った＝匂いで位置がバレる
      text: '自分の頭から、酢のような匂いが立っている。\nこれでは、どこにいるか向こうに分かってしまう。',
      solvedBy: ['matches'],
      solveText: 'マッチを擦り、髪の匂いを焼く。焦げた匂いが匂いを覆った。',
      penalty: 1,
      penaltyText: '匂いを消せない。扉の向こうで、鼻を鳴らす音がした。',
    },
  },

  6: {
    n: 6, id: 'kitchendoor', name: '厨房前',
    sign: ['いろいろ注文が多くてうるさかったでしょう',
           'お気の毒でした。もうこれだけです',
           'どうか体中に、壺の中の塩を',
           'たくさんよくもみこんでください'],
    judgment: false,
    reveal: true,
    obstacle: {
      kind: 'locked_door',
      when: () => true,
      text: '来た道の扉が、閉まっている。押しても引いても動かない。',
      solvedBy: ['penknife', 'pocket_watch'],
      solveText: {
        penknife: 'ペンナイフを隙間に差し込み、閂をこじる。扉が開いた。',
        pocket_watch: '懐中時計の鎖を隙間から通し、閂に引っ掛けて外した。',
      },
      forceLabel: '体当たりする',
      forceText: '肩から二度ぶつかって、ようやく扉が外れた。時間を使った。',
      forceTurns: 2,
    },
  },
};

/** 往路の判断室（仕様書 §4.2）。判断は4室である */
export const JUDGMENT_ROOMS = [2, 3, 4, 5];

/** 復路の巡回順（ターンフロー §4） */
export const RETURN_ORDER = [6, 5, 4, 3, 2, 1];
