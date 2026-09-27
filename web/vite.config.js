import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { THEME, THEME_DIR } from "../theme.config.mjs";

// 활성 테마(templates/<THEME>)는 저장소 루트의 단일 소스 — @theme 별칭으로 끌어온다. 테마 선택은 theme.config.mjs 하나가 맡는다.
// LOCAL_API=http://127.0.0.1:8787 이면 /api 와 /config.json 을 로컬 API 브리지(scripts/local-api.mjs)로 넘긴다.
const localApi = process.env.LOCAL_API;
console.log(`[vite] theme: ${THEME}`);
export default defineConfig({
  plugins: [react()],
  define: { __THEME__: JSON.stringify(THEME) },
  resolve: {
    alias: { "@theme": THEME_DIR },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
    ...(localApi ? { proxy: { "/api": { target: localApi, changeOrigin: true }, "/config.json": { target: localApi, changeOrigin: true } } } : {}),
  },
});
