<script>
  import { runeRing } from '../lib/runes.js';

  /** side：'front' 或 'back'；children 是卡面內容，foot 是底部按鈕列；dormant 為背對畫面、暫停常駐動畫 */
  let { side, children, foot, footHidden = false, dormant = false } = $props();

  const runes = runeRing();
  const inks = [[28, 30, 0], [70, 58, 3.7], [38, 80, 7.3]];
  const sparks = [[0, 18, 0], [100, 62, 1.7], [37, 100, 3.1], [0, 83, 4.2], [64, 0, 2.4]];
  const corners = ['tl', 'tr', 'bl', 'br'];
</script>

<section class="face {side}" class:dormant aria-hidden={side === 'back'}>
  <div class="paper">
    <div class="cardfx" aria-hidden="true">
      <div class="fx-ink">
        {#each inks as [x, y, d]}<b style="left:{x}%;top:{y}%;animation-delay:{d}s"></b>{/each}
      </div>
      <div class="fx-runes">
        {#each runes as r}
          <i style="left:{r.x}%;top:{r.y}%;animation-delay:{r.delay}s">
            <svg viewBox="-1.3 -1.3 2.6 2.6"><path class="glow" d={r.d}/><path d={r.d} fill="none" stroke="currentColor" stroke-width=".24" stroke-linecap="round"/></svg>
          </i>
        {/each}
      </div>
    </div>
    <div class="dim"></div>
    <div class="body">{@render children()}</div>
    {#if foot && !footHidden}<div class="foot">{@render foot()}</div>{/if}
    {#each corners as c}
      <svg class="corner {c}" viewBox="0 0 36 36" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-linecap="round">
          <path d="M3 33V15C3 8 8 3 15 3h18" stroke-width="1.4"/>
          <path d="M7 33V18c0-6 5-11 11-11h15" stroke-width=".7"/>
          <circle cx="11" cy="11" r="2.4" fill="currentColor" stroke="none"/>
          <path d="M14 14c5 0 8-3 9-8M14 14c0 5-3 8-8 9" stroke-width=".9"/>
          <path d="M22 3.5l2 2-2 2-2-2z M3.5 22l2 2-2 2-2-2z" fill="currentColor" stroke="none"/>
        </g>
      </svg>
    {/each}
  </div>
  {#each sparks as [x, y, d]}
    <i class="spark" style="left:{x}%;top:{y}%;animation-delay:{d}s" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 0C13 9 15 11 24 12 15 13 13 15 12 24 11 15 9 13 0 12 9 11 11 9 12 0Z" fill="currentColor"/></svg>
    </i>
  {/each}
  <i class="shade"></i><i class="sheen"><b></b></i>
</section>

<style>
  /* 面＝暗金框；旋轉的錐形漸層當流光，紙張壓在上面只露出 4px 邊 */
  .face{
    position:absolute;inset:0;border-radius:18px;overflow:hidden;background:var(--gold-deep);
    box-shadow:0 0 0 1px rgba(0,0,0,.6);
    /* 兩面都不剔除背面、前後錯開 1px，靠 3D 深度決定誰在上面。被剔除的那面手機不會事先畫，
       翻到 90° 才第一次畫整面（紙紋＋整段解析的新字形），會頓一下（2026-10-02 手機實測：改後不再頓） */
    transform:translateZ(1px);will-change:transform
  }
  .back{transform:rotateY(180deg) translateZ(1px)}
  .face::before{
    content:"";position:absolute;inset:-50%;
    background:conic-gradient(from 0deg,
      var(--gold-deep) 0deg,var(--gold) 50deg,var(--gold-hi) 78deg,var(--gold) 100deg,var(--gold-deep) 150deg,
      var(--gold-deep) 180deg,var(--gold) 230deg,#d9b763 258deg,var(--gold) 280deg,var(--gold-deep) 330deg);
    animation:sweep 7s linear infinite;
  }
  /* 流光只要蓋住旋轉中的卡面：邊長＝對角線的正方形就夠，比 inset:-50% 少 45% 面積，出卡時點陣化較快 */
  @supports (width:hypot(3px,4px)) and (width:1cqw){
    .face{container-type:size}
    .face::before{inset:auto;left:50%;top:50%;width:hypot(100cqw,100cqh);aspect-ratio:1;translate:-50% -50%}
  }
  .paper{
    position:absolute;inset:4px;border-radius:14px;overflow:hidden;
    display:flex;flex-direction:column;color:var(--ink);
    background-color:var(--paper);
    background-image:
      radial-gradient(ellipse 100% 100% at 50% 50%, transparent 55%, rgba(var(--paper-burn),.55) 100%),
      var(--tex-paper-noise,none),
      var(--tex-paper-fiber,none),
      var(--tex-paper-stain,none),
      linear-gradient(160deg,var(--paper),var(--paper-2));
    background-size:auto,300px 300px,300px 300px,500px 500px,auto;
    box-shadow:inset 0 0 0 1px rgba(240,212,138,.35),inset 0 0 26px rgba(var(--paper-burn),.55);
  }
  .paper::after{
    content:"";position:absolute;inset:7px;border-radius:9px;pointer-events:none;
    border:1px solid rgba(143,108,42,.55);
  }
  .cardfx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .fx-ink b{
    position:absolute;width:75%;aspect-ratio:1;margin:-37.5% 0 0 -37.5%;opacity:0;
    border-radius:47% 53% 42% 58%/55% 45% 55% 45%;
    background:radial-gradient(closest-side,rgba(232,196,110,var(--ink-a1)),rgba(232,196,110,var(--ink-a2)) 68%,rgba(240,212,138,var(--ink-a3)) 88%,transparent);
    animation:ink 11s ease-out infinite;
  }
  @keyframes ink{0%{transform:scale(.15) rotate(0);opacity:0}12%{opacity:1}100%{transform:scale(1.6) rotate(50deg);opacity:0}}
  .fx-runes i{
    position:absolute;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;color:#F0D48A;opacity:var(--rune-lo);
    animation:runeOn 5.6s ease-in-out infinite;
  }
  .fx-runes svg{display:block;width:100%;height:100%;overflow:visible}
  /* 光暈：寬而淡的同形線條，取代 drop-shadow 濾鏡（56 個符文各帶濾鏡在手機上重） */
  .fx-runes .glow{fill:none;stroke:currentColor;stroke-linecap:round;stroke-width:var(--rune-glow-w);stroke-opacity:.28}
  @keyframes runeOn{0%,100%{opacity:var(--rune-lo)}7%{opacity:var(--rune-hi)}24%{opacity:var(--rune-lo)}}
  /* 暗度：壓在紋理與動畫上、文字下 */
  .dim{position:absolute;inset:0;background:#0b0704;opacity:var(--card-dim);pointer-events:none}
  .body{position:relative;z-index:1;flex:1;overflow-y:auto;padding:24px 22px 8px;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}
  .foot{position:relative;z-index:1;display:flex;gap:10px;padding:10px 18px 18px}
  .foot :global(button){flex:1}
  .corner{position:absolute;width:34px;height:34px;color:var(--gold);pointer-events:none;z-index:2}
  .corner.tl{top:3px;left:3px}
  .corner.tr{top:3px;right:3px;transform:scaleX(-1)}
  .corner.bl{bottom:3px;left:3px;transform:scaleY(-1)}
  .corner.br{bottom:3px;right:3px;transform:scale(-1)}
  .spark{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;pointer-events:none;z-index:3;
    color:#fff3c8;opacity:0;animation:twinkle 5.2s ease-in-out infinite}
  .spark svg{display:block;width:100%;height:100%;filter:drop-shadow(0 0 3px rgba(240,212,138,.9))}
  .shade{position:absolute;inset:0;z-index:4;background:#140a00;opacity:0;pointer-events:none}
  .sheen{position:absolute;inset:0;z-index:4;overflow:hidden;opacity:0;pointer-events:none}
  .sheen b{position:absolute;top:-30%;bottom:-30%;left:-60%;width:60%;
    background:linear-gradient(100deg,transparent 20%,rgba(var(--sheen),.55) 50%,transparent 80%)}
  /* 放最後並多一層 .face：要壓過上面各動畫簡寫裡隱含的 running */
  .face.dormant::before,.face.dormant :global(*){animation-play-state:paused}
</style>
