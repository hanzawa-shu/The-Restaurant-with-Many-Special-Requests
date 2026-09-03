/**
 * 文字送り（フィードバック対応）
 *
 * 段落を順に、1文字ずつ現す。パネルをタップすると残りを即座に出す。
 *
 * 実装上の注意: 表示のたびに DOM を作り直すと重いので、段落の要素は
 * 最初に全部作っておき、いま送っている段落だけ textContent を切り替える。
 */

/**
 * 1秒あたりの文字数（既定）。
 * ★場面ごとに変えられる。view() が speed を返すので、start() で受け取る。
 *   受け取らずに定数のまま使っていたので、遅くしたはずの場面
 *   （鍵穴の眼玉・玄関で泣く場面・結末）が全部同じ速さで流れていた。
 */
const CPS = 34;

export function createTypewriter() {
  let paras = [];        // { el, text }
  let idx = 0;           // いま送っている段落
  let shown = 0;         // その段落で表示済みの文字数
  let done = true;
  let raf = 0;
  let last = 0;
  let onDone = null;
  let instant = false;
  let guard = 0;

  function setInstant(v) { instant = !!v; }

  let scrollEl = null;

  let cps = CPS;

  /**
   * @param {number} [speed] 1秒あたりの文字数。省略すると既定
   * @param {boolean} [atOnce] 既読などで送らずに全部出す
   */
  function start(list, cb, scroll = null, speed = CPS, atOnce = false) {
    stop();
    paras = list;
    idx = 0;
    shown = 0;
    onDone = cb;
    scrollEl = scroll;
    cps = speed > 0 ? speed : CPS;
    done = false;

    for (const p of paras) p.el.textContent = '';
    if (instant || atOnce || paras.length === 0) return finish();

    last = performance.now();
    raf = requestAnimationFrame(tick);

    /**
     * ★保険。requestAnimationFrame はタブが隠れると止まる。
     * 送っている途中で別のタブに移られると、選択肢が出ないまま固まる。
     * 想定所要時間の倍で打ち切る。
     */
    const total = paras.reduce((n, p) => n + [...p.text].length, 0);
    clearTimeout(guard);
    guard = setTimeout(finish, (total / cps) * 2000 + 1500);
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    shown += cps * dt;

    while (idx < paras.length) {
      const p = paras[idx];
      const len = [...p.text].length;
      if (shown >= len) {
        p.el.textContent = p.text;
        shown -= len;
        idx += 1;
        // 空行はためない
        if (idx < paras.length && paras[idx].text === '') continue;
      } else {
        p.el.textContent = [...p.text].slice(0, Math.floor(shown)).join('');
        break;
      }
    }

    /**
     * いま送っている行が枠から出ていたら、出たぶんだけ送る。
     * ★下端に貼り付けてはいけない。ページの先頭を枠の上に合わせてあるので、
     * 毎フレーム下端へ寄せると読んでいる文の頭が上へ流れていく。
     */
    if (scrollEl) {
      const cur = paras[Math.min(idx, paras.length - 1)];
      if (cur && cur.el.isConnected) {
        const over = cur.el.getBoundingClientRect().bottom - scrollEl.getBoundingClientRect().bottom;
        if (over > 0) scrollEl.scrollTop += over;
      }
    }

    if (idx >= paras.length) return finish();
    raf = requestAnimationFrame(tick);
  }

  function finish() {
    stop();
    for (const p of paras) p.el.textContent = p.text;
    done = true;
    onDone?.();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(guard);
    guard = 0;
  }

  /** タップされたとき。送っている途中なら残りを即座に出す */
  function skip() {
    if (done) return false;
    finish();
    return true;
  }

  return { start, skip, finish, stop, setInstant, isDone: () => done };
}
