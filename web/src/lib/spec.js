/** 스펙 유틸 — schema.json 기본값으로 스펙 생성, 깊은 복사, 정규화, 경로 쓰기 */

import { isV2, themeFor, DEFAULT_THEME_ID } from "./themes.js";
import { sectionBase, instanceKeysIn } from "./sectionKeys.js";

export function specFromDefaults(schema) {
  const sections = {};
  for (const [name, def] of Object.entries(schema.sections)) {
    const sec = {};
    if (!def.required) sec.on = def.defaultOn !== false;
    for (const [slot, rule] of Object.entries(def.slots)) {
      sec[slot] = structuredClone(rule.default);
    }
    sections[name] = sec;
  }
  const images = {};
  for (const [key, def] of Object.entries(schema.imageSlots)) images[key] = def.default;
  return {
    meta: { docTitle: schema.meta.docTitle.default, sectionOrder: defaultSectionOrder(schema), ...(schema.designVersion === 2 ? { designVersion: 2, themeId: DEFAULT_THEME_ID } : {}) },
    sections,
    images,
  };
}

export function clone(spec) {
  return structuredClone(spec);
}

/** 템플릿(=스키마 키) 순서가 기본 순서 */
export function defaultSectionOrder(schema) {
  return Object.keys(schema.sections);
}

/**
 * 섹션 순서 정규화 — 중복·모르는 이름 제거, hero 맨 앞·footer 맨 뒤 강제,
 * 빠진 섹션은 템플릿 순서로 뒤에 붙여 항상 "전체 섹션의 완전한 순서"로 만든다.
 */
export function normalizeSectionOrder(order, schema, sections = {}) {
  const names = Object.keys(schema.sections);
  const instances = instanceKeysIn(sections, schema);
  const known = new Set([...names, ...instances]);
  const seen = new Set(["hero", "footer"]);
  const middle = [];
  for (const n of Array.isArray(order) ? order : []) {
    if (known.has(n) && !seen.has(n)) { middle.push(n); seen.add(n); }
  }
  for (const n of names) {
    if (!seen.has(n)) { middle.push(n); seen.add(n); }
  }
  // 순서에 없는 인스턴스는 같은 base의 마지막 항목 바로 뒤에 둔다
  for (const n of instances) {
    if (seen.has(n)) continue;
    let at = -1;
    middle.forEach((m, i) => { if (sectionBase(m) === sectionBase(n)) at = i; });
    middle.splice(at + 1, 0, n);
    seen.add(n);
  }
  return ["hero", ...middle, "footer"];
}

/** 편집기가 새 인스턴스(card:2)를 만들 때 쓰는 기본 섹션 */
export function sectionDefaults(def) {
  const sec = { on: true };
  for (const [slot, rule] of Object.entries(def.slots)) if (rule.default != null) sec[slot] = structuredClone(rule.default);
  return sec;
}

/**
 * 스펙 정규화 — AI 생성·과거 초안에 빠져 있을 수 있는 부분을 기본값으로 채운다.
 * (AI는 글만 쓰고 고른 모듈만 보낸다 — 경계에서 반드시 이걸 거친다)
 *
 * 섹션 on/off 규칙:
 *  - 섹션이 아예 없음      → 예시문(default)으로 채우되 무조건 on:false (AI가 안 골랐다는 뜻)
 *  - 있는데 on이 boolean 아님 → on:true (있음 = 선택됨 — on 필드가 없던 옛 초안도 자연 호환)
 *  - on이 boolean           → 그대로 존중
 */
export function normalizeSpec(spec, schema) {
  const s = structuredClone(spec);
  s.images = s.images || {};
  for (const [key, def] of Object.entries(schema.imageSlots)) {
    if (!s.images[key]) s.images[key] = def.default;
  }
  s.meta = s.meta || {};
  if (isV2(s)) {
    s.meta.themeId = themeFor(s).id;
    if (!spec.images?.heroBg) s.images.heroBg = themeFor(s).background;
    if (!spec.images?.heroDeco || /^deco-/.test(spec.images.heroDeco)) s.images.heroDeco = `deco-${themeFor(s).id}`;
  }
  if (!s.meta.docTitle) s.meta.docTitle = schema.meta.docTitle.default;
  s.sections = s.sections || {};
  const fill = (name, def) => {
    const missing = !s.sections[name];
    if (missing) s.sections[name] = {};
    const sec = s.sections[name];
    for (const [slot, rule] of Object.entries(def.slots)) {
      if (sec[slot] == null && rule.default != null) {
        // A generated document never gets old campaign facts from template defaults.
        if (isV2(s) && !missing && ["text","multiline"].includes(rule.type)) sec[slot] = "";
        else sec[slot] = structuredClone(rule.default);
      }
    }
    if (!def.required) {
      if (missing) sec.on = false;
      else if (typeof sec.on !== "boolean") sec.on = true;
    }
  };
  for (const [name, def] of Object.entries(schema.sections)) fill(name, def);
  for (const key of instanceKeysIn(s.sections, schema)) fill(key, schema.sections[sectionBase(key)]);
  s.meta.sectionOrder = normalizeSectionOrder(s.meta.sectionOrder, schema, s.sections);
  return s;
}

/** "values.cards.1.sub" 경로에 값 쓰기 (편집기 blur 시 사용) */
export function setAtPath(spec, path, value) {
  const segs = path.split(".");
  let cur = segs[0] === "meta" || segs[0] === "images" ? spec : spec.sections;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    cur = cur[/^\d+$/.test(seg) ? Number(seg) : seg];
    if (cur == null) return false;
  }
  const last = segs[segs.length - 1];
  cur[/^\d+$/.test(last) ? Number(last) : last] = value;
  return true;
}
