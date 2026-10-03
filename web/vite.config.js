import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { buildIndex } from './src/lib/bank-index.js';

// 頁尾顯示的程式版本與 commit 短碼，讓使用者回報時對得到版本：版本只取 package.json（唯一來源，見 docs/檔案結構規範.md〈命名〉4），
// commit 在 CI 取 GITHUB_SHA、本機取 git；tools/run_gate.py 的「建置產出檢查」核對 dist 裡有這兩個字串
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
function commit(){
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'dev'; }
}

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

// 字型授權（全面盤點 D-04）：dist 隨包發出思源宋體子集（OFL-1.1），授權文字要跟著發；@fontsource 的 LICENSE 開頭只有「Google Inc.」、
// 沒有宣告 Reserved Font Name，子集沿用家族名可以。tools/run_gate.py 的建置產出檢查核對這個檔在、頁尾有連結
function fontLicense(){
  return {
    name: 'font-license',
    generateBundle(){
      const text = readFileSync(new URL('./node_modules/@fontsource/noto-serif-tc/LICENSE', import.meta.url), 'utf8');
      const head = '本站字型「Noto Serif TC」（思源宋體）由 Google Inc. 發行，依 SIL Open Font License 1.1 授權；站上用的是依題庫用字裁切的子集（tools/build_fonts.py）。授權全文如下。\n\n';
      this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: head + text });
    },
  };
}

export default defineConfig({
  plugins: [bankIndex(), fontLicense(), svelte()],
  // 相對路徑：GitHub Pages 掛在 /ProcQuiz/ 底下也能直接開
  base: './',
  // 題庫 JSON 在 repo 的 data/questions/，位於 web/ 之外
  server: { fs: { allow: ['..'] } },
  // 題庫 JSON 兩包各 0.6–1 MB，本來就拆成按需載入，不再細切。
  // 建置目標明寫（vite 8 的預設值）：升 vite 大版預設會變而沒人知道；README〈狀態〉寫的支援瀏覽器由 tests/test_readme.py 對這份比對（全面盤點 D-02）
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200, target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'] },
  define: { __PQZ_VERSION__: JSON.stringify(pkg.version), __PQZ_COMMIT__: JSON.stringify(commit()) },
});
