import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 輸出單一 dist/index.html：離線可用、可直接放上 Pages（D000 技術方向）
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 },
  server: { port: 8301 },
});
