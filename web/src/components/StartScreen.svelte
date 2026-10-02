<script>
  import { statsByPrefix } from '../lib/progress.js';

  /** index 為目前題型的課程清單（建置時產生，不必等題庫）；starting 為按下開始後還在等題庫下載；rev 變動時重算進度 */
  let { kind = $bindable(), course = $bindable(), mode = $bindable(), index, progress, rev, starting, onstart } = $props();

  const KINDS = [['true-false', '是非題'], ['multiple-choice', '選擇題']];
  const MODES = [['all', '全部'], ['wrong', '錯題']];

  let rows = $derived.by(() => {
    rev;
    return [{ id: 0, name: '全部課程', count: index.total, prefix: index.prefix }, ...index.courses]
      .map(c => ({ ...c, ...statsByPrefix(progress, c.prefix, c.count) }));
  });
  let noWrong = $derived(mode === 'wrong' && !(rows.find(r => r.id === course)?.wrong));
</script>

<section class="start">
  <div class="group">
    <span class="lbl">題型</span>
    <div class="seg">
      {#each KINDS as [v, label]}
        <button aria-pressed={kind === v} onclick={() => { kind = v; course = 0; }}>{label}</button>
      {/each}
    </div>
  </div>
  <div class="group">
    <span class="lbl">出題</span>
    <div class="seg">
      {#each MODES as [v, label]}
        <button aria-pressed={mode === v} onclick={() => mode = v}>{label}</button>
      {/each}
    </div>
  </div>

  <div class="courses">
      {#each rows as r (r.id)}
        <button class="course" aria-pressed={course === r.id} onclick={() => course = r.id}>
          <span class="name">{r.id ? `${r.id}. ` : ''}{r.name}</span>
          <span class="count">{r.total} 題</span>
          <span class="bar"><i style="width:{r.total ? r.done / r.total * 100 : 0}%"></i></span>
          <span class="sub">{r.done ? `已練 ${r.done}・熟練 ${r.mastered}・錯題 ${r.wrong}` : '還沒練過'}</span>
        </button>
      {/each}
  </div>

  <div class="go">
    {#if starting}
      <button class="btn primary" disabled>題庫下載中…</button>
    {:else if noWrong}
      <button class="btn primary" disabled>這個範圍沒有錯題</button>
    {:else}
      <button class="btn primary" onclick={onstart}>開始練習</button>
    {/if}
  </div>
</section>

<style>
  .start{display:flex;flex-direction:column;gap:14px}
  .group{display:grid;grid-template-columns:3.5em 1fr;align-items:center;gap:10px}
  .lbl{letter-spacing:.2em;color:var(--gold-mid);font-size:14px}
  .seg{display:flex;border:1px solid var(--gold);border-radius:999px;overflow:hidden}
  .seg button{flex:1;padding:6px 10px;border:0;cursor:pointer;background:rgba(20,14,8,.6);color:var(--page-ink-2);font-size:15px}
  .seg button[aria-pressed="true"]{background:linear-gradient(180deg,#b8913f,#8f6c2a);color:#1a1208;font-weight:700}
  .courses{display:grid;gap:8px}
  .course{
    display:grid;grid-template-columns:1fr auto;gap:2px 10px;text-align:left;cursor:pointer;
    padding:10px 14px;border-radius:12px;color:var(--page-ink);
    background:rgba(28,20,12,.72);border:1px solid rgba(143,108,42,.55);
  }
  .course[aria-pressed="true"]{border-color:var(--gold-hi);box-shadow:0 0 0 1px var(--gold-hi),0 0 18px rgba(240,212,138,.18)}
  .name{font-size:15px}
  .count{font-size:13px;color:var(--page-ink-2);align-self:center}
  .bar{grid-column:1/-1;height:3px;border-radius:2px;background:rgba(143,108,42,.3);overflow:hidden;margin-top:4px}
  .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-hi))}
  .sub{grid-column:1/-1;font-size:12px;color:var(--page-ink-2)}
  .go{position:sticky;bottom:12px;display:flex;gap:10px}
  .go .btn{flex:1;padding:12px}
  .go .btn:not(.primary){flex:0 0 auto;color:var(--page-ink);background:rgba(28,20,12,.9)}
</style>
