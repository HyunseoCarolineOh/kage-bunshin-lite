/**
 * Sample theme descriptor — "Northwind Cloud", a fictional B2B cloud vendor's Korean newsletter.
 * Copy this folder to templates/<your-theme>/ and set THEME=<your-theme> (env or .env) to use your own brand.
 *
 * Contract read by the build scripts and the app:
 *   id, name            — theme id (folder name) and the display name shown on the home page
 *   defaultVariant      — variant the AI always emits; users switch variants in the editor
 *   variants[id]        — colour variant: label, accent, end (gradient end), tint, chartBg,
 *                         optional background (default hero-<id>) and keywords (regex sources for inferTheme)
 *   logoWhite           — preset id + file for the white logo used by the dark hero banner
 *   brandLabels         — official spelling of the product brands declared in schema.json → brands
 *   icons               — extra icon presets (merged into schema.v2.json → iconPresets)
 *   legacyBackgrounds   — old heroBg preset ids that should still follow variant changes (optional)
 *   sampleBrief         — the "예시 원고 넣기" text on the home page (optional)
 *
 * Asset naming convention (assets/): hero-<variant>.jpg (1280x569), hero-deco-<variant>.png (480x720),
 * plus whatever schema.json → imageSlots.*.presets / iconPresets and this file reference.
 */
export default {
  id: "sample",
  name: "Northwind Cloud",
  defaultVariant: "general",
  variants: {
    general: { label: "General", accent: "#1F5FBF", end: "#3B82F6", tint: "#EEF4FD", chartBg: "#D6E4FA" },
    ocean: { label: "Ocean", accent: "#0F766E", end: "#14B8A6", tint: "#ECFDF8", chartBg: "#CCF3EA", keywords: ["\\bstratus\\b", "스트라투스"] },
    sunset: { label: "Sunset", accent: "#C2410C", end: "#F97316", tint: "#FFF4EC", chartBg: "#FFE0CC", keywords: ["\\bcirrus\\b", "시러스"] },
    plum: { label: "Plum", accent: "#6D28D9", end: "#A78BFA", tint: "#F5F0FF", chartBg: "#E6DDFA", keywords: ["\\bnimbus\\b", "님버스"] },
  },
  logoWhite: { id: "logo-white", file: "assets/logo-white.png" },
  brandLabels: { nimbus: "Nimbus", stratus: "Stratus", cirrus: "Cirrus" },
  icons: { "icon-check": "assets/icon-check.png", "icon-settings": "assets/icon-settings.png", "icon-people": "assets/icon-people.png", "icon-chart": "assets/icon-chart.png" },
  sampleBrief: `Northwind Cloud 파트너 성장 세미나 안내

일시: 2026년 10월 15일(수) 14:00~17:00
장소: 서울 강남구 Northwind Cloud 세미나룸 (지하철 2호선 역 도보 5분)
대상: 클라우드 도입을 검토 중인 고객사 개발자·기획자 (선착순 40명)

프로그램
14:00 인사말과 Nimbus 소개
14:30 실습 1: Nimbus로 문서 요약 봇 만들기
15:30 휴식
15:45 실습 2: Stratus로 사내 데이터 연결하기
16:45 Q&A와 다음 단계 안내

참가 혜택: 실습용 크레딧 제공, 1:1 기술 상담 예약 가능
신청: https://example.com/register (10월 10일 마감)
문의: newsletter@example.com`,
};
