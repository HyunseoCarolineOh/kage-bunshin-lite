/**
 * 브라우저 렌더링 — 활성 테마(templates/<THEME>, Vite 별칭 @theme)의 v2 템플릿(색 변형별 generated/v2-<variant>.html)만 다룬다.
 * 디자인은 템플릿이, 글은 스펙(AI)이 맡는다. 어떤 이미지 프리셋·아이콘이 있는지는 schema.v2.json(imageSlots.*.presets, iconPresets)이 정한다.
 */
import schemaJson from "@theme/schema.v2.json";
import tokens from "@theme/tokens.json";
import { assemble } from "./assembler.js";
import { THEMES, themeFor, safeImage } from "./themes.js";
import { svgToPng } from "./graphics.js";

// 테마 폴더의 파일을 이름으로 찾는다 (별칭 글롭의 키 형식은 Vite 버전에 따라 달라 basename으로 맞춘다).
const byName = (mods) => Object.fromEntries(Object.entries(mods).map(([path, value]) => [path.split("/").pop(), value]));
const generated = byName(import.meta.glob("@theme/generated/v2-*.html", { query: "?raw", import: "default", eager: true }));
const assets = byName(import.meta.glob("@theme/assets/*.{png,jpg,jpeg,gif,webp,svg}", { eager: true, import: "default" }));
const assetUrl = (file) => {
  const url = assets[String(file).split("/").pop()];
  if (!url) throw new Error(`테마 자산이 없어요: ${file} (templates/<theme>/assets/)`);
  return url;
};

export const schema = schemaJson;
export const FONT_STACK = tokens.font?.stack;
/** 프리셋 id → URL. schema.v2.json의 imageSlots.*.presets (heroBg: hero-<variant>, heroDeco: deco-<variant>, logo, logoWhite, photo …) */
export const PRESET_URLS = Object.fromEntries(
  Object.values(schema.imageSlots).flatMap((slot) => Object.entries(slot.presets || {}).map(([id, file]) => [id, assetUrl(file)])),
);
/** 아이콘 id → URL. schema.v2.json의 iconPresets (브랜드 아이콘·값 카드 아이콘) */
export const ICON_URLS = Object.fromEntries(Object.entries(schema.iconPresets || {}).map(([id, file]) => [id, assetUrl(file)]));
const templates = Object.fromEntries(Object.keys(THEMES).map((id) => {
  const html = generated[`v2-${id}.html`];
  if (!html) throw new Error(`generated/v2-${id}.html 이 없어요 — npm run template:build`);
  return [id, html];
}));
const parse = (html) => new DOMParser().parseFromString(html, "text/html");
const resolveImage = (value) => PRESET_URLS[value] || safeImage(value);

export function resolveImages(spec) {
  const theme = themeFor(spec).id;
  return { heroBg: resolveImage(spec.images.heroBg), logo: resolveImage(spec.images.logo),
    // 다크 배너의 흰 로고, 컬러 블록 배너의 테마 장식 — 값이 없으면 테마 기본값
    logoWhite: resolveImage(spec.images.logoWhite || schema.imageSlots.logoWhite?.default),
    heroDeco: resolveImage(spec.images.heroDeco || `deco-${theme}`),
    photo: resolveImage(spec.images.photo), icons: ICON_URLS };
}

function render(spec, mode) {
  return assemble(templates[themeFor(spec).id], spec, schema, { parse, mode, images: resolveImages(spec), fontStack: FONT_STACK });
}
export const assemblePreview = (spec) => render(spec, "preview");
export const assembleExportShallow = (spec) => render(spec, "export");

async function toDataUri(url) {
  if (url.startsWith("data:image/svg+xml")) return svgToPng(decodeURIComponent(url.slice(url.indexOf(",") + 1)));
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error("이미지를 불러오지 못했습니다. 연결을 확인해 주세요.");
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("이미지 형식이 아닙니다.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 내려받기용 — 이미지를 전부 data URI로 박아 파일 하나로 완결. */
export async function assembleExport(spec) {
  return embedImages(assembleExportShallow(spec));
}

/** 복사용 — 앱이 서빙하는 이미지는 절대 URL로, SVG 그래픽은 PNG data URI로. */
export async function assembleEmailCopy(spec) {
  const doc = parse(assembleExportShallow(spec));
  for (const img of doc.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src");
    img.setAttribute("src", src.startsWith("data:") ? await toDataUri(src) : new URL(src, window.location.href).href);
  }
  for (const el of doc.querySelectorAll("[style]"))
    el.setAttribute("style", el.getAttribute("style").replace(/url\(['"]?([^'")]+)['"]?\)/g, (_m, url) => `url('${url.startsWith("data:") ? url : new URL(url, window.location.href).href}')`));
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
}

async function embedImages(html) {
  const doc = parse(html);
  const urls = new Set();
  for (const img of doc.querySelectorAll("img[src]")) urls.add(img.getAttribute("src"));
  for (const el of doc.querySelectorAll("[style]"))
    for (const match of el.getAttribute("style").matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) urls.add(match[1]);
  const replacements = new Map(await Promise.all([...urls].filter(Boolean).map(async url => [url, await toDataUri(url)])));
  for (const img of doc.querySelectorAll("img[src]")) img.setAttribute("src", replacements.get(img.getAttribute("src")) || img.getAttribute("src"));
  for (const el of doc.querySelectorAll("[style]"))
    el.setAttribute("style", el.getAttribute("style").replace(/url\(['"]?([^'")]+)['"]?\)/g, (_m, url) => `url('${replacements.get(url) || url}')`));
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
}
