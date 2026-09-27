/**
 * v2 디자인 빌더 — 테마 폴더(templates/<THEME>)의 tokens.json + template.src.html + v2-layouts.mjs로
 * 색 변형(variant)마다 generated/v2-<variant>.html을 굽는다. 변형 목록·색은 theme.mjs가 정한다.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";
import { THEME, THEME_DIR, loadTheme } from "../theme.config.mjs";
const dir = THEME_DIR;
const THEMES = (await loadTheme()).variants;
const { layouts, refits } = await import(pathToFileURL(join(dir, "v2-layouts.mjs")).href);

export function buildDesignV2(themeId) {
  const theme = THEMES[themeId];
  if (!theme) throw new Error(`Unknown theme variant ${themeId}`);
  const tokens = JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8"));
  // 라벨(eyebrow) 글꼴: 테마가 font.label을 주면 그것, 없으면 예전 이름(font.ember) → 본문 스택 순으로 쓴다.
  tokens.font.label ||= tokens.font.ember || tokens.font.stack;
  Object.assign(tokens.color, { accent: theme.accent, muted: "#8a8f98", line: "#ecebf0", tintHero: theme.tint, tintSection: theme.tint, tintFooter: theme.tint, tintCard: theme.tint, tableHeadBg: theme.chartBg, railLine: theme.chartBg, hashtagBg: theme.tint });
  tokens.gradient.accent = `linear-gradient(90deg,${theme.accent},${theme.end})`;
  // Editorial surface: soft rounded cards, light shadows, a clear 22/16/14/12.5 type scale and 44px section rhythm.
  Object.assign(tokens.radius, { card: "14px", cardSm: "10px", quote: "14px" });
  tokens.shadow.card = "0 6px 24px rgba(20,25,32,0.06)";
  tokens.shadow.cardSoft = "0 3px 12px rgba(20,25,32,0.04)";
  tokens.style.eyebrow = "font-size:11.5px; font-weight:700; letter-spacing:1.2px; color:{{color.muted}}; font-family:{{font.label}};";
  tokens.style.sectionTitle = "font-size:22px; font-weight:800; color:{{color.ink}}; letter-spacing:-0.4px; line-height:1.35; padding-top:6px; padding-bottom:24px;";
  tokens.style.sectionWhite = "background-color:{{color.white}}; padding:44px 40px;";
  tokens.style.sectionTint = "background-color:{{color.tintSection}}; background:linear-gradient(180deg,{{color.tintSection}} 0%,{{color.white}} 100%); padding:44px 40px;";
  tokens.style.numBadge = "background:{{gradient.accent}}; background-color:{{color.accent}}; border-radius:50%; font-size:13px; font-weight:700; color:{{color.white}}; line-height:28px;";
  const doc = parseHTML(readFileSync(join(dir, "template.src.html"), "utf8")).document;
  const parent = doc.querySelector('[data-section="footer"]').parentNode;
  for (const [name, html] of Object.entries(layouts)) {
    const replacement = parseHTML(`<html><body><table>${html}</table></body></html>`).document.querySelector("[data-section]");
    const existing = doc.querySelector(`[data-section="${name}"]`);
    if (existing) existing.replaceWith(replacement);
    else parent.insertBefore(replacement, parent.querySelector('[data-section="footer"]'));
  }
  // Sections that keep v1 inner markup are fitted to the v2 frame: no centered headings, same cell spacing, theme gradient.
  for (const [name, refit] of Object.entries(refits)) {
    const cell = doc.querySelector(`[data-section="${name}"] > td`);
    for (const child of cell.children) if (child.hasAttribute("data-slot")) child.removeAttribute("align");
    if (refit.cell) { cell.setAttribute("style", refit.cell); cell.removeAttribute("data-slot-bg"); }
    for (const [slot, style] of Object.entries(refit.headings || {})) cell.querySelector(`[data-slot="${name}.${slot}"]`).setAttribute("style", style);
    if (refit.repeatCell) cell.querySelector('[data-repeat="."]').setAttribute("style", refit.repeatCell);
    for (const [from, to] of refit.replace || []) for (const el of cell.querySelectorAll("[style]")) el.setAttribute("style", el.getAttribute("style").replaceAll(from, to));
  }
  doc.documentElement.setAttribute("data-design-version", "2");
  doc.documentElement.setAttribute("data-theme", themeId);
  let html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
  for (let i = 0; i < 5 && html.includes("{{"); i++) {
    html = html.replace(/\{\{([a-zA-Z0-9.]+)\}\}/g, (_m, path) => {
      const value = path.split(".").reduce((obj,key) => obj?.[key], tokens);
      if (typeof value !== "string") throw new Error(`Missing token: ${path}`);
      return value;
    });
  }
  if (/\{\{/.test(html)) throw new Error("Unresolved design token");
  return html;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(join(dir, "generated"), { recursive: true });
  for (const id of Object.keys(THEMES)) {
    writeFileSync(join(dir, "generated", `v2-${id}.html`), buildDesignV2(id));
    console.log(`[${THEME}] generated/v2-${id}.html`);
  }
}
