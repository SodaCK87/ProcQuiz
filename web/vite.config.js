import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildIndex } from './src/lib/bank-index.js';

// 建置時產生 virtual:bank-index（課程清單＋題數＋版本），題庫 JSON 本身仍按需下載
function bankIndex(){
  const id = 'virtual:bank-index', resolved = '\0' + id;
  return {
    name: 'bank-index',
    resolveId: s => (s === id ? resolved : null),
    load(s){
      if (s !== resolved) return null;
      const banks = {};
      for (const kind of ['true-false', 'multiple-choice']){
        const file = fileURLToPath(new URL(`../data/questions/${kind}.json`, import.meta.url));
        this.addWatchFile(file);
        banks[kind] = JSON.parse(readFileSync(file, 'utf8'));
      }
      return `export default ${JSON.stringify(buildIndex(banks))};`;
    },
  };
}

export default defineConfig({
  plugins: [bankIndex(), svelte()],
  // 相對路徑：GitHub Pages 掛在 /ProcQuiz/ 底下也能直接開
  base: './',
  // 題庫 JSON 在 repo 的 data/questions/，位於 web/ 之外
  server: { fs: { allow: ['..'] } },
  // 題庫 JSON 兩包各 0.6–1 MB，本來就拆成按需載入，不再細切
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
