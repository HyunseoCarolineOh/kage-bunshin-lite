/**
 * 수정률 측정 — AI가 처음 쓴 글(aiSpec)과 지금 글(spec)을 칸(슬롯) 단위로 비교한다.
 * 고친 칸의 비율이 "AI가 의도를 놓친 양"이다. 프롬프트를 바꿀 때마다 이 숫자가 내려가는지 본다.
 *
 *   node scripts/edit-rate.mjs                                  # 운영 테이블 kage-bunshin-lite 전체 (로컬 AWS 자격증명)
 *   node scripts/edit-rate.mjs --table <이름>                   # 다른 테이블
 *   node scripts/edit-rate.mjs --api http://127.0.0.1:8787 --ids a,b   # 로컬 브리지에서 id 몇 개만 (GET /flyers/{id})
 *   --since 2026-09-23   생성일 이후만 · --include-tests  E2E 테스트 초안("E2E수정" 표식)도 포함 · --out 저장 경로(기본 scripts/edit-rate-out/<KST 날짜>.md)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : []).filter(Boolean));
const TABLE = args.table || "kage-bunshin-lite";
const since = args.since ? String(args.since) : "";

/** 스펙을 "경로 → 문자열" 지도로 펼친다. 글자 칸만 비교한다(숫자·불리언·이미지 키는 제외). */
function flatten(node, prefix = "", out = new Map()) {
  if (typeof node === "string") { out.set(prefix, node); return out; }
  if (Array.isArray(node)) node.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
const isText = (path) => /^(sections|meta\.docTitle|meta\.subject|meta\.preheader)/.test(path) && !/\.(layout|variant|columns|kind|on|image|icon|link|url|href)$/.test(path);
const generalize = (path) => path.replace(/\[\d+\]/g, "[]").replace(/^sections\.([a-zA-Z]+):\d+\./, "sections.$1.");

function compare(item) {
  const A = new Map([...flatten(item.aiSpec)].filter(([p]) => isText(p)));
  const B = new Map([...flatten(item.spec)].filter(([p]) => isText(p)));
  const changed = [], removed = [], added = [];
  for (const [p, v] of A) { if (!B.has(p)) removed.push(p); else if (B.get(p) !== v) changed.push({ path: p, before: v, after: B.get(p) }); }
  for (const p of B.keys()) if (!A.has(p)) added.push(p);
  return { total: A.size, changed, removed, added, rate: A.size ? changed.length / A.size : 0 };
}

async function loadFromDynamo() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  process.env.AWS_REGION ||= "ap-northeast-2";
  delete process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
  const ddb = new DynamoDBClient({});
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE, FilterExpression: "attribute_exists(aiSpec)", ExclusiveStartKey }));
    items.push(...(res.Items || []).map((it) => unmarshall(it)));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items.map((it) => ({ id: it.pk.slice("flyer#".length), ...it }));
}
async function loadFromApi(base, ids) {
  const out = [];
  for (const id of ids) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/flyers/${id}`);
    if (!res.ok) { console.error(`GET ${id} -> ${res.status}`); continue; }
    const d = await res.json();
    if (d.aiSpec) out.push({ id, ...d });
  }
  return out;
}

const isTestDraft = (it) => JSON.stringify(it.spec || {}).includes("E2E수정"); // scripts/e2e.mjs가 남긴 표식 — 기본 제외
const items = (args.api ? await loadFromApi(String(args.api), String(args.ids || "").split(",").filter(Boolean)) : await loadFromDynamo())
  .filter((it) => !since || String(it.generatedAt || "") >= since)
  .filter((it) => args["include-tests"] || !isTestDraft(it))
  .sort((a, b) => String(a.generatedAt).localeCompare(String(b.generatedAt)));

if (!items.length) { console.log("비교할 초안이 없어요 (aiSpec이 있는 초안 0건)."); process.exit(0); }

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 날짜
const kst = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? "" : new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "); };
const cell = (s) => String(s).replace(/\|/g, "／").replace(/\n/g, " ");
const rows = items.map((it) => ({ id: it.id, title: cell(it.docTitle || it.spec?.meta?.docTitle || ""), model: (it.model || "").replace(/^global\.anthropic\./, ""), generatedAt: kst(it.generatedAt || ""), ...compare(it) }));
const sumTotal = rows.reduce((s, r) => s + r.total, 0);
const sumChanged = rows.reduce((s, r) => s + r.changed.length, 0);
const touched = rows.filter((r) => r.changed.length || r.removed.length || r.added.length).length;
const byPath = new Map();
for (const r of rows) for (const c of r.changed) byPath.set(generalize(c.path), (byPath.get(generalize(c.path)) || 0) + 1);
const topPaths = [...byPath].sort((a, b) => b[1] - a[1]).slice(0, 10);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const lines = [];
lines.push(`# 수정률 ${today()} · ${args.api ? args.api : TABLE}`);
lines.push("");
lines.push(`초안 ${rows.length}건 · 손댄 초안 ${touched}건 · 글자 칸 ${sumTotal}개 중 고친 칸 ${sumChanged}개 · **수정률 ${pct(sumTotal ? sumChanged / sumTotal : 0)}** (고친 칸 ÷ 전체 칸)`);
lines.push("");
lines.push("| 생성 | 제목 | 모델 | 칸 | 고침 | 지움 | 추가 | 수정률 |");
lines.push("|---|---|---|---:|---:|---:|---:|---:|");
for (const r of rows) lines.push(`| ${r.generatedAt} | ${r.title.slice(0, 30)} | ${r.model} | ${r.total} | ${r.changed.length} | ${r.removed.length} | ${r.added.length} | ${pct(r.rate)} |`);
lines.push("");
lines.push("## 가장 자주 고친 칸");
lines.push("");
if (!topPaths.length) lines.push("아직 고친 칸이 없어요.");
for (const [p, n] of topPaths) lines.push(`- \`${p}\` × ${n}`);
lines.push("");
lines.push("## 고친 문장 예시 (최근 초안부터, 최대 12개)");
lines.push("");
for (const r of [...rows].reverse()) for (const c of r.changed.slice(0, 3)) {
  if (lines.filter((l) => l.startsWith("- `")).length >= 10 + topPaths.length) break;
  lines.push(`- \`${c.path}\`: “${c.before.replace(/\n/g, " ").slice(0, 60)}” → “${c.after.replace(/\n/g, " ").slice(0, 60)}”`);
}
const report = lines.join("\n") + "\n";
console.log(report);
const outDir = join(dirname(fileURLToPath(import.meta.url)), "edit-rate-out");
mkdirSync(outDir, { recursive: true });
const outPath = args.out ? String(args.out) : join(outDir, `${today()}.md`);
writeFileSync(outPath, report);
console.log(`저장: ${outPath}`);
