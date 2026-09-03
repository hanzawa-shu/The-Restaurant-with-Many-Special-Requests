/**
 * アセットの唯一の出典（single source of truth）
 *
 * ★docs/プロンプト集.md と docs/アセット一覧.md は、このファイルから
 *   `node scripts/gen-prompts.mjs` で生成する。手で書かない。
 *
 * 散文のドキュメントとコードを二重管理すると必ずずれる。
 * 実際に、コードが使う6枚が一覧から漏れていた。
 *
 * recipe が VIEW と TECH の両方を決める。だから
 *   STYLE_BASE + SUBJECT + RECIPE
 * を連結すれば、判断の余地なく完成したプロンプトになる。
 */

export const STYLE_BASE =
  'storybook illustration in delicate watercolor wash over fine copperplate ' +
  'etching linework, muted desaturated palette of aged ivory, dusty ochre, ' +
  'faded moss green and oxidized silver, Taisho-era Japanese art nouveau ' +
  'ornament, thin confident ink outlines, subtle laid-paper grain, restrained detail';

const NO_MARKS = 'no text, no lettering, no watermark, no signature';
const FLAT = 'flat even ambient lighting, NO cast shadows, NO drop shadow, no baked highlights, no perspective distortion';
/**
 * 見下ろし視の絵に使う照明指定。
 * ★FLAT の `no perspective distortion` を外す。角度を付けて描かせるのに
 * 「遠近を付けるな」と併記すると矛盾したプロンプトになる。
 * 排したいのは広角レンズの歪みだけなので、そう書く。
 */
const FLAT_ANGLED = 'flat even ambient lighting, NO cast shadows, NO drop shadow, no baked highlights, no wide-angle lens distortion';
const CUTOUT = 'isolated subject on solid pure magenta background (#FF00FF), centered, full subject visible, no cropping';

/**
 * レシピ。
 *
 * ★「面」（床・壁・背景）にマゼンタ背景を指定してはいけない。
 * 面は板いっぱいに貼るので、抜く必要がないどころか抜けてはいけない。
 * cut: false のレシピはクロマキーを通さない（chromaKey.js が kind で判定する）。
 */
export const RECIPES = {
  /**
   * 床。
   *
   * ★向きのある幾何模様（ヘリンボーン、シェブロン）は避ける。
   * 継ぎ目のずれが一目で分かるうえ、鏡張りで逃げることもできない
   * （反転すると V 字の折り返しが継ぎ目より目立つ）。
   * 幅の違う板を不規則に並べる、といった絵にすれば両方隠れる。
   *
   * 格子模様（市松など）にする場合は、枡の数を偶数にして端が揃うようにする。
   */
  floor: {
    label: '床（面）', kind: 'floor', cut: false, px: 1024, fmt: 'JPEG',
    view: 'seamless tileable texture, viewed straight from directly above, perfectly top-down, no objects on the surface',
    tech: `${FLAT}, edges must tile seamlessly, fills the frame edge to edge, `
        + `avoid strong directional geometric patterns such as herringbone or chevron, `
        + `they make the seams obvious, ${NO_MARKS}`,
  },
  wall: {
    label: '壁（面）', kind: 'wall', cut: false, px: 1024, fmt: 'JPEG',
    view: 'flat wall surface, viewed straight from the front, perfectly head-on, no floor or ceiling visible',
    tech: `${FLAT}, fills the frame edge to edge, ${NO_MARKS}`,
  },
  backdrop: {
    label: '背景（面）', kind: 'backdrop', cut: false, px: 1792, fmt: 'JPEG',
    view: 'wide landscape, viewed from a slightly elevated angle, horizon about one third up from the bottom, 21:9',
    tech: `soft flat daylight, no harsh cast shadows, no vignette, fills the frame edge to edge, ${NO_MARKS}`,
  },
  /**
   * 立て板。
   *
   * ★真正面（head-on）で成立するのは「背の高いもの」だけ。
   * カメラは水平から 22 度見下ろしているので、腰より低いものは天面が見える。
   * 立面図で描かせて垂直の板に貼ると、天面が無いまま床に立つので
   * 「床に貼ったシール」になる（衣裳室の靴置きが実際にそうなった）。
   * 低いものは prop_low、床に寝ているものは prop_flat を使う。
   */
  prop: {
    label: '立て板（抜き）', kind: 'prop', cut: true, px: 1024, fmt: 'PNG',
    view: 'viewed straight from the front, perfectly head-on, standing upright, base resting on the very bottom edge of the frame',
    tech: `${FLAT}, ${CUTOUT}, ${NO_MARKS}`,
  },

  /**
   * 低い立て板（腰より低い床置きの家具・箱・籠）。
   *
   * ★カメラの姿勢をそのままプロンプトに書く。
   * 固定カメラは方位 40 度・水平から 22 度見下ろし（camera.js の SHOT.WIDE）。
   * その角度で見た絵をそのまま垂直の板に貼れば、絵の遠近と場面の遠近が一致する。
   * 「三分の四視で」と曖昧に書くと、生成ごとに角度が変わって部屋の中でばらつく。
   * 角度を数字で固定するのが要点。
   *
   * 手前下の角が画像の下端に来ること。ここがずれると接地が崩れる（設計書 §4.2）。
   */
  prop_low: {
    label: '低い立て板（抜き・見下ろし）', kind: 'prop', cut: true, px: 1024, fmt: 'PNG',
    view: 'viewed from a fixed raised three-quarter angle, the viewpoint 22 degrees above the horizon '
        + 'and 40 degrees to the right of the object\'s front, '
        + 'so that the front face and the top surface are both clearly visible '
        + 'and one side recedes to the left, '
        + 'the nearest bottom corner resting on the very bottom edge of the frame',
    tech: `${FLAT_ANGLED}, ${CUTOUT}, `
        + `no ground plane, no floor, no rug or base under the object, ${NO_MARKS}`,
  },

  /**
   * 寝かせる板（敷物・床に落ちた布）。
   *
   * ★これは立て板ではない。床と同じ水平面に貼る（stage.js が flat で寝かせる）。
   * だから絵は**真上から**でなければならない。見下ろし 22 度で描かせると
   * 遠近が二重に付いて、床の上で歪む。
   * 玄関のマットは元から真上視で描かれていたのに垂直の板に貼っていたため、
   * 敷物が立て看板のように立っていた。
   */
  prop_flat: {
    label: '寝かせる板（抜き・真上から）', kind: 'prop', cut: true, px: 1024, fmt: 'PNG',
    view: 'lying flat on the ground, viewed straight from directly above, perfectly top-down, '
        + 'the whole object visible with a small margin on every side',
    tech: `${FLAT}, ${CUTOUT}, `
        + `no ground plane, no floor visible around the object, ${NO_MARKS}`,
  },
  /**
   * 看板の板。
   *
   * ★「書ける面」は、まわりより明るい無地の矩形でなければならない。
   * 文字は render/signboard.js が実行時に描く。書く場所は絵から探している
   * （明るい画素の行・列の連続を見る）。枠と同じ明るさだと見つけられず、
   * 板の全面に書いてしまう。彫りの枠や吊り鎖の上に文字が乗ったのはこれが原因。
   */
  sign: {
    label: '看板の板（抜き・文字なし）', kind: 'sign', cut: true, px: 1024, fmt: 'PNG',
    view: 'viewed straight from the front, perfectly head-on, the whole board visible with a small margin on every side',
    tech: `${FLAT}, ${CUTOUT}, `
        + `the writing surface is a single plain rectangular panel of pale ivory, `
        + `clearly lighter than the frame around it, covering at least three quarters `
        + `of the board in both directions, `
        + `completely blank board face, absolutely no characters or marks on the surface, ${NO_MARKS}`,
  },
  /**
   * 縁に立てる帯（地面板の縁を隠す草など）。
   *
   * ★prop（1024正方基準）では横長にすると縦が 128px しか残らず、
   * 草の先の抜けが潰れる。長さと縦の細かさを両立させるため長辺を 2048 にする。
   * 左右は画面の外へ続かせる（中央に寄せると端に切れ目ができる）。
   */
  edge: {
    label: '縁の帯（抜き）', kind: 'prop', cut: true, px: 2048, fmt: 'PNG',
    view: 'viewed from the side at eye level, perfectly head-on, '
        + 'the band running off both the left and right edges of the frame, '
        + 'the bottom edge of the band flush with the very bottom of the frame',
    tech: `${FLAT}, isolated subject on solid pure magenta background (#FF00FF), `
        + `opaque all along the bottom edge with no gaps, ${NO_MARKS}`,
  },
  actor: {
    label: 'キャラ（抜き）', kind: 'actor', cut: true, px: 1024, fmt: 'PNG',
    view: 'full body, standing, viewed from the front slightly above, feet fully visible and touching the very bottom edge of the frame',
    tech: `${FLAT}, ${CUTOUT}, ${NO_MARKS}`,
  },
  face: {
    label: '表情（抜き）', kind: 'actor', cut: true, px: 512, fmt: 'PNG',
    view: 'head and shoulders close-up, viewed from the front, top of the head near the upper edge of the frame',
    tech: `${FLAT}, ${CUTOUT}, ${NO_MARKS}`,
  },
  animal: {
    label: '犬（抜き）', kind: 'dog', cut: true, px: 1024, fmt: 'PNG',
    view: 'full bodies, viewed from the front slightly above, resting on the very bottom edge of the frame',
    tech: `${FLAT}, ${CUTOUT}, ${NO_MARKS}`,
  },
  /**
   * 寄りの一枚絵。鍵穴の眼玉のように、対象だけを画面いっぱいに寄って描くもの。
   *
   * ★一枚絵なのにマゼンタで抜くのは意図的。
   * 画面いっぱいに置くとき、絵の縦横比は生成ごとにぶれる。
   * 抜いて外周を切り詰めてから比率を保って収めれば、
   * 余りは暗闇として成立する（引き伸ばすと必ず崩れる）。
   */
  detail: {
    label: '寄りの一枚絵（抜き）', kind: 'eyes', cut: true, px: 1536, fmt: 'PNG',
    view: 'extreme close-up of the subject alone, viewed straight from the front, filling the frame',
    tech: `${FLAT}, ${CUTOUT}, ${NO_MARKS}`,
  },
  scene: {
    label: '一枚絵', kind: 'scene', cut: false, px: 1536, fmt: 'JPEG',
    view: 'single illustration, free composition, 16:9',
    tech: `${NO_MARKS}`,
  },
};

/**
 * 全アセット。
 * wired: false は「まだコードで使っていないが、後の工程で使う」もの。
 */
export const ASSETS = [
  // ---------------- 共通の面 ----------------
  { p: 'common/floor_wood.png',  r: 'floor', ar: [1, 1],
    s: 'aged western plank floor, boards of clearly varying widths laid parallel in one direction, '
     + 'board ends staggered irregularly, dark worn stained oak, subtle gaps between the boards',
    use: '廊下・衣裳室・銃器室の床。★ヘリンボーンは継ぎ目が目立つので不規則な板張りにした' },
  { p: 'common/floor_tile.png',  r: 'floor', ar: [1, 1], s: 'black and white checkerboard marble floor tiles, slightly cracked', use: '玄関・香油室・厨房前の床' },
  { p: 'common/wall_panel.png',  r: 'wall', ar: [1, 1],  s: 'pale dark-stained wainscoting panelled wall with art nouveau vine moulding, sun-faded striped wallpaper above, light overall value', use: '全室の壁（腰板張り）' },
  { p: 'common/wall_plaster.png', r: 'wall', ar: [1, 1], s: 'pale cream plaster wall, water-stained, thin art nouveau border stencil near the top, light overall value', use: '全室の壁（漆喰）' },

  // ---------------- 共通の板 ----------------
  { p: 'common/signboard_blank.png', r: 'sign', ar: [9, 10], s: 'varnished wooden signboard with art nouveau carved frame, hanging from two brass chains', use: '★全6室で共有する看板の板。文字は Canvas 2D で描く' },
  { p: 'common/door_closed.png', r: 'prop', ar: [1, 2], s: 'tall western wooden door, closed, brass handle, small keyhole', use: '玄関の装飾（左壁）' },
  { p: 'common/door_frame.png',  r: 'prop', ar: [1, 2],
    s: 'a tall western doorway standing open, the dark opening reaching from the very bottom edge of the frame '
     + 'up to nine tenths of the height, filled with darkness, '
     + 'surrounded by a narrow art nouveau carved jamb no wider than one twelfth of the image, '
     + 'no cornice, no pediment, no wall above the door',
    use: '★各室の出口の扉。退室の歩きの行き先。'
       + '開口が画像の縦9割を占めること（奥壁で画面に入る高さは 2.6 しかなく、'
       + '冠や梁を描き足すと開口が役者の背丈 2.2 より低くなって通れなく見える）' },

  // ---------------- 玄関 ----------------
  { p: 'rooms/01_entrance/mat.png', r: 'prop_flat', ar: [2, 1], s: 'worn western entrance mat, faded floral border',
    use: '装飾。★床に寝かせる板（stage.js の flat）。既存の絵は元から真上視なので作り直し不要' },
  { p: 'rooms/01_entrance/umbrella_stand.png', r: 'prop', ar: [3, 5], s: 'brass umbrella stand containing two black western umbrellas', use: '装飾' },
  { p: 'rooms/01_entrance/chandelier.png', r: 'prop', ar: [6, 5], s: 'small art nouveau brass chandelier with frosted glass tulip shades, hanging', use: '装飾' },
  { p: 'rooms/01_entrance/chandelier_dark.png', r: 'prop', ar: [6, 5], s: 'small art nouveau brass chandelier, all glass shades dark and cold, one shade missing', use: '復路の差分（明かりが消えている）' },

  // ---------------- 廊下 ----------------
  { p: 'rooms/02_corridor/mirror_tall.png', r: 'prop', ar: [2, 5], s: 'tall narrow western standing mirror in art nouveau frame, dim reflection', use: '調べる対象' },
  { p: 'rooms/02_corridor/hair_stand.png', r: 'prop', ar: [9, 10], s: 'small marble-topped stand with a comb, a hand mirror and a porcelain water jug', use: '指示の対象（髪を整える）' },
  { p: 'rooms/02_corridor/boot_scraper.png', r: 'prop_low', ar: [3, 2], s: 'cast iron boot scraper and a coarse bristle brush on a low wooden stand', use: '指示の対象（泥を落とす）' },
  { p: 'rooms/02_corridor/wall_lamp.png', r: 'prop', ar: [2, 3], s: 'tall art nouveau brass floor lamp with a single amber glass shade, standing on a wide moulded base', use: '装飾（床置き。台座が描かれるので壁には掛けない）' },

  // ---------------- 銃器室 ----------------
  { p: 'rooms/03_gunroom/gun_rack.png', r: 'prop', ar: [3, 4], s: 'empty wooden gun rack for two hunting rifles, brass fittings', use: '指示の対象（鉄砲を置く）' },
  { p: 'rooms/03_gunroom/ammo_box.png', r: 'prop_low', ar: [3, 2], s: 'open wooden ammunition box with brass cartridges, leather strap', use: '指示の対象（弾丸を置く）' },
  { p: 'rooms/03_gunroom/deer_mount.png', r: 'prop', ar: [9, 10], s: 'mounted deer head trophy on a wooden shield plaque, glass eyes, the neck not stitched to the plaque but cut clean through, the cut edge raw and wet', use: '調べる対象（切り口が新しい）' },
  { p: 'rooms/03_gunroom/side_table.png', r: 'prop', ar: [1, 1], s: 'small round side table with a shallow brass tray for small metal objects', use: '小物の受け皿' },
  { p: 'rooms/03_gunroom/rifle_on_floor.png', r: 'prop', ar: [7, 2], s: 'single hunting rifle lying abandoned on the floor, dust on the barrel', use: '★復路の罠（拾えるが効かない）' },

  // ---------------- 衣裳室 ----------------
  { p: 'rooms/04_wardrobe/coat_rack.png', r: 'prop', ar: [3, 5], s: 'empty art nouveau wooden coat and hat rack with curved brass hooks', use: '指示の対象（外套・帽子）' },
  { p: 'rooms/04_wardrobe/rack_toppled.png', r: 'prop', ar: [3, 5], s: 'wooden coat rack toppled over on its side, one brass hook bent', use: '復路の差分' },
  { p: 'rooms/04_wardrobe/mirror_ornate.png', r: 'prop', ar: [4, 5], s: 'large ornate oval mirror in art nouveau gilt frame, clouded glass, a dozen thin claw scratches scored into the inner edge of the frame', use: '調べる対象（内側からの引っかき傷）' },
  { p: 'rooms/04_wardrobe/mirror_cracked.png', r: 'prop', ar: [4, 5], s: 'large ornate oval mirror with a single long crack across the glass', use: '復路の差分' },
  { p: 'rooms/04_wardrobe/metal_tray.png', r: 'prop', ar: [9, 10], s: 'pedestal stand holding a wide silver tray for pocket watches, spectacles and small metal items, empty', use: '小物の受け皿' },
  { p: 'rooms/04_wardrobe/shoe_shelf.png', r: 'prop_low', ar: [3, 2], s: 'low wooden two-tier shoe shelf, empty, one shoehorn hanging on the side',
    use: '指示の対象（靴）。★立面図で描かせていたため床に貼ったシールに見えていた。見下ろし視で作り直す' },
  { p: 'rooms/04_wardrobe/coat_discarded.png', r: 'prop_low', ar: [2, 1], s: 'dark western overcoat and a pair of leather shoes dropped in a heap',
    use: '★復路の誘惑（拾えば腹が満ちるが重くなる）。既存の絵も見下ろし視なので作り直しは任意' },

  // ---------------- 香油室 ----------------
  { p: 'rooms/05_oilroom/cream_jar.png', r: 'prop', ar: [3, 4], s: 'large white porcelain jar of pale cream on a marble pedestal, lid removed', use: '指示の対象／調べる対象' },
  { p: 'rooms/05_oilroom/cream_spilled.png', r: 'prop', ar: [3, 4], s: 'white porcelain jar knocked over, pale cream spilled in a wide pool', use: '復路の差分' },
  { p: 'rooms/05_oilroom/perfume_bottle.png', r: 'prop', ar: [2, 3], s: 'tall cut-glass perfume bottle with brass atomizer bulb on a small table', use: '指示の対象（香水）' },
  { p: 'rooms/05_oilroom/washstand.png', r: 'prop', ar: [9, 10], s: 'western porcelain washstand with brass taps, folded white towels', use: '装飾' },
  { p: 'rooms/05_oilroom/white_cloth.png', r: 'prop', ar: [3, 4], s: 'wooden rail draped with long white linen cloths', use: '伏線（復路の敷布と対応）' },

  // ---------------- 厨房前 ----------------
  { p: 'rooms/06_kitchendoor/kitchen_door.png', r: 'prop', ar: [2, 3],
    s: 'heavy aged western wooden door, tightly closed, deeply grained dark old timber, '
     + 'TWO large keyholes side by side at the exact horizontal centre, placed slightly above the middle of the door, '
     + 'the left keyhole is the silhouette of a table fork, the right keyhole is the silhouette of a table knife, both cut clean through the wood, tarnished silver inlay framing each, '
     + 'the openings pitch black and empty, nothing behind them',
    use: '★往路の扉。原作「大きなかぎ穴が二つつき、銀いろのホークとナイフの形が切りだしてあって」' },
  /**
   * ★鍵穴を覗いたカットは2枚に分ける（扉／眼玉）。
   * 1枚で「暗闇に眼玉」を出すより、扉を見せてから溶かして眼玉に変えるほうが怖い。
   * かぎ穴の黒と眼玉の背景の黒が同じなので、位置合わせなしでつながる。
   * 面（scene）として扱う。マゼンタを抜かず、切り詰めもしない
   * ——切り詰めると2枚の位置がずれて溶け目が動く。
   */
  { p: 'rooms/06_kitchendoor/keyhole_eyes_door.png', r: 'scene', ar: [2, 1],
    s: 'extreme close-up of a heavy wooden kitchen door, two large keyholes side by side '
     + 'cut in the shape of a fork and a knife, tarnished silver escutcheons, '
     + 'art nouveau ornament in aged ivory framing them, the openings pitch black and empty, '
     + 'filling the whole frame',
    use: '★覗いた瞬間・1枚目（扉）。かぎ穴はまだ空っぽ' },
  { p: 'rooms/06_kitchendoor/keyhole_eyes_eyes.png', r: 'scene', ar: [2, 1],
    s: 'two enormous feline eyes side by side on pitch black, filling the whole frame, '
     + 'pale blue irises shot through with red veins, narrow vertical slit pupils, '
     + 'glaring straight at the viewer, nothing else visible',
    use: '★覗いた瞬間・2枚目（眼玉）。1枚目から溶けて入れ替わる。最重要カット' },
  { p: 'rooms/06_kitchendoor/kitchen_door_eyes.png', r: 'prop', ar: [2, 3],
    s: 'heavy aged western wooden door, tightly closed, deeply grained dark old timber, '
     + 'TWO large keyholes side by side at the exact horizontal centre, placed slightly above the middle of the door, '
     + 'the left keyhole is the silhouette of a table fork, the right keyhole is the silhouette of a table knife, both cut clean through the wood, tarnished silver inlay framing each, '
     + 'and one blazing pale blue feline eye with a narrow vertical slit pupil glaring out through each keyhole '
     + 'from the darkness behind, the eyes are the only bright thing',
    use: '★覗いたあとの扉。kitchen_door.png と同じ扉で、鍵穴から眼玉が覗いているだけの差分' },
  { p: 'rooms/06_kitchendoor/salt_jar.png', r: 'prop', ar: [9, 10],
    s: 'handsome blue glazed Seto porcelain salt jar, lid removed, filled with coarse grey salt, on a low wooden stand',
    use: '★反転の中心／調べる対象。原作「立派な青い瀬戸の塩壺」' },
  { p: 'rooms/06_kitchendoor/serving_table.png', r: 'prop', ar: [4, 3], s: 'long serving table with stacked white porcelain plates and folded napkins', use: '伏線' },
  { p: 'rooms/06_kitchendoor/butcher_cloth.png', r: 'prop', ar: [4, 3], s: 'long white linen cloth spread on a table, dark wet stain soaked through the centre', use: '★意味の反転（白布→血抜きの敷布）' },
  { p: 'rooms/06_kitchendoor/greens_basket.png', r: 'prop_low', ar: [4, 3], s: 'wicker basket of salted leafy greens, wilted', use: '伏線（菜っ葉＝原作準拠）' },

  // ---------------- 山道 ----------------
  { p: 'mountain/ground.png', r: 'floor', ar: [1, 1], mirror: true,
    s: 'autumn mountain grass and bare earth ground, irregular organic texture, no repeating motif, no straight lines',
    use: '山道の地面。★鏡張りで敷くので、継ぎ目を合わせる必要はない' },
  { p: 'mountain/slope.png', r: 'backdrop', ar: [22, 9], s: 'steep autumn mountain slope in northern Japan, tall dry grass bending in wind, no people', use: 'カット1の背景' },
  { p: 'mountain/fallen_tree.png', r: 'backdrop', ar: [22, 9], s: 'huge fallen tree across a mountain path, moss covered, wind-bent grasses', use: 'カット2の背景' },
  { p: 'mountain/restaurant_exterior.png', r: 'backdrop', ar: [22, 9], s: 'small ornate western brick and stucco building standing absurdly alone in a Japanese mountain grassland, art nouveau porch, warm light in the windows', use: 'カット3の背景（山猫軒の発見）' },
  { p: 'mountain/bamboo.png', r: 'prop', ar: [2, 1], s: 'dense low bamboo thicket, narrow trodden path disappearing into it', use: 'カット1の前景' },
  /**
   * ★地面板の遠い縁に立てる帯。3カット共用。
   * 地面（14x14 の板）の縁が幾何学的な直線として見えるのを、
   * 不規則なシルエットで壊すのが役目。下半分は密に、上は疎に抜ける絵にする
   * ——下が透けると隠せないし、上が密だと壁のように見える。
   */
  { p: 'mountain/grass_edge.png', r: 'edge', ar: [8, 1],
    s: 'a long horizontal band of dry autumn grass and low weeds seen from the side at eye level, '
     + 'densely packed and opaque along the bottom half, thinning into irregular scattered tips at the top, '
     + 'the silhouette uneven all along its length with taller clumps and gaps, '
     + 'a few dry seed heads, no ground or sky visible, '
     + 'the space between the stems in the lower half filled with dark shaded earth, not pale',
    use: '★地面板の遠い縁に立てる。境目の直線を壊す。山道3カット共用' },
  { p: 'mountain/gate_sign_blank.png', r: 'sign', ar: [5, 6], s: 'varnished wooden signboard with art nouveau carved frame on two wooden posts, standing in grass', use: '門の札。文字は Canvas 2D で描く' },

  // ---------------- キャラ ----------------
  { p: 'characters/player/stage0.png', r: 'actor', ar: [1, 2], s: 'young Japanese gentleman in full 1920s western hunting attire, tweed jacket, breeches, leather boots, flat cap, empty hands, seen from behind three-quarters, face not visible', use: '主人公・正装' },
  { p: 'characters/player/stage1.png', r: 'actor', ar: [1, 2], s: 'same young gentleman, cap removed, hair neatly combed, boots clean, seen from behind three-quarters, face not visible', use: '主人公・帽子なし' },
  { p: 'characters/player/stage2.png', r: 'actor', ar: [1, 2], s: 'same young gentleman stripped to his white cotton undershirt and drawers, barefoot, seen from behind three-quarters, face not visible', use: '主人公・下着姿' },
  { p: 'characters/player/stage3.png', r: 'actor', ar: [1, 2], s: 'same young gentleman in undergarments, skin glistening wet with pale cream, seen from behind three-quarters, face not visible', use: '主人公・クリーム塗布' },
  { p: 'characters/partner/stage0.png', r: 'actor', ar: [1, 2], s: 'second young Japanese gentleman in full 1920s western hunting attire, round spectacles, slightly leaner, alert wary expression, facing forward', use: '相方・正装' },
  { p: 'characters/partner/stage1.png', r: 'actor', ar: [1, 2], s: 'same second gentleman, cap removed, hair combed, boots clean, wary expression, facing forward', use: '相方・帽子なし' },
  { p: 'characters/partner/stage2.png', r: 'actor', ar: [1, 2], s: 'same second gentleman stripped to white cotton undershirt and drawers, barefoot, arms crossed, facing forward', use: '相方・下着姿' },
  { p: 'characters/partner/stage3.png', r: 'actor', ar: [1, 2], s: 'same second gentleman in undergarments, skin glistening wet with pale cream, hollow exhausted expression, facing forward', use: '相方・クリーム塗布' },
  { p: 'characters/player/rifle_held.png', r: 'prop', ar: [1, 3], s: 'single hunting rifle held upright at a slight angle, no hands visible', use: '主人公の鉄砲（独立レイヤー）' },
  { p: 'characters/partner/rifle_held.png', r: 'prop', ar: [1, 3], s: 'single hunting rifle slung on a leather shoulder strap, no body visible', use: '相方の鉄砲（独立レイヤー）' },

  // ---------------- 犬・猟師 ----------------
  { p: 'characters/dog/fallen.png', r: 'animal', ar: [2, 1], s: 'two large white hunting dogs like polar bears collapsed on mountain grass, foam at their mouths, a small silver whistle visible on one collar', use: '★山道カット2（笛の入手）' },
  { p: 'characters/dog/alive.png', r: 'animal', ar: [3, 2], s: 'two large white hunting dogs like polar bears, standing alert, one wearing a small silver whistle on its collar', use: '山道カット1' },
  { p: 'characters/dog/charging.png', r: 'animal', ar: [5, 3], s: 'two large white hunting dogs mid-leap, jaws open, fur bristling, bursting forward', use: '玄関で扉を突き破る' },

  // ---------------- 相方の表情 ----------------
  { p: 'characters/partner/face_doubt.png', r: 'face', ar: [1, 1], s: 'close-up face of a young Japanese gentleman with round spectacles, narrowed suspicious eyes', use: 'P 12〜9' },
  { p: 'characters/partner/face_confused.png', r: 'face', ar: [1, 1], s: 'same face, brows drawn together, uncertain', use: 'P 8〜6' },
  { p: 'characters/partner/face_begging.png', r: 'face', ar: [1, 1], s: 'same face, hollow-cheeked, pleading, spectacles slipping', use: 'P 5〜3' },
  { p: 'characters/partner/face_surrender.png', r: 'face', ar: [1, 1], s: 'same face, eyes lowered, mouth slack, all resistance gone', use: 'P 2〜0（折れる）' },
  { p: 'characters/partner/face_despair.png', r: 'face', ar: [1, 1], s: 'same face crumpled like wastepaper, weeping without sound', use: '反転の直後' },
  { p: 'characters/partner/face_resolve.png', r: 'face', ar: [1, 1], s: 'same face, tears dried, jaw set, looking straight ahead', use: 'TrueEnd 直前' },

  // ---------------- エンディング ----------------
  { p: 'endings/cooked.png', r: 'scene', ar: [16, 9], s: 'a wide white porcelain plate on a linen cloth, salted leafy greens arranged neatly beside an empty space, a knife and napkin laid ready, seen from above, total darkness beyond the edge of the table', use: '結末1・調理' },
  { p: 'endings/together.png', r: 'scene', ar: [16, 9], s: 'two pale hands still gripping each other, seen against darkness, a long clawed shadow falling across them', use: '結末2・共倒れ' },
  { p: 'endings/alone.png', r: 'scene', ar: [16, 9], s: 'a single young gentleman in torn undergarments walking down an autumn mountain path at dusk, seen from behind, an untouched rice dumpling in his open hand', use: '結末3・独り' },
  { p: 'endings/original.png', r: 'scene', ar: [16, 9], s: 'an autumn mountain grassland at dusk, an overcoat hanging from a branch, shoes and a wallet scattered among the roots, two white dogs returning through the grass, and far away on another hillside a small ornate western building with a lit sign', use: '結末4・原作' },
  { p: 'endings/true.png', r: 'scene', ar: [16, 9], s: 'two young gentlemen in torn undergarments descending a mountain path at sunrise, two large white dogs walking beside them, a straw-hatted hunter ahead, their faces crumpled like wastepaper but calm', use: '結末5・TrueEnd' },
];

/**
 * 目標のピクセル寸法。縦横比と長辺の目標から決める。
 *
 * ★縦横比は「目安」であって厳密でなくてよい。
 * 板の側で吸収する仕組みがある（設計書 §5.2）。
 *   抜き板 … 不透明部分に切り詰めてから、絵の比で板を作る
 *   壁     … はみ出す方を切り落として中央を使う
 *   床     … 繰り返し数で打ち消す
 * 合っていれば無駄なピクセルが減る、という程度の意味。
 *
 * 長辺のピクセル数は守ってほしい。守らないと読み込みが重くなる。
 */
export function pixelsFor(asset) {
  const r = RECIPES[asset.r];
  const [aw, ah] = asset.ar;
  const long = r.px;
  const round8 = (n) => Math.round(n / 8) * 8;
  return aw >= ah
    ? [long, round8(long * ah / aw)]
    : [round8(long * aw / ah), long];
}

/**
 * 完成したプロンプトを組み立てる。判断の余地はない。
 *
 * ★保存形式は「全部 PNG」ではない。
 * 透明が要るのは抜き板だけ。面（床・壁・背景・一枚絵）は端まで絵で埋まるので
 * 透明を持つ意味がなく、PNG にすると水彩の粒子が圧縮できずに 2MB を超える。
 * 同じ絵を JPEG にすれば 1/4 になる（実測 2206KB → 515KB）。
 */
export function promptFor(asset) {
  const r = RECIPES[asset.r];
  const [pw, ph] = pixelsFor(asset);
  const size = `aspect ratio ${asset.ar[0]}:${asset.ar[1]}, output ${pw} x ${ph} pixels, ${r.fmt}`;

  let view = r.view;
  let tech = r.tech;
  // 鏡張りで敷く床は、継ぎ目を合わせる必要がない。要らない制約は外す
  if (asset.mirror) {
    view = view.replace('seamless tileable texture, ', '');
    tech = tech.replace('edges must tile seamlessly, ', '');
  }

  return [STYLE_BASE, asset.s, view, tech, size].join(',\n');
}

/** クロマキーを通す種類かどうか。面は絶対に抜かない */
export function isCutout(recipeId) {
  return !!RECIPES[recipeId]?.cut;
}

/**
 * 鏡張り（MirroredRepeatWrapping）で敷く床かどうか。
 *
 * 鏡張りは継ぎ目を必ず一致させるが、代わりに左右反転が見える。
 *   向いている  … 地面・土・草のような不規則で向きのない絵
 *   向いていない … 板張り・市松のように向きや直線がある絵
 *                  （反転すると V 字の折り返しが継ぎ目より目立つ）
 */
export function isMirrored(path) {
  return !!ASSETS.find((a) => a.p === path)?.mirror;
}
