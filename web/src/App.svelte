<script>
  import { onMount } from 'svelte';
  import QuizCard from './components/QuizCard.svelte';
  import StartScreen from './components/StartScreen.svelte';
  import { start as startStars } from './lib/starfield.js';
  import { bakeTextures } from './lib/textures.js';
  import { load, save, record, markGuess, stats, isWrong, MASTER } from './lib/progress.js';
  import { pool, pick, deckKey } from './lib/deck.js';
  import { loadOn, saveOn } from './lib/highlight.js';
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
  let kind = $state('true-false'), course = $state(0), mode = $state('all');
  let deck = $state.raw(null);     // { key, cur, recent, mixed }：目前這題、最近出過的題號、是否為錯題模式穿插的題目
  let loadError = $state('');
  let starting = $state(false);    // 按了開始，題庫還在下載
  let marks = $state(loadOn());     // 題目重點字開關
  let fixes = $state.raw({});       // 重點字逐題微調，題庫到了才下載，不跟題庫搶頻寬
  const inLine = /\bLine\//.test(navigator.userAgent);

  let bank = $derived(banks[kind] ?? null);
  let byId = $derived(bank ? new Map(bank.questions.map(q => [q.id, q])) : new Map());
  let question = $derived(deck && view === 'quiz' ? byId.get(deck.cur) : null);
  let courseName = $derived(bank && question ? bank.courses.find(c => c.id === question.course)?.name ?? '' : '');
  const generated = INDEX['true-false'].generated;
  // 建置時由 vite.config.js 的 define 填入：程式版本（web/package.json）與 commit 短碼；回報問題到 repo 的 Issues
  const version = __PQZ_VERSION__, commit = __PQZ_COMMIT__;
  const ISSUES = 'https://github.com/SodaCK87/ProcQuiz/issues';

  // 每個題型只下載一次；首頁一出現就在背景開始抓目前的題型
  const pending = {};
  function ensure(k){
    pending[k] ??= LOADERS[k]().then(m => { banks = { ...banks, [k]: m.default }; loadFonts(); loadFixes(); },
      () => { delete pending[k]; loadError = '題庫下載失敗，請檢查網路後再按一次開始。'; throw new Error('load'); });
    return pending[k];
  }
  $effect(() => { ensure(kind).catch(() => {}); });
  // 沒下載到就只用規則標記，不影響作答
  let fixesRequested = false;
  function loadFixes(){
    if (fixesRequested) return;
    fixesRequested = true;
    import('./lib/highlight-fixes.json').then(m => { fixes = m.default; }, () => {});
  }

  // 思源宋體等題庫到了才開始下載，在那之前先用系統內建的明體。字型是 tools/build_fonts.py 切的子集：
  // 首頁只用到介面那兩檔（400＋700 約 260 KB），題目專用字的兩檔到卡片出現才會被抓
  let fontsRequested = false;
  function loadFonts(){
    if (fontsRequested) return;
    fontsRequested = true;
    import('./fonts.css');
  }

  // 存檔延到閒置時：作答當下要先讓翻卡第一格出來，整份紀錄 stringify 加寫入不擋在點擊裡；離開頁面前一定寫完
  let saveQueued = false;
  const idle = globalThis.requestIdleCallback ?? (f => setTimeout(f, 200));
  function flush(){ if (saveQueued){ saveQueued = false; save(progress); } }
  function persist(){ rev++; if (!saveQueued){ saveQueued = true; idle(flush, { timeout: 1000 }); } }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  async function begin(){
    const k = kind;  // 等下載時題型可能被切換，以按下當時的為準
    if (!banks[k]){
      starting = true; loadError = '';
      try { await ensure(k); } catch { return; } finally { starting = false; }
      if (k !== kind) return;
    }
    const next = draw(banks[k].questions, []);
    if (!next) return;
    deck = { key: deckKey(k, course, mode), ...next, recent: [] };
    view = 'quiz';
    scrollTo(0, 0);
  }

  // 錯題模式下答對的題目可能已經離開錯題，所以每題都重抓範圍
  function draw(questions, recent){
    const ids = pool(questions, course, mode, progress.answers);
    const filler = mode === 'wrong' ? pool(questions, course, 'all', progress.answers) : null;
    const cur = pick(ids, progress.answers, recent, Math.random, filler);
    return cur && { cur, mixed: mode === 'wrong' && !isWrong(progress.answers[cur]) };
  }

  function onresult(ok){ record(progress, question.id, ok); persist(); }
  function onguess(){ markGuess(progress, question.id); persist(); }

  function onnext(){
    const recent = [...deck.recent, deck.cur].slice(-10);
    const next = draw(bank.questions, recent);
    if (!next) { view = 'done'; return; }
    deck = { ...deck, ...next, recent };
  }

  let rangeStats = $derived.by(() => { rev; return bank ? stats(progress, bank.questions, course) : null; });

  onMount(() => { bakeTextures(); startStars(canvas); });
</script>

<div class="page-bg" aria-hidden="true"></div>
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
    <StartScreen bind:kind bind:course bind:mode index={INDEX[kind]} {progress} {rev} {starting} onstart={begin} />
  {:else if view === 'quiz' && question}
    <nav class="bar">
      <button class="back" onclick={() => view = 'start'}>‹ 選題</button>
      <button class="marks" aria-pressed={marks} onclick={() => { marks = !marks; saveOn(marks); }}>✦ 重點字{marks ? '' : '：關'}</button>
      {#if rangeStats}<span>{mode === 'wrong' ? `錯題剩 ${rangeStats.wrong} 題${deck.mixed ? '・穿插複習' : ''}` : '全部'}・熟練 {rangeStats.mastered}／{rangeStats.total}</span>{/if}
    </nav>
    {#key deck.key}
      <QuizCard {question} kindLabel={bank.label} {courseName} {marks} fix={fixes[question.id]} {onresult} {onguess} {onnext} />
    {/key}
  {:else if view === 'done'}
    <section class="done">
      <h2>錯題都練完了</h2>
      <p>這個範圍的錯題都已連續答對 {MASTER} 次。</p>
      {#if rangeStats}<p>已練 {rangeStats.done}／{rangeStats.total} 題，熟練 {rangeStats.mastered} 題。</p>{/if}
      <div class="go">
        <button class="btn primary" onclick={() => { mode = 'all'; begin(); }}>改練全部題目</button>
        <button class="btn" onclick={() => view = 'start'}>回選題</button>
      </div>
    </section>
  {/if}

  <footer>非官方練習站｜題庫版本 {generated}｜程式 v{version}（{commit}）｜解析為第三方整理，部分經人工審查加註｜紀錄只存在這台裝置｜<a href={ISSUES} target="_blank" rel="noopener">回報問題</a></footer>
</div>

<style>
  /* 高度跟大視窗走：手機網址列收合時畫布大小不變（不支援 lvh 的瀏覽器退回 100%） */
  .stars{position:fixed;left:0;top:0;width:100%;height:100%;height:100lvh;pointer-events:none;z-index:0}
  .wrap{position:relative;z-index:1;max-width:460px;margin:0 auto}
  header{text-align:center;margin-bottom:18px}
  header p{margin:2px 0 0;font-size:13px;color:var(--page-ink-2);letter-spacing:.08em}
  .bar{display:flex;justify-content:space-between;align-items:center;margin:0 6px 12px;font-size:14px;color:var(--page-ink-2)}
  .back{border:0;background:none;color:var(--gold-hi);cursor:pointer;padding:4px 0;font-size:15px}
  .marks{margin-right:auto;margin-left:12px;padding:2px 10px;border-radius:999px;cursor:pointer;font-size:13px;
    color:var(--page-ink-2);background:rgba(20,14,8,.6);border:1px solid rgba(143,108,42,.55)}
  .marks[aria-pressed="true"]{color:var(--gold-hi);border-color:var(--gold-hi)}
  .done{text-align:center;padding:40px 12px}
  .done h2{color:var(--gold-hi);letter-spacing:.15em}
  .go{display:flex;gap:10px;margin-top:20px}
  .go .btn{flex:1;padding:12px}
  .go .btn:not(.primary){color:var(--page-ink);background:rgba(28,20,12,.9)}
  .error{color:var(--bad);text-align:center}
  .hint{margin:0 6px 14px;padding:10px 12px;border-radius:10px;font-size:14px;line-height:1.6;
    color:var(--page-ink);background:rgba(28,20,12,.85);border:1px solid var(--gold)}
  footer{margin-top:22px;text-align:center;font-size:12px;color:var(--page-ink-2);opacity:.85;line-height:1.6}
  footer a{color:var(--gold-hi)}
</style>
