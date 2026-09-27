import { BLOCKS_SCHEMA, EVENT_SCHEMA } from "./shared/briefing.mjs";
import { instanceKeys } from "./shared/sectionKeys.mjs";
import { THEMES, DEFAULT_THEME_ID } from "./shared/themes.mjs";
/**
 * 프롬프트·도구 스키마 조립.
 *
 * 원칙: AI는 카피라이터일 뿐 — CSS·색·레이아웃 정보는 여기 절대 넣지 않는다.
 * 디자인은 템플릿이 전담하고, AI는 슬롯별 글자수 안에서 글만 쓴다.
 * 브랜드·말투처럼 테마마다 다른 지침은 여기 두지 않고 templates/<THEME>/prompt-style.md에서 받는다 (buildSystemPrompt의 둘째 인자).
 */

/**
 * schema.json → Bedrock toolSpec 입력 JSON 스키마.
 * 계약: 섹션 객체가 "있으면 선택된 것" — on 필드 없음. 필수는 hero/footer뿐이고,
 * 나머지 모듈은 브리핑에 맞는 것만 포함한다. 순서는 meta.sectionOrder로 제시.
 */
export function buildToolSchema(schema) {
  const sectionProps = {};
  const sectionRequired = [];

  // Deprecated sections stay renderable for saved drafts but are never offered to the model.
  const active = Object.entries(schema.sections).filter(([, def]) => !def.deprecated);
  for (const [name, def] of active) {
    const props = {};
    const required = [];
    for (const [slot, rule] of Object.entries(def.slots)) {
      props[slot] = slotToJsonSchema(rule);
      if (rule.required) required.push(slot);
    }
    sectionProps[name] = { type: "object", properties: props, required, description: def.desc || def.label };
    if (def.required) sectionRequired.push(name);
    // multi 모듈은 같은 정의로 card:2, card:3 자리를 더 연다 — 다른 주제의 묶음이 하나 더 필요할 때만 쓴다
    for (const key of def.multi ? instanceKeys(name).slice(1) : [])
      sectionProps[key] = { ...sectionProps[name], description: `${def.label} 묶음 ${key.split(":")[1]}번째 — 다른 주제의 같은 형식 묶음이 하나 더 필요할 때만 (예: 수치 카드와 사례 카드). meta.sectionOrder에도 같은 키를 쓴다.` };
  }

  return {
    type: "object",
    properties: {
      meta: {
        type: "object",
        properties: {
          designVersion: { type: "integer", enum: [2] },
          themeId: { type: "string", enum: Object.keys(THEMES) },
          docTitle: { type: "string", maxLength: schema.meta.docTitle.maxChars, description: schema.meta.docTitle.desc },
          sectionOrder: {
            type: "array",
            items: { type: "string", enum: active.flatMap(([name, def]) => def.multi ? instanceKeys(name) : [name]) },
            minItems: 3,
            description: "선택한 섹션들의 위→아래 배치 순서. hero가 처음, footer가 마지막.",
          },
        },
        required: ["docTitle", "sectionOrder", "designVersion", "themeId"],
      },
      sections: { type: "object", properties: sectionProps, required: sectionRequired },
    },
    required: ["meta", "sections"],
  };
}

function textDesc(rule) {
  const parts = [rule.desc || ""];
  if (rule.maxLines > 1 && rule.perLine) parts.push(`최대 ${rule.maxLines}줄(\\n 구분), 한 줄은 한글 기준 약 ${rule.perLine}자(영문·숫자는 절반 폭)`);
  else if (rule.maxLines > 1) parts.push(`최대 ${rule.maxLines}줄(\\n 구분)`);
  else if (rule.perLine) parts.push(`한 줄, 한글 기준 약 ${rule.perLine}자 이내(영문·숫자는 절반 폭)`);
  return parts.filter(Boolean).join(" — ");
}

function slotToJsonSchema(rule) {
  if (rule.type === "agendaBlocks") return BLOCKS_SCHEMA;
  if (rule.type === "eventDetails") return EVENT_SCHEMA;
  if (rule.type === "text" || rule.type === "multiline")
    return { type: "string", maxLength: rule.maxChars, description: textDesc(rule) };
  if (rule.type === "list")
    return {
      type: "array", minItems: rule.minItems, maxItems: rule.maxItems, description: rule.desc,
      items: { type: "string", maxLength: rule.itemMaxChars, description: textDesc({ perLine: rule.itemPerLine, maxLines: rule.itemMaxLines }) },
    };
  if (rule.type === "cards")
    return {
      type: "array", minItems: rule.minItems, maxItems: rule.maxItems, description: rule.desc,
      items: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: rule.fields.title.maxChars, description: textDesc(rule.fields.title) },
          sub: { type: "string", maxLength: rule.fields.sub.maxChars, description: textDesc(rule.fields.sub) },
        },
        required: ["title", "sub"],
      },
    };
  if (rule.type === "pills")
    return {
      type: "array", minItems: rule.minItems, maxItems: rule.maxItems, description: rule.desc,
      items: {
        type: "object",
        properties: {
          main: { type: "string", maxLength: rule.fields.main.maxChars, description: rule.fields.main.desc },
          sub: { type: "string", maxLength: rule.fields.sub.maxChars, description: rule.fields.sub.desc },
        },
        required: ["main"],
      },
    };
  if (rule.type === "choice")
    return { type: "string", enum: rule.enum, description: rule.desc };
  if (rule.type === "toggle")
    return { type: "string", enum: ["off", "on"], description: rule.desc || rule.label };
  if (rule.type === "items") {
    const props = {};
    const required = [];
    for (const [fname, f] of Object.entries(rule.fields)) {
      if (f.type === "graphic") props[fname] = {
        type: "object", description: f.desc, properties: {
          kind: {type:"string",enum:["tiles","percent","bars","beforeAfter"]},
          value: {type:"number",minimum:0,maximum:100},
          unit: {type:"string"},
          values: {type:"array",minItems:2,maxItems:2,items:{type:"object",properties:{label:{type:"string",maxLength:20},value:{type:"number",minimum:0}},required:["label","value"]}},
        }, required:["kind"],
      };
      else if (f.enum) props[fname] = { type: "string", enum: f.enum, description: f.desc };
      else if (f.type === "list")
        props[fname] = {
          type: "array", minItems: f.minItems, maxItems: f.maxItems,
          items: { type: "string", maxLength: f.itemMaxChars }, description: f.desc,
        };
      else props[fname] = { type: "string", maxLength: f.maxChars, description: textDesc(f) };
      if (!f.optional) required.push(fname);
    }
    return {
      type: "array", minItems: rule.minItems, maxItems: rule.maxItems, description: rule.desc,
      items: { type: "object", properties: props, required },
    };
  }
  if (rule.type === "groups")
    return {
      type: "array", minItems: rule.minItems, maxItems: rule.maxItems, description: rule.desc,
      items: {
        type: "object",
        properties: {
          brand: { type: "string", enum: rule.fields.brand.enum, description: rule.fields.brand.desc },
          name: { type: "string", maxLength: rule.fields.name.maxChars, description: rule.fields.name.desc },
          headers: {
            type: "array", minItems: rule.fields.headers.minItems, maxItems: rule.fields.headers.maxItems,
            items: { type: "string", maxLength: rule.fields.headers.itemMaxChars }, description: rule.fields.headers.desc,
          },
          highlightCol: { type: "integer", description: rule.fields.highlightCol.desc },
          rows: {
            type: "array", minItems: rule.fields.rows.minItems, maxItems: rule.fields.rows.maxItems,
            items: { type: "array", items: { type: "string", maxLength: rule.fields.cellMaxChars } },
            description: rule.fields.rows.desc,
          },
        },
        required: ["brand", "name", "headers", "highlightCol", "rows"],
      },
    };
  throw new Error(`알 수 없는 슬롯 타입: ${rule.type}`);
}

/**
 * few-shot 예시 — 스키마 기본값(중립 안내 문구)으로 만든 구조 참고용 스펙.
 * "고른 모듈만" 정책대로 세 섹션만 담아 프롬프트를 슬림하게 유지한다.
 */
const EXAMPLE_SECTIONS = ["hero", "values", "footer"];

function exampleSpec(schema) {
  const sections = {};
  for (const name of EXAMPLE_SECTIONS) {
    const def = schema.sections[name];
    const sec = {};
    for (const [slot, rule] of Object.entries(def.slots)) sec[slot] = rule.default;
    sections[name] = sec;
  }
  return { meta: { docTitle: schema.meta.docTitle.default, sectionOrder: EXAMPLE_SECTIONS, designVersion: 2, themeId: DEFAULT_THEME_ID }, sections };
}

const EXAMPLE_BRIEF = `가상의 사내 워크숍 안내: 팀원이 새 도구를 실습하고 사용 방법을 나눕니다. 등록 링크·수치·연락처는 아직 없습니다.`;

/**
 * @param {object} schema      — 활성 테마의 schema.v2.json
 * @param {string} styleGuide  — 활성 테마의 prompt-style.md (누구의 뉴스레터인지, 브랜드 표기, 말투). 비어 있으면 일반 B2B 뉴스레터 기준.
 */
export function buildSystemPrompt(schema, styleGuide = "") {
  const style = String(styleGuide || "").trim();
  return [
    "당신은 B2B 이벤트 플라이어/eDM(뉴스레터) 카피라이터다. 사용자의 행사 브리핑을 받아 정해진 템플릿의 빈칸(슬롯)에 들어갈 글을 쓴다.",
    "",
    ...(style ? ["## 브랜드·말투 지침 (이 뉴스레터 고유)", style, ""] : []),
    "## 글쓰기 규칙",
    "- 담백한 존댓말. 과장·감탄 남발 금지. 이모지는 히어로 제목에 최대 1개.",
    "- 글밥은 줄이고(짧게), 구체적 숫자·사실 위주로. 형용사보다 팩트.",
    "- 섹션 라벨(eyebrow)은 영문 2~3단어, 첫 단어만 대문자 (예: Value offering).",
    "- 제품·회사 이름은 공식 표기 그대로 쓴다 (위 브랜드 지침에 표기가 있으면 그것을 따른다).",
    "- 줄바꿈(\\n)은 의미 단위로 끊는다. 조사·단어 중간에서 끊지 않는다. 마지막 줄에 한두 글자만 남는 줄바꿈 금지.",
    "- 각 슬롯의 글자수 한도를 반드시 지킨다. 한글은 1자, 영문·숫자·공백은 절반 폭으로 계산해 '한 줄 약 N자' 지침을 지킨다.",
    "- 브리핑에 없는 사실을 지어내지 않는다. 날짜·가격·이름·연락처는 브리핑에 있는 그대로.",
    "- 브리핑에 없는데 템플릿이 요구하는 칸(장소·일시·대상처럼 필수 칸)은 정확히 '추후 안내'라고만 적는다. '미정', 'TBD', '확정 후 안내' 같은 다른 말로 얼버무리지 않는다. 선택 칸은 비운다. (편집기가 '추후 안내'를 찾아 채울 칸으로 표시한다)",
    "- 같은 사실을 두 곳에 넣지 않는다. hero.badges는 마감·조건·혜택처럼 행동을 부르는 짧은 사실 1~2개, infobar.cells는 일시·장소·대상. 한쪽에 넣은 사실(예: 선착순 40명)은 다른 쪽에 반복하지 않는다.",
    "",
    "## 컴플라이언스 (위반 시 발송 불가)",
    "- 경쟁사 비교·폄하 금지. ROI/성능 수치 확약 금지 ('보장', '반드시' 금지).",
    "- 내부 할인가·크레딧 단가 등 비공개 가격 정보 금지 (브리핑에 명시된 공개 가능 숫자만).",
    "- 신용등급·재무 상태 언급 금지.",
    "",
    "## 모듈 카탈로그 (섹션 = 레이아웃 모듈)",
    Object.entries(schema.sections).filter(([, def]) => !def.deprecated).map(([name, def]) => `- ${name}: ${def.label} — ${def.desc || ""}`).join("\n"),
    "",
    "## 모듈 선택 규칙",
    "- 브리핑에 맞는 모듈만 3~6개 골라 (hero·footer 포함) 그 모듈만 채운다. 고르지 않은 모듈은 스펙에 아예 넣지 않는다.",
    "- meta.sectionOrder에 고른 모듈의 위→아래 순서를 담는다 (hero 처음, footer 마지막).",
    schema.combos.map((c) => `- ${c}`).join("\n"),
    "",
    "## 추가 데이터 규칙",
    `- meta.designVersion은 2. meta.themeId는 항상 ${DEFAULT_THEME_ID} (테마 색은 사용자가 편집기에서 바꾼다).`,
    "- 브리핑에 없는 선택 필드(연락처, 날짜, 사례, 수치, 링크, 이미지)는 생략하거나 빈 문자열. 예시 문구를 결과에 복사하지 않는다.",
    "- card는 사례·단계·특징처럼 같은 형식의 항목 묶음. 제공된 실제 내용만 넣고, 사진·링크는 브리핑에 있을 때만 image/href에 넣는다. 명시된 제품·기관 로고 목록은 card layout=logo(title=이름, image는 있을 때만), 헤드라인 수치 하나(예: 시장 규모)는 card layout=banner 항목 1개(num·title·kicker·source).",
    "- card.items[].num은 브리핑의 수치 토큰만(단위 포함). graphic은 제공된 숫자만: 비율 하나면 percent/value, 비교 수치 2개와 같은 단위가 모두 있을 때만 bars 또는 beforeAfter와 values/unit. 31% 개선만 주어진 경우 기준값을 추정해 비교 그래프를 만들지 않고 num만 쓴다.",
    `- card.items[].brand: ${schema.sections.card?.slots?.items?.fields?.brand?.desc || "항상 none."} tag는 대상·분야 라벨, hashtags는 브리핑에 특징 키워드가 있을 때만 최대 3개. 일시·장소·대상·구성은 date/time/location/audience/format에 원문 그대로.`,
    "- agenda.style은 기본 timeline. 시간은 제목과 분리해 items[].time 또는 blocks의 time에 제공된 그대로 넣고, 없는 시간은 만들지 않는다.",
    "- hero.layout은 넷 중 하나: basic(왼쪽 정렬, 연한 배경) 기본 · centered(가운데 정렬, 짧은 초대장) · dark(검정 배너, 컨퍼런스·발표·격식 있는 초대) · block(왼쪽 컬러 블록, 프로모션·혜택·모집처럼 활기찬 행사). 원고의 성격에 맞춰 고르고 이유가 없으면 basic.",
    "- 모듈 형태(layout)는 문서 안에서 같은 모양이 연달아 나오지 않게 고른다. values.layout: cards(세로 나열)·cols3(3열 카드, 항목 3개일 때)·numbers(큰 숫자)·tiles(틴트 타일, 항목 3개). agenda.style: rail(왼쪽 선 타임라인, 기본)·table(번호 표, 세션 6개 이상이거나 설명이 짧을 때). infobar.layout: strip(검정 띠, 기본)·floating(흰 카드, hero가 dark나 block일 때 어울림).",
    "- footer.layout: contact(문의처 카드, 기본)·dark(다크 배너)·block(컬러 블록)·table(항목 표 — footer.rows에 라벨·값 2~4행을 채우고 bullets는 빈 배열)·sentence(문장형 — footer.body에 신청 방법·마감을 2~3문장으로 쓰고 bullets는 빈 배열). hero가 dark면 footer도 dark, hero가 block이면 footer도 block처럼 짝을 맞추면 좋다. rows·body는 해당 형태가 아니면 비운다.",
    "- card.layout은 항목 수에 맞춘다: 3·6개면 col3, 짝수면 col2, 본문이 길거나 사진이 크면 col1, 수치 카드(num·graphic)는 col2. 순서 있는 절차·단계면 numbers=on, 아니면 off. 버튼 문구(cta)는 href가 있을 때만.",
    "- 같은 형식의 묶음이 둘 이상이면(예: 수치 카드와 사례 카드) card, card:2, card:3처럼 번호 키로 각각 넣고 meta.sectionOrder에도 같은 키를 쓴다. 한 문서에 카드 묶음은 최대 3개.",
    "- 각 섹션의 background(배경 그라디언트)는 강조할 섹션 1~2개에만 on. 연속한 두 섹션을 모두 on으로 하지 않고, 지정하지 않으면 기본값을 따른다.",
    "- 출처 URL은 제공된 것만 href에 담고, 없으면 빈 문자열. 이미지 URL을 만들어내지 않는다.",
    "## 예시 (가상 워크숍 — 구조 참고용, 사실 정보 재사용 금지)",
    "브리핑:",
    EXAMPLE_BRIEF,
    "",
    "제출된 스펙:",
    JSON.stringify(exampleSpec(schema), null, 1),
  ].join("\n");
}

export function buildGenerateMessage(brief) {
  return [
    "다음 행사 브리핑으로 플라이어 스펙을 작성해 submit_flyer_spec 도구로 제출하라.",
    "",
    "## 브리핑",
    brief,
  ].join("\n");
}

export function buildRepairMessage(spec, targets) {
  return [
    "방금 제출한 스펙에서 아래 칸들이 규칙을 어겼다. 해당 칸만 규칙에 맞게 고치고, 나머지는 그대로 둔 전체 스펙을 submit_flyer_spec 도구로 다시 제출하라.",
    "글자수를 줄일 때는 의미를 유지하며 압축한다 (조사 생략, 군더더기 제거).",
    "",
    "## 어긴 칸",
    targets.map((t) => `- ${t.path}: ${t.msg}`).join("\n"),
    "",
    "## 현재 스펙",
    JSON.stringify(spec, null, 1),
  ].join("\n");
}
