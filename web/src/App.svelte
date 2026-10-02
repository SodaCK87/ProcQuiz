<script>
  import { onMount } from 'svelte';
  import QuizCard from './components/QuizCard.svelte';
  import StartScreen from './components/StartScreen.svelte';
  import { start as startStars } from './lib/starfield.js';
  import { bakeTextures } from './lib/textures.js';
  import { load, save, record, stats } from './lib/progress.js';
  import { buildDeck, deckKey, newSeed } from './lib/deck.js';
  import INDEX from 'virtual:bank-index';

  // 題庫在 repo 的 data/questions/，由 tools/convert.py 產生；動態載入，選到那個題型才下載
  const LOADERS = {
    'true-false': () => import('../../data/questions/true-false.json'),
    'multiple-choice': () => import('../../data/questions/multiple-choice.json'),
  };

  let canvas;
  let banks = $state.raw({});
  let progress = load();
  let rev = $state(0);            // 紀錄是普通物件，改完遞增 rev 讓畫面重算
  let view = $state('start');
  let kind = $state('true-false'), course = $state(0), order = $state('random');
  let deck = $state.raw(null);     // { key, ids, pos }
  let loadError = $state('');
  let starting = $state(false);    // 按了開始，題庫還在下載
  const inLine = /\bLine\//.test(navigator.userAgent);

  let bank = $derived(banks[kind] ?? null);
  let byId = $derived(bank ? new Map(bank.questions.map(q => [q.id, q])) : new Map());
  let question = $derived(deck && view === 'quiz' ? byId.get(deck.ids[deck.pos]) : null);
  let courseName = $derived(bank && question ? bank.courses.find(c => c.id === question.course)?.name ?? '' : '');
  const generated = INDEX['true-false'].generated;

  // 每個題型只下載一次；首頁一出現就在背景開始抓目前的題型
  const pending = {};
  function ensure(k){
    pending[k] ??= LOADERS[k]().then(m => { banks = { ...banks, [k]: m.default }; loadFonts(); },
      () => { delete pending[k]; loadError = '題庫下載失敗，請檢查網路後再按一次開始。'; throw new Error('load'); });
    return pending[k];
  }
  $effect(() => { ensure(kind).catch(() => {}); });

  // 思源宋體等題庫到了才開始下載：慢網路下字型切片（首頁就要 16 塊、約 700 KB）會跟題庫搶頻寬；
  // 在那之前先用系統內建的明體
  let fontsRequested = false;
  function loadFonts(){
    if (fontsRequested) return;
    fontsRequested = true;
    import('@fontsource/noto-serif-tc/400.css');
    import('@fontsource/noto-serif-tc/700.css');
  }

  function persist(){ save(progress); rev++; }

  async function begin(resume){
    const k = kind;  // 等下載時題型可能被切換，以按下當時的為準
    if (!banks[k]){
      starting = true; loadError = '';
      try { await ensure(k); } catch { return; } finally { starting = false; }
      if (k !== kind) return;
    }
    const key = deckKey(k, course, order);
    let st = progress.decks[key];
    if (!resume || !st) st = progress.decks[key] = { seed: newSeed(), pos: 0 };
    const ids = buildDeck(banks[k].questions, course, order, st.seed);
    if (st.pos >= ids.length) st.pos = 0;
    deck = { key, ids, pos: st.pos };
    persist();
    view = 'quiz';
    scrollTo(0, 0);
  }

  function onresult(ok){ record(progress, question.id, ok); persist(); }

  function onnext(){
    const pos = deck.pos + 1;
    progress.decks[deck.key].pos = pos;
    persist();
    if (pos >= deck.ids.length) { view = 'done'; return; }
    deck = { ...deck, pos };
  }

  function again(){ progress.decks[deck.key] = { seed: newSeed(), pos: 0 }; begin(true); }

  let roundStats = $derived.by(() => { rev; return view === 'done' && bank ? stats(progress, bank.questions, course) : null; });

  onMount(() => { bakeTextures(); startStars(canvas); });
</script>

<div class="page-bg" aria-hidden="true"></div>
<div class="page-dim" aria-hidden="true"></div>
<canvas class="stars" bind:this={canvas} aria-hidden="true"></canvas>

<div class="wrap">
  <header>
    <h1 class="gold-title">採購題庫練習</h1>
    <p>非官方練習站・先作答再翻卡看解析</p>
  </header>

  {#if inLine}
    <p class="hint" role="note">你正在 LINE 裡開這個網頁，練習紀錄可能保不住。請點右上角選單，改用 Chrome 或 Safari 開啟。</p>
  {/if}
  {#if loadError}<p class="error" role="alert">{loadError}</p>{/if}

  {#if view === 'start'}
    <StartScreen bind:kind bind:course bind:order index={INDEX[kind]} {progress} {rev} {starting} onstart={begin} />
  {:else if view === 'quiz' && question}
    <nav class="bar">
      <button class="back" onclick={() => view = 'start'}>‹ 選題</button>
      <span>{order === 'random' ? '隨機' : '依題號'}・第 {deck.pos + 1}／{deck.ids.length} 題</span>
    </nav>
    {#key deck.key}
      <QuizCard {question} kindLabel={bank.label} {courseName} {onresult} {onnext} />
    {/key}
  {:else if view === 'done'}
    <section class="done">
      <h2>這一輪做完了</h2>
      <p>這一輪的 {deck.ids.length} 題已經到最後一題。</p>
      {#if roundStats}<p>這個範圍已練 {roundStats.done} 題，最近一次答對 {roundStats.right} 題。</p>{/if}
      <div class="go">
        <button class="btn primary" onclick={again}>再來一輪</button>
        <button class="btn" onclick={() => view = 'start'}>回選題</button>
      </div>
    </section>
  {/if}

  <footer>非官方練習站｜題庫版本 {generated}｜解析為第三方整理，部分經人工審查加註｜紀錄只存在這台裝置</footer>
</div>

<style>
  /* 背景再暗 40%：壓在古紙上、星圖下 */
  .page-dim{position:fixed;inset:0;background:#000;opacity:var(--page-dim);pointer-events:none;z-index:0}
  .stars{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}
  .wrap{position:relative;z-index:1;max-width:460px;margin:0 auto}
  header{text-align:center;margin-bottom:18px}
  header p{margin:2px 0 0;font-size:13px;color:var(--page-ink-2);letter-spacing:.08em}
  .bar{display:flex;justify-content:space-between;align-items:center;margin:0 6px 12px;font-size:14px;color:var(--page-ink-2)}
  .back{border:0;background:none;color:var(--gold-hi);cursor:pointer;padding:4px 0;font-size:15px}
  .done{text-align:center;padding:40px 12px}
  .done h2{color:var(--gold-hi);letter-spacing:.15em}
  .go{display:flex;gap:10px;margin-top:20px}
  .go .btn{flex:1;padding:12px}
  .go .btn:not(.primary){color:var(--page-ink);background:rgba(28,20,12,.9)}
  .error{color:var(--bad);text-align:center}
  .hint{margin:0 6px 14px;padding:10px 12px;border-radius:10px;font-size:14px;line-height:1.6;
    color:var(--page-ink);background:rgba(28,20,12,.85);border:1px solid var(--gold)}
  footer{margin-top:22px;text-align:center;font-size:12px;color:var(--page-ink-2);opacity:.85;line-height:1.6}
</style>
