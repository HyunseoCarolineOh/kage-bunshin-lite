/** 경로("values.cards.1.sub") → 해당 슬롯의 글자수 규칙 찾기 (편집기 카운터·멀티라인 판정용) */
import { sectionBase } from "./sectionKeys.js";

export function ruleForPath(schema, path) {
  const segs = path.split(".");
  if (segs[0] === "meta") return { maxChars: schema.meta[segs[1]]?.maxChars, maxLines: 1 };

  const secDef = schema.sections[sectionBase(segs[0])];
  if (!secDef) return null;
  const rule = secDef.slots[segs[1]];
  if (!rule) return null;

  if (rule.type === "text" || rule.type === "multiline")
    return { maxChars: rule.maxChars, maxLines: rule.maxLines ?? 1, perLine: rule.perLine };

  if (rule.type === "list")
    return { maxChars: rule.itemMaxChars, maxLines: rule.itemMaxLines ?? 1, perLine: rule.itemPerLine };

  if (rule.type === "cards" || rule.type === "pills") {
    const field = rule.fields[segs[3]];
    return field ? { maxChars: field.maxChars, maxLines: field.maxLines ?? 1, perLine: field.perLine } : null;
  }

  if (rule.type === "items") {
    const field = rule.fields[segs[3]];
    if (!field) return null;
    if (field.type === "list")
      return { maxChars: field.itemMaxChars, maxLines: 1, perLine: field.itemPerLine };
    return { maxChars: field.maxChars, maxLines: field.maxLines ?? 1, perLine: field.perLine };
  }

  if (rule.type === "groups") {
    const sub = segs[3]; // groups.<i>.<sub>...
    if (sub === "name") return { maxChars: rule.fields.name.maxChars, maxLines: 1 };
    if (sub === "headers") return { maxChars: rule.fields.headers.itemMaxChars, maxLines: 1 };
    if (sub === "rows") return { maxChars: rule.fields.cellMaxChars, maxLines: 1 };
  }
  return null;
}
