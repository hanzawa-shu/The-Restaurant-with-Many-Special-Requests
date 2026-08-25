/**
 * 状態オブジェクト（ターンフロー §0）
 *
 * このモジュールは three を import しない。
 * items は Set ではなく配列で持つ（ハッシュ化とテストを単純にするため）。
 */

export const H_MAX = 12;
export const P_MAX = 12;
export const D_INIT = 3;

export function createState() {
  return {
    // 進行
    phase: 'MOUNTAIN',      // MOUNTAIN | OUTBOUND | REVEAL | RETURN | ENDING
    step: 'm1',
    room: 0,

    // ゲージ
    H: 10,
    P: 8,      // 相方は主人公より弱っている。放置すれば5室目で折れる
    D: D_INIT,

    // 所持（立ち絵に出る2つ）
    hasGun: true,
    hasCoat: true,
    // 小物。紳士たちは最初からこれらを持っている。
    // 銀の犬笛だけは山道で犬から手に入れる（仕様書 §3 カット2）
    items: ['penknife', 'pocket_watch', 'glasses', 'matches'],

    // 服従フラグ（部屋番号ごと）
    obeyed: { 2: false, 3: false, 4: false, 5: false },

    // 相方
    partnerBroken: false,
    partnerPresent: true,

    // 犬
    dogBuried: false,

    // 分岐結果
    saltApplied: false,
    caught: false,
    pushedPartner: false,
    abandonedPartner: false,
    chargedIn: false,
    gunFired: false,

    // 一時領域
    examined: {},           // 部屋ごとに「調べる」を使ったか
    talked: {},             // 部屋ごとに相方と話したか
    hideSel: [],            // 「一部を隠す」で選択中の小物
    pendingReward: 0,
    returnPartnerHandled: false,
    turnExtra: 0,           // その部屋で余分に使ったターン
    penalty: 0,             // その部屋で受けた追跡ペナルティ

    // 表示用（ハッシュには含めない）
    log: [],
    ending: null,
    focus: null,       // 「調べる」で寄る板のパス
    spoke: false,      // 相方が口をひらいたか（肖像の出し入れだけに使う）
  };
}

/** 不変更新のための複製 */
export function cloneState(s) {
  return {
    ...s,
    obeyed: { ...s.obeyed },
    items: [...s.items],
    examined: { ...s.examined },
    talked: { ...s.talked },
    hideSel: [...s.hideSel],
    log: [...s.log],
  };
}

/**
 * 到達可能性テストで状態を同一視するためのハッシュ。
 * log は含めない（無限に伸びるため）。
 */
export function hashState(s) {
  return JSON.stringify([
    s.phase, s.step, s.room,
    s.H, s.P, s.D,
    s.hasGun, s.hasCoat, [...s.items].sort(),
    s.obeyed[2], s.obeyed[3], s.obeyed[4], s.obeyed[5],
    s.partnerBroken, s.partnerPresent, s.dogBuried,
    s.saltApplied, s.caught, s.pushedPartner, s.abandonedPartner,
    s.chargedIn, s.gunFired,
    Object.keys(s.examined).sort(), Object.keys(s.talked).sort(),
    [...s.hideSel].sort(), s.pendingReward,
    s.returnPartnerHandled, s.turnExtra, s.penalty,
    s.ending,
  ]);
}
