/**
 * kage-bunshin-lite API — 라우트 둘.
 *   POST /generate        원고 → Bedrock(강제 도구 호출) → 스펙 JSON → validateSpec → 위반 슬롯 수선 1회. 한 번 호출, API Gateway 30초 안.
 *   GET|PUT /flyers/{id}  초안 저장·조회 (DynamoDB flyer#<id> 한 종류만)
 * 없는 것: 비동기 잡, 장문 분석, 이미지 업로드, AI 검수, 스냅샷, 일일 상한. 공개 링크로 열 때 상한 하나는 다시 붙인다.
 * shared/ 와 templates/ 는 사본 — 직접 수정하지 말고 `npm run sync:templates`.
 */
import { readFileSync } from "node:fs";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { DEFAULT_THEME_ID } from "./shared/themes.mjs";
import { validateSpec, repairTargets } from "./shared/validator.mjs";
import { buildToolSchema, buildSystemPrompt, buildGenerateMessage, buildRepairMessage } from "./prompt.mjs";

const TABLE = process.env.TABLE;
const MODEL_CHAIN = [
  process.env.MODEL_ID || "global.anthropic.claude-sonnet-4-6",
  process.env.FALLBACK_MODEL_ID || "global.anthropic.claude-haiku-4-5-20251001-v1:0",
];
const GENERATE_BUDGET_MS = Number(process.env.GENERATE_BUDGET_MS || 26000); // API Gateway 통합 상한 30초 안

const bedrock = new BedrockRuntimeClient({ requestHandler: { requestTimeout: 30000, socketTimeout: 30000, connectionTimeout: 5000 } });
// 활성 테마의 사본 (npm run sync:templates): 슬롯 계약 schema.json + 브랜드·말투 지침 prompt-style.md
const schema = JSON.parse(readFileSync(new URL("./templates/schema.json", import.meta.url), "utf8"));
const STYLE_GUIDE = readFileSync(new URL("./templates/prompt-style.md", import.meta.url), "utf8");
const TOOL_SCHEMA = buildToolSchema(schema);
const SYSTEM_PROMPT = buildSystemPrompt(schema, STYLE_GUIDE);

// 저장소 — DynamoDB 한 테이블, flyer#<id>만. LOCAL_STORE=memory면 메모리(로컬 브리지 테스트용).
// put(id, item, original): item은 매번 덮어쓰고, original(AI 원본 aiSpec·model·generatedAt)은 처음 한 번만 남긴다.
// 원본을 남기는 이유: 동료가 뭘 얼마나 고쳤는지(수정률)가 "AI가 의도를 놓친 양"이다 — scripts/edit-rate.mjs가 비교한다.
const store = process.env.LOCAL_STORE === "memory" ? memoryStore() : dynamoStore();
function memoryStore() {
  const items = new Map();
  return {
    get: async (id) => items.get(id) || null,
    put: async (id, item, original) => {
      const prev = items.get(id) || {};
      items.set(id, { ...prev, ...item, ...(original && !prev.aiSpec ? original : {}) });
    },
  };
}
function dynamoStore() {
  const ddb = new DynamoDBClient({});
  return {
    get: async (id) => {
      const res = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: marshall({ pk: `flyer#${id}` }) }));
      return res.Item ? unmarshall(res.Item) : null;
    },
    put: async (id, item, original) => {
      const names = { "#spec": "spec", "#brief": "brief", "#title": "docTitle", "#upd": "updatedAt" };
      const values = { ":spec": item.spec, ":brief": item.brief, ":title": item.docTitle, ":upd": item.updatedAt };
      let expr = "SET #spec = :spec, #brief = :brief, #title = :title, #upd = :upd";
      if (original) {
        Object.assign(names, { "#ai": "aiSpec", "#model": "model", "#gen": "generatedAt" });
        Object.assign(values, { ":ai": original.aiSpec, ":model": original.model, ":gen": original.generatedAt });
        expr += ", #ai = if_not_exists(#ai, :ai), #model = if_not_exists(#model, :model), #gen = if_not_exists(#gen, :gen)";
      }
      await ddb.send(new UpdateItemCommand({
        TableName: TABLE, Key: marshall({ pk: `flyer#${id}` }),
        UpdateExpression: expr, ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
      }));
    },
  };
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  },
  body: JSON.stringify(body),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function converseOnce(modelId, userText, deadline) {
  const signal = AbortSignal.timeout(Math.max(1000, deadline - Date.now()));
  const res = await bedrock.send(new ConverseCommand({
    modelId,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: [{ text: userText }] }],
    toolConfig: {
      tools: [{ toolSpec: { name: "submit_flyer_spec", description: "완성한 플라이어 스펙 JSON을 제출한다", inputSchema: { json: TOOL_SCHEMA } } }],
      toolChoice: { tool: { name: "submit_flyer_spec" } },
    },
    inferenceConfig: { temperature: 0.4, maxTokens: 4096 },
  }), { abortSignal: signal });
  console.info(JSON.stringify({ event: "model_completion", modelId, ms: res.metrics?.latencyMs, inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens }));
  const toolUse = (res.output?.message?.content || []).find((c) => c.toolUse)?.toolUse;
  if (!toolUse) throw new Error("도구 호출 없음 — 모델이 스펙을 제출하지 않음");
  return toolUse.input;
}

/** 모델 체인 + 재시도: Sonnet 2회 → Haiku 2회. 전체 마감(deadline) 안에서만. */
async function converse(userText, deadline) {
  let lastErr;
  for (const modelId of MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() >= deadline - 1500) throw lastErr || new Error("시간 초과");
      try {
        return { spec: await converseOnce(modelId, userText, deadline), modelId };
      } catch (e) {
        lastErr = e;
        console.error(`converse 실패 model=${modelId} attempt=${attempt}: ${e.name} ${e.message}`);
        const retriable = ["ThrottlingException", "ServiceUnavailableException", "ModelTimeoutException", "InternalServerException"].includes(e.name)
          || String(e.message).includes("도구 호출 없음");
        if (!retriable) break;
        await sleep(600 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

function cleanSpec(node) {
  if (typeof node === "string")
    return node.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "").replace(/  +/g, " ")).join("\n").trim();
  if (Array.isArray(node)) return node.map(cleanSpec);
  if (node && typeof node === "object")
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, cleanSpec(v)]));
  return node;
}
// 테마 색 변형은 AI가 고르지 않는다 (2026-09-25): 항상 테마의 기본 변형으로 뽑고, 사용자가 편집기에서 바꾼다. shared/themes.mjs의 inferTheme은 편집기 밖 참고용으로만 남긴다.
const DEFAULT_THEME = process.env.DEFAULT_THEME || DEFAULT_THEME_ID;
const withMeta = (spec, brief) => arrangeLayouts({ ...spec, meta: { ...(spec.meta || {}), designVersion: 2, themeId: DEFAULT_THEME } });

/**
 * 레이아웃 배치 규칙 (규칙 3, 2026-09-25 — "카드 나열이 단조롭다" 피드백):
 *  ① 연속한 두 본문 섹션이 같은 모양(shape)이면 두 번째의 형태를 바꾼다.
 *  ② 본문 섹션 배경은 흰색과 테마 색을 번갈아 켠다(hero·infobar·footer 제외).
 *  ③ 내용이 없는 형태는 되돌린다: footer.table에 rows가 없으면 contact, footer.sentence에 body가 없으면 contact.
 * 모델이 고른 값을 최대한 존중하고, 어긋난 곳만 결정적으로 고친다.
 */
const SHAPE = {
  values: { cards: "rows", numbers: "rows", cols3: "grid", tiles: "grid", diagram: "diagram" },
  agenda: (sec) => ({ rail: "rail", timeline: "rail", table: "table", classic: "cards" }[sec.style || "rail"]),
  steps: { list: "cards", compact: "rows", process: "grid" },
  card: { col1: "cards", col2: "grid", col3: "grid", logo: "grid", banner: "banner" },
  quotes: { list: "cards", featured: "quote" },
  stats: "grid", customerStories: "grid", productCards: "cards", programs: "cards", about: "about", article: "text", qualify: "table", timeline: "rail", logoGrid: "grid", bignumber: "banner",
};
const ALT = { // 같은 모양이 이어질 때 두 번째 섹션을 바꾸는 대안
  values: { cards: "cols3", numbers: "tiles", cols3: "cards", tiles: "numbers" },
  "agenda.style": { rail: "table", timeline: "table", table: "rail", classic: "rail" },
  steps: { list: "compact", compact: "list", process: "list" },
  card: { col1: "col2", col2: "col1", col3: "col1" },
  quotes: { list: "featured", featured: "list" },
};
function shapeOf(key, sec) {
  const base = key.split(":")[0];
  const rule = SHAPE[base];
  if (!rule) return base;
  if (typeof rule === "function") return rule(sec);
  if (typeof rule === "string") return rule;
  return rule[sec.layout] || rule[Object.keys(rule)[0]];
}
function arrangeLayouts(spec) {
  const sections = spec.sections || {};
  const order = (spec.meta?.sectionOrder || Object.keys(sections)).filter((k) => sections[k] && sections[k].on !== false);
  const body = order.filter((k) => !["hero", "infobar", "footer"].includes(k.split(":")[0]));
  let prev = null;
  body.forEach((key, i) => {
    const base = key.split(":")[0], sec = sections[key];
    if (base === "card" && sec.items && sec.items.length < 2) { /* 카드 1개는 col1 유지 */ }
    else if (prev && shapeOf(key, sec) === prev) {
      if (base === "agenda") { const alt = ALT["agenda.style"][sec.style || "rail"]; if (alt) sec.style = alt; }
      else if (ALT[base]) { const alt = ALT[base][sec.layout]; if (alt && !(base === "values" && ["cols3", "tiles"].includes(alt) && (sec.cards || []).length !== 3)) sec.layout = alt; }
    }
    if (base === "values" && ["cols3", "tiles"].includes(sec.layout) && (sec.cards || []).length !== 3) sec.layout = sec.layout === "cols3" ? "cards" : "numbers"; // 3열은 항목 3개일 때만
    sec.background = i % 2 === 1 ? "on" : "off";
    prev = shapeOf(key, sec);
  });
  const f = sections.footer;
  if (f) {
    if (f.layout === "table" && !(Array.isArray(f.rows) && f.rows.length)) f.layout = "contact";
    if (f.layout === "sentence" && !String(f.body || "").trim()) f.layout = "contact";
    if (f.layout !== "table") f.rows = [];
    if (f.layout !== "sentence") f.body = "";
  }
  return spec;
}

/** 글자수 검사 밖의 부드러운 경고 — 고치지 않고 편집기의 'AI 경고'에만 띄운다. */
function softWarnings(spec) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[\s·,.()\-~]/g, "");
  const out = [];
  const badges = (spec.sections?.hero?.badges || []).map(norm).filter(Boolean);
  (spec.sections?.infobar?.cells || []).forEach((cell, i) => {
    const v = norm(cell?.value);
    if (v && badges.some((b) => b === v || b.includes(v) || v.includes(b)))
      out.push({ path: `sections.infobar.cells[${i}].value`, msg: `배지와 같은 사실("${cell.value}")이 정보 띠에 반복됨 — 한쪽만 남기세요`, kind: "dup" });
  });
  const placeholders = [];
  (function walk(node, path) {
    if (typeof node === "string") { if (/^추후 안내/.test(node.trim())) placeholders.push(path); }
    else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  })(spec.sections || {}, "sections");
  for (const p of placeholders) out.push({ path: p, msg: "원고에 없어 '추후 안내'로 채운 칸 — 발송 전에 채우거나 지우세요", kind: "placeholder" });
  return out;
}

async function handleGenerate(body) {
  const brief = String(body.brief || "").trim();
  if (brief.length < 20) return json(400, { error: "원고가 너무 짧아요 — 행사 내용을 몇 줄 적어 주세요." });
  if (brief.length > 8000) return json(400, { error: "원고는 8,000자 이내로 적어 주세요." });

  const started = Date.now();
  const deadline = started + GENERATE_BUDGET_MS;
  try {
    const result = await converse(buildGenerateMessage(brief), deadline);
    let spec = withMeta(cleanSpec(result.spec), brief);
    let errors = validateSpec(spec, schema, { strictLines: true });
    let repaired = false;
    // 글자수 위반 + 배지·정보 띠 중복(규칙 2)을 한 번의 수선으로 고친다. '추후 안내' 자리표시는 고치지 않고 경고로만 남긴다.
    const dupTargets = softWarnings(spec).filter((w) => w.kind === "dup").map((w) => ({ path: w.path, msg: `${w.msg}. 이 칸에는 원래 뜻(대상·장소·일시)에 맞는 사실을 브리핑에서 찾아 적고, 없으면 '추후 안내'로 둔다. 배지는 그대로.` }));
    const targets = [...repairTargets(errors), ...dupTargets];
    if (targets.length > 0 && Date.now() < deadline - 6000) {
      try {
        const fix = await converse(buildRepairMessage(spec, targets), deadline);
        spec = withMeta(cleanSpec(fix.spec), brief);
        repaired = true;
        errors = validateSpec(spec, schema, { strictLines: true });
      } catch (e) {
        console.error(`수선 실패 (원본 유지): ${e.message}`);
      }
    }
    const warnings = [...errors.map(({ path, msg, kind }) => ({ path, msg, kind })), ...softWarnings(spec)];
    console.info(JSON.stringify({ event: "generate", ok: true, model: result.modelId, ms: Date.now() - started, repaired, briefLen: brief.length, warnings: warnings.length }));
    return json(200, { spec, warnings, model: result.modelId, repaired });
  } catch (e) {
    console.error("generate 실패:", e);
    const timedOut = e?.name === "AbortError" || e?.name === "TimeoutError" || /시간 초과/.test(e?.message || "");
    return json(timedOut ? 504 : 502, {
      error: timedOut ? "AI 응답이 늦어 시간 안에 끝내지 못했어요. 다시 시도해 주세요." : "AI 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
    });
  }
}

const ID_RE = /^[0-9a-f-]{8,64}$/i;
async function handleGetFlyer(id) {
  if (!ID_RE.test(id)) return json(400, { error: "잘못된 id" });
  const item = await store.get(id);
  if (!item) return json(404, { error: "없는 초안이에요." });
  return json(200, { id, spec: item.spec, brief: item.brief || "", updatedAt: item.updatedAt,
    aiSpec: item.aiSpec, model: item.model, generatedAt: item.generatedAt });
}
const isSpec = (v) => v && typeof v === "object" && !Array.isArray(v);
async function handlePutFlyer(id, body) {
  if (!ID_RE.test(id)) return json(400, { error: "잘못된 id" });
  if (!isSpec(body.spec)) return json(400, { error: "spec 누락" });
  if (JSON.stringify(body.spec).length > 200_000) return json(400, { error: "스펙이 너무 큽니다" });
  // 첫 저장(생성 직후)에만 실려 오는 AI 원본 — 이후 저장은 무시되고 서버가 처음 값을 지킨다
  let original = null;
  if (body.aiSpec !== undefined) {
    if (!isSpec(body.aiSpec) || JSON.stringify(body.aiSpec).length > 200_000) return json(400, { error: "aiSpec 형식이 잘못됐어요" });
    original = { aiSpec: body.aiSpec, model: String(body.model || "").slice(0, 80), generatedAt: String(body.generatedAt || new Date().toISOString()).slice(0, 40) };
  }
  const now = new Date().toISOString();
  await store.put(id, {
    spec: body.spec,
    brief: String(body.brief || "").slice(0, 8000),
    docTitle: String(body.spec?.meta?.docTitle || "").slice(0, 120),
    updatedAt: now,
  }, original);
  return json(200, { id, updatedAt: now });
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || "GET";
  // CloudFront /api/* 비헤이비어를 거치면 경로에 /api 접두사가 붙는다
  const path = ((event.rawPath || "/").replace(/^\/api(?=\/|$)/, "")) || "/";
  if (method === "OPTIONS") return json(204, {});
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body);
    } catch {
      return json(400, { error: "본문이 JSON이 아님" });
    }
  }
  try {
    const flyerMatch = path.match(/^\/flyers\/([^/]+)$/);
    if (method === "POST" && path === "/generate") return await handleGenerate(body);
    if (method === "GET" && flyerMatch) return await handleGetFlyer(flyerMatch[1]);
    if (method === "PUT" && flyerMatch) return await handlePutFlyer(flyerMatch[1], body);
    return json(404, { error: `없는 경로: ${method} ${path}` });
  } catch (e) {
    console.error("unhandled:", e);
    return json(500, { error: "서버 오류" });
  }
};
