/** A generated superset; schema.json remains the immutable v1 reference. Theme-specific values (variants, brands, logo) come from templates/<THEME>/theme.mjs. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SECTION_CATALOG } from "../web/src/lib/sectionCatalog.js";
import { THEME, THEME_DIR, loadTheme } from "../theme.config.mjs";
const theme = await loadTheme();
const VARIANT_IDS = Object.keys(theme.variants);
const schema = JSON.parse(readFileSync(join(THEME_DIR, "schema.json"), "utf8"));
// 브랜드(제품 워드마크) 안내문 — 테마의 brandLabels(id → 공식 표기)로 만든다. 표기가 없으면 id를 그대로 보여 준다.
const brandIds = Object.keys(schema.brands).filter((id) => id !== "none");
const brandDesc = (subject) => brandIds.length
  ? `${subject}이 ${brandIds.map((id) => theme.brandLabels?.[id] || id).join("·")} 제품 이름일 때만 ${brandIds.join("/")}. 그 외 none.`
  : "항상 none.";
const text = (value = "", required = false, maxChars = 100) => ({ type: "text", required, maxChars, perLine: 38, default: value });
const multiline = (value = "", maxChars = 240) => ({ ...text(value, false, maxChars), type: "multiline", maxLines: 6, perLine: 45 });
const layout = (values, labels) => ({ type: "choice", label: "형태", enum: values, default: values[0], optionLabels: Object.fromEntries(values.map((v,i) => [v,labels[i]])), desc: labels.join(" / ") });
const list = (values, maxItems = 6) => ({ type: "list", minItems: 1, maxItems, itemMaxChars: 70, itemPerLine: 38, default: values });
const section = (label, desc, slots) => ({ label, desc, required: false, defaultOn: false, since: 2, slots: { eyebrow: text(label), title: text(label, true), ...slots } });
schema.designVersion = 2;
schema.meta.themeId = { type: "choice", enum: VARIANT_IDS, default: theme.defaultVariant };
schema.meta.designVersion = { type: "number", enum: [2], default: 2 };
schema.meta.docTitle.default = "새 플라이어";
const s = schema.sections;
s.hero.slots.layout = layout(["basic","centered","dark","block"], ["기본형","가운데 정렬","다크 배너","컬러 블록"]);
// 배너 형태용 이미지 슬롯 (2026-09-25): 다크 배너의 흰 로고, 컬러 블록의 테마 장식. 값이 비면 렌더러가 테마 기본값을 쓴다.
// 프리셋 이름 규약: 배경 hero-<variant> → assets/hero-<variant>.jpg, 장식 deco-<variant> → assets/hero-deco-<variant>.png (theme.mjs의 variants 기준).
schema.imageSlots.logoWhite = { label: "로고(흰색)", default: theme.logoWhite.id, presets: { [theme.logoWhite.id]: theme.logoWhite.file } };
schema.imageSlots.heroDeco = { label: "배너 장식", default: `deco-${theme.defaultVariant}`, presets: Object.fromEntries(VARIANT_IDS.map((id) => [`deco-${id}`, `assets/hero-deco-${id}.png`])) };
// 테마가 추가로 쓰는 아이콘(값 카드 아이콘 등) — schema.json의 iconPresets에 합친다.
schema.iconPresets = { ...(schema.iconPresets || {}), ...(theme.icons || {}) };
s.agenda.slots.layout = layout(["list","grouped"], ["세션 목록","오전·오후 묶음과 동시 세션"]);
s.agenda.slots.style = {...layout(["rail","table","timeline","classic"], ["왼콽 선 타임라인","번호 표","가운데 선, 좌우 카드","번호 카드"]), label:"일정 디자인"}; // 2026-09-25 채택: rail·table, 나머지는 기존 초안 호환
s.agenda.slots.items.fields.time = {...text("",false,80),optional:true,perLine:undefined};
s.agenda.slots.blocks = { type:"agendaBlocks", required:false, default:[] };
s.infobar.slots.layout = layout(["strip","floating","details"], ["한 줄 띠","떠 있는 흰 카드","항목별 여러 줄"]);
s.infobar.slots.event = { type:"eventDetails", required:false };
s.hero.slots.sourceTitle = { type:"multiline", required:false, maxChars:500, maxLines:20 };
s.footer.slots.notes = { type:"list", required:false, minItems:0, maxItems:40, itemMaxChars:2200, itemMaxLines:50, default:[] };
s.productCards.slots.layout = layout(["vertical","horizontal"], ["카드 2열","가로로 긴 카드"]);
s.values.slots.layout = layout(["cards","cols3","numbers","tiles","diagram"], ["세로 나열","3열 카드","큰 숫자","틴트 타일 3열","가운데 핵심어 도식"]);
s.values.slots.centerLabel = text("핵심 가치", false, 36);
s.about.slots.layout = layout(["photo","text"], ["사진 위, 글 아래","로고 옆에 글"]);
s.about.slots.body = multiline("");
s.steps.slots.layout = layout(["list","process","compact"], ["세로로 나열","가로 3칸 (3단계일 때)","번호와 제목 한 줄"]);
s.quotes.slots.layout = layout(["list","featured"], ["세로 나열","큰 인용"]);
s.footer.slots.layout = layout(["contact","dark","block","table","sentence","cta"], ["문의처 카드","다크 배너","컬러 블록","항목 표","문장형","버튼과 이미지"]);
// 2026-09-25 채택 형태용 슬롯: 항목 표(table)는 rows, 문장형(sentence)은 body. 다른 형태에서는 비워 둔다.
s.footer.slots.rows = { type: "items", required: false, minItems: 0, maxItems: 4, fields: {
  label: { maxChars: 8, maxLines: 1, perLine: 8, desc: "라벨 (신청 방법·기재 사항·정원·마감 등)" },
  value: { maxChars: 44, maxLines: 2, perLine: 28, desc: "값 — 브리핑에 있는 사실만" },
}, default: [], desc: "footer.layout이 table일 때만 2~4행. 다른 형태면 빈 배열." };
s.footer.slots.body = { ...multiline("", 180), desc: "footer.layout이 sentence일 때만 — 신청 방법·마감을 한 문단(2~3문장)으로. 다른 형태면 빈 문자열." };
s.timeline.slots.layout.optionLabels = { vertical: "위에서 아래로", horizontal: "왼쪽에서 오른쪽으로" };
s.footer.slots.href = { ...text("", false, 1200), format: "url", perLine: undefined };
s.footer.slots.image = { ...text("", false, 1200), format: "image", perLine: undefined };
s.productCards.slots.items.fields.href = { ...text("", false, 1200), format: "url", optional: true, perLine: undefined };
s.stats.slots.items.fields.graphic = {
  type: "graphic", optional: true, desc: "브리핑에 실제 수치가 있을 때만. percent는 0~100의 value. bars/beforeAfter는 label/value 2개와 공통 unit. 숫자가 없는 경우 생략.",
};
s.customerStories = section("고객 사례", "브리핑에 실제 사례의 본문이 있을 때만. 성과·고객 이름·수치를 만들어내지 않는다.", {
  items: { type: "items", minItems: 1, maxItems: 4, fields: {
    title: text("사례 제목", true, 60), body: multiline("사례 내용을 입력하세요"),
    href: { ...text("", false, 1200), format: "url", optional: true, perLine: undefined },
    image: { ...text("", false, 1200), format: "image", optional: true, perLine: undefined },
  }, default: [{ title: "사례 제목", body: "사례 내용을 입력하세요", href: "", image: "" }] },
});
s.customerStories.slots.items.fields.body = { ...s.customerStories.slots.items.fields.body, maxChars:2000, maxLines:50, perLine:undefined };
s.logoGrid = section("로고 모음", "브리핑에서 명시한 제품·기관만. 로고 이미지가 없는 경우 이름을 표시한다.", {
  items: { type: "items", minItems: 1, maxItems: 8, fields: {
    name: text("이름", true, 40),
    image: { ...text("", false, 1200), format: "image", optional: true, perLine: undefined },
    href: { ...text("", false, 1200), format: "url", optional: true, perLine: undefined },
  }, default: [{ name: "이름", image: "", href: "" }] },
});
// Review-owned verbatim slots: no per-line width rule (source text is never re-wrapped), generous line counts.
const verbatim = (maxChars, maxLines) => ({ type: "multiline", required: false, maxChars, maxLines, perLine: undefined, default: "" });
const plain = (value, required, maxChars) => ({ ...text(value, required, maxChars), perLine: undefined });
s.hero.slots.letter = { ...verbatim(600, 12), desc: "확인한 원문의 오프닝 레터. 서버가 원문 그대로 채우므로 AI는 비워 둔다." };
s.article = section("기사 본문", "확인한 원고의 본문 단락만. 서버가 확인 데이터로 채우므로 AI는 선택하지 않는다.", {
  lead: { ...verbatim(800, 16), default: "리드 문단을 입력하세요" },
  items: { type: "items", minItems: 0, maxItems: 6, required: false, fields: {
    heading: plain("소제목", true, 80),
    body: { ...verbatim(800, 16), optional: true },
  }, default: [{ heading: "소제목", body: "본문을 입력하세요" }] },
  href: { ...plain("", false, 1200), format: "url" },
});
s.article.slots.title = { ...s.article.slots.title, type: "multiline", maxLines: 2, perLine: undefined };
s.programs = section("프로그램 카드", "확인한 개별 행사·프로그램만. 서버가 확인 데이터로 채우므로 AI는 선택하지 않는다.", {
  intro: verbatim(400, 8),
  items: { type: "items", minItems: 1, maxItems: 4, required: true, fields: {
    title: plain("프로그램 이름", true, 100),
    oneLiner: { ...verbatim(200, 3), optional: true },
    body: { ...verbatim(800, 16), optional: true },
    date: { ...plain("", false, 100), optional: true },
    time: { ...plain("", false, 100), optional: true },
    location: { ...plain("", false, 100), optional: true },
    audience: { ...verbatim(300, 5), optional: true },
    format: { ...verbatim(300, 5), optional: true },
    cta: { ...plain("", false, 40), optional: true },
    href: { ...plain("", false, 1200), format: "url", optional: true },
  }, default: [{ title: "프로그램 이름", oneLiner: "한 줄 소개를 입력하세요", body: "소개 내용을 입력하세요", date: "날짜 입력", time: "", location: "장소 입력", audience: "대상 입력", format: "", cta: "신청하기", href: "" }] },
});
s.customerStories.slots.intro = verbatim(400, 8);
s.customerStories.slots.items.maxItems = 6;
s.customerStories.slots.items.fields.title.perLine = undefined;
// One configurable card module replaces the picker entries for steps and customerStories (2026-09-16).
// Column count is the layout choice; numbers is a second variant axis; image/link/caption are optional per card.
const urlField = () => ({ ...text("", false, 1200), format: "url", optional: true, perLine: undefined });
const imageField = () => ({ ...text("", false, 1200), format: "image", optional: true, perLine: undefined });
const cardDefault = title => ({ title, kicker: "", body: "카드 내용을 입력하세요", image: "", brand: "none", tag: "", num: "",
  date: "", time: "", location: "", audience: "", format: "", hashtags: [], source: "", href: "", cta: "" });
s.card = section("카드", "같은 형식의 항목 묶음(사례·단계·수치·제품·프로그램·로고). 열 수는 layout(col1/col2/col3), 로고 목록은 logo, 헤드라인 수치 하나는 banner, 순서 있는 절차는 numbers=on. 묶음이 둘 이상이면 card:2, card:3 키로 추가한다. 사례·수치·링크·이미지는 브리핑에 있는 것만 쓴다.", {
  layout: layout(["col1", "col2", "col3", "logo", "banner"], ["1열", "2열", "3열", "로고 격자 (3열, 작은 이미지)", "큰 숫자 배너 (1열, 테두리 없음)"]),
  numbers: { ...layout(["off", "on"], ["없음", "1, 2, 3 번호"]), label: "번호", desc: "순서가 있는 단계·절차면 on, 아니면 off." },
  intro: verbatim(400, 8),
  items: { type: "items", minItems: 1, maxItems: 8, required: true, fields: {
    title: plain("카드 제목", true, 60),
    kicker: { ...verbatim(200, 3), optional: true, desc: "한 줄 소개·질문형 헤드라인. 없으면 생략." },
    body: { ...verbatim(2000, 50), optional: true, desc: "카드 설명 2~3문장. 없으면 생략." },
    image: imageField(),
    brand: { enum: Object.keys(schema.brands), optional: true, desc: brandDesc("카드 제목") },
    tag: { ...plain("", false, 24), optional: true, desc: "작은 라벨(대상·분야). 없으면 생략." },
    num: { ...plain("", false, 12), optional: true, desc: "큰 숫자(단위·화살표 포함, 예: 31%↑). 브리핑에 있는 수치 토큰만." },
    graphic: { type: "graphic", optional: true, desc: "브리핑에 실제 수치가 있을 때만. percent는 0~100의 value. bars/beforeAfter는 label/value 2개와 공통 unit. 숫자가 없는 경우 생략." },
    date: { ...plain("", false, 100), optional: true, desc: "일시. 원문 표현 그대로." },
    time: { ...plain("", false, 100), optional: true, desc: "시간. 원문 표현 그대로." },
    location: { ...plain("", false, 100), optional: true, desc: "장소. 원문 표현 그대로." },
    audience: { ...verbatim(300, 5), optional: true, desc: "대상. 원문 표현 그대로." },
    format: { ...verbatim(300, 5), optional: true, desc: "구성·형식. 원문 표현 그대로." },
    hashtags: { type: "list", minItems: 0, maxItems: 3, itemMaxChars: 14, optional: true, desc: "#해시태그 최대 3개. 없으면 빈 배열." },
    source: { ...plain("", false, 60), optional: true, desc: "출처 표기(예: 출처: 금융위원회 보도자료). 없으면 생략." },
    href: urlField(),
    cta: { ...plain("", false, 24), optional: true, desc: "버튼 문구. href가 있을 때만. 비우면 '자세히 보기'." },
  }, default: [cardDefault("첫 번째 카드"), cardDefault("두 번째 카드"), cardDefault("세 번째 카드")] },
});
s.card.multi = true; // several instances per document: card, card:2, card:3 (see web/src/lib/sectionKeys.js)
// Deprecated: kept in the schema and markup so saved drafts still render and edit; hidden from the picker, the AI tool and thumbnails.
s.steps.deprecated = true;
s.customerStories.deprecated = true;
s.stats.deprecated = true;
s.productCards.deprecated = true;
s.programs.deprecated = true;
s.logoGrid.deprecated = true;
s.bignumber.deprecated = true;
// Slots that applyReview fills with confirmed source text: width warnings would otherwise be unrepairable.
s.stats.slots.items.fields.cap = { ...s.stats.slots.items.fields.cap, maxChars: 40, maxLines: 3, perLine: undefined };
s.stats.slots.items.fields.title = { ...s.stats.slots.items.fields.title, optional: true };
s.stats.slots.items.fields.story = { ...s.stats.slots.items.fields.story, maxChars: 200, maxLines: 5, perLine: undefined, optional: true };
s.quotes.slots.items.fields.quote = { ...s.quotes.slots.items.fields.quote, maxChars: 300, maxLines: 6, perLine: undefined };
s.quotes.slots.items.fields.name.maxChars = 40;
s.quotes.slots.items.fields.role.maxChars = 40;
s.footer.slots.headline = { ...s.footer.slots.headline, maxChars: 100, maxLines: 3, perLine: undefined };
s.footer.slots.leftNote = { ...s.footer.slots.leftNote, maxChars: 300, maxLines: 6, perLine: undefined };
// Every module except the hero (image) and the info strip (dark) gets a background toggle: on = theme tint gradient, off = white.
// Defaults reproduce today's look so saved drafts do not change.
const TINTED_BY_DEFAULT = new Set(["quotes", "programs", "footer", "bignumber"]);
for (const [name, def] of Object.entries(s)) {
  if (["hero", "infobar"].includes(name)) continue;
  def.slots.background = { type: "toggle", label: "배경 그라디언트", default: TINTED_BY_DEFAULT.has(name) ? "on" : "off",
    desc: "섹션 배경. on이면 테마 틴트 그라디언트, off면 흰색. 강조할 섹션 1~2개에만 on, 연속한 두 섹션을 모두 on으로 하지 않는다." };
}
// Editor samples are neutral instructions, never real claims or contact information.
s.hero.slots.title.default = "행사 제목을 입력하세요";
s.hero.slots.paragraphs.default = ["행사 소개를 입력하세요"];
s.hero.slots.badges.default = ["핵심 안내"];
s.values.slots.title.default = "참여하면 얻는 가치";
s.values.slots.cards.default = [{ title: "핵심 가치", sub: "구체적인 내용을 입력하세요" }, { title: "다음 가치", sub: "구체적인 내용을 입력하세요" }];
s.qualify.slots.title.default = "상세 정보";
s.qualify.slots.condition.default = "";
s.qualify.slots.groups.default = [{ brand: "none", name: "정보", headers: ["항목", "내용"], highlightCol: -1, rows: [["항목", "내용"]] }];
s.about.slots.title.default = "소개";
s.about.slots.bullets.default = ["소개 내용을 입력하세요", "추가 내용을 입력하세요"];
s.about.slots.photoAlt.default = "소개 이미지";
s.about.slots.pills.default = [{ main: "주요 내용", sub: "" }, { main: "추가 내용", sub: "" }];
s.agenda.slots.items.default = [{ title: "첫 세션", desc: "", speaker: "" }, { title: "다음 세션", desc: "", speaker: "" }];
s.steps.slots.items.default = [{ title: "요구사항", sub: "목표를 정리하세요" }, { title: "설계", sub: "접근 방식을 정하세요" }, { title: "실행", sub: "할 일을 정하세요" }];
s.stats.slots.items.default = [{ num: "수치 입력", cap: "지표 이름", title: "지표 설명", story: "" }, { num: "수치 입력", cap: "지표 이름", title: "지표 설명", story: "" }];
s.quotes.slots.items.default = [{ quote: "인용문을 입력하세요", name: "이름", role: "" }];
s.infobar.slots.cells.default = [{ label: "일시", value: "일시 입력" }, { label: "장소", value: "장소 입력" }];
s.productCards.slots.items.default = [{ brand: "none", name: "제품 이름", audience: "대상", question: "핵심 메시지를 입력하세요", desc: "소개 내용을 입력하세요", hashtags: ["주요 특징", "추가 특징"], href: "" }];
s.bignumber.slots.big.default = "수치 입력";
for (const [key,rule] of Object.entries(s.bignumber.slots)) {
  if (key !== "big" && ["text","multiline"].includes(rule.type)) rule.default = key === "eyebrow" ? "Highlights" : "내용을 입력하세요";
}
for (const [key,rule] of Object.entries(s.footer.slots)) {
  if (["text","multiline"].includes(rule.type)) rule.default = ["contactLines","contactEmail","leftNote","href","image"].includes(key) ? "" : key === "cta" ? "자세히 보기" : "다음 단계를 안내하세요";
}
s.footer.slots.contactLines.required = false;
s.agenda.slots.items.fields.desc.optional = true;
s.footer.slots.leftNote.required = false;
s.qualify.slots.groups.fields.headers.minItems = 2;
schema.imageSlots.photo.default = "";
s.footer.slots.bullets.default = ["다음 단계를 입력하세요"];
// Editor names describe the form; flyer headings come from SECTION_CATALOG.heading. Saved document text is untouched.
for (const [name, info] of Object.entries(SECTION_CATALOG)) s[name].label = info.label;
// Neutral section headings throughout.
for (const [name,def] of Object.entries(s)) {
  if (def.slots.eyebrow) def.slots.eyebrow.default = {hero:"",values:"Value offering",qualify:"Details",about:"About",agenda:"Agenda",steps:"How it works",timeline:"Timeline",stats:"Highlights",quotes:"Testimonials",infobar:"Information",productCards:"Products",bignumber:"Highlights",footer:"Next step",customerStories:"Customer stories",logoGrid:"Partners",article:"Feature",programs:"Programs",card:"Highlights"}[name];
  if (def.slots.title && !["hero","values","qualify","about"].includes(name)) def.slots.title.default = SECTION_CATALOG[name].heading;
}
for (const id of VARIANT_IDS) schema.imageSlots.heroBg.presets[`hero-${id}`] = `assets/hero-${id}.jpg`;
schema.imageSlots.heroBg.default = `hero-${theme.defaultVariant}`;
schema.combos = schema.combos.map(c => c.replace("agenda vs steps", "agenda vs card").replace("values vs productCards", "values vs card"));
schema.combos.push("사례·단계·특징처럼 같은 형식의 항목은 card(열 수는 layout, 순서면 numbers=on). 명시된 제품·기관 로고 목록은 card layout=logo, 헤드라인 수치 하나는 card layout=banner. 없는 자료는 만들지 않는다.");
schema.combos.push("기사형 원고의 본문 단락은 article. 개별 행사·프로그램, 수치 카드, 고객 사례는 확인 데이터에서 서버가 card 묶음(card, card:2, card:3)으로 조립하므로 AI는 고르지 않는다.");
writeFileSync(join(THEME_DIR, "schema.v2.json"), JSON.stringify(schema, null, 2) + "\n");
console.log(`[${THEME}] schema.v2.json 생성`);
