import { safeLink } from "./themes.mjs";
import { instanceKeys } from "./sectionKeys.mjs";

const str = (maxLength = 2000) => ({ type: "string", maxLength });
const obj = properties => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items, maxItems = 120) => ({ type: "array", items, maxItems });
export const EVENT_FIELDS = {
  title: "행사 제목", subtitle: "행사 소개", date: "날짜", time: "행사 시간",
  location: "장소", audience: "참가 대상", format: "진행 형식", organizer: "주최",
  registrationUrl: "등록 링크", contact: "연락처",
};
export const EVENT_SCHEMA = obj(Object.fromEntries(Object.keys(EVENT_FIELDS).map(k => [k, str()])));
const itemSchema = obj({ time: str(80), title: str(500), speaker: str(200) });
const trackSchema = obj({ title: str(200), time: str(80), items: arr(itemSchema) });
export const BLOCKS_SCHEMA = arr({
  oneOf: [
    obj({ kind: { type: "string", enum: ["sequential"] }, title: str(200), time: str(80), items: arr(itemSchema) }),
    obj({ kind: { type: "string", enum: ["parallel"] }, title: str(200), time: str(80), tracks: arr(trackSchema, 12) }),
  ],
}, 40);
export const PROGRAM_FIELDS = {
  title: "프로그램 이름", oneLiner: "한 줄 소개", body: "본문", date: "날짜", time: "시간",
  location: "장소", audience: "대상", format: "구성", cta: "버튼 문구", url: "신청 링크",
};
const PROGRAM_LIMITS = { title: 100, oneLiner: 200, body: 2000, date: 100, time: 100, location: 100, audience: 300, format: 300, cta: 40, url: 1200 };
export const PROGRAM_SCHEMA = obj(Object.fromEntries(Object.keys(PROGRAM_FIELDS).map(k => [k, str(PROGRAM_LIMITS[k])])));
export const CONTENT_KINDS = ["benefit", "case", "claim", "internal", "section", "quote", "cta"];
export const SECTION_PLACES = ["", "article", "caseIntro", "programIntro", "opening"];
/** Kinds whose body is printed verbatim: the body itself must appear in the source. */
const VERBATIM_KINDS = new Set(["section", "quote", "cta"]);
const PROGRAM_TEXT_KEYS = ["oneLiner", "body", "date", "time", "location", "audience", "format", "cta"];
export const ANALYSIS_SCHEMA = obj({
  event: EVENT_SCHEMA,
  blocks: BLOCKS_SCHEMA,
  content: arr(obj({
    kind: { type: "string", enum: CONTENT_KINDS },
    title: str(100), body: str(), source: str(4000),
    figure: str(12), link: str(1200), place: { type: "string", enum: SECTION_PLACES, maxLength: 20 },
  }), 40),
  programs: arr(PROGRAM_SCHEMA, 4),
  issues: arr(obj({ field: str(200), message: str(500), source: str(2000) }), 20),
});
const httpLink = value => /^https?:\/\//i.test(safeLink(value));
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const blankProgram = () => Object.fromEntries(Object.keys(PROGRAM_FIELDS).map(k => [k, ""]));
/** Reviews saved before newsletter support lack figure/link/place/programs; defaults keep them valid and renderable. */
export function normalizeReview(input) {
  if (!input || typeof input !== "object") return input;
  const next = structuredClone(input);
  if (Array.isArray(next.content)) next.content = next.content.map(c => c && typeof c === "object" ? { figure: "", link: "", place: "", ...c } : c);
  next.programs = Array.isArray(next.programs) ? next.programs.map(p => p && typeof p === "object"
    ? { ...blankProgram(), ...p, ...(typeof p.included === "boolean" || next.version === undefined ? {} : { included: true }) } : p) : [];
  return next;
}

/** Normalize copy artifacts, without deleting meaningful table cells or links. */
export function cleanBrief(raw) {
  return String(raw).replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/[\u200b\ufeff]/g, "")
    .split("\n").filter(line => !/^\s*\|(?:\s*[:\-]*\s*\|)+\s*$/.test(line))
    .map(line => line.replace(/(^|\s):[a-z][a-z0-9_+-]*:(?=\s|$)/g, "$1").replace(/[ \t]+/g, " ").replace(/\\\s*$/, "").trim())
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function sourceText(text) {
  return cleanBrief(text).replace(/[*_`\\“”"‘’']/g, "").replace(/[–—~～]/g, "-")
    .replace(/\s+/g, "").replace(/[,:]/g, "").toLowerCase();
}
export const scheduleItems = blocks => (blocks || []).flatMap(b =>
  b.kind === "parallel" ? (b.tracks || []).flatMap(t => t.items || []) : b.items || []);
export const blankItem = () => ({ time: "", title: "", speaker: "" });
export const blankBlock = (kind = "sequential") => kind === "parallel"
  ? { kind, title: "병렬 세션", time: "", tracks: [
      { title: "Track A", time: "", items: [blankItem()] },
      { title: "Track B", time: "", items: [blankItem()] },
    ] }
  : { kind, title: "새 구간", time: "", items: [blankItem()] };

/** A bounded, shared validator: client edits and generated data use the same contract. */
function schemaErrors(value, schema, path) {
  if (schema.oneOf) {
    const match = schema.oneOf.find(s => s.properties.kind.enum.includes(value?.kind));
    return match ? schemaErrors(value, match, path) : [`${path}: 구간 종류가 올바르지 않습니다.`];
  }
  if (schema.type === "string") {
    return typeof value !== "string" || value.length > schema.maxLength || (schema.enum && !schema.enum.includes(value))
      ? [`${path}: 텍스트 값이나 길이를 확인하세요.`] : [];
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length > schema.maxItems) return [`${path}: 항목 개수를 확인하세요.`];
    return value.flatMap((v, i) => schemaErrors(v, schema.items, `${path}.${i}`));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return [`${path}: 형식이 올바르지 않습니다.`];
  return Object.entries(schema.properties).flatMap(([k, s]) => schemaErrors(value[k], s, `${path}.${k}`));
}
export function blockErrors(blocks) {
  const errors = schemaErrors(blocks, BLOCKS_SCHEMA, "agenda.blocks");
  if (errors.length) return errors;
  if (scheduleItems(blocks).length > 120) errors.push("일정은 총 120개 이내로 작성하세요.");
  for (const [i, b] of blocks.entries()) {
    if (!b.title.trim()) errors.push(`agenda.blocks.${i}.title: 구간 제목을 입력하세요.`);
    const groups = b.kind === "parallel" ? b.tracks : [b];
    if (b.kind === "parallel" && groups.length < 2) errors.push(`agenda.blocks.${i}: 병렬 트랙은 2개 이상 필요합니다.`);
    for (const g of groups) {
      if (!g.title.trim() || !g.items.length) errors.push(`agenda.blocks.${i}: 제목과 일정이 필요합니다.`);
      for (const item of g.items) {
        if (!item.title.trim()) errors.push(`agenda.blocks.${i}: 세션 제목을 입력하세요.`);
        const range = item.time.match(/^(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})$/);
        if (range) {
          const [, h, m, eh, em] = range.map(Number);
          if (h > 23 || eh > 23 || m > 59 || em > 59 || h * 60 + m >= eh * 60 + em)
            errors.push(`agenda.blocks.${i}: 시작·종료 시간을 확인하세요.`);
        }
      }
    }
  }
  return errors;
}
export function eventErrors(event) {
  const errors = schemaErrors(event, EVENT_SCHEMA, "event");
  if (!errors.length && event.registrationUrl && !/^https?:\/\//i.test(safeLink(event.registrationUrl)))
    errors.push("등록 링크는 http 또는 https 주소를 입력하세요.");
  return errors;
}
export function reviewErrors(input) {
  if (!input || input.version !== 1 || !["customer", "internal"].includes(input.audience))
    return ["발송 대상과 확인 내용을 확인하세요."];
  const review = normalizeReview(input);
  const errors = schemaErrors(review, ANALYSIS_SCHEMA, "inputReview");
  if (errors.length) return errors;
  if (review.content.some(c => typeof c.included !== "boolean")) errors.push("포함 여부를 확인하세요.");
  if (review.content.filter(c => c.kind === "case" && c.included).length > 6) errors.push("고객 사례는 최대 6개 선택하세요.");
  if (review.content.some(c => c.link && !httpLink(c.link))) errors.push("링크는 http 또는 https 주소를 입력하세요.");
  if (review.programs.some(p => typeof p.included !== "boolean")) errors.push("프로그램 포함 여부를 확인하세요.");
  if (review.programs.some(p => p.included && !p.title.trim())) errors.push("프로그램 이름을 입력하세요.");
  if (review.programs.some(p => p.url && !httpLink(p.url))) errors.push("신청 링크는 http 또는 https 주소를 입력하세요.");
  return [...errors, ...eventErrors(review.event), ...blockErrors(review.blocks)];
}
/** Unambiguous internal sales language must not depend on a model's category label. */
export function isInternalContent(entry) {
  // "파이프라인" alone is production vocabulary (VFX·데이터 파이프라인); only sales-pipeline phrasing is internal.
  return /파이프라인(가속|창출|목표|구축목표)|영업파이프라인|세일즈파이프라인|모객|어카운트팀|참석자확정|고객추천|추천고객|slackdm|bcc:|운영노트|본문미노출|프레임매핑|와이어프레임|발송회차|회차별|제작전확정|검증리스트|서베이문항|단일선택|복수선택|contactfiltering/i.test(`${entry.title} ${entry.body}`.replace(/\s+/g,""));
}
export function makeReview(input) {
  const analysis = normalizeReview(input);
  return {
    version: 1, audience: "customer", event: analysis.event, blocks: analysis.blocks, issues: analysis.issues,
    content: analysis.content.map(c => ({ ...c, kind: isInternalContent(c) ? "internal" : c.kind, included: true })),
    programs: analysis.programs.map(p => ({ ...p, included: true })),
  };
}

/** Ground extraction in source; never silently accept shortened session titles. */
export function extractionErrors(input, raw) {
  const analysis = normalizeReview(input);
  const errors = schemaErrors(analysis, ANALYSIS_SCHEMA, "analysis");
  if (errors.length) return errors;
  const source = sourceText(raw);
  const inSource = value => { const t = sourceText(value ?? ""); return t.length > 0 && source.includes(t); };
  for (const item of scheduleItems(analysis.blocks)) {
    if (!source.includes(sourceText(item.title))) errors.push(`원문에 없는 일정 제목: ${item.title}`);
    if (item.time && !source.includes(sourceText(item.time))) errors.push(`원문과 다른 일정 시간: ${item.time}`);
  }
  for (const c of analysis.content) {
    if (!c.source || !source.includes(sourceText(c.source))) errors.push(`원문 구절을 확인할 수 없음: ${c.title}`);
    if (VERBATIM_KINDS.has(c.kind) && !inSource(c.body)) errors.push(`원문과 다른 본문: ${c.title}`);
    if (c.figure && !inSource(c.figure)) errors.push(`원문에 없는 수치: ${c.figure}`);
    if (c.link && !(raw.includes(c.link) && httpLink(c.link))) errors.push(`원문과 다른 링크: ${c.title}`);
  }
  for (const p of analysis.programs) {
    if (!p.title.trim()) errors.push("프로그램 이름이 비어 있습니다.");
    for (const key of ["title", ...PROGRAM_TEXT_KEYS]) if (p[key] && !inSource(p[key])) errors.push(`원문과 다른 프로그램 정보: ${p.title || "(이름 없음)"} · ${PROGRAM_FIELDS[key]}`);
    if (p.url && !(raw.includes(p.url) && httpLink(p.url))) errors.push(`원문과 다른 프로그램 링크: ${p.title}`);
  }
  if (analysis.event.registrationUrl && !raw.includes(analysis.event.registrationUrl))
    errors.push("원문과 등록 링크가 다릅니다.");
  const lines = cleanBrief(raw).split("\n").map(s => s.replace(/\*\*/g, "").trim()).filter(Boolean);
  const expected = [];
  let track = "";
  for (let i=0; i<lines.length; i++) {
    const heading=lines[i].match(/\bTrack\s+([A-Z0-9]+)\b/i);
    if(heading && !/^\d{1,2}:\d{2}/.test(lines[i])) {track=heading[0];continue;}
    if(/^(?:Closing|폐회|오전\s*세션)\b/i.test(lines[i]))track="";
    let time="",title="";
    const columns=lines[i].startsWith("|") ? lines[i].split("|").map(s=>s.trim()).filter(Boolean) : null;
    const range=/^(\d{1,2}:\d{2}\s*[-–—~]\s*\d{1,2}:\d{2})(?:\s+(.+))?$/;
    const match=(columns?.[0] || lines[i]).match(range);
    if(!match)continue;
    time=match[1];title=columns?.[1] || match[2] || lines[i+1] || "";
    title=title.replace(/^[\p{Extended_Pictographic}\uFE0F]+\s*/u,"");
    if(title)expected.push({time,title,track});
  }
  for(const item of expected) {
    const matches=it=>sourceText(it.time)===sourceText(item.time) && sourceText(it.title)===sourceText(item.title);
    const candidates=item.track
      ? analysis.blocks.filter(b=>b.kind==="parallel").flatMap(b=>b.tracks.filter(t=>sourceText(t.title).includes(sourceText(item.track))).flatMap(t=>t.items))
      : scheduleItems(analysis.blocks);
    if(!candidates.some(matches))errors.push(`누락되거나 바뀐 일정/트랙: ${item.track} ${item.time} ${item.title}`);
  }
  for(const key of ["date","time","location","audience","contact"]) {
    if(analysis.event[key] && !source.includes(sourceText(analysis.event[key])))
      errors.push(`원문과 다른 행사 정보: ${key}`);
  }
  return [...errors, ...eventErrors(analysis.event), ...blockErrors(analysis.blocks)];
}
/** Keep the review reachable: drop time-less sessions and event fields the source cannot confirm, and say so in issues. */
export function reconcileExtraction(analysis, raw) {
  const source = sourceText(raw);
  const inSource = value => { const t = sourceText(value ?? ""); return t.length > 0 && source.includes(t); };
  const next = normalizeReview(analysis);
  const dropped = [], blanked = [], adjusted = [];
  const keep = item => {
    if (!item || typeof item !== "object") return true;
    if (/\d{1,2}:\d{2}/.test(String(item.time ?? "")) || inSource(item.title)) return true;
    dropped.push(String(item.title ?? "")); return false;
  };
  if (Array.isArray(next.blocks)) {
    const blocks = [];
    for (const block of next.blocks) {
      if (!block || typeof block !== "object") { blocks.push(block); continue; }
      if (block.kind === "parallel" && Array.isArray(block.tracks)) {
        const tracks = block.tracks.map(t => t && Array.isArray(t.items) ? { ...t, items: t.items.filter(keep) } : t).filter(t => !t || !Array.isArray(t.items) || t.items.length);
        if (tracks.length >= 2) blocks.push({ ...block, tracks });
        else if (tracks.length === 1) blocks.push({ kind: "sequential", title: block.title, time: block.time, items: tracks[0].items });
      } else if (Array.isArray(block.items)) {
        const items = block.items.filter(keep);
        if (items.length) blocks.push({ ...block, items });
      } else blocks.push(block);
    }
    next.blocks = blocks;
  }
  if (next.event && typeof next.event === "object") {
    for (const key of ["date", "time", "location", "audience", "contact"]) {
      if (next.event[key] && !inSource(next.event[key])) { next.event[key] = ""; blanked.push(key); }
    }
  }
  // Verbatim kinds fall back to the indexed source line; unverifiable figures, links and program fields are blanked, never guessed.
  if (Array.isArray(next.content)) next.content = next.content.map((c, i) => {
    if (!c || typeof c !== "object") return c;
    const fixed = { ...c };
    if (VERBATIM_KINDS.has(c.kind) && !inSource(c.body) && inSource(c.source)) { fixed.body = c.source; adjusted.push({ field: `content.${i}.body`, message: `"${c.title}" 본문 표현이 원문과 달라 원문 구절로 대체했어요.` }); }
    if (c.figure && !inSource(c.figure)) { fixed.figure = ""; adjusted.push({ field: `content.${i}.figure`, message: `"${c.title}" 수치 토큰을 원문에서 확인할 수 없어 비웠어요.` }); }
    if (c.link && !(String(raw).includes(c.link) && httpLink(c.link))) { fixed.link = ""; adjusted.push({ field: `content.${i}.link`, message: `"${c.title}" 링크가 원문과 달라 비웠어요.` }); }
    return fixed;
  });
  if (Array.isArray(next.programs)) {
    const kept = [];
    const eventTitle = sourceText(next.event?.title || "");
    for (const p of next.programs) {
      if (!p || typeof p !== "object") continue;
      if (eventTitle && sourceText(p.title) === eventTitle) { adjusted.push({ field: "programs", message: `행사 자체(${p.title})는 프로그램 카드가 아니라 행사 정보로만 다뤄 제외했어요.` }); continue; }
      if (!inSource(p.title)) { adjusted.push({ field: "programs", message: `원문에서 확인할 수 없어 제외한 프로그램: ${p.title || "(이름 없음)"}` }); continue; }
      const fixed = { ...p };
      for (const key of PROGRAM_TEXT_KEYS) if (p[key] && !inSource(p[key])) { fixed[key] = ""; adjusted.push({ field: `programs.${kept.length}.${key}`, message: `${p.title}: ${PROGRAM_FIELDS[key]} 표현이 원문과 달라 비워 두었어요. 필요하면 직접 입력하세요.` }); }
      if (p.url && !(String(raw).includes(p.url) && httpLink(p.url))) { fixed.url = ""; adjusted.push({ field: `programs.${kept.length}.url`, message: `${p.title}: 신청 링크가 원문과 달라 비웠어요.` }); }
      kept.push(fixed);
    }
    next.programs = kept;
  }
  const added = adjusted.map(a => ({ ...a, source: "" }));
  if (dropped.length) added.push({ field: "blocks", message: `원문에서 시간을 확인할 수 없어 제외한 일정 ${dropped.length}개: ${dropped.join(" · ")}`.slice(0, 500), source: "" });
  for (const key of blanked) added.push({ field: `event.${key}`, message: `${EVENT_FIELDS[key]} 표현이 원문과 달라 비워 두었어요. 필요하면 직접 입력하세요.`, source: "" });
  if (added.length) next.issues = [...added, ...(Array.isArray(next.issues) ? next.issues : [])].slice(0, 20);
  return { analysis: next, dropped, blanked, adjusted, changed: dropped.length + blanked.length + adjusted.length > 0 };
}
export function reviewNotices(input, now = new Date()) {
  const review = normalizeReview(input);
  const notices = [...(review.issues || [])];
  const year = Number(review.event.date.match(/20\d{2}/)?.[0] || now.getFullYear());
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  for (const c of review.content.filter(c => c.kind === "internal" && c.included)) {
    const week = c.body.match(/(\d{1,2})월\s*(\d)주차/);
    const day = c.body.match(/(\d{1,2})월\s*(\d{1,2})일/);
    const lastDay = week ? Number(week[2]) * 7 : day ? Number(day[2]) : null;
    const month = week?.[1] || day?.[1];
    if (lastDay && `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}` < today)
      notices.push({ field: "internal", message: `지난 내부 기한입니다. 발송 전에 수정하세요: ${c.body}`, source: c.source });
  }
  if (review.content.some(c => c.kind === "claim" && c.included))
    notices.push({ field: "claim", message: "수치는 제공 원문에서 추출했습니다. 외부 사실 검증 결과가 아닙니다.", source: "" });
  return notices;
}
export function visibleContent(input) {
  const review = normalizeReview(input);
  return review.content.map(c => ({...c, kind: isInternalContent(c) ? "internal" : c.kind})).filter(c => c.included && (review.audience === "internal" || c.kind !== "internal"));
}
export const includedPrograms = input => normalizeReview(input).programs.filter(p => p.included);
/** newsletter = article paragraphs or program cards; invitation = one event. */
export function reviewFormat(input) {
  return visibleContent(input).some(c => c.kind === "section") || includedPrograms(input).length ? "newsletter" : "invitation";
}
/** Theme inference text: a newsletter body names many products, so only the masthead decides. */
export function themeText(input) {
  const review = normalizeReview(input);
  return reviewFormat(review) === "newsletter" ? `${review.event.title} ${review.event.subtitle}` : reviewedBrief(review);
}
export function reviewedBrief(input) {
  // Internal requests and claims go verbatim into notes or stats, not through copy compression.
  const review = normalizeReview(input);
  const visible = visibleContent(review);
  return JSON.stringify({
    format: reviewFormat(review),
    audience: review.audience,
    event: review.event,
    content: visible.filter(c => ["benefit", "case", "section", "quote", "cta"].includes(c.kind)).map(c =>
      c.kind === "section" ? { kind: c.kind, place: c.place || "article", title: c.title, body: c.body.slice(0, 300) }
      : c.kind === "quote" ? { kind: c.kind, title: c.title }
      : { kind: c.kind, title: c.title, body: c.body }),
    programs: includedPrograms(review).map(({ title, oneLiner, date, audience }) => ({ title, oneLiner, date, audience })),
    schedule: review.blocks.map(b => ({ title: b.title, kind: b.kind })),
  });
}
/** Paths the server fills from confirmed data; copy repair must leave them alone. */
export function isReviewOwned(path, input) {
  if (/^(agenda|infobar|card(?::\d+)?|customerStories|article|programs|stats|quotes)\.|^hero\.(sourceTitle|letter)$|^footer\.(notes|contactLines|contactEmail|href)/.test(path)) return true;
  return /^footer\.(headline|leftNote)/.test(path) && visibleContent(input).some(c => c.kind === "cta");
}
export function canUseAgendaList(agenda) {
  if (agenda.layout !== "grouped") return true;
  const blocks = agenda.blocks || [];
  return blocks.length === 1 && blocks[0].kind === "sequential" && blocks[0].items.length >= 2 &&
    blocks[0].items.length <= 8 && blocks[0].items.every(i => `${i.time} ${i.title}`.trim().length <= 40);
}
export function changeAgendaLayout(agenda, layout) {
  if (layout === agenda.layout) return;
  if (layout === "grouped") {
    agenda.blocks = [{ kind: "sequential", title: agenda.title || "세션 일정", time: "",
      items: (agenda.items || []).map(i => ({ time: i.time || "", title: i.title, speaker: i.speaker || "", ...(i.desc ? { desc: i.desc } : {}) })) }];
  } else {
    if (!canUseAgendaList(agenda)) return;
    agenda.items = agenda.blocks[0].items.map(i => ({ title: i.title, ...(i.time ? {time:i.time} : {}), speaker: i.speaker || "", desc: i.desc || "" }));
  }
  agenda.layout = layout;
}

/** The reviewed facts win after generation AND after any copy repair. Verbatim modules are assembled here, never by the copy model. */
export function applyReview(spec, input) {
  const review = normalizeReview(input);
  const next = structuredClone(spec);
  const sections = next.sections;
  const selected = visibleContent(review);
  const byKind = kind => selected.filter(c => c.kind === kind);
  const placed = place => byKind("section").filter(c => (c.place || "") === place);
  const contains = (a, b) => { const x = sourceText(a), y = sourceText(b); return y.length > 0 && x.includes(y); };
  const cases = byKind("case"), claims = byKind("claim"), quotes = byKind("quote"), cta = byKind("cta")[0];
  const figures = claims.filter(c => c.figure);
  const useFigures = figures.length >= 2;
  const programs = includedPrograms(review);
  // Intro paragraphs only leave the article when the cards they introduce exist; otherwise the text must not be lost.
  const opening = placed("opening")[0];
  const caseIntro = cases.length ? placed("caseIntro")[0] : undefined;
  const programIntro = programs.length ? placed("programIntro")[0] : undefined;
  // A paragraph that merely repeats the benefit or case texts is already rendered as cards; keep it out of the article.
  const cardBodies = [...byKind("benefit"), ...cases].map(c => c.body).filter(b => sourceText(b).length >= 12);
  const articles = byKind("section").filter(c => c !== opening && c !== caseIntro && c !== programIntro && !cardBodies.some(b => contains(c.body, b)));
  const notes = [...(useFigures ? [...claims.filter(c => !c.figure), ...figures.slice(8)] : claims), ...byKind("internal")];
  // Deterministic de-duplication of model choices: a heading repeated as the first body line,
  // an intro paragraph that is really one of the cards, a figure caption repeated as its story.
  const same = (a, b) => sourceText(a) === sourceText(b);
  const core = s => sourceText(String(s || "").replace(/\([^)]*\)/g, ""));
  const sameCore = (a, b) => core(a).length > 0 && core(a) === core(b);
  const withoutHeading = (title, body) => {
    const lines = String(body || "").split("\n");
    return lines.length > 1 && same(lines[0], title) ? lines.slice(1).join("\n") : body;
  };
  const introUnless = (intro, bodies) => intro && !bodies.some(b => contains(intro.body, b) || contains(b, intro.body)) ? intro.body : "";
  const allowed = new Set(["hero", "footer"]);
  // Verbatim groups all become card instances, keyed in reading order: card, card:2, card:3.
  const cardKeys = instanceKeys("card");
  let cardCount = 0;
  const blankCard = () => ({ title: "", kicker: "", body: "", image: "", brand: "none", tag: "", num: "", date: "", time: "", location: "", audience: "", format: "", hashtags: [], source: "", href: "", cta: "" });
  const addCard = (eyebrow, title, layout, intro, items) => {
    const key = cardKeys[cardCount++];
    if (!key) return null;
    sections[key] = { on: true, eyebrow, title, layout, numbers: "off", intro, items: items.map(f => ({ ...blankCard(), ...f })) };
    allowed.add(key);
    return key;
  };
  if (byKind("benefit").length) allowed.add("values"); else delete sections.values;
  if (articles.length) {
    allowed.add("article");
    const [first, ...rest] = articles;
    sections.article = { on: true, eyebrow: "Feature", title: first.title || "주요 소식", lead: withoutHeading(first.title, first.body),
      items: rest.slice(0, 6).map(c => ({ heading: c.title, body: withoutHeading(c.title, c.body) })), href: "" };
    notes.push(...rest.slice(6));
  }
  const figuresKey = useFigures ? addCard("Highlights", "핵심 수치", "col2", "",
    figures.slice(0, 8).map(c => ({ title: c.title, num: c.figure, body: sameCore(c.body, c.title) || contains(c.title, c.body) ? "" : c.body }))) : null;
  if (quotes.length) {
    allowed.add("quotes");
    sections.quotes = { on: true, eyebrow: "Quote", title: "주요 발언", layout: quotes.length === 1 ? "featured" : "list",
      items: quotes.map(q => ({ quote: q.body, name: q.title, role: "" })) };
  }
  const casesKey = cases.length ? addCard("Customer stories", "고객 사례", "col2", introUnless(caseIntro, cases.map(c => c.body)),
    cases.slice(0, 8).map(c => { const href = safeLink(c.link); return { title: c.title, body: c.body, href, cta: href ? "사례 자세히 보기" : "" }; })) : null;
  const programsKey = programs.length ? addCard("Programs", "프로그램 안내", "col1", introUnless(programIntro, programs.map(p => p.body)),
    programs.map(p => ({ title: p.title, kicker: p.oneLiner, body: p.body, date: p.date, time: p.time, location: p.location,
      audience: p.audience, format: p.format, cta: p.cta || "신청하기", href: safeLink(p.url) }))) : null;
  const e = review.event;
  if ([e.date, e.time, e.location, e.audience, e.format].some(Boolean)) {
    allowed.add("infobar");
    sections.infobar = { on: true, layout: "details", event: structuredClone(e) };
  }
  if (review.blocks.length) {
    allowed.add("agenda");
    sections.agenda = { on: true, eyebrow: "Event agenda", title: "전체 일정", layout: "grouped", style: "timeline", blocks: structuredClone(review.blocks) };
  }
  for (const key of Object.keys(sections)) if (!allowed.has(key)) delete sections[key];
  const contact = String(e.contact || "").trim();
  const contactEmail = cta?.body.match(EMAIL_RE)?.[0] || (contact.match(EMAIL_RE)?.[0] === contact ? contact : "");
  sections.footer = { ...sections.footer, layout: "cta",
    ...(cta ? { headline: cta.title || sections.footer.headline, leftNote: cta.body } : {}),
    href: safeLink(cta?.link) || safeLink(e.registrationUrl),
    contactLines: [e.organizer, e.contact].filter(v => v && v.trim() !== contactEmail).join("\n"), contactEmail, image: "",
    notes: notes.map(c => `${[c.figure, c.title].filter(Boolean).join(" · ")}\n${c.body}`) };
  // A reviewed title may be long; the source-title slot uses wrapping, not compression. The opening letter is printed as written.
  sections.hero.sourceTitle = e.title;
  sections.hero.letter = opening?.body || "";
  next.meta = { ...next.meta, audience: review.audience, sectionOrder:
    ["hero", "infobar", "article", figuresKey, "quotes", "values", casesKey, "agenda", programsKey, "footer"].filter(k => k && sections[k]) };
  return next;
}
