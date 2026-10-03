import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';

// 背面暫停動畫靠 animation-play-state 壓過各動畫簡寫裡隱含的 running；
// 規則放錯位置不會報錯，只會靜靜照跑（2026-10-03 實際踩過：放在 .face::before 前面，流光沒停）
const src = readFileSync(new URL('../components/CardFace.svelte', import.meta.url), 'utf8');
const css = compile(src, { filename: 'CardFace.svelte', css: 'external' }).css.code;
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }))
  .filter(r => !r.sel.startsWith('@') && !/^\d|^from|^to/.test(r.sel));

test('背對畫面的那面：暫停規則排在所有動畫規則之後', () => {
  const pause = rules.findIndex(r => /animation-play-state:\s*paused/.test(r.body));
  assert.ok(pause >= 0, '找不到 animation-play-state:paused 的規則');
  assert.match(rules[pause].sel, /\.face\.dormant/);
  const anims = rules.map((r, i) => [r, i]).filter(([r]) => /(^|;)\s*animation\s*:/.test(r.body));
  assert.ok(anims.length >= 4, `動畫規則只剩 ${anims.length} 條，測試前提變了`);
  for (const [r, i] of anims) assert.ok(i < pause, `動畫規則「${r.sel}」排在暫停規則之後，會把 paused 蓋回 running`);
});
