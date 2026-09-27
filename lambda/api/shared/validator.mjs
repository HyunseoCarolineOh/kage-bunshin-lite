import { blockErrors, eventErrors } from "./briefing.mjs";
import { sectionBase, instanceKeysIn } from "./sectionKeys.mjs";
/**
 * 검증기 — 스펙 JSON이 schema.json의 슬롯 규칙(글자수·줄수·필수값)을 지키는지 검사.
 * video-maker pov_idea.py의 "필드별 한도 + validate() 오류 목록" 패턴 이식.
 *
 * 반환: [{ path, msg, kind }] — kind: 'error'(생성 직후 수선 대상) | 'warn'(편집 중 경고)
 * 글자 폭 가중치: 한글/CJK/전각 = 1, 그 외(영문·숫자·공백) = 0.55 — perLine 한도와 비교.
 */

import { graphicErrors } from "./graphics.mjs";
import { safeLink, safeImage, THEMES } from "./themes.mjs";

const WIDE_RE = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-｠]/;

export function weightedLen(line) {
  let w = 0;
  for (const ch of line) w += WIDE_RE.test(ch) ? 1 : ch === " " ? 0.35 : 0.55;
  return w;
}

function checkText(errors, path, value, rule, strictLines) {
  const { maxChars, maxLines = 1, perLine } = rule;
  if (value == null || String(value).trim() === "") {
    if (rule.required !== false) errors.push({ path, msg: "비어 있음", kind: "error" });
    return;
  }
  const text = String(value);
  if (maxChars && text.replace(/\n/g, "").length > maxChars)
    errors.push({ path, msg: `${text.replace(/\n/g, "").length}자 — 최대 ${maxChars}자`, kind: "error" });
  const lines = text.split("\n");
  if (lines.length > maxLines)
    errors.push({ path, msg: `${lines.length}줄 — 최대 ${maxLines}줄`, kind: "error" });
  if (perLine) {
    for (let i = 0; i < lines.length; i++) {
      const w = weightedLen(lines[i]);
      if (w > perLine + 0.001)
        errors.push({ path, msg: `${i + 1}번째 줄이 김 (${w.toFixed(1)}/${perLine} 폭) — 넘치면 자동 줄바꿈으로 리듬이 깨짐`, kind: strictLines ? "error" : "warn" });
    }
  }
}

function checkList(errors, path, arr, rule, strictLines) {
  if (!Array.isArray(arr) || arr.length < (rule.minItems ?? 1)) {
    errors.push({ path, msg: `최소 ${rule.minItems ?? 1}개 필요`, kind: "error" });
    return;
  }
  if (arr.length > rule.maxItems)
    errors.push({ path, msg: `${arr.length}개 — 최대 ${rule.maxItems}개`, kind: "error" });
  arr.forEach((item, i) =>
    checkText(errors, `${path}.${i}`, item, {
      maxChars: rule.itemMaxChars, maxLines: rule.itemMaxLines ?? 1, perLine: rule.itemPerLine,
    }, strictLines));
}

/** opts.strictLines: 줄 폭 초과를 error로 승격 — AI 생성 직후 수선(repair) 판정용 */
export function validateSpec(spec, schema, opts = {}) {
  const { strictLines = false } = opts;
  const errors = [];
  if (spec.meta?.designVersion != null && ![1,2].includes(spec.meta.designVersion))
    errors.push({path:"meta.designVersion",msg:"지원하지 않는 디자인 버전",kind:"error"});
  if (spec.meta?.designVersion === 2 && !THEMES[spec.meta.themeId])
    errors.push({path:"meta.themeId",msg:"지원하지 않는 테마",kind:"error"});

  checkText(errors, "meta.docTitle", spec.meta?.docTitle, { maxChars: schema.meta.docTitle.maxChars }, strictLines);

  // 스키마 이름 + 인스턴스 키(card:2 …)를 모두 검사한다. 정의는 base 이름으로 찾고 경로는 전체 키를 쓴다.
  const sectionNames = [...Object.keys(schema.sections), ...instanceKeysIn(spec.sections || {}, schema)];
  for (const secName of sectionNames) {
    const base = sectionBase(secName);
    const secDef = schema.sections[base];
    const sec = spec.sections?.[secName];
    if (!secDef.required && (!sec || sec.on === false)) continue;
    if (!sec) { errors.push({ path: secName, msg: "필수 섹션 누락", kind: "error" }); continue; }

    for (const [slotName, rule] of Object.entries(secDef.slots)) {
      const path = `${secName}.${slotName}`;
      const value = sec[slotName];
      if (base === "footer" && sec.layout === "cta" && slotName === "bullets") continue;
      if (base === "agenda" && sec.layout === "grouped" && slotName === "items") continue;
      if (base === "agenda" && sec.layout !== "grouped" && slotName === "blocks") continue;
      if (base === "infobar" && sec.layout === "details" && slotName === "cells") continue;
      if (base === "infobar" && sec.layout !== "details" && slotName === "event") continue;
      if (rule.type === "agendaBlocks" || rule.type === "eventDetails") {
        const messages = rule.type === "agendaBlocks" ? blockErrors(value) : eventErrors(value);
        messages.forEach(msg => errors.push({path,msg,kind:"error"}));
        continue;
      }
      if (rule.type === "choice" && value == null && rule.required !== true) continue;
      if (rule.type === "toggle") {
        if (value != null && value !== "on" && value !== "off") errors.push({ path, msg: "on/off 중 하나", kind: "error" });
        continue;
      }
      if (slotName === "notes" && value == null) continue;

      if (rule.format && value) {
        const valid = rule.format === "image" ? safeImage(value) : safeLink(value);
        if (!valid) errors.push({path,msg:"지원하지 않는 이미지/링크 주소",kind:"error"});
      }
      if (rule.type === "text" || rule.type === "multiline") {
        if (!rule.required && (value == null || value === "")) continue;
        checkText(errors, path, value, rule, strictLines);
      } else if (rule.type === "list") {
        checkList(errors, path, value, rule, strictLines);
      } else if (rule.type === "cards") {
        if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) {
          errors.push({ path, msg: `카드 ${rule.minItems}~${rule.maxItems}개 필요`, kind: "error" });
          continue;
        }
        value.forEach((card, i) => {
          checkText(errors, `${path}.${i}.title`, card.title, { ...rule.fields.title }, strictLines);
          checkText(errors, `${path}.${i}.sub`, card.sub, { ...rule.fields.sub, maxLines: rule.fields.sub.maxLines }, strictLines);
        });
      } else if (rule.type === "pills") {
        if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) {
          errors.push({ path, msg: `필 ${rule.minItems}~${rule.maxItems}개 필요`, kind: "error" });
          continue;
        }
        value.forEach((pill, i) => {
          checkText(errors, `${path}.${i}.main`, pill.main, { maxChars: rule.fields.main.maxChars }, strictLines);
          if (pill.sub) checkText(errors, `${path}.${i}.sub`, pill.sub, { maxChars: rule.fields.sub.maxChars }, strictLines);
        });
      } else if (rule.type === "choice") {
        if (!rule.enum.includes(value))
          errors.push({ path, msg: `${rule.enum.join("/")} 중 하나`, kind: "error" });
      } else if (rule.type === "items") {
        if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) {
          errors.push({ path, msg: `항목 ${rule.minItems}~${rule.maxItems}개 필요`, kind: "error" });
          continue;
        }
        value.forEach((item, i) => {
          for (const [fname, f] of Object.entries(rule.fields)) {
            const fv = item?.[fname];
            if ((base === "stats" || base === "card") && fname === "num" && item.graphic && item.graphic.kind !== "tiles" && !graphicErrors(item.graphic).length) continue;
            const fpath = `${path}.${i}.${fname}`;
            if (f.type === "graphic") {
              for (const msg of graphicErrors(fv)) errors.push({path:fpath,msg,kind:"error"});
            } else if (f.format) {
              if (fv && !(f.format === "image" ? safeImage(fv) : safeLink(fv)))
                errors.push({path:fpath,msg:"지원하지 않는 이미지/링크 주소",kind:"error"});
            } else if (f.enum) {
              if (!(f.optional && (fv == null || fv === "")) && !f.enum.includes(fv))
                errors.push({ path: fpath, msg: `${f.enum.join("/")} 중 하나`, kind: "error" });
            } else if (f.type === "list") {
              if (f.optional && (fv == null || (Array.isArray(fv) && fv.length === 0))) continue;
              checkList(errors, fpath, fv, f, strictLines);
            } else if (f.optional && (fv == null || fv === "")) {
              // 선택 필드는 생략 허용
            } else {
              checkText(errors, fpath, fv, { maxChars: f.maxChars, maxLines: f.maxLines ?? 1, perLine: f.perLine }, strictLines);
            }
          }
        });
      } else if (rule.type === "groups") {
        if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) {
          errors.push({ path, msg: `그룹 ${rule.minItems}~${rule.maxItems}개 필요`, kind: "error" });
          continue;
        }
        value.forEach((g, i) => {
          const gp = `${path}.${i}`;
          if (!rule.fields.brand.enum.includes(g.brand))
            errors.push({ path: `${gp}.brand`, msg: `brand는 ${rule.fields.brand.enum.join("/")} 중 하나`, kind: "error" });
          checkText(errors, `${gp}.name`, g.name, { maxChars: rule.fields.name.maxChars, perLine: rule.fields.name.perLine }, strictLines);
          checkList(errors, `${gp}.headers`, g.headers, {
            minItems: rule.fields.headers.minItems, maxItems: rule.fields.headers.maxItems,
            itemMaxChars: rule.fields.headers.itemMaxChars,
          }, strictLines);
          if (!Array.isArray(g.rows) || g.rows.length < rule.fields.rows.minItems || g.rows.length > rule.fields.rows.maxItems) {
            errors.push({ path: `${gp}.rows`, msg: `행 ${rule.fields.rows.minItems}~${rule.fields.rows.maxItems}개 필요`, kind: "error" });
          } else {
            g.rows.forEach((row, ri) => {
              if (!Array.isArray(row) || row.length !== (g.headers?.length ?? 0))
                errors.push({ path: `${gp}.rows.${ri}`, msg: "셀 개수가 머리글 개수와 다름", kind: "error" });
              else row.forEach((cell, ci) =>
                checkText(errors, `${gp}.rows.${ri}.${ci}`, cell, { maxChars: rule.fields.cellMaxChars }, strictLines));
            });
          }
          const hl = g.highlightCol;
          if (hl != null && hl !== -1 && !(Number.isInteger(hl) && hl >= 0 && hl < (g.headers?.length ?? 0)))
            errors.push({ path: `${gp}.highlightCol`, msg: "강조 열 번호가 머리글 범위를 벗어남", kind: "error" });
        });
      }
    }
  }

  if (spec.sections?.steps?.layout === "process" && spec.sections.steps.items?.length !== 3)
    errors.push({path:"steps.items",msg:"프로세스 형태에는 정확히 3단계가 필요합니다.",kind:"error"});
  const email = spec.sections?.footer?.contactEmail;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push({ path: "footer.contactEmail", msg: "이메일 형식이 아님", kind: "error" });

  return errors;
}

/** 수선(repair) 호출용 — error만 추려 "이 칸들만 고쳐라" 목록으로 */
export function repairTargets(errors) {
  return errors.filter((e) => e.kind === "error").map(({ path, msg }) => ({ path, msg }));
}
