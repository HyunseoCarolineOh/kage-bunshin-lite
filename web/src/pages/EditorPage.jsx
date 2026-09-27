import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import PreviewFrame, { isPlaceholderText } from "../components/PreviewFrame.jsx";
import { schema, assemblePreview, assembleExport, assembleEmailCopy } from "../lib/template.js";
import { clone, normalizeSpec, setAtPath } from "../lib/spec.js";
import { THEMES, DEFAULT_THEME_ID, changeTheme } from "../lib/themes.js";
import { loadFlyer, saveFlyer, saveFlyerKeepalive } from "../lib/api.js";

const safeFileName = (title) => (title || "edm").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "edm";

/** 원고에 없어 '추후 안내'로 채워진 칸의 경로(data-slot 형식: hero.title, infobar.cells.0.value …) */
function placeholderPaths(spec) {
  const out = [];
  (function walk(node, path) {
    if (typeof node === "string") { if (isPlaceholderText(node)) out.push(path); }
    else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) { if (k !== "on") walk(v, path ? `${path}.${k}` : k); }
  })(spec?.sections || {}, "");
  return out;
}

export default function EditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const specRef = useRef(location.state?.spec ? normalizeSpec(location.state.spec, schema) : null);
  const briefRef = useRef(location.state?.brief || "");
  const saveTimer = useRef(null);
  const dirtyRef = useRef(false);

  const [html, setHtml] = useState(() => (specRef.current ? assemblePreview(specRef.current) : null));
  const [ready, setReady] = useState(!!specRef.current);
  const [error, setError] = useState("");
  const [warnings] = useState(location.state?.warnings || []);
  const [showWarnings, setShowWarnings] = useState(false);
  const [saveState, setSaveState] = useState({ kind: "", text: "" });
  const [note, setNote] = useState("");
  const [title, setTitle] = useState(specRef.current?.meta?.docTitle || "");
  const [flash, setFlash] = useState(null);
  const placeholders = ready ? placeholderPaths(specRef.current) : [];

  useEffect(() => {
    if (specRef.current) {
      // 생성 직후 넘어온 state는 1회용 — 남겨두면 새로고침 때 서버 대신 옛 스펙을 복원한다
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    loadFlyer(id)
      .then((d) => {
        specRef.current = normalizeSpec(d.spec, schema);
        briefRef.current = d.brief || "";
        setHtml(assemblePreview(specRef.current));
        setTitle(specRef.current.meta?.docTitle || "");
        setThemeId(specRef.current.meta?.themeId || "general");
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = useCallback(() => ({ spec: specRef.current, brief: briefRef.current }), []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState({ kind: "pending", text: "저장 대기…" });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveFlyer(id, payload());
        dirtyRef.current = false;
        setSaveState({ kind: "ok", text: `저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` });
      } catch (e) {
        setSaveState({ kind: "error", text: `저장 실패: ${e.message}` });
      }
    }, 2000);
  }, [id, payload]);

  // 디바운스가 돌기 전 이탈해도 편집을 잃지 않게 — 최선 시도 저장
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) saveFlyerKeepalive(id, payload()); };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [id, payload]);

  const onTextEdit = (path, text) => {
    const next = clone(specRef.current);
    setAtPath(next, path, text);
    specRef.current = next;
    setHtml(assemblePreview(next));
    setTitle(next.meta?.docTitle || "");
    scheduleSave();
  };

  // 테마는 AI가 고르지 않고 여기서 바꾼다 (2026-09-25). 배경·장식 이미지도 테마를 따라간다.
  const [themeId, setThemeId] = useState(specRef.current?.meta?.themeId || DEFAULT_THEME_ID);
  const onTheme = (id) => {
    const next = clone(specRef.current);
    changeTheme(next, id);
    specRef.current = next;
    setThemeId(id);
    setHtml(assemblePreview(next));
    scheduleSave();
  };

  const download = async () => {
    try {
      const snapshot = clone(specRef.current);
      const out = await assembleExport(snapshot);
      const blob = new Blob([out], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeFileName(snapshot.meta?.docTitle)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setNote(`HTML 파일을 내려받았어요. 이미지가 파일 안에 들어 있어 어디서 열어도 같게 보여요.${placeholders.length ? ` 단, '추후 안내'로 남은 칸이 ${placeholders.length}개 있어요.` : ""}`);
    } catch (e) {
      setNote(`내려받기 실패: ${e.message}`);
    }
  };

  const copyHtml = async () => {
    try {
      const out = await assembleEmailCopy(clone(specRef.current));
      const item = new ClipboardItem({
        "text/html": new Blob([out], { type: "text/html" }),
        "text/plain": new Blob([out], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      setNote(`HTML을 복사했어요. Outlook·Gmail 새 메일 본문에 붙여 넣으세요.${placeholders.length ? ` 단, '추후 안내'로 남은 칸이 ${placeholders.length}개 있어요.` : ""}`);
    } catch (e) {
      setNote(`복사 실패: ${e.message}`);
    }
  };

  if (error) {
    return (
      <div className="home"><div className="home-card">
        <p className="error">{error}</p>
        <Link to="/">← 처음으로</Link>
      </div></div>
    );
  }
  if (!ready) return <div className="loading">초안을 불러오는 중…</div>;

  return (
    <div className="editor">
      <div className="topbar">
        <Link to="/">← 새로 만들기</Link>
        <div className="topbar-title" title={title}>{title || "제목 없음"}</div>
        <span className={`save-state${saveState.kind ? ` is-${saveState.kind}` : ""}`}>{saveState.text}</span>
        <div className="topbar-actions">
          <div className="theme-picker" title="테마 색 바꾸기">
            {Object.values(THEMES).map((t) => (
              <button key={t.id} className={`theme-dot${themeId === t.id ? " is-on" : ""}`} style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.end})` }}
                title={t.label} aria-label={`테마 ${t.label}`} onClick={() => onTheme(t.id)} />
            ))}
          </div>
          {placeholders.length > 0 && (
            <button className="btn-ghost fill-hint" title="원고에 없어 '추후 안내'로 채운 칸 — 눌러서 첫 칸으로 이동"
              onClick={() => setFlash({ path: placeholders[0], at: Date.now() })}>채울 칸 {placeholders.length}</button>
          )}
          {warnings.length > 0 && (
            <button className="btn-ghost" onClick={() => setShowWarnings((v) => !v)}>AI 경고 {warnings.length}</button>
          )}
          <button className="btn-ghost" onClick={copyHtml}>HTML 복사</button>
          <button className="btn-primary" onClick={download}>HTML 내려받기</button>
        </div>
      </div>
      {showWarnings && (
        <ul className="warnings">
          {warnings.map((w, i) => <li key={i}><code>{w.path}</code> — {w.msg}</li>)}
        </ul>
      )}
      {note && <div className="note-bar">{note}</div>}
      <div className="editor-body">
        <PreviewFrame
          html={html}
          schema={schema}
          onTextEdit={onTextEdit}
          onImageClick={() => setNote("필수판에서는 이미지 교체를 지원하지 않아요. 템플릿 기본 이미지가 쓰입니다.")}
          flash={flash}
        />
      </div>
      <p className="tip editor-tip">글자를 클릭해 고치세요. Enter로 확정, Esc로 취소. 고치면 2초 뒤 자동 저장돼요. 이 주소로 다시 열 수 있어요.</p>
    </div>
  );
}
