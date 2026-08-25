/**
 * DOM の会話・選択肢（設計書 §7）
 *
 * ここは view() が返したものを描くだけ。ゲーム状態は書き換えない。
 * 数値は画面に出さない（仕様書 §11）。開発パネルだけは別枠。
 *
 * ★テキストはページ送りにする。
 * 一度に流し込むと、最初の行を読む余裕がないまま次が出てしまう。
 * 1ページはスクロールなしで読める量に収め、続きはタップで出す。
 * 読み終えたページは残るので、さかのぼって読み返せる。
 */

import { createState, view, choose, isEnd } from '../systems/game.js';
import { loadProgress, saveProgress } from '../systems/save.js';
import { recordEnding, collectedCount, markSeen, hasSeen, textKey } from '../systems/progress.js';
import { ENDING_IDS } from '../data/endings.js';
import { createTypewriter } from './typewriter.js';
import { collectionEl } from './collection.js';
import { seForChoice } from '../data/audio.js';
import { loadCanvas } from '../render/chromaKey.js';

/**
 * 遊ぶ人が切り替えられるのは「出す／隠す」の2つだけ。
 *
 * ★中間の大きさは用意しない。
 * 3段階だと全部隠すまでに2回押すことになり、「絵を見たい」に対して遠い。
 * 小さい枠は鍵穴の一枚絵のときだけ自動で使う（applySize の auto）。
 */
const SIZES = ['normal', 'hidden'];
const SIZE_LABEL = { normal: '▾', hidden: '▴' };
const SIZE_TITLE = { normal: '文字を隠す（H）', hidden: '文字を出す（H）' };

/**
 * 1ページの目安。空行は 0.4 行として数える。
 *
 * ★枠の高さと対で決める。実測で 34% の枠に収まる本文は3行。
 * 4行だと1ページ目からスクロールが要る（＝ページ送りの意味がなくなる）。
 */
const PAGE_WEIGHT = 3;

/**
 * @param {HTMLElement} root
 * @param {object} hooks
 * @param {{defer?: boolean}} [opt] defer:true なら最初の描画をしない
 *   （タイトル画面を先に見せるため。`begin()` で始める）
 */
export function createUI(root, hooks = {}, opt = {}) {
  let state = createState();
  let progress = loadProgress();
  let devOpen = false;
  let sizeIdx = 0;
  let curView = null;
  let pages = [];
  let pageIdx = 0;
  let lastLog = null;
  let lastBody = null;
  let focusReleased = false;
  let boxes = [];
  /**
   * ★場面が変わる前にログを読ませるための状態（設計書 §11.1.9）。
   *
   * ログは「いま起きたこと」なので、それを引き起こした場面のまま読ませないと
   * 順序が入れ替わる。犬を埋めた話が山猫軒の前で流れ、服を脱いだ話が
   * すでに脱いだ姿の上で流れていた。
   *
   * holdUntil … ここまで（ログの最後）を読ませてから、場面を変える
   * phase     … 'hold' のあいだは選択肢を出さない（次の場面のものなので）
   */
  let holdUntil = -1;
  let logCount = 0;
  let holdDone = null;
  let holdReady = false;
  let phase = 'main';
  let instant = false;
  /** いま出している文の既読鍵。送り終わったら記録する */
  let pageKey = null;
  let atOnce = false;
  let renderSeq = 0;
  const typer = createTypewriter();

  // ---------------------------------------------------------------- 骨組み

  const panel = document.createElement('div');
  panel.className = 'panel';
  root.appendChild(panel);

  const bar = document.createElement('div');
  bar.className = 'panel-bar';

  // 相方の肖像。P の段階を台詞以外でも伝える（仕様書 §11）
  const portrait = document.createElement('div');
  portrait.className = 'portrait';
  bar.appendChild(portrait);

  const toggle = document.createElement('button');
  toggle.className = 'panel-toggle';
  toggle.type = 'button';
  bar.appendChild(toggle);
  panel.appendChild(bar);

  const textArea = document.createElement('div');
  textArea.className = 'panel-text';
  panel.appendChild(textArea);

  const endBox = document.createElement('div');
  endBox.className = 'collection-box';
  panel.appendChild(endBox);

  const chipArea = document.createElement('div');
  chipArea.className = 'chips';
  panel.appendChild(chipArea);

  const choiceArea = document.createElement('div');
  choiceArea.className = 'choices';
  panel.appendChild(choiceArea);

  const more = document.createElement('div');
  more.className = 'more';
  more.textContent = '▼';
  panel.appendChild(more);

  const dev = document.createElement('div');
  dev.className = 'dev';
  root.appendChild(dev);

  // ---------------------------------------------------------------- 入力

  dev.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    devOpen = !devOpen;
    renderDev();
  });

  function cycleSize() {
    sizeIdx = (sizeIdx + 1) % SIZES.length;
    applySize();
  }

  toggle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    cycleSize();
  });

  /**
   * ★キーでも隠せるようにする。
   * 絵を見たいときに小さなボタンを狙わせるのは、見たいものを隠す手間そのもの。
   */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); cycleSize(); }
  });

  /**
   * パネルをタップしたとき。
   *   送っている途中 → 残りを即座に出す
   *   送り終わっていて続きがある → 次のページを出す
   */
  panel.addEventListener('pointerdown', () => {
    if (typer.skip()) return;
    // 場面が変わる前のログを読んでいる最中
    if (phase === 'hold') {
      if (pageIdx < holdUntil) { showPage(pageIdx + 1); return; }
      if (holdReady) releaseHold();
      return;
    }
    if (pageIdx < pages.length - 1) { showPage(pageIdx + 1); return; }
    /**
     * ★読み終えた枠を押したら、寄っていたカメラを戻す。
     * 以前は次の選択肢を押すまで寄ったままだったので、
     * 「読み終わったのに画面が対象に張りついている」状態が続いていた。
     */
    if (curView && curView.focus && !focusReleased) {
      focusReleased = true;
      hooks.onFocusEnd?.();
    }
  });

  // ---------------------------------------------------------------- 表示

  /**
   * 相方の肖像を差し替える。
   * テクスチャと同じ3段フォールバックを通るので、未生成なら仮の顔が出る。
   */
  let faceShown = null;
  let faceSeq = 0;

  async function setFace(path) {
    if (path === faceShown) return;
    faceShown = path;
    const token = ++faceSeq;
    portrait.innerHTML = '';
    portrait.classList.toggle('shown', !!path);
    if (!path) return;
    const cv = await loadCanvas(path, 'face');
    if (token !== faceSeq) return;
    portrait.appendChild(cv);
  }

  /**
   * 枠の大きさ。
   *
   * ★文章の量や選択肢の数で変えてはいけない。
   * 以前は内容に合わせて伸縮していたので、一手ごとに枠が動いて落ち着かなかった。
   * 高さは style.css で固定し、あふれる文章は枠の中で送る。
   *
   * 変えるのは3つだけ。
   *   ・遊ぶ人が ▾ で畳んだとき
   *   ・結末（3Dを隠すものがなく、文章が長い）
   *   ・鍵穴の眼玉の一枚絵（絵が主役。暗転を挟んで入るので枠が動いて見えない）
   */
  function applySize() {
    const size = SIZES[sizeIdx];
    let auto = 'normal';
    if (isEnd(state)) auto = 'ending';
    else if (curView && curView.panel === 'small') auto = 'small';
    panel.dataset.size = (size === 'normal') ? auto : size;
    toggle.textContent = SIZE_LABEL[size];
    toggle.title = SIZE_TITLE[size];
  }

  function pick(id) {
    // ★音は状態を進める前に決める。押した「前」の部屋で音が変わるものがある
    hooks.onChoice?.(seForChoice(id, state));
    state = choose(state, id);
    if (isEnd(state) && state.ending) {
      progress = recordEnding(progress, state.ending);
      saveProgress(progress);
    }
    render();
  }

  function restart() {
    state = createState();
    lastLog = null;
    lastBody = null;
    render();
  }

  /**
   * ログ（いま起きたこと）と本文（いまの状況）を分けて返す。
   * ★この2つは同じページに混ぜない。
   * 相方の台詞のすぐ下に看板の文面が続くと、台詞を読む区切りがなくなる。
   */
  function buildText(v, sameBody) {
    textArea.innerHTML = '';
    const make = (cls, lines) => {
      const paras = [];
      const box = document.createElement('div');
      box.className = cls;
      for (const l of lines) {
        const p = document.createElement('p');
        if (l === '') p.className = 'spacer';
        box.appendChild(p);
        paras.push({ el: p, text: l });
      }
      return { box, paras };
    };
    const log = v.log.length ? make('log', v.log) : null;
    const body = make('body', v.body);

    /**
     * ★並び順は「古いものが上、新しいものが下」。
     * 部屋に入った直後は  ログ（起きたこと）→ 本文（いまの状況）。
     * 本文が据え置きのときは  本文（もう読んだ）→ ログ（いま起きたこと）。
     * ここを固定にすると、送り終わりに下へ送ったとき新しい行が画面外に残る。
     */
    const order = (sameBody ? [body, log] : [log, body]).filter(Boolean);
    for (const b of order) textArea.appendChild(b.box);
    boxes = order;
    return { log: log ? log.paras : [], body: body.paras };
  }

  /** スクロールなしで読める量に切る */
  function paginate(paras) {
    const out = [];
    let cur = [];
    let w = 0;
    for (const p of paras) {
      const add = p.text === '' ? 0.4 : 1;
      if (cur.length && w + add > PAGE_WEIGHT) { out.push(cur); cur = []; w = 0; }
      // ページ先頭の空行は捨てる（頭が空くと1行ぶん損する）
      if (!cur.length && p.text === '') { p.el.style.display = 'none'; continue; }
      cur.push(p);
      w += add;
    }
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  }

  /**
   * いま読むページの先頭を、枠の上端に合わせる。
   *
   * ★下端に合わせてはいけない。読み終えたページも残す作りなので、
   * 下に寄せると上で行が半分に切れる（見た目が雑になる）。
   * 先頭を上に合わせれば、いま読む文は必ず先頭から全部見える。
   */
  function scrollToPage(i) {
    const first = pages[i] && pages[i][0];
    if (!first || !first.el.isConnected) return;
    const d = first.el.getBoundingClientRect().top - textArea.getBoundingClientRect().top;
    textArea.scrollTop = Math.max(0, textArea.scrollTop + d);
  }

  function showPage(i) {
    pageIdx = i;
    pages.forEach((pg, k) => {
      for (const p of pg) p.el.style.display = (k <= i) ? '' : 'none';
    });
    // 中身が1行も出ていない塊は畳む。枠の高さを固定したので、
    // 空のまま罫線だけが残ると穴が空いて見える
    for (const b of boxes) {
      b.box.style.display = b.paras.some((p) => p.el.style.display !== 'none') ? '' : 'none';
    }
    more.classList.remove('shown');
    choiceArea.classList.add('waiting');
    chipArea.classList.add('waiting');

    scrollToPage(i);
    // hold 中は「ログの最後」で止める。そこから先は場面を変えたあとに出す
    const stop = phase === 'hold' ? holdUntil : pages.length - 1;
    const isLast = i >= stop;
    typer.start(pages[i], () => {
      if (!isLast) { more.classList.add('shown'); return; }
      if (phase === 'hold') {
        // ★選択肢は出さない。次の場面のものなので、いま押されては困る
        holdReady = true;
        more.classList.add('shown');
        return;
      }
      rememberRead();
      showChoices();
    }, textArea, curView ? curView.speed : undefined, atOnce);
  }

  function releaseHold() {
    holdReady = false;
    phase = 'main';
    more.classList.remove('shown');
    const done = holdDone;
    holdDone = null;
    done?.();
  }

  /**
   * ★場面を変える前に、ログを読ませて待つ。
   * main.js が「これから場面を変える」ときに呼ぶ。
   * ログが無い／既読で早送りする／自動検証中は、待たずに進む。
   */
  function holdForLog() {
    if (!logCount || atOnce || instant || !pages.length) return Promise.resolve();
    phase = 'hold';
    holdUntil = logCount - 1;
    showPage(0);
    return new Promise((r) => { holdDone = r; });
  }

  /**
   * 読み終えた文を既読にする。
   * ★送り終わった時点で記録する。表示した時点ではない
   *   （途中で別の選択に飛んだ文を「読んだ」ことにしてしまう）。
   */
  function rememberRead() {
    if (!pageKey || hasSeen(progress, pageKey)) return;
    progress = markSeen(progress, [pageKey]);
    saveProgress(progress);
  }

  function showChoices() {
    choiceArea.classList.remove('waiting');
    chipArea.classList.remove('waiting');
    more.classList.remove('shown');
    endBox.classList.add('shown');
    // 選択肢や結末の一覧が出ると枠が狭まるので、位置を取り直す
    /**
     * 選択肢が出ると枠の高さが変わるので、並び終わってから取り直す。
     * rAF は隠しタブで止まるので、時間切れの保険も一緒に置く（設計書 §11.2）。
     */
    scrollToPage(pageIdx);
    requestAnimationFrame(() => scrollToPage(pageIdx));
    setTimeout(() => scrollToPage(pageIdx), 60);
  }

  function revealAll() {
    typer.stop();
    for (const pg of pages) {
      for (const p of pg) { p.el.style.display = ''; p.el.textContent = p.text; }
    }
    for (const b of boxes) b.box.style.display = '';
    pageIdx = Math.max(0, pages.length - 1);
    rememberRead();
    showChoices();
  }

  function buildChoices(v) {
    choiceArea.innerHTML = '';
    chipArea.innerHTML = '';
    endBox.innerHTML = '';
    endBox.classList.remove('shown');

    for (const c of v.choices.filter((x) => x.chip)) {
      const b = document.createElement('button');
      b.className = 'chip' + (c.on ? ' on' : '');
      b.type = 'button';
      const mark = document.createElement('span');
      mark.className = 'chip-mark';
      mark.textContent = c.on ? '隠す' : '渡す';
      const name = document.createElement('span');
      name.className = 'chip-name';
      name.textContent = c.label;
      b.append(mark, name);
      if (c.hint) b.title = c.hint;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); pick(c.id); });
      chipArea.appendChild(b);
    }

    if (isEnd(state)) {
      endBox.appendChild(collectionEl(progress, { highlight: state.ending }));
      const again = document.createElement('button');
      again.className = 'choice';
      again.type = 'button';
      again.textContent = 'もう一度';
      again.addEventListener('pointerdown', (e) => { e.stopPropagation(); restart(); });
      choiceArea.appendChild(again);

      // 記録を見る場所はタイトルに置いてある。そこへ戻る道を必ず用意する
      if (hooks.onTitle) {
        const home = document.createElement('button');
        home.className = 'choice';
        home.type = 'button';
        home.textContent = 'タイトルへ';
        home.addEventListener('pointerdown', (e) => { e.stopPropagation(); hooks.onTitle(); });
        choiceArea.appendChild(home);
      }
      return;
    }

    for (const c of v.choices.filter((x) => !x.chip)) {
      const b = document.createElement('button');
      b.className = 'choice' + (c.emphasis ? ' emphasis' : '');
      b.type = 'button';
      b.textContent = c.label;
      b.disabled = !c.enabled;
      if (c.hint) {
        b.title = c.hint;
        if (c.emphasis && c.enabled) {
          const h = document.createElement('span');
          h.className = 'hint';
          h.textContent = '（' + c.hint + '）';
          b.appendChild(h);
        }
        if (!c.enabled) {
          const h = document.createElement('span');
          h.className = 'hint';
          h.textContent = '（' + c.hint + '）';
          b.appendChild(h);
        }
      }
      if (c.enabled) {
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); pick(c.id); });
      }
      choiceArea.appendChild(b);
    }
  }

  function render() {
    const token = ++renderSeq;
    const v = view(state);
    curView = v;
    focusReleased = false;
    phase = 'main';
    holdUntil = -1;
    holdDone = null;
    holdReady = false;

    /**
     * ★同じ本文を二度送らない。
     *
     * 部屋の本文（部屋名と看板の文面）は、その部屋にいるあいだ変わらない。
     * 「調べる」「相方に話す」「看板の前に立つ」と選ぶたびに送り直していたので、
     * 選択肢の数だけ同じ文が流れていた（4択なら4回）。
     *
     * 変わっていない本文は**残したまま、送らずに出す**。
     * 消してしまうと、看板を読み返せなくなる（看板はこのゲームの謎そのもの）。
     * 送るのは「いま起きたこと」＝ログだけになる。
     */
    const logSig = v.log.join(' / ');
    const bodySig = v.body.join(' / ');
    const sameBody = bodySig === lastBody && lastBody !== null;
    const text = buildText(v, sameBody);

    const logPages = text.log.length ? paginate(text.log) : [];
    logCount = logPages.length;
    pages = [...logPages, ...(sameBody ? [] : paginate(text.body))];
    if (sameBody) for (const p of text.body) p.el.textContent = p.text;
    if (!pages.length) pages = [[]];

    buildChoices(v);
    applySize();
    setFace(v.partnerFace);
    renderDev(v);
    textArea.scrollTop = 0;

    // 場面が切り替わるときは、暗転と明転が終わるまで待つ
    const ready = hooks.onState ? hooks.onState(state, v, holdForLog) : null;

    /**
     * 既読の早送り（仕様書 §10）。
     *
     * 2周目に部屋の描写や「調べる」の文をもう一度送られるのは、ただの待ち時間。
     * ★ただし判断の場面は飛ばさない（view() の skippable が false）。
     *   決断の文が一瞬で出ると、選択がボタンを押す作業に落ちる。
     */
    const lines = [...v.log, ...(sameBody ? [] : v.body)];
    pageKey = lines.length ? textKey(v.scene.code, lines) : null;
    atOnce = !!(v.skippable && pageKey && hasSeen(progress, pageKey));

    // ログも本文も前と同じなら送り直さない（チップの切り替えなど）
    if (logSig === lastLog && sameBody) { revealAll(); return; }
    lastLog = logSig;
    lastBody = bodySig;

    choiceArea.classList.add('waiting');
    chipArea.classList.add('waiting');

    const begin = () => {
      if (token !== renderSeq) return;
      /**
       * ★既読は「送らない」だけでなく「ページ送りもしない」。
       * 1ページ目だけ即座に出しても、続きを出すために押す手間は残る。
       * 全ページまとめて出して、選択肢もすぐ出す。
       */
      if (atOnce) { revealAll(); return; }
      // hold でログを読ませたなら、その続き（本文）から出す
      const next = holdUntil + 1;
      if (next < pages.length) showPage(next);
      else { rememberRead(); showChoices(); }
    };
    if (ready && typeof ready.then === 'function') ready.then(begin);
    else begin();
  }

  function renderDev(v) {
    const vv = v || view(state);
    const sc = vv.scene;
    const head = 'S' + String(sc.no).padStart(2, '0') + ' [' + sc.code + ']';
    dev.textContent = devOpen
      ? [
          head + ' ' + sc.name,
          '［調整用・Phase 5 で削除］',
          'phase ' + vv.phase + '  step ' + state.step + '  room ' + vv.room,
          'ページ ' + (pageIdx + 1) + ' / ' + pages.length + '　送り ' + (vv.speed || 34) + '字/秒',
          'H ' + vv.debug.H + '  P ' + vv.debug.P + '  W ' + vv.debug.W + '  D ' + vv.debug.D,
          '走れる ' + (vv.debug.run ? 'はい' : 'いいえ') + '  相方 ' + (vv.debug.broken ? '折れた' : '無事'),
          '服装段階 ' + vv.stages.clothing + '  空腹段階 ' + vv.stages.hunger,
          '鉄砲 ' + (vv.stages.hasGun ? '有' : '無') + '  外套 ' + (vv.stages.hasCoat ? '有' : '無'),
          '小物 ' + (vv.debug.items.join(', ') || '（なし）'),
          '到達 ' + collectedCount(progress) + ' / ' + ENDING_IDS.length,
        ].join(String.fromCharCode(10))
      : head;
  }

  if (!opt.defer) render();

  return {
    render,
    restart,
    /** タイトル画面から始める。defer:true のときに使う */
    begin() { restart(); },
    getProgress: () => progress,
    /** 記録を消したあとなど、外で書き換えたものを読み直す */
    reloadProgress() { progress = loadProgress(); },
    getState: () => state,
    setInstant(v) { instant = !!v; typer.setInstant(v); },
    /** 自動検証用。送りを飛ばし、残りのページも全部出す */
    skipTyping() { revealAll(); },
    /** 自動検証用。選択肢を id で選ぶ（画面をクリックせずに場面を進める） */
    pick,
    nextPage() { if (pageIdx < pages.length - 1) showPage(pageIdx + 1); },
    pageInfo: () => ({ page: pageIdx + 1, total: pages.length }),
    /** 自動検証用。いま出している文を既読として飛ばしたか */
    skipping: () => atOnce,
    setPanelSize(size) {
      const i = SIZES.indexOf(size);
      if (i >= 0) { sizeIdx = i; applySize(); }
    },
  };
}
