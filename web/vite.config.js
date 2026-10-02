import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // 相對路徑：GitHub Pages 掛在 /ProcQuiz/ 底下也能直接開
  base: './',
  // 題庫 JSON 在 repo 的 data/questions/，位於 web/ 之外
  server: { fs: { allow: ['..'] } },
  // 題庫 JSON 兩包各 0.6–1 MB，本來就拆成按需載入，不再細切
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
