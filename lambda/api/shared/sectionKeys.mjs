/**
 * Section instance keys. A module flagged `multi: true` in the schema (card) may appear several times in one
 * document as `card`, `card:2`, `card:3`. All instances share `schema.sections[base]` and the template row
 * `[data-section="base"]`; the assembler clones the row per instance and rewrites path prefixes.
 * Path strings keep the full key (`card:2.items.0.title`); schema lookups use `sectionBase(key)`.
 */
export const INSTANCE_RE = /^([a-zA-Z]+):(\d+)$/;
export const MAX_INSTANCES = 3;
export const sectionBase = key => String(key).split(":")[0];
export const isInstanceKey = key => INSTANCE_RE.test(String(key));
/** card → ["card", "card:2", "card:3"] */
export const instanceKeys = base => Array.from({ length: MAX_INSTANCES }, (_, i) => (i ? `${base}:${i + 1}` : base));
export const instanceLabel = (label, key) => (isInstanceKey(key) ? `${label} ${String(key).split(":")[1]}` : label);
/** Instance keys present in a spec whose base module is multi, in numeric order (saved keys beyond MAX are kept). */
export const instanceKeysIn = (sections, schema) => Object.keys(sections || {})
  .filter(k => isInstanceKey(k) && schema.sections[sectionBase(k)]?.multi)
  .sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]));
/** Editor "add card": the first key that is missing or switched off, or null when all instances are in use. */
export const nextInstanceKey = (sections, base) => instanceKeys(base).find(k => !sections[k] || sections[k].on === false) || null;
