<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import CardFace from './CardFace.svelte';
  import { burst, setAvoid } from '../lib/starfield.js';
  import { segments } from '../lib/highlight.js';
  import { isCorrect } from '../lib/deck.js';

  /** onresult(ok) 作答當下呼叫；onguess() 答對後標記是猜的；onnext() 換下一題（由外層改 question）；marks 為是否標重點字，fix 為這題的逐題微調 */
  let { question, kindLabel, courseName, onresult, onguess, onnext, marks = true, fix = null } = $props();

  const NOTE_TITLE = { replace: '審查說明', correct: '出處更正', law: '法條更正', answer: '答案註記' };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let slot, card, floor, aura, front, back;
  let answered = $state(false), chosen = $state(null), revealed = $state(false), guessed = $state(false), busy = false;
  let isOk = $derived(answered && isCorrect(chosen, question.answer));
  let stem = $derived(marks ? segments(question.stem, fix) : [{ t: question.stem, hit: false }]);
  let choices = $derived(question.options ? question.options.map((t, k) => [k + 1, t]) : [['O', null], ['X', null]]);

  /* ---------- 光影翻轉（定案樣式）：所有狀態在 S，一條 rAF 迴圈逐格算 ---------- */
  const S = { theta: 0, vel: 0, target: 0, mode: 'idle', landed: true, prevDiff: 0, onLand: null };
  let shades = [], sheens = [], bars = [], running = false, last = 0, shownFront = null;
  let flipping = $state(false), dormantFront = $state(false), dormantBack = $state(true);

  function render(){
    if (!card) return;
    const rad = S.theta * Math.PI / 180, side = Math.abs(Math.sin(rad)), cos = Math.cos(rad);
    const lift = 56 * side;
    card.style.transform = `translateZ(${lift}px) rotateY(${S.theta}deg)`;
    // 背面靠 backface-visibility 藏起來，但保持可見好讓它事先畫好；翻到中途才第一次畫背面，手機上會卡一下
    const frontOn = cos > 0;
    if (frontOn !== shownFront){
      shownFront = frontOn;
      front.style.pointerEvents = frontOn ? '' : 'none';
      back.style.pointerEvents = frontOn ? 'none' : '';
      front.setAttribute('aria-hidden', String(!frontOn));
      back.setAttribute('aria-hidden', String(frontOn));
      // pointer-events 擋不住鍵盤：沒有 inert 時 Tab 會停在看不見那面的按鈕，按 Enter 等於跳題（全面盤點 A-03）
      front.inert = !frontOn; back.inert = frontOn;
    }
    const narrow = .3 + .7 * Math.abs(cos);
    floor.style.transform = `translateY(${lift * .3}px) scale(${narrow * (1 + side * .25)}, ${1 + side * .6})`;
    floor.style.opacity = String(1 - side * .55);
    aura.style.transform = `scaleX(${narrow})`;
    const u = (((S.theta % 180) + 180) % 180) / 180;
    shades.forEach(s => s.style.opacity = String(.5 * side));
    sheens.forEach(s => s.style.opacity = String(Math.min(1, side * 1.8)));
    bars.forEach(b => b.style.transform = `translateX(${u * 270}%)`);
  }

  function step(dt){
    if (S.mode !== 'spring') return;
    // 反應時間 0.75 s、阻尼 0.75（約 25% 回彈），與試驗頁選定的參數相同
    const T = .75, zeta = .75, k = (2 * Math.PI / T) ** 2, c = 4 * Math.PI * zeta / T, h = 1 / 480;
    for (let n = Math.ceil(dt / h); n > 0; n--){ const a = -k * (S.theta - S.target) - c * S.vel; S.vel += a * h; S.theta += S.vel * h; }
    const diff = S.theta - S.target;
    if (!S.landed && (Math.sign(diff) !== Math.sign(S.prevDiff) || Math.abs(diff) < 1)){ S.landed = true; land(); }
    S.prevDiff = diff;
    if (Math.abs(diff) < .05 && Math.abs(S.vel) < 1){ S.theta = S.target; S.vel = 0; S.mode = 'idle'; }
  }

  function tickFrame(now){
    const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
    step(dt); render();
    if (S.mode !== 'idle') requestAnimationFrame(tickFrame); else { running = false; flipping = false; rest(); }
  }

  // 背對畫面的那面暫停常駐動畫：看不到，卻照樣每幀重算與合成
  function rest(){ dormantFront = !shownFront; dormantBack = shownFront; }

  function flipTo(target, onLand){
    S.onLand = onLand || null;
    if (reduced){ S.theta = target; render(); land(); return; }
    S.mode = 'spring'; S.target = target; S.landed = false; S.prevDiff = S.theta - target;
    flipping = true; dormantFront = dormantBack = false;
    if (!running){ running = true; last = performance.now(); requestAnimationFrame(tickFrame); }
  }

  function land(){
    const f = S.onLand; S.onLand = null;
    const r = card.getBoundingClientRect();
    burst(r.left + 4, r.top + r.height * .5, 10); burst(r.right - 4, r.top + r.height * .5, 10);
    if (f) f();
  }

  function answer(val){
    if (answered || busy) return;
    chosen = val; answered = true;
    onresult(isCorrect(val, question.answer));
    flipTo(S.theta + 180, () => {
      revealed = true;
      const seal = back.querySelector('.seal');
      if (seal && !reduced) seal.animate([{ transform: 'rotate(-8deg) scale(1.9)', opacity: 0 }, { transform: 'rotate(-8deg) scale(1)', opacity: 1 }],
        { duration: 280, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    });
  }

  const peek = () => { if (!busy) flipTo(Math.round(S.theta / 180) * 180 - 180); };
  const show = () => { if (!busy) flipTo(Math.round(S.theta / 180) * 180 + 180); };

  async function next(){
    if (busy) return;
    busy = true;
    const out = reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-110%) rotate(-7deg)', opacity: 0 }];
    const inn = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateY(28px) scale(.95)', opacity: 0 }, { transform: 'none', opacity: 1 }];
    await slot.animate(out, { duration: 300, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).finished;
    await onnext();
    await tick();
    if (!slot) return;  // 最後一題：外層已換成完成畫面，這張卡已卸載
    answered = false; chosen = null; revealed = false; guessed = false;
    Object.assign(S, { theta: 0, vel: 0, target: 0, mode: 'idle', landed: true, onLand: null });
    await tick();
    render(); rest();
    for (const b of slot.querySelectorAll('.body')) b.scrollTop = 0;
    await slot.animate(inn, { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished;
    slot.getAnimations().forEach(a => a.cancel());
    busy = false;
  }

  onMount(() => {
    front = card.querySelector('.front'); back = card.querySelector('.back');
    shades = [...card.querySelectorAll('.shade')]; sheens = [...card.querySelectorAll('.sheen')]; bars = [...card.querySelectorAll('.sheen b')];
    render(); rest();
    setAvoid(() => slot && slot.getBoundingClientRect());
  });
  onDestroy(() => setAvoid(null));
</script>

<div class="slot" class:flipping bind:this={slot}>
  <div class="aura" bind:this={aura}></div>
  <div class="floor" bind:this={floor}></div>
  <div class="card" bind:this={card}>
    <CardFace side="front" footHidden={!revealed} dormant={dormantFront}>
      <div class="inner">
        <div class="meta">{kindLabel}・{courseName}・第 {question.no} 題</div>
        <p class="stem">{#each stem as s}{#if s.hit}<mark><i class="star" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 0C13 9 15 11 24 12 15 13 13 15 12 24 11 15 9 13 0 12 9 11 11 9 12 0Z" fill="currentColor"/></svg></i>{s.t}</mark>{:else}{s.t}{/if}{/each}</p>
        <div class={question.options ? 'mc' : 'tf'}>
          {#each choices as [val, text]}
            <button class="btn"
              class:chosen={chosen === val}
              class:is-ans={revealed && isCorrect(val, question.answer)}
              class:is-wrong={revealed && chosen === val && !isCorrect(val, question.answer)}
              disabled={answered}
              onclick={() => answer(val)}>
              {#if text}<span class="no">{val}</span><span>{text}</span>{:else}{val}{/if}
            </button>
          {/each}
        </div>
      </div>
      {#snippet foot()}<button class="btn primary" onclick={show}>看答案</button>{/snippet}
    </CardFace>
    <CardFace side="back" dormant={dormantBack}>
      <!-- 解析在出題時就排好，字型也趁讀題時載入；按下答案只換上面的判定 -->
      <div class="verdict" class:ok={isOk} class:bad={!isOk}>
        <div class="seal">{isOk ? '正' : '誤'}</div>
        <div><strong>{isOk ? '答對了' : '答錯了'}</strong><span>正解 {question.answer}｜你選 {chosen ?? ''}</span></div>
        {#if isOk}
          <button class="btn guess" disabled={guessed} onclick={() => { guessed = true; onguess(); }}>{guessed ? '已記為沒把握' : '其實是猜的'}</button>
        {/if}
      </div>
      {#if question.options}<p>正解：({question.answer}) {question.options[question.answer - 1]}</p>{/if}
      {#if question.law}<h3>法條</h3><p>政府採購法{question.law}</p>{/if}
      {#if question.explanation}<h3>解析</h3><p>{question.explanation}</p>{/if}
      {#each question.notes as n}<h3>{NOTE_TITLE[n.type] ?? '註記'}</h3><p>{n.text}</p>{/each}
      {#if !question.explanation && !question.notes.length}<p class="none">這題目前沒有解析。</p>{/if}
      {#snippet foot()}
        <button class="btn" onclick={peek}>看題目</button>
        <button class="btn primary" onclick={next}>下一題</button>
      {/snippet}
    </CardFace>
  </div>
</div>

<style>
  .slot{position:relative;height:min(64vh,560px);perspective:1100px;margin:0 6px 30px}
  .aura{position:absolute;inset:0;border-radius:18px;pointer-events:none;
    box-shadow:0 0 40px 6px rgba(240,212,138,.24);animation:aura 4.5s ease-in-out infinite}
  @keyframes aura{0%,100%{opacity:.45}50%{opacity:1}}
  .floor{position:absolute;left:8%;right:8%;bottom:-20px;height:32px;pointer-events:none;
    background:radial-gradient(ellipse at center,rgba(0,0,0,.7),transparent 70%)}
  /* 3D 容器不得帶 overflow／opacity／filter，否則會被壓平（MDN transform-style） */
  .card{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}
  /* 翻卡期間才把每幀要改的遮罩與地面陰影升成獨立圖層，否則每幀連帶重畫整面卡（2026-10-03 同頁 A／B：超過 8 ms 的幀 16 → 1.5 格）；
     落定就拿掉，免得常駐圖層吃記憶體 */
  .flipping .floor{will-change:transform,opacity}
  .flipping :global(.shade),.flipping :global(.sheen){will-change:opacity}
  .flipping :global(.sheen b){will-change:transform}

  /* 題目短時置中；內容超出時 auto 邊距歸零，不會被裁掉頂端 */
  .inner{margin:auto 0}
  .meta{font-size:12px;color:var(--ink-2);letter-spacing:.06em;margin-bottom:10px;text-align:center}
  .meta::after{content:"";display:block;height:1px;margin:8px auto 0;width:60%;
    background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .stem{font-size:18px;margin:0 0 18px;line-height:1.85}
  /* 重點字：星芒點睛（原型 web/prototype/highlight-style.html 的 D 樣式，星星在字首） */
  mark{background:none;color:var(--gold-hi);font-weight:700;text-shadow:0 0 8px rgba(240,212,138,.35)}
  .star{display:inline-block;width:.62em;height:.62em;vertical-align:.75em;margin:0 .05em 0 .1em;color:#fff3c8;
    filter:drop-shadow(0 0 3px rgba(240,212,138,.9));animation:twk 3.6s ease-in-out infinite}
  .star svg{display:block;width:100%;height:100%}
  @keyframes twk{0%,100%{transform:scale(.55) rotate(0);opacity:.55}40%{transform:scale(1.1) rotate(45deg);opacity:1}70%{transform:scale(.7) rotate(90deg);opacity:.7}}
  .tf{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tf .btn{font-size:30px;font-weight:700;padding:14px 0;line-height:1.2}
  .mc{display:grid;gap:9px}
  .mc .btn{text-align:left;display:flex;gap:10px;align-items:flex-start;line-height:1.6}
  .mc .no{font-weight:700;color:var(--gold-text);min-width:1.1em}
  .btn.chosen{outline:2px solid var(--gold-hi);outline-offset:2px}
  .btn.is-ans{background:var(--ok-bg);border-color:var(--ok);color:var(--ok)}
  .btn.is-wrong{background:var(--bad-bg);border-color:var(--bad);color:var(--bad)}

  .verdict{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:14px}
  .seal{flex:none;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;
    font-size:30px;font-weight:700;transform:rotate(-8deg);border:3px double currentColor}
  .verdict.ok .seal{color:var(--ok);background:var(--ok-bg)}
  .verdict.bad .seal{color:var(--bad);background:var(--bad-bg)}
  .verdict strong{display:block;font-size:20px}
  .verdict.ok strong{color:var(--ok)}
  .verdict.bad strong{color:var(--bad)}
  .verdict span{font-size:14px;color:var(--ink-2);white-space:nowrap}
  .guess{margin-left:auto;flex:none;padding:6px 10px;font-size:13px}
  h3{display:flex;align-items:center;gap:8px;font-size:14px;letter-spacing:.2em;margin:16px 0 4px;color:var(--gold-text)}
  h3::before,h3::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
  h3::after{background:linear-gradient(90deg,var(--gold),transparent)}
  p{margin:0;white-space:pre-line}
  .none{color:var(--ink-2);margin-top:14px}
</style>
