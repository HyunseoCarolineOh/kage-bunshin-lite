/**
 * 룰베이스 템플릿 빌더 — tokens.json(규칙) + template.src.html(구조) → template.html.
 *   npm run template:build
 *
 * template.html은 생성물이다. 디자인 값을 바꾸려면 tokens.json을,
 * 구조를 바꾸려면 template.src.html을 고치고 이 스크립트를 돌린다.
 * (test-assembler가 "src+tokens로 다시 구웠을 때 template.html과 같은지"를 검사한다)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME, THEME_DIR } from "../theme.config.mjs";

const tplDir = THEME_DIR; // templates/<THEME> — see theme.config.mjs

export function buildTemplate(dir = tplDir) {
  const tokens = JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8"));
  let html = readFileSync(join(dir, "template.src.html"), "utf8");

  const lookup = (path) => {
    let cur = tokens;
    for (const seg of path.split(".")) {
      cur = cur?.[seg];
      if (cur == null) throw new Error(`tokens.json에 없는 토큰: {{${path}}}`);
    }
    if (typeof cur !== "string") throw new Error(`토큰이 문자열이 아님: {{${path}}}`);
    return cur;
  };

  // style.* 안에서 다른 토큰을 참조할 수 있으므로 남지 않을 때까지 치환
  for (let pass = 0; pass < 5 && html.includes("{{"); pass++) {
    html = html.replace(/\{\{([a-zA-Z0-9.]+)\}\}/g, (_, p) => lookup(p));
  }
  const leftover = html.match(/\{\{[^}]*\}\}/);
  if (leftover) throw new Error(`치환되지 않은 참조: ${leftover[0]}`);

  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = buildTemplate();
  writeFileSync(join(tplDir, "template.html"), html);
  console.log(`[${THEME}] template.html 생성 (${html.length.toLocaleString()} bytes) — tokens.json + template.src.html`);
}
