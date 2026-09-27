import { renderReviewedSections } from "./agendaRender.js";
import { themeFor, safeLink, safeImage } from "./themes.js";
import { graphicSvg, graphicText, svgDataUri, graphicErrors } from "./graphics.js";

export const V2_RELATIVE_ATTRS = ["data-link", "data-content-image", "data-image-cell", "data-icon", "data-graphic", "data-graphic-item", "data-metric", "data-graphic-caption"];

export function finishDesignV2(doc, spec, images, resolve) {
  renderReviewedSections(doc, spec);
  const theme = themeFor(spec);
  // Section background toggle: on = theme tint gradient, off = white. Hero (image) and infobar (dark strip) carry no toggle.
  for (const row of [...doc.querySelectorAll("[data-section]")]) {
    const sec = spec.sections?.[row.getAttribute("data-section")];
    const td = row.firstElementChild;
    if (!td || !sec || (sec.background !== "on" && sec.background !== "off")) continue;
    const rest = (td.getAttribute("style") || "").split(";").map(d => d.trim()).filter(d => d && !/^background(-color|-image|-size|-position)?\s*:/.test(d));
    const bg = sec.background === "on"
      ? [`background-color:${theme.tint}`, `background:linear-gradient(180deg,${theme.tint} 0%,#ffffff 100%)`]
      : ["background-color:#ffffff"];
    td.setAttribute("style", [...bg, ...rest].join("; ") + ";");
  }
  const make = (tag, attrs = {}) => {
    const el = doc.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };
  const table = () => make("table", { role: "presentation", width: "100%", cellpadding: "0", cellspacing: "0", style: "table-layout:fixed;width:100%;" });
  const cell = (node, width) => {
    const td = make("td", { valign: "top", width, style: "padding:8px;vertical-align:top;overflow-wrap:anywhere;" });
    if (node) td.appendChild(node);
    return td;
  };
  const GAP = 16;
  const isCard = node => !!node?.firstElementChild?.getAttribute("style")?.includes("border-radius");
  const parseStyle = str => Object.fromEntries((str || "").split(";").map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }));
  const serialize = obj => Object.entries(obj).map(([k, v]) => `${k}:${v};`).join(" ");
  const sides = value => { const p = (value || "0").split(/\s+/); return { top: p[0], right: p[1] ?? p[0], bottom: p[2] ?? p[0], left: p[3] ?? p[1] ?? p[0] }; };
  for (const host of [...doc.querySelectorAll("[data-grid]")]) {
    const cols = Number(host.getAttribute("data-grid"));
    const children = [...host.children];
    const grid = table();
    grid.setAttribute("style", "table-layout:fixed;width:100%;border-collapse:separate;border-spacing:0;");
    const colgroup = make("colgroup");
    for (let i = 0; i < cols; i++) { colgroup.appendChild(make("col")); if (i < cols - 1) colgroup.appendChild(make("col", { width: String(GAP), style: `width:${GAP}px;` })); }
    grid.appendChild(colgroup);
    const gapCell = () => make("td", { width: String(GAP), style: `width:${GAP}px;padding:0;font-size:0;line-height:0;` });
    for (let start = 0; start < children.length; start += cols) {
      if (start > 0) { const gapRow = make("tr"); const c = make("td", { colspan: String(cols * 2 - 1), height: String(GAP), style: `height:${GAP}px;padding:0;font-size:0;line-height:0;` }); gapRow.appendChild(c); grid.appendChild(gapRow); }
      const row = children.slice(start, start + cols);
      const feet = row.map(node => node && isCard(node) ? [...node.firstElementChild.children].find(c => c.hasAttribute("data-card-foot")) || null : null);
      const split = feet.some(Boolean);
      const bodyRow = make("tr"), footRow = split ? make("tr") : null;
      for (let i = 0; i < cols; i++) {
        const node = row[i];
        if (node && isCard(node)) {
          // Card styling moves onto the cell so every card in the row stretches to the same height.
          const card = node.firstElementChild;
          const style = parseStyle(card.getAttribute("style"));
          const dataAttrs = [...card.attributes].filter(a => a.name.startsWith("data-"));
          if (!split) {
            const td = make("td", { valign: "top", style: `${serialize(style)} vertical-align:top;overflow-wrap:anywhere;` });
            for (const a of dataAttrs) td.setAttribute(a.name, a.value);
            while (card.firstChild) td.appendChild(card.firstChild);
            bodyRow.appendChild(td);
          } else {
            // Two stacked cells share one card surface: the body row grows, the foot row keeps every button on the same line.
            const pad = sides(style.padding), radius = style["border-radius"] || "0", shadow = style["box-shadow"];
            const base = { ...style }; delete base.padding; delete base["border-radius"]; delete base["box-shadow"];
            const top = { ...base, "border-bottom": "0", "border-radius": `${radius} ${radius} 0 0`, padding: `${pad.top} ${pad.right} 0 ${pad.left}`, "vertical-align": "top", "overflow-wrap": "anywhere" };
            const bottom = { ...base, "border-top": "0", "border-radius": `0 0 ${radius} ${radius}`, padding: `0 ${pad.right} ${pad.bottom} ${pad.left}`, "vertical-align": "bottom", "overflow-wrap": "anywhere" };
            if (shadow) { top["box-shadow"] = shadow; top["clip-path"] = "inset(-40px -40px -8px -40px)"; bottom["box-shadow"] = shadow; bottom["clip-path"] = "inset(0 -40px -40px -40px)"; }
            const foot = feet[i];
            const td = make("td", { valign: "top", style: serialize(top) });
            for (const a of dataAttrs) td.setAttribute(a.name, a.value);
            const ft = make("td", { valign: "bottom", style: serialize(bottom) });
            while (card.firstChild) { const child = card.firstChild; if (child === foot) card.removeChild(child); else td.appendChild(child); }
            if (foot) { foot.removeAttribute("data-card-foot"); ft.appendChild(foot); }
            bodyRow.appendChild(td); footRow.appendChild(ft);
          }
        } else {
          bodyRow.appendChild(node ? cell(node, undefined) : make("td", { style: "padding:0;" }));
          if (split) footRow.appendChild(make("td", { style: "padding:0;" }));
        }
        if (i < cols - 1) { bodyRow.appendChild(gapCell()); if (split) footRow.appendChild(gapCell()); }
      }
      grid.appendChild(bodyRow);
      if (split) grid.appendChild(footRow);
    }
    host.replaceWith(grid);
  }
  for (const host of [...doc.querySelectorAll("[data-hub]")]) {
    const nodes = [...host.children];
    const grid = table();
    const center = make("div", { "data-slot": host.getAttribute("data-hub"), style: `border-radius:50%;padding:28px 8px;text-align:center;background-color:#ffffff;color:${theme.accent};border:1.5px solid ${theme.chartBg};box-shadow:0 6px 24px rgba(20,25,32,0.06);font-size:15px;font-weight:800;letter-spacing:-0.2px;word-break:keep-all;` });
    center.textContent = resolve(spec, host.getAttribute("data-hub")) || "핵심 가치";
    const arrangement = nodes.length === 2 ? [[null,nodes[0],null],[null,center,null],[null,nodes[1],null]]
      : [[null,nodes[0],null],[nodes[1],center,nodes[2]],[null,nodes[3],null]];
    for (const row of arrangement) {
      if (!row.some(Boolean)) continue;
      const tr = make("tr");
      for (const node of row) tr.appendChild(cell(node,"33.33%"));
      grid.appendChild(tr);
    }
    host.replaceWith(grid);
  }
  for (const el of [...doc.querySelectorAll("[data-link]")]) {
    const href = safeLink(resolve(spec, el.getAttribute("data-link")));
    if (href) {
      el.setAttribute("href", href);
      // A linked button with an empty caption slot falls back to the template caption (e.g. card.items[].cta).
      if (!el.textContent.trim() && el.hasAttribute("data-caption")) el.textContent = el.getAttribute("data-caption");
    } else {
      const parent = el.parentNode;
      el.remove();
      if (parent?.tagName === "DIV" && !parent.textContent.trim() && !parent.children.length) parent.remove();
    }
  }
  const imageAt = (path) => path.startsWith("images.") ? images[path.split(".")[1]] : images.extra?.[path] || safeImage(resolve(spec,path));
  for (const el of [...doc.querySelectorAll("[data-content-image]")]) {
    const path = el.getAttribute("data-content-image");
    const src = imageAt(path);
    if (src) {
      el.setAttribute("src", src);
      el.setAttribute("data-image-path", path);
    } else el.remove();
  }
  for (const el of [...doc.querySelectorAll("[data-image-cell]")])
    if (!imageAt(el.getAttribute("data-image-cell"))) el.remove();
  for (const el of [...doc.querySelectorAll("[data-icon]")]) {
    const kind = resolve(spec, el.getAttribute("data-icon"));
    const src = images.icons?.[`icon-${kind}`] || images.icons?.["icon-check"];
    if (el.tagName === "IMG" && src) { el.setAttribute("src", src); el.removeAttribute("data-icon"); }
    else el.textContent = ({check:"✓",settings:"⚙",people:"◎",chart:"▥"})[kind] || "✓";
  }
  for (const el of [...doc.querySelectorAll("[data-graphic]")]) {
    const g = resolve(spec, el.getAttribute("data-graphic"));
    const svg = graphicSvg(g, theme);
    if (!svg) { el.remove(); continue; }
    el.setAttribute("src", svgDataUri(svg));
    el.setAttribute("alt", graphicText(g, "지표 장식"));
  }
  for (const el of [...doc.querySelectorAll("[data-metric]")]) {
    const path = el.getAttribute("data-metric");
    const item = resolve(spec,path) || {};
    const metric = graphicText(item.graphic,item.num);
    if (!metric) { el.remove(); continue; } // neither a number nor a graphic: no empty line
    el.textContent = metric;
    if (!item.graphic || item.graphic.kind === "tiles" || graphicErrors(item.graphic).length)
      el.setAttribute("data-slot", `${path}.num`);
  }
  for (const el of [...doc.querySelectorAll("[data-graphic-caption]")]) {
    const g = resolve(spec,el.getAttribute("data-graphic-caption"));
    if (!g || graphicErrors(g).length || !g.values) { el.remove(); continue; }
    el.textContent = g.values.map(v => `${v.label}: ${v.value}${g.unit}`).join(" / ");
  }
}
