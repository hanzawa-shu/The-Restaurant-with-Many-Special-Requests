/**
 * 場面切り替えの暗転（フィードバック対応）
 *
 * 部屋やカットが切り替わったことが分かるようにする。
 * 自動検証では CSS トランジションが隠しタブで止まるため、
 * setInstant(true) で即時化できるようにしてある。
 */

let el = null;
let instant = false;

export function initFade(root) {
  el = document.createElement('div');
  el.id = 'fade';
  root.appendChild(el);
  return el;
}

export function setInstant(v) {
  instant = !!v;
}

export function fadeTo(alpha, ms = 220) {
  if (!el) return Promise.resolve();
  if (instant) {
    el.style.transition = 'none';
    el.style.opacity = String(alpha);
    return Promise.resolve();
  }
  el.style.transition = `opacity ${ms}ms ease-in-out`;
  el.style.opacity = String(alpha);
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 暗転 → 差し替え → 明転
 *
 * 明転は暗転より長くする。暗くするのは合図なので速くてよいが、
 * 明るくなるのが速いと場面が「切り替わった」感じにならない。
 * ★差し替えは必ず真っ黒のあいだに終える（カメラのスナップも含む）。
 */
export async function crossFade(swap, out = 260, into = 560) {
  await fadeTo(1, out);
  await swap();
  await fadeTo(0, into);
}
