/**
 * 小物の定義（仕様書 §5）
 *
 * すべて掌に握り込めるサイズ。立ち絵には出ない。
 * 立ち絵に出るのは鉄砲と外套だけで、それらは小物ではなく
 * 「必ず要求され、重量を持つもの」として resources.js が扱う。
 */

export const ITEMS = {
  dog_whistle: {
    id: 'dog_whistle',
    name: '銀の犬笛',
    note: '犬の首から外した。吹いても、人の耳には何も聞こえない',
  },
  penknife: {
    id: 'penknife',
    name: 'ペンナイフ',
    note: '刃は短く、峰は薄い',
  },
  pocket_watch: {
    id: 'pocket_watch',
    name: '懐中時計',
    note: '長い鎖がついている。銀めっきが少し剥げている',
  },
  glasses: {
    id: 'glasses',
    name: '眼鏡',
    note: 'これがないと、細かいものが見えない',
  },
  matches: {
    id: 'matches',
    name: 'マッチ箱',
    note: '軸は乾いている。まだ擦れる',
  },
};

export const ITEM_IDS = Object.keys(ITEMS);

export function itemName(id) {
  return ITEMS[id]?.name ?? id;
}
