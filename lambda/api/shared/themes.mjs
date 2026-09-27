/**
 * Document-wide colour variants ("themes") of the active brand theme.
 * The list itself lives in templates/<THEME>/theme.mjs; this module only adds the helpers.
 *
 * templates/_active.mjs is a two-line, git-ignored shim written by theme.config.mjs that re-exports the active theme.
 * scripts/sync-templates.mjs rewrites this import to "../templates/theme.mjs" for the Lambda bundle.
 */
import theme from "../templates/theme.mjs";

/** Active theme descriptor: { id, name, defaultVariant, variants, logoWhite, brandLabels, icons, legacyBackgrounds }. */
export const THEME = theme;
/** variant id → { id, label, accent, end, tint, chartBg, background } */
export const THEMES = Object.fromEntries(Object.entries(theme.variants).map(([id, v]) => [id, { ...v, id, background: v.background || `hero-${id}` }]));
export const DEFAULT_THEME_ID = theme.defaultVariant in THEMES ? theme.defaultVariant : Object.keys(THEMES)[0];
export const isV2 = (spec) => spec?.meta?.designVersion === 2;
export const themeFor = (spec) => THEMES[spec?.meta?.themeId] || THEMES[DEFAULT_THEME_ID];
/** Hero backgrounds that follow the variant (user-uploaded backgrounds are left alone when the variant changes). */
export const themeBackgrounds = new Set([...(theme.legacyBackgrounds || []), ...Object.values(THEMES).map((t) => t.background)]);

/**
 * Guess a variant from the brief — a product variant only when that product is the *topic*, not a passing mention.
 * Variants opt in with `keywords: [regex source, ...]` in theme.mjs; without keywords this always returns the default.
 *   ① product names inside URLs are not a topic → stripped
 *   ② if exactly one variant is named in the title or the first line → that variant; several → default
 *   ③ otherwise a variant wins only with 4+ mentions and at least twice the runner-up
 */
export function inferTheme(brief, title = "") {
  const products = Object.values(THEMES).filter((t) => Array.isArray(t.keywords) && t.keywords.length)
    .map((t) => [t.id, new RegExp(t.keywords.join("|"), "gi")]);
  if (!products.length) return DEFAULT_THEME_ID;
  const text = String(brief || "").replace(/https?:\/\/\S+/g, " ");
  const firstLine = (text.split("\n").find((l) => l.trim()) || "").slice(0, 160);
  const head = `${String(title || "")}\n${firstLine}`;
  const inHead = products.filter(([, re]) => (head.match(re) || []).length > 0).map(([id]) => id);
  if (inHead.length === 1) return inHead[0];
  if (inHead.length > 1) return DEFAULT_THEME_ID;
  const [top, second] = products.map(([id, re]) => [id, (text.match(re) || []).length]).sort((a, b) => b[1] - a[1]);
  return top[1] >= 4 && top[1] >= 2 * (second?.[1] || 0) ? top[0] : DEFAULT_THEME_ID;
}

export function changeTheme(spec, themeId) {
  if (!THEMES[themeId]) return;
  spec.meta = { ...spec.meta, designVersion: 2, themeId };
  spec.images ||= {};
  if (!spec.images.heroBg || themeBackgrounds.has(spec.images.heroBg))
    spec.images.heroBg = THEMES[themeId].background;
  // 컬러 블록 배너의 장식은 테마 색을 따른다 (사용자 지정 이미지는 유지)
  if (!spec.images.heroDeco || /^deco-/.test(spec.images.heroDeco))
    spec.images.heroDeco = `deco-${themeId}`;
}

export function resetThemeBackground(spec) {
  spec.images.heroBg = themeFor(spec).background;
  spec.images.heroDeco = `deco-${themeFor(spec).id}`;
}

export function safeLink(value) {
  if (typeof value !== "string" || /[\u0000-\u0020]/.test(value)) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? value : "";
  } catch { return ""; }
}

export function safeImage(value) {
  if (typeof value !== "string") return "";
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  try { return new URL(value).protocol === "https:" ? value : ""; } catch { return ""; }
}
