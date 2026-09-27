/**
 * 조립기 — 템플릿 HTML + 스펙 JSON → 완성 플라이어 HTML.
 *
 * 원칙: 디자인(스타일)은 template.html이 단일 소스. 이 파일은 글·이미지를
 * 정해진 자리(data-slot 계열)에 기계적으로 끼워 넣기만 한다.
 * 모든 텍스트는 textNode로 삽입 — AI/사용자 입력이 마크업으로 해석될 수 없다.
 *
 * 반복 규약 (모듈 추가 시 조립기 수정 없이 동작):
 *   data-repeat="abs.path"  — 배열 항목 프로토타입. data-gap(마지막 항목 여백 제거),
 *                             data-num(자동 번호), item.brand(브랜드 워드마크·아이콘) 지원
 *   data-repeat-row="abs.path" — 한 행 안에서 [data-spacer]를 사이에 끼우며 반복.
 *                             셀 프로토는 data-repeat="." (상대)
 *   상대 경로(".", ".field")는 항목 확장 때 절대화된다. 중첩 프로토 내부는 건드리지 않아
 *   다음 확장 라운드가 처리한다 (예: productCards 항목 속 .hashtags)
 *   data-optional은 빈 문자열·null·빈 배열이면 요소를 지운다. data-prune-empty 표는 td가 하나도 없으면 지운다.
 *   multi 모듈(schema.sections[x].multi)은 card:2 같은 인스턴스 키로 여러 번 놓인다: 0단계가 base 행을 복제하고
 *   절대 경로 접두사(card. → card:2.)를 바꾼다. 스키마 조회는 sectionBase(key)로 한다.
 *
 * 환경 독립: DOM 구현을 `parse` 인자로 주입받는다.
 *   브라우저: (html) => new DOMParser().parseFromString(html, 'text/html')
 *   Node 테스트: linkedom의 parseHTML
 *
 * mode:
 *   'preview' — data-* 속성 유지(클릭 편집기가 사용), Pretendard 웹폰트 링크 주입
 *   'export'  — data-* 전부 제거, 폰트 링크 없음 (이메일 안전 상태 그대로)
 */

import { finishDesignV2, V2_RELATIVE_ATTRS } from "./designV2.js";
import { sectionBase, instanceKeysIn } from "./sectionKeys.js";
import { safeLink } from "./themes.js";

// Fallback only — the theme's tokens.json (font.stack) is passed in through opts.fontStack.
const DEFAULT_FONT_STACK =
  "'Pretendard','Segoe UI','Malgun Gothic','맑은 고딕',sans-serif";

const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";

/** spec 경로 해석: "meta.docTitle" | "hero.title" | "values.cards.1.sub" */
export function resolvePath(spec, path) {
  const segs = path.split(".");
  let cur = segs[0] === "meta" || segs[0] === "images" ? spec : spec.sections;
  for (const seg of segs) {
    if (cur == null) return undefined;
    cur = cur[/^\d+$/.test(seg) ? Number(seg) : seg];
  }
  return cur;
}

function setMultiline(doc, el, text) {
  while (el.firstChild) el.removeChild(el.firstChild);
  const lines = String(text ?? "").split("\n");
  lines.forEach((line, i) => {
    if (i > 0) el.appendChild(doc.createElement("br"));
    el.appendChild(doc.createTextNode(line));
  });
}

const REL_ATTRS = [...V2_RELATIVE_ATTRS, "data-slot", "data-optional", "data-bullets", "data-pill-rows", "data-repeat", "data-repeat-row"];
/** 절대 섹션 경로를 담는 속성 (인스턴스 행 복제 때 접두사를 바꾼다; data-variant는 값 형식이 달라 별도 처리) */
const PATH_ATTRS = [...REL_ATTRS, "data-slot-email", "data-slot-alt", "data-hub"];

/**
 * 클론 내부의 상대 경로(".", ".title")를 절대 경로로 다시 쓴다.
 * 중첩 프로토(data-repeat/-row를 가진 자식)는 자기 경로 속성만 절대화하고
 * 내부는 보존한다 — 다음 확장 라운드에서 처리된다.
 */
function rewriteRelativeSlots(rootEl, itemPath) {
  const rewrite = (el) => {
    for (const a of REL_ATTRS) {
      const p = el.getAttribute && el.getAttribute(a);
      if (p && p.startsWith(".")) el.setAttribute(a, p === "." ? itemPath : itemPath + p);
    }
  };
  rewrite(rootEl);
  const walk = (el) => {
    for (const child of [...el.children]) {
      const nestedProto = child.hasAttribute("data-repeat") || child.hasAttribute("data-repeat-row");
      if (nestedProto) {
        // 중첩 원형은 반복 경로만 절대화한다. 자기 슬롯(".")은 다음 라운드에서 항목 경로로 바뀐다.
        for (const a of ["data-repeat", "data-repeat-row"]) {
          const p = child.getAttribute(a);
          if (p && p.startsWith(".")) child.setAttribute(a, p === "." ? itemPath : itemPath + p);
        }
        continue;
      }
      rewrite(child);
      walk(child);
    }
  };
  walk(rootEl);
}

/** 프로토타입 요소를 items 개수만큼 복제. fill(clone, item, idx) 후 프로토 제거 */
function expandRepeat(proto, items, fill) {
  const parent = proto.parentNode;
  for (let i = 0; i < items.length; i++) {
    const clone = proto.cloneNode(true);
    clone.removeAttribute("data-repeat");
    fill(clone, items[i], i);
    parent.insertBefore(clone, proto);
  }
  parent.removeChild(proto);
}

/** 필/배지/셀처럼 [spacer?, item] 프로토가 든 행: item×n, 사이에 spacer(없으면 촘촘히) */
function expandRowItems(proto, spacer, items, fill) {
  if (spacer) spacer.parentNode.removeChild(spacer);
  const parent = proto.parentNode;
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && spacer) parent.insertBefore(spacer.cloneNode(true), proto);
    const clone = proto.cloneNode(true);
    clone.removeAttribute("data-repeat");
    fill(clone, items[i], i);
    parent.insertBefore(clone, proto);
  }
  parent.removeChild(proto);
}

/** 첫/마지막 항목만 다른 스타일 (타임라인 선을 끝에서 멈추는 용도 등) */
function applyIndexStyles(clone, i, n) {
  const els = [clone, ...clone.querySelectorAll("[data-if-first-style], [data-if-last-style]")];
  for (const el of els) {
    const first = el.getAttribute && el.getAttribute("data-if-first-style");
    const last = el.getAttribute && el.getAttribute("data-if-last-style");
    if (first != null) {
      if (i === 0) el.setAttribute("style", first);
      el.removeAttribute("data-if-first-style");
    }
    if (last != null) {
      if (i === n - 1) el.setAttribute("style", last);
      el.removeAttribute("data-if-last-style");
    }
  }
}

function appendStyle(el, css) {
  const cur = el.getAttribute("style") || "";
  el.setAttribute("style", cur.trim().replace(/;?$/, ";") + " " + css);
}

/** 브랜드 워드마크 색·아이콘 적용 — qualify 표 그룹과 productCards가 공유 */
function applyBrand(scope, brand, images, altName) {
  const wordmark = scope.querySelector("[data-brand-wordmark]");
  if (wordmark)
    wordmark.setAttribute("style", `${wordmark.getAttribute("data-base-style")} ${brand.wordmarkCss}`);
  const iconCell = scope.querySelector("[data-brand-icon-cell]");
  if (iconCell) {
    if (brand.icon && images.icons[brand.icon]) {
      const img = iconCell.querySelector("[data-brand-icon]");
      img.setAttribute("src", images.icons[brand.icon]);
      img.setAttribute("alt", altName || "");
    } else {
      iconCell.parentNode.removeChild(iconCell);
    }
  }
}

function fillBullets(doc, el, path, items) {
  const dotProto = el.querySelector("span");
  while (el.firstChild) el.removeChild(el.firstChild);
  items.forEach((text, i) => {
    if (i > 0) el.appendChild(doc.createElement("br"));
    el.appendChild(dotProto.cloneNode(true));
    el.appendChild(doc.createTextNode("  "));
    const span = doc.createElement("span");
    span.setAttribute("data-slot", `${path}.${i}`);
    span.appendChild(doc.createTextNode(text));
    el.appendChild(span);
  });
  el.removeAttribute("data-bullets");
}

const isAbs = (p) => p && !p.startsWith(".");

/**
 * @param {string} templateHtml
 * @param {object} spec        — { meta, sections, images }
 * @param {object} schema      — templates/<id>/schema.json
 * @param {object} opts
 * @param {(html:string)=>Document} opts.parse
 * @param {'preview'|'export'} opts.mode
 * @param {object} opts.images — 해석 완료된 src 문자열 { heroBg, logo, photo, icons: {아이콘id: src} }
 * @param {string} [opts.fontStack] — 내보내기 때 글자 요소에 박는 폰트 스택 (테마 tokens.json의 font.stack)
 * @returns {string} html
 */
export function assemble(templateHtml, spec, schema, { parse, mode = "preview", images, fontStack = DEFAULT_FONT_STACK }) {
  const doc = parse(templateHtml);

  // --- 0. 인스턴스 행 복제 — multi 모듈(card:2 …)은 base 행을 복제하고 경로 접두사를 바꾼다 ---
  for (const key of instanceKeysIn(spec.sections, schema)) {
    const base = sectionBase(key);
    const baseRow = doc.querySelector(`[data-section="${base}"]`);
    if (!baseRow || doc.querySelector(`[data-section="${key}"]`)) continue;
    const row = baseRow.cloneNode(true);
    row.setAttribute("data-section", key);
    let anchor = baseRow;
    while (anchor.nextElementSibling && sectionBase(anchor.nextElementSibling.getAttribute("data-section") || "") === base) anchor = anchor.nextElementSibling;
    anchor.parentNode.insertBefore(row, anchor.nextSibling);
    for (const el of [row, ...row.querySelectorAll("*")]) {
      for (const a of PATH_ATTRS) {
        const v = el.getAttribute(a);
        if (v && (v === base || v.startsWith(`${base}.`))) el.setAttribute(a, key + v.slice(base.length));
      }
      const variant = el.getAttribute("data-variant");
      if (variant && variant.startsWith(`${base}.`)) el.setAttribute("data-variant", key + variant.slice(base.length));
    }
  }

  // --- 1. 섹션 on/off (tr 통째 제거) ---
  for (const tr of [...doc.querySelectorAll("[data-section]")]) {
    const name = tr.getAttribute("data-section");
    const secDef = schema.sections[sectionBase(name)];
    const sec = spec.sections[name];
    if (!secDef.required && (!sec || sec.on === false)) tr.parentNode.removeChild(tr);
  }

  // --- 1b. 섹션 재정렬 (spec.meta.sectionOrder — normalizeSpec이 완성해 주지만 방어적으로 보정) ---
  {
    const rows = new Map(
      [...doc.querySelectorAll("[data-section]")].map((tr) => [tr.getAttribute("data-section"), tr]),
    );
    if (rows.size > 1) {
      const requested = Array.isArray(spec.meta?.sectionOrder) ? spec.meta.sectionOrder : [];
      const seen = new Set();
      const order = [];
      for (const name of ["hero", ...requested.filter((n) => n !== "hero" && n !== "footer")]) {
        if (rows.has(name) && !seen.has(name)) { order.push(name); seen.add(name); }
      }
      for (const name of rows.keys()) {
        if (name !== "footer" && !seen.has(name)) { order.push(name); seen.add(name); }
      }
      if (rows.has("footer")) order.push("footer");
      const parent = rows.values().next().value.parentNode;
      for (const name of order) parent.appendChild(rows.get(name));
    }
  }

  // --- 1c. 레이아웃 변형 선택 — data-variant="path:value" 중 스펙 값과 일치하는 것만 남긴다 ---
  // 마무리 '버튼형'은 신청 링크가 있을 때만 뜻이 있다. 링크가 없으면 그리는 순간에만 '연락처형'으로 되돌린다(저장된 값은 그대로).
  const effectiveVariant = (path) => {
    const value = resolvePath(spec, path);
    if (path === "footer.layout" && value === "cta" && !safeLink(spec.sections?.footer?.href)) return "contact";
    return value;
  };
  for (const el of [...doc.querySelectorAll("[data-variant]")]) {
    const attr = el.getAttribute("data-variant");
    const idx = attr.lastIndexOf(":");
    const path = attr.slice(0, idx);
    const value = attr.slice(idx + 1);
    if (String(effectiveVariant(path)) === value) el.removeAttribute("data-variant");
    else if (el.parentNode) el.parentNode.removeChild(el);
  }

  // --- 2a. qualify.groups (비스포크 — 브랜드·머리글·행×셀·강조 열의 복합 구조) ---
  const groupProto = doc.querySelector('[data-repeat="qualify.groups"]');
  if (groupProto) {
    const firstStyle = groupProto.getAttribute("data-first-style");
    const groups = spec.sections.qualify.groups;
    expandRepeat(groupProto, groups, (clone, group, gi) => {
      clone.removeAttribute("data-first-style");
      if (gi === 0 && firstStyle) clone.setAttribute("style", firstStyle);

      applyBrand(clone, schema.brands[group.brand] || schema.brands.none, images, group.name);

      const table = clone.querySelector("[data-highlight-css]");
      const hlCss = table.getAttribute("data-highlight-css");
      const firstRowBg = table.getAttribute("data-first-row-bg");
      const hl = Number.isInteger(group.highlightCol) ? group.highlightCol : -1;

      const thProto = table.querySelector('[data-repeat=".headers"]');
      expandRepeat(thProto, group.headers, (th, _h, ci) => {
        if (ci === hl) appendStyle(th, hlCss);
        rewriteRelativeSlots(th, `qualify.groups.${gi}.headers.${ci}`);
      });

      const rowProto = table.querySelector('[data-repeat=".rows"]');
      expandRepeat(rowProto, group.rows, (tr, row, ri) => {
        if (ri === 0 && firstRowBg) tr.setAttribute("style", `background-color:${firstRowBg};`);
        const cellProto = tr.querySelector('[data-repeat="."]');
        expandRepeat(cellProto, row, (td, _c, ci) => {
          if (ci === hl) appendStyle(td, hlCss);
          rewriteRelativeSlots(td, `qualify.groups.${gi}.rows.${ri}.${ci}`);
        });
      });

      rewriteRelativeSlots(clone, `qualify.groups.${gi}`); // 남은 .name 등
    });
  }

  // --- 2b. 범용 반복 확장 — 절대 경로 프로토가 소진될 때까지 (중첩 대응) ---
  for (let guard = 0; guard < 10; guard++) {
    let changed = false;

    for (const row of [...doc.querySelectorAll("[data-repeat-row]")]) {
      const path = row.getAttribute("data-repeat-row");
      if (!isAbs(path)) continue;
      const proto = row.querySelector('[data-repeat="."]');
      const spacer = row.querySelector("[data-spacer]");
      const items = resolvePath(spec, path) || [];
      expandRowItems(proto, spacer, items, (clone, _item, i) => {
        applyIndexStyles(clone, i, items.length);
        rewriteRelativeSlots(clone, `${path}.${i}`);
      });
      row.removeAttribute("data-repeat-row");
      changed = true;
    }

    for (const proto of [...doc.querySelectorAll("[data-repeat]")]) {
      const path = proto.getAttribute("data-repeat");
      if (!isAbs(path)) continue;
      const items = resolvePath(spec, path) || [];
      const gap = proto.getAttribute("data-gap");
      expandRepeat(proto, items, (clone, item, i) => {
        if (gap) {
          clone.removeAttribute("data-gap");
          const wrapTd = clone.querySelector("td");
          wrapTd.setAttribute("style", i < items.length - 1 ? `padding-bottom:${gap};` : "");
        }
        const num = clone.querySelector("[data-num]");
        if (num) { num.textContent = num.getAttribute("data-num") === "pad2" ? String(i + 1).padStart(2, "0") : String(i + 1); num.removeAttribute("data-num"); }
        if (clone.querySelector("[data-brand-wordmark],[data-brand-icon-cell]")) {
          const brand = item && typeof item === "object" ? item.brand : null;
          applyBrand(clone, schema.brands[brand] || schema.brands.none, images, item?.name || item?.title);
        }
        applyIndexStyles(clone, i, items.length);
        rewriteRelativeSlots(clone, `${path}.${i}`);
      });
      changed = true;
    }

    if (!changed) break;
  }

  // --- 2c. 2개씩 줄바꿈 필 목록 (about.pills) ---
  for (const pillHost of [...doc.querySelectorAll("[data-pill-rows]")]) {
    const path = pillHost.getAttribute("data-pill-rows");
    const pills = resolvePath(spec, path) || [];
    const rowProto = pillHost.querySelector("[data-pill-row]");
    const rowGap = rowProto.getAttribute("data-row-gap") || "10px";
    const pillProto = rowProto.querySelector("[data-pill]");
    const spacerProto = rowProto.querySelector("[data-spacer]");
    const tr = pillProto.parentNode;
    tr.removeChild(pillProto);
    tr.removeChild(spacerProto);

    for (let start = 0, rowIdx = 0; start < pills.length; start += 2, rowIdx++) {
      const rowClone = rowProto.cloneNode(true);
      rowClone.removeAttribute("data-pill-row");
      rowClone.removeAttribute("data-row-gap");
      if (rowIdx > 0) rowClone.setAttribute("style", `margin-top:${rowGap};`);
      const rowTr = rowClone.querySelector("tr");
      pills.slice(start, start + 2).forEach((pill, k) => {
        const i = start + k;
        if (k > 0) rowTr.appendChild(spacerProto.cloneNode(true));
        const cell = pillProto.cloneNode(true);
        cell.removeAttribute("data-pill");
        if (!pill.sub) {
          const sub = cell.querySelector("[data-pill-sub]");
          sub.parentNode.removeChild(sub);
        } else {
          cell.querySelector("[data-pill-sub]").removeAttribute("data-pill-sub");
        }
        rewriteRelativeSlots(cell, `${path}.${i}`);
        rowTr.appendChild(cell);
      });
      pillHost.insertBefore(rowClone, rowProto);
    }
    pillHost.removeChild(rowProto);
    pillHost.removeAttribute("data-pill-rows");
  }

  // --- 3. 불릿 목록 ---
  for (const el of [...doc.querySelectorAll("[data-bullets]")]) {
    const path = el.getAttribute("data-bullets");
    fillBullets(doc, el, path, resolvePath(spec, path) || []);
  }

  // --- 4. 연락처 이메일 (없으면 앵커·줄바꿈 제거) ---
  const emailA = doc.querySelector("[data-slot-email]");
  if (emailA) {
    const email = resolvePath(spec, emailA.getAttribute("data-slot-email"));
    if (email) {
      emailA.setAttribute("href", `mailto:${email}`);
      emailA.textContent = email;
    } else {
      const br = doc.querySelector("[data-contact-email-br]");
      if (br) br.parentNode.removeChild(br);
      emailA.parentNode.removeChild(emailA);
    }
  }

  // --- 5. 선택 슬롯 (값 없으면 요소 제거) ---
  for (const el of [...doc.querySelectorAll("[data-optional]")]) {
    const v = resolvePath(spec, el.getAttribute("data-optional"));
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) el.parentNode.removeChild(el);
    else el.removeAttribute("data-optional");
  }
  // --- 5b. 빈 표 제거 (선택 행이 모두 빠진 메타 표) ---
  for (const el of [...doc.querySelectorAll("[data-prune-empty]")]) {
    if (!el.querySelector("td")) el.parentNode.removeChild(el);
    else el.removeAttribute("data-prune-empty");
  }

  // --- 6. 텍스트 슬롯 일괄 채움 (전부 절대 경로 상태) ---
  for (const el of [...doc.querySelectorAll("[data-slot]")]) {
    const v = resolvePath(spec, el.getAttribute("data-slot"));
    if (v == null) continue;
    if (String(v).includes("\n")) setMultiline(doc, el, v);
    else el.textContent = String(v);
  }

  // --- 7. 이미지 (src / alt / 배경) ---
  for (const el of [...doc.querySelectorAll("[data-slot-img]")]) {
    const key = el.getAttribute("data-slot-img").split(".")[1];
    if (images[key]) el.setAttribute("src", images[key]);
    const altPath = el.getAttribute("data-slot-alt");
    if (altPath) {
      const alt = resolvePath(spec, altPath);
      if (alt) el.setAttribute("alt", String(alt));
    }
  }
  for (const el of [...doc.querySelectorAll("[data-slot-bg]")]) {
    const key = el.getAttribute("data-slot-bg").split(".")[1];
    if (images[key]) {
      const style = el.getAttribute("style") || "";
      el.setAttribute("style", style.replace(/url\((['"]?)[^)]*\1\)/, `url('${images[key]}')`));
    }
  }

  if (spec.meta?.designVersion === 2) finishDesignV2(doc, spec, images, resolvePath);

  // --- 8. 마무리 ---
  // Preview and v2 exports load Pretendard in browsers so files match the editor; email clients ignore <link>. v1 exports stay byte-identical.
  if (mode === "preview" || spec.meta?.designVersion === 2) {
    const link = doc.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", PRETENDARD_CSS);
    doc.querySelector("head").appendChild(link);
  }
  if (mode !== "preview") {
    for (const el of [...doc.querySelectorAll("*")]) {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith("data-")) el.removeAttribute(attr.name);
      }
      // 이메일(Outlook Word 엔진)은 폰트 상속을 못 한다 — 글자 크기를 정한
      // 모든 요소에 폰트 스택을 직접 박는다 (이미 폰트를 명시한 요소는 유지)
      const style = el.getAttribute("style");
      if (style && style.includes("font-size") && !style.includes("font-family")) {
        appendStyle(el, `font-family:${fontStack};`);
      }
    }
  }

  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
}
