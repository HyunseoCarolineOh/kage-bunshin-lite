/**
 * 공유물 동기화 — 빌드·배포 전 실행 (npm run sync:templates).
 * 단일 소스(web/src/lib/*.js, templates/<THEME>/)를 Lambda 번들 폴더로 복사한다. Lambda 쪽 사본은 직접 수정하지 않는다.
 *
 *   lambda/api/shared/*.mjs        ← web/src/lib/*.js (import 확장자를 .mjs로 고쳐 복사)
 *   lambda/api/templates/          ← 활성 테마의 schema.v2.json · theme.mjs · prompt-style.md (git-ignored)
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { THEME, THEME_DIR, ROOT } from "../theme.config.mjs";

const libPairs = [
  ["web/src/lib/briefing.js", "lambda/api/shared/briefing.mjs"],
  ["web/src/lib/sectionKeys.js", "lambda/api/shared/sectionKeys.mjs"],
  ["web/src/lib/themes.js", "lambda/api/shared/themes.mjs"],
  ["web/src/lib/graphics.js", "lambda/api/shared/graphics.mjs"],
  // .mjs로 복사 — lambda/api엔 package.json이 없어 .js는 CommonJS로 취급된다
  ["web/src/lib/validator.js", "lambda/api/shared/validator.mjs"],
];
for (const [src, dst] of libPairs) {
  mkdirSync(dirname(join(ROOT, dst)), { recursive: true });
  const code = readFileSync(join(ROOT, src), "utf8")
    .replace(/from "(\.\/[^"]+)\.js"/g, 'from "$1.mjs"')
    // themes.js reads the active theme through the templates/_active.mjs shim; inside the bundle it is a plain copy.
    .replace(/from "(?:\.\.\/)+templates\/_active\.mjs"/g, 'from "../templates/theme.mjs"');
  writeFileSync(join(ROOT, dst), code);
  console.log(`${src} -> ${dst}`);
}

const themePairs = [
  ["schema.v2.json", "schema.json"],
  ["theme.mjs", "theme.mjs"],
  ["prompt-style.md", "prompt-style.md"],
];
mkdirSync(join(ROOT, "lambda/api/templates"), { recursive: true });
for (const [src, dst] of themePairs) {
  copyFileSync(join(THEME_DIR, src), join(ROOT, "lambda/api/templates", dst));
  console.log(`templates/${THEME}/${src} -> lambda/api/templates/${dst}`);
}
