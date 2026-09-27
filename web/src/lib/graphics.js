/** Numeric charts have a single source: graphic data, never a second display value. */
export const GRAPHIC_KINDS = ["tiles", "percent", "bars", "beforeAfter"];
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const fmt = (n) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(n);

export function graphicErrors(g) {
  if (g == null) return [];
  if (!g || typeof g !== "object" || Array.isArray(g)) return ["그래픽 데이터 형식이 잘못되었습니다."];
  if (!GRAPHIC_KINDS.includes(g.kind)) return ["지원하지 않는 그래픽입니다."];
  if (g.kind === "tiles") return [];
  if (g.kind === "percent") return finite(g.value) && g.value >= 0 && g.value <= 100 ? [] : ["비율은 0~100 사이의 숫자여야 합니다."];
  const errors = [];
  if (!Array.isArray(g.values) || g.values.length !== 2) return ["비교에는 이름과 수치 두 개가 필요합니다."];
  if (g.values.some(v => !v || !finite(v.value) || v.value < 0)) errors.push("비교 수치는 음이 아닌 숫자여야 합니다.");
  if (g.values.some(v => !String(v?.label || "").trim())) errors.push("비교 항목의 이름을 입력하세요.");
  if (typeof g.unit !== "string" || !g.unit.trim()) errors.push("공통 단위를 입력하세요.");
  if (g.values.some(v => v?.unit != null && v.unit !== g.unit)) errors.push("비교 수치의 단위가 서로 다릅니다.");
  return errors;
}

export function graphicText(g, fallback = "") {
  if (!g || graphicErrors(g).length || g.kind === "tiles") return fallback;
  if (g.kind === "percent") return `${fmt(g.value)}%`;
  return g.values.map(v => `${fmt(v.value)}${g.unit}`).join(" → ");
}

export function graphicSvg(g, theme) {
  if (!g || graphicErrors(g).length) return "";
  const a = theme.accent, b = theme.end, bg = theme.chartBg;
  const defs = `<defs><linearGradient id="accent" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
  const text = (x, y, value, size = 12, anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#141920" font-family="Arial,sans-serif" font-size="${size}">${esc(value)}</text>`;
  let shapes;
  if (g.kind === "tiles") {
    shapes = [[72, 22], [134, 22], [72, 84], [134, 84]].map(([x,y], i) =>
      `<rect x="${x}" y="${y}" width="52" height="52" rx="5" fill="${i === 3 ? "url(#accent)" : bg}"/>`).join("");
  } else if (g.kind === "percent") {
    const length = 2 * Math.PI * 53;
    shapes = `<circle cx="130" cy="80" r="53" fill="none" stroke="${bg}" stroke-width="22"/>
      <circle cx="130" cy="80" r="53" fill="none" stroke="url(#accent)" stroke-width="22"
      stroke-dasharray="${length * g.value / 100} ${length}" transform="rotate(-90 130 80)"/>
      ${text(130, 88, `${fmt(g.value)}%`, 26)}`;
  } else {
    const [one, two] = g.values;
    const max = Math.max(one.value, two.value, 1);
    if (g.kind === "bars") {
      shapes = g.values.map((v, i) => {
        const h = 86 * v.value / max, x = 52 + i * 108;
        return `<rect x="${x}" y="${119-h}" width="48" height="${h}" rx="3" fill="${i ? "url(#accent)" : bg}"/>
          ${text(x+24, 109-h, `${fmt(v.value)}${g.unit}`)}${text(x+24, 141, v.label)}`;
      }).join("") + `<line x1="34" y1="120" x2="232" y2="120" stroke="${bg}"/>`;
    } else {
      shapes = [one, two].map((v, i) => {
        const y = 31 + i * 67;
        return `${text(12, y-8, `${v.label} · ${fmt(v.value)}${g.unit}`, 12, "start")}
          <rect x="12" y="${y}" width="236" height="22" rx="4" fill="${bg}"/>
          <rect x="12" y="${y}" width="${236*v.value/max}" height="22" rx="4" fill="url(#accent)"/>`;
      }).join("");
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160" viewBox="0 0 260 160">${defs}${shapes}</svg>`;
}

export const svgDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Browser-only export: 2x bitmap, with labels also retained as live HTML text. */
export async function svgToPng(svg) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("그래픽 이미지 변환에 실패했습니다."));
    img.src = svgDataUri(svg);
  });
  const canvas = document.createElement("canvas");
  // Keep each registered asset at twice its own size, including small icons.
  canvas.width = img.naturalWidth * 2; canvas.height = img.naturalHeight * 2;
  const context = canvas.getContext("2d");
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
