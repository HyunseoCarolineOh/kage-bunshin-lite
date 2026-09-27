import { useEffect, useRef, useState } from "react";
import { ruleForPath } from "../lib/schemaUtil.js";
import { weightedLen } from "../lib/validator.js";

/**
 * 미리보기 + 클릭 편집.
 * - srcdoc iframe(같은 출처)이라 contentDocument를 직접 조작한다.
 * - 글 수정은 iframe을 다시 그리지 않는다(스펙만 갱신) — 스크롤·포커스 유지.
 * - 확정은 blur 시점 (한글 IME 조합 중 깨짐 방지). Esc = 취소, Enter = 한 줄 슬롯 확정.
 */
const DOC_WIDTH = 690; // 640px 문서 + 여백. 이보다 좁은 화면에서는 프레임을 축소해 잘림 없이 보여준다.
/** AI는 브리핑에 없는 필수 칸을 정확히 '추후 안내'로 적는다(프롬프트 규칙). 그 칸을 채울 칸으로 본다. */
export const isPlaceholderText = (text) => /^추후 안내/.test(String(text || "").trim());
export default function PreviewFrame({ html, schema, onTextEdit, onImageClick, flash }) {
  const frameRef = useRef(null);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(width && width < DOC_WIDTH ? Math.round((width / DOC_WIDTH) * 1000) / 1000 : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const wire = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !doc.body || doc.body.dataset.kbWired) return;
    doc.body.dataset.kbWired = "1";

    const style = doc.createElement("style");
    style.textContent = [
      "[data-slot]:hover { outline: 2px dashed #7b00dd; outline-offset: 2px; cursor: text; }",
      "[data-slot].kb-editing { outline: 2px solid #7b00dd; outline-offset: 2px; }",
      "[data-slot].kb-over { outline: 2px solid #e5484d !important; }",
      "[data-slot-img]:hover, [data-slot-bg]:hover { outline: 2px dashed #33b9a3; outline-offset: -2px; cursor: pointer; }",
      ".kb-flash { outline: 3px solid #ff9900 !important; }",
      // 원고에 없어 '추후 안내'로 채운 칸 — 사용자가 알아채고 채우도록 노란 점선으로 표시한다
      "[data-slot].kb-placeholder { outline: 2px dashed #f0a020; outline-offset: 2px; background: rgba(255, 201, 67, 0.28); }",
    ].join("\n");
    doc.head.appendChild(style);
    for (const el of doc.querySelectorAll("[data-slot]")) {
      if (isPlaceholderText(el.innerText)) {
        el.classList.add("kb-placeholder");
        el.setAttribute("title", "원고에 없던 정보예요. 클릭해서 채워 주세요.");
      }
    }

    const startEdit = (el, path) => {
      if (el.isContentEditable) return;
      const rule = ruleForPath(schema, path) || {};
      const multiline = (rule.maxLines ?? 1) > 1;
      const orig = el.innerText;
      el.setAttribute("contenteditable", "true");
      el.classList.add("kb-editing");
      el.focus();

      const onInput = () => {
        const text = el.innerText.replace(/\n+$/, "");
        const plainLen = text.replace(/\n/g, "").length;
        const over =
          (rule.maxChars && plainLen > rule.maxChars) ||
          text.split("\n").length > (rule.maxLines ?? 1) ||
          (rule.perLine && text.split("\n").some((l) => weightedLen(l) > rule.perLine));
        el.classList.toggle("kb-over", !!over);
        el.setAttribute("title", rule.maxChars ? `${plainLen}자 / 최대 ${rule.maxChars}자` : `${plainLen}자`);
      };
      const onKey = (e) => {
        if (e.isComposing) return;
        if (e.key === "Enter" && !multiline) { e.preventDefault(); el.blur(); }
        if (e.key === "Escape") { el.innerText = orig; el.blur(); }
      };
      const onPaste = (e) => {
        e.preventDefault();
        doc.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      };
      const onBlur = () => {
        el.removeEventListener("input", onInput);
        el.removeEventListener("keydown", onKey);
        el.removeEventListener("paste", onPaste);
        el.removeEventListener("blur", onBlur);
        el.removeAttribute("contenteditable");
        el.classList.remove("kb-editing", "kb-over");
        el.removeAttribute("title");
        let text = el.innerText.replace(/\u00a0/g, " ").replace(/\n+$/, "");
        if (!multiline) text = text.replace(/\n/g, " ");
        text = text.replace(/[ \t]+$/gm, "");
        if (text !== orig) onTextEdit(path, text);
      };
      el.addEventListener("input", onInput);
      el.addEventListener("keydown", onKey);
      el.addEventListener("paste", onPaste);
      el.addEventListener("blur", onBlur);
    };

    for (const el of doc.querySelectorAll("[data-slot]")) {
      const path = el.getAttribute("data-slot");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startEdit(el, path);
      });
    }
    for (const el of doc.querySelectorAll("[data-slot-img], [data-slot-bg], [data-image-path]")) {
      const imagePath = el.getAttribute("data-image-path");
      const key = imagePath ? (imagePath.startsWith("images.") ? imagePath.split(".")[1] : `sections.${imagePath}`) : (el.getAttribute("data-slot-img") || el.getAttribute("data-slot-bg")).split(".")[1];
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onImageClick(key);
      });
    }
  };

  // srcdoc은 이미지가 다 내려오기 전(load 이벤트 전)에도 DOM은 준비된다 — 준비되는 즉시 편집 손잡이를 붙인다.
  // (운영에서 배경 이미지가 늦게 오면 그 전 클릭이 무시되던 문제. onLoad는 그대로 두어 늦게 준비되는 경우를 받는다.)
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      const doc = frameRef.current?.contentDocument;
      if (doc?.body && doc.readyState !== "loading" && doc.querySelector("[data-slot]") && !doc.body.dataset.kbWired) {
        wire();
        clearInterval(timer);
      } else if (++tries > 100) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  // QA 항목 클릭 → 해당 슬롯으로 스크롤 + 잠깐 강조
  useEffect(() => {
    if (!flash) return;
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const el =
      doc.querySelector(`[data-slot="${flash.path}"]`) ||
      doc.querySelector(`[data-slot^="${flash.path}"]`) ||
      doc.querySelector(`[data-section="${flash.path.split(".")[0]}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("kb-flash");
    const t = setTimeout(() => el.classList.remove("kb-flash"), 1500);
    return () => clearTimeout(t);
  }, [flash]);

  const scaled = scale < 1 ? { width: DOC_WIDTH, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "top left" } : undefined;
  return (
    <div ref={wrapRef} className="preview-wrap" data-scale={scale}>
      <iframe
        ref={frameRef}
        className="preview-frame"
        title="플라이어 미리보기"
        srcDoc={html || "<html><body></body></html>"}
        onLoad={wire}
        style={scaled}
      />
    </div>
  );
}
