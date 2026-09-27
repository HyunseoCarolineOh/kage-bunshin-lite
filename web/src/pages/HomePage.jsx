import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateFlyer, saveFlyer } from "../lib/api.js";
import { schema } from "../lib/template.js";
import { THEME } from "../lib/themes.js";
import { normalizeSpec } from "../lib/spec.js";

// 예시 원고 — 가상의 회사·행사. 테마가 sampleBrief를 주면 그것을 쓴다.
const SAMPLE = THEME.sampleBrief || `생성형 AI 실습 세미나 안내

일시: 2026년 10월 15일(수) 14:00~17:00
장소: 서울 강남구 세미나룸 (지하철 2호선 역 도보 5분)
대상: 생성형 AI 도입을 검토 중인 고객사 개발자·기획자 (선착순 40명)

프로그램
14:00 인사말과 서비스 소개
14:30 실습 1: 문서 요약 봇 만들기
15:30 휴식
15:45 실습 2: 사내 데이터 연결하기
16:45 Q&A와 다음 단계 안내

참가 혜택: 실습용 크레딧 제공, 1:1 기술 상담 예약 가능
신청: https://example.com/register (10월 10일 마감)
문의: events@example.com`;

export default function HomePage() {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [busy]);

  const onGenerate = async () => {
    const text = brief.trim();
    if (text.length < 20) { setError("행사 내용을 몇 줄 더 적어 주세요 (20자 이상)."); return; }
    setError("");
    setBusy(true);
    setElapsed(0);
    try {
      const { spec: raw, warnings, model } = await generateFlyer(text);
      const spec = normalizeSpec(raw, schema);
      const id = crypto.randomUUID();
      // 첫 저장에만 AI 원본(aiSpec)을 함께 보낸다 — 이후 편집과 비교해 "얼마나 고쳤나"를 잰다
      await saveFlyer(id, { spec, brief: text, aiSpec: spec, model, generatedAt: new Date().toISOString() });
      navigate(`/editor/${id}`, { state: { spec, warnings, brief: text } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home">
      <div className="home-card">
        <h1>그림자 분신술<span className="badge">필수판</span></h1>
        <p className="home-sub">
          행사 내용을 적으면 {THEME.name} 스타일 eDM을 만들어 드려요. 디자인은 템플릿이 맡고 글만 AI가 씁니다.
          만든 뒤 글자를 클릭해 고치고, HTML로 가져가 메일에 붙이세요.
        </p>
        <textarea
          rows={14}
          value={brief}
          disabled={busy}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="행사 제목, 일시, 장소, 대상, 프로그램, 신청 링크, 문의처를 아는 대로 적어 주세요."
        />
        <div className="home-row">
          <button className="btn-primary" disabled={busy} onClick={onGenerate}>
            {busy ? `만드는 중… ${elapsed}초` : "eDM 만들기"}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => setBrief(SAMPLE)}>예시 원고 넣기</button>
          {busy && <span className="progress-line"><span className="progress-spinner" />보통 10~20초 걸려요</span>}
        </div>
        {error && <p className="error">{error}</p>}
        <p className="tip">날짜·장소·링크는 원고에 있는 것만 씁니다. 없는 내용은 빈칸으로 두고, 편집기에서 채우면 돼요.</p>
      </div>
    </div>
  );
}
