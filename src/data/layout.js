/**
 * 各部屋の板ポリ配置（Phase 2）
 *
 * 部屋は 9x9。壁は z=-4.5（ry=0）と x=-4.5（ry=PI/2）の2面。
 * カメラは固定なので、見える範囲だけに置けばよい。
 *
 * y を省略した板は下端が y=0 に接地する。
 * ret に指定した板は、復路でその位置のテクスチャを差し替える。
 *
 * ry は板の方位（既定はカメラ正対）。flat: true は床と同じ水平面に寝かせる
 * （敷物・床に落ちた布だけ。絵も真上視でなければならない）。
 *
 * ★低い家具を「少し倒して」ごまかす口は開けていない。立面図の絵に角度だけ付けても
 * 絵の遠近と場面の遠近が噛み合わず、垂直のままより悪くなる。
 * 低い家具は絵を見下ろし視で描き直す（assets.js の prop_low）。
 */

const WALLS = ['common/wall_panel.png', 'common/wall_plaster.png'];

/**
 * ★壁に掛ける板は必ず壁と平行にする（ry を明示する）。
 *
 * 既定の向きはカメラ正対（約39.6度）なので、奥壁（z=-4.5）際に置くと
 * 板の右端が壁より 0.26 奥に入り、めり込む。Phase 4 で実際に起きた。
 *   奥壁に掛ける → ry: 0
 *   左壁に掛ける → ry: Math.PI / 2
 * 床置き・吊り下げで壁から離れているものは既定（カメラ正対）でよい。
 */
const ON_BACK_WALL = 0;

/**
 * 壁に掛ける板を置く座標。
 *
 * ★壁（±4.5）から離すほど、影が壁の上を大きくずれて「浮いて」見える。
 * 光は [4,8,3] から来るので、壁から 0.2 離すと影は 0.53 下・0.27 横にずれる。
 * 板の裏に隠れる 0.06 まで寄せれば、影はほぼ板の縁に収まる。
 */
const ON_WALL_Z = -4.44;
const ON_WALL_X = -4.44;

/**
 * 扉と看板の寸法。
 *
 * ★奥壁（z=-4.25）で画面に入る高さは y=2.63 までしかない（カメラが俯瞰なので
 *   奥は上がすぐ画面外に出る）。役者は 2.2 なので、扉の板をこれ以上大きくしても
 *   冠の彫りが画面から切れるだけで、開口は高くならない。
 *   → 開口を高くするのは寸法ではなく絵の役目。
 *     door_frame.png は「開口が画像の縦の 9割以上」を満たすこと（assets.js のプロンプト）。
 *
 * 看板は4列20字の文面（衣裳室・厨房前）が読める大きさが下限。
 * 板を大きくすると字も大きくなるので、見える帯いっぱいまで使う。
 */
const DOOR_H = 2.6;
const SIGN_X = -3.5;   // 左端が壁（-4.48）を越えない位置
const SIGN_W = 1.85;
const SIGN_H = 2.0;

export const LAYOUT = {
  entrance: {
    floor: 'common/floor_tile.png',
    walls: WALLS,
    props: [
      { tex: 'common/door_frame.png', x: -1.2, z: ON_WALL_Z, w: 1.7, h: DOOR_H, ry: ON_BACK_WALL, exit: true },
      { tex: 'common/signboard_blank.png', kind: 'sign',
        x: SIGN_X, z: ON_WALL_Z, y: 1.25, w: SIGN_W, h: SIGN_H, ry: ON_BACK_WALL, sign: true },
      { tex: 'rooms/01_entrance/chandelier.png', x: 0.9, z: -3.4, y: 2.7, w: 1.3, h: 1.1,
        ret: 'rooms/01_entrance/chandelier_dark.png' },
      { tex: 'rooms/01_entrance/umbrella_stand.png', x: -3.2, z: -2.6, w: 0.8, h: 1.4 },
      /**
       * ★マットは寝かせる。
       * 絵は元から真上視で描かれているのに垂直の板に貼っていたので、
       * 敷物が立て看板のように立っていた。h は寝かせた奥行きの意味になる。
       * 置き場所は左壁の扉の前。マットは扉の前にあってはじめてマットに見える
       * （床の中央に置くと、ただの染みに見えた）。ry で長辺を壁と平行にする。
       */
      { tex: 'rooms/01_entrance/mat.png', x: -3.4, z: -1.0, w: 1.8, h: 1.0,
        flat: true, ry: -Math.PI / 2 },
      { tex: 'common/door_closed.png', x: ON_WALL_X, z: -1.0, w: 1.4, h: 2.6, ry: Math.PI / 2 },
    ],
  },

  corridor: {
    floor: 'common/floor_wood.png',
    walls: WALLS,
    props: [
      { tex: 'common/door_frame.png', x: -1.2, z: ON_WALL_Z, w: 1.7, h: DOOR_H, ry: ON_BACK_WALL, exit: true },
      { tex: 'common/signboard_blank.png', kind: 'sign',
        x: SIGN_X, z: ON_WALL_Z, y: 1.25, w: SIGN_W, h: SIGN_H, ry: ON_BACK_WALL, sign: true },
      { tex: 'rooms/02_corridor/mirror_tall.png', x: ON_WALL_X, z: -1.6, w: 1.0, h: 2.4, ry: Math.PI / 2 },
      { tex: 'rooms/02_corridor/hair_stand.png', x: 1.7, z: -3.2, w: 1.1, h: 1.2 },
      { tex: 'rooms/02_corridor/boot_scraper.png', x: 2.4, z: -0.8, w: 1.0, h: 0.7 },
      // ★絵に台座がある（壁付けの燭台ではなく脚付きのランプ）。
      //   宙に掛けると必ず浮いて見えるので、床に立てて接地させる（y を省く＝下端が y=0）
      { tex: 'rooms/02_corridor/wall_lamp.png', x: -3.6, z: 0.6, w: 0.9, h: 1.5 },
    ],
  },

  gunroom: {
    floor: 'common/floor_wood.png',
    walls: WALLS,
    props: [
      { tex: 'common/door_frame.png', x: -1.2, z: ON_WALL_Z, w: 1.7, h: DOOR_H, ry: ON_BACK_WALL, exit: true },
      { tex: 'common/signboard_blank.png', kind: 'sign',
        x: SIGN_X, z: ON_WALL_Z, y: 1.25, w: SIGN_W, h: SIGN_H, ry: ON_BACK_WALL, sign: true },
      { tex: 'rooms/03_gunroom/gun_rack.png', x: ON_WALL_X, z: -1.4, w: 1.4, h: 1.9, ry: Math.PI / 2 },
      // ★奥壁は y=2.63 までしか画面に入らない。中心 y に高さの半分を足した値が
      //   これを超えると上が切れる（鹿の角が切れていた）
      { tex: 'rooms/03_gunroom/deer_mount.png', x: 1.4, z: ON_WALL_Z, y: 2.0, w: 1.1, h: 1.2, ry: ON_BACK_WALL },
      { tex: 'rooms/03_gunroom/side_table.png', x: 2.2, z: -2.2, w: 1.0, h: 1.0 },
      { tex: 'rooms/03_gunroom/ammo_box.png', x: -2.9, z: -0.4, w: 0.9, h: 0.6 },
    ],
    retProps: [
      { tex: 'rooms/03_gunroom/rifle_on_floor.png', x: 0.2, z: -0.2, w: 1.7, h: 0.5 },
    ],
  },

  wardrobe: {
    floor: 'common/floor_wood.png',
    walls: WALLS,
    props: [
      { tex: 'common/door_frame.png', x: -1.2, z: ON_WALL_Z, w: 1.7, h: DOOR_H, ry: ON_BACK_WALL, exit: true },
      { tex: 'common/signboard_blank.png', kind: 'sign',
        x: SIGN_X, z: ON_WALL_Z, y: 1.25, w: SIGN_W, h: SIGN_H, ry: ON_BACK_WALL, sign: true },
      { tex: 'rooms/04_wardrobe/coat_rack.png', x: ON_WALL_X, z: -1.2, w: 1.2, h: 2.1, ry: Math.PI / 2,
        ret: 'rooms/04_wardrobe/rack_toppled.png' },
      { tex: 'rooms/04_wardrobe/mirror_ornate.png', x: 1.3, z: ON_WALL_Z, y: 1.7, w: 1.4, h: 1.8, ry: ON_BACK_WALL,
        ret: 'rooms/04_wardrobe/mirror_cracked.png' },
      { tex: 'rooms/04_wardrobe/metal_tray.png', x: 2.3, z: -2.2, w: 1.0, h: 1.1 },
      /**
       * ★靴置きは絵の側を見下ろし視で描き直して直す（assets.js の prop_low）。
       *
       * 板を中途半端に倒して逃げようとしたが、立面図の絵に角度だけ付けても
       * 絵の遠近と場面の遠近が噛み合わず、垂直のままより悪くなった。
       * 板の姿勢はカメラ正対の垂直に戻し、絵を場面と同じ角度で描かせる。
       *
       * 位置は壁際（外套掛けの隣）に置く。背後に壁が来るだけで床から浮かなくなる。
       * 看板が「帽子と外套と靴」を並べて言うので、掛けと置き場が隣にあるのは筋も通る。
       * h は天面が見えるぶん絵が縦に伸びるので 0.6 → 0.9（横幅 1.3 を保つ値）。
       */
      { tex: 'rooms/04_wardrobe/shoe_shelf.png', x: -3.2, z: -1.7, w: 1.3, h: 0.9 },
    ],
    retProps: [
      { tex: 'rooms/04_wardrobe/coat_discarded.png', x: 0.4, z: -0.1, w: 1.5, h: 0.7 },
    ],
  },

  oilroom: {
    floor: 'common/floor_tile.png',
    walls: WALLS,
    props: [
      { tex: 'common/door_frame.png', x: -1.2, z: ON_WALL_Z, w: 1.7, h: DOOR_H, ry: ON_BACK_WALL, exit: true },
      { tex: 'common/signboard_blank.png', kind: 'sign',
        x: SIGN_X, z: ON_WALL_Z, y: 1.25, w: SIGN_W, h: SIGN_H, ry: ON_BACK_WALL, sign: true },
      { tex: 'rooms/05_oilroom/cream_jar.png', x: -2.9, z: -2.4, w: 1.0, h: 1.3,
        ret: 'rooms/05_oilroom/cream_spilled.png' },
      /**
       * ★香水は敷布（white_cloth）と画面で重ならない位置に置く。
       * x:2.0 z:-3.0 だと敷布の掛けの真裏に来て、瓶の 79% が隠れていた
       * （画面での重なりを実測して確かめた）。奥行きが違うだけでは避けられない。
       * 左手前は空いているので、クリームの壺と対になる位置へ移す。
       */
      { tex: 'rooms/05_oilroom/perfume_bottle.png', x: -2.2, z: -0.6, w: 0.7, h: 1.0 },
      { tex: 'rooms/05_oilroom/washstand.png', x: ON_WALL_X, z: -0.6, w: 1.3, h: 1.5, ry: Math.PI / 2 },
      { tex: 'rooms/05_oilroom/white_cloth.png', x: 2.5, z: -1.0, w: 1.2, h: 1.6 },
    ],
  },

  kitchendoor: {
    floor: 'common/floor_tile.png',
    walls: WALLS,
    props: [
      { tex: 'common/signboard_blank.png', kind: 'sign',
        x: SIGN_X, z: ON_WALL_Z, y: 1.25, w: SIGN_W, h: SIGN_H, ry: ON_BACK_WALL, sign: true },
      // 鍵穴のある扉。気づきの瞬間の主役なので、看板と同じ空間・同じ光の下に置く
      { tex: 'rooms/06_kitchendoor/kitchen_door.png', x: 0.2, z: ON_WALL_Z, w: 1.6, h: 2.4, ry: ON_BACK_WALL,
        ret: 'rooms/06_kitchendoor/kitchen_door_eyes.png', keyhole: true },
      { tex: 'rooms/06_kitchendoor/salt_jar.png', x: -2.4, z: -2.0, w: 1.0, h: 1.1 },
      { tex: 'rooms/06_kitchendoor/serving_table.png', x: ON_WALL_X, z: -0.4, w: 1.6, h: 1.2, ry: Math.PI / 2,
        ret: 'rooms/06_kitchendoor/butcher_cloth.png' },
      { tex: 'rooms/06_kitchendoor/greens_basket.png', x: 2.4, z: -1.4, w: 0.9, h: 0.7 },
    ],
  },
};

/** 山道は部屋ではない。壁の代わりに横長の背景板を1枚立てる */
export const MOUNTAIN = {
  m1: { floor: null, backdrop: 'mountain/slope.png',
        props: [{ tex: 'mountain/bamboo.png', x: 2.7, z: -3.2, w: 2.8, h: 1.5 }] },
  m2: { floor: null, backdrop: 'mountain/fallen_tree.png',
        props: [{ tex: 'characters/dog/fallen.png', kind: 'dog', x: -3.9, z: -0.9, w: 2.8, h: 1.4 }] },
  m3: { floor: null, backdrop: 'mountain/restaurant_exterior.png',
        // ★門の札は左に立てる。右は背景の山猫軒と二人が占めている。
        //   右前（x:1.8）に置くと相方をまるごと隠していた
        // ★y を書かない。書くと板が浮き、地面の影だけが足元から離れる
        //   （実際に 0.3 浮いて、影が札の足から外れていた）
        props: [{ tex: 'mountain/gate_sign_blank.png', kind: 'sign',
                  x: -2.9, z: -0.6, w: 1.7, h: 2.0, sign: true }] },
};

/** 部屋番号 → レイアウトの id */
export const ROOM_ID = {
  1: 'entrance', 2: 'corridor', 3: 'gunroom',
  4: 'wardrobe', 5: 'oilroom', 6: 'kitchendoor',
};
