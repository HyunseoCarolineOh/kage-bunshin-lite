import { renderAgendaTimeline } from "./agendaTimeline.js";
import { themeFor } from "./themes.js";
/** Fixed email tables. Every string is a text node, including newly added edit bindings. */
export function renderReviewedSections(doc, spec) {
  const theme = themeFor(spec);
  const make = (tag, attrs = {}) => {
    const el = doc.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v);
    return el;
  };
  const text = (value, path, css = "") => {
    const el = make("div", { ...(path ? {"data-slot":path}:{}), style: `font-size:14px;line-height:1.65;overflow-wrap:anywhere;word-break:keep-all;white-space:pre-wrap;${css}` });
    el.textContent = value || "";
    return el;
  };
  const table = () => make("table", {role:"presentation",width:"100%",cellpadding:"0",cellspacing:"0",style:"width:100%;table-layout:fixed;border-collapse:collapse;"});
  const items = (entries, path) => {
    const out = table();
    entries.forEach((item,i) => {
      const row=make("tr"), td=make("td",{style:"padding:15px 0;border-bottom:1px solid #ecebf0;vertical-align:top;"});
      td.append(text(item.time,`${path}.${i}.time`,`font-size:14px;font-weight:700;color:${theme.accent};`));
      td.append(text(item.title,`${path}.${i}.title`,"font-weight:600;margin-top:4px;"));
      if(item.speaker)td.append(text(item.speaker,`${path}.${i}.speaker`,"font-size:13px;color:#8a8f98;margin-top:4px;"));
      if(item.desc)td.append(text(item.desc,`${path}.${i}.desc`,"font-size:13px;color:#8a8f98;margin-top:4px;"));
      row.append(td);out.append(row);
    });
    return out;
  };
  const agenda = spec.sections.agenda;
  const timeline = renderAgendaTimeline(doc, spec);
  if (!timeline && agenda?.layout === "grouped") {
    const host=doc.querySelector('[data-section="agenda"] > td');
    if(host) {
      host.replaceChildren(text(agenda.eyebrow,"agenda.eyebrow",`font-size:12px;font-weight:700;color:${theme.accent};`),
        text(agenda.title,"agenda.title","font-size:22px;font-weight:800;letter-spacing:-0.4px;margin:8px 0 22px;"));
      (agenda.blocks || []).forEach((b,i) => {
        const base=`agenda.blocks.${i}`;
        const wrapper=table(), row=make("tr"), cell=make("td",{style:"padding:20px 0;"});
        cell.append(text(b.title,`${base}.title`,"font-size:17px;font-weight:800;letter-spacing:-0.3px;"));
        if(b.time)cell.append(text(b.time,`${base}.time`,"font-size:13px;color:#8a8f98;"));
        if(b.kind==="parallel") {
          cell.append(text("병렬 진행",null,`font-size:13px;font-weight:700;color:${theme.accent};margin:8px 0;`));
          b.tracks.forEach((track,j)=>{
            const box=table(),tr=make("tr"),td=make("td",{style:`padding:20px;border:1px solid ${theme.chartBg};background-color:${theme.tint};`});
            td.append(text(track.title,`${base}.tracks.${j}.title`,"font-size:15px;font-weight:700;"));
            if(track.time)td.append(text(track.time,`${base}.tracks.${j}.time`,"font-size:14px;"));
            td.append(items(track.items,`${base}.tracks.${j}.items`));tr.append(td);box.append(tr);
            const gap=make("div",{style:"height:12px;line-height:12px;"});cell.append(box,gap);
          });
        }else cell.append(items(b.items,`${base}.items`));
        row.append(cell);wrapper.append(row);host.append(wrapper);
      });
    }
  }
  if (!timeline && agenda?.layout !== "grouped") {
    for(const [i,item] of (agenda?.items || []).entries()) {
      const title=doc.querySelector(`[data-slot="agenda.items.${i}.title"]`);
      if(title && item.time) title.before(text(item.time,`agenda.items.${i}.time`,`font-size:14px;font-weight:700;color:${theme.accent};margin-bottom:5px;`));
    }
  }
  const info=spec.sections.infobar;
  if(info?.layout==="details") {
    const host=doc.querySelector('[data-section="infobar"] > td');
    if(host) {
      host.replaceChildren();
      host.setAttribute("style","padding:28px 40px 0;background-color:#ffffff;");
      const panel=make("table",{role:"presentation",width:"100%",cellpadding:"0",cellspacing:"0",style:`width:100%;border-collapse:separate;background:linear-gradient(180deg,${theme.tint},#ffffff);background-color:${theme.tint};border:1px solid ${theme.chartBg};border-radius:14px;`});
      const wrap=make("tr"),wrapCell=make("td",{style:"padding:18px 22px;"});
      const out=table();
      // 원문 확인 흐름이 채워 주는 event 서랍이 우선. 그 서랍이 비어 있으면(필수판) 가로 띠가 쓰는 cells 내용을 세로로 그린다 — 빈 박스 방지 (docs/rules.md 수정 4).
      const eventRows=[["date","일시"],["time","시간"],["location","장소"],["audience","대상"],["format","형식"]].filter(([key])=>info.event?.[key])
        .map(([key,label])=>({label,value:info.event[key],path:`infobar.event.${key}`}));
      const rows=eventRows.length?eventRows:(info.cells||[]).map((c,i)=>c && (c.value||c.label)?{label:c.label||"",value:c.value||"",sub:c.sub||"",path:`infobar.cells.${i}.value`,subPath:`infobar.cells.${i}.sub`}:null).filter(Boolean);
      rows.forEach((r,i)=>{
        const tr=make("tr"),labelCell=make("td",{width:"64",style:`width:64px;padding:${i?7:0}px 12px 0 0;vertical-align:top;`}),td=make("td",{style:`padding:${i?7:0}px 0 0;vertical-align:top;`});
        labelCell.append(text(r.label,null,`font-size:11.5px;font-weight:700;letter-spacing:1px;color:${theme.accent};line-height:1.9;`));
        td.append(text(r.value,r.path,"font-size:14px;font-weight:600;color:#141920;line-height:1.65;"));
        if(r.sub) td.append(text(r.sub,r.subPath,"font-size:12.5px;color:#8a8f98;line-height:1.6;"));
        tr.append(labelCell,td);out.append(tr);
      });
      wrapCell.append(out);wrap.append(wrapCell);panel.append(wrap);host.append(panel);
    }
  } else if(info?.layout==="floating") {
    // 2026-09-25 채택 형태 (Figma 시안 4): 틴트 바탕 위에 떠 있는 흰 카드, 칸은 세로 구분선으로. 값은 그대로 클릭 편집.
    const host=doc.querySelector('[data-section="infobar"] > td');
    if(host) {
      host.replaceChildren();
      host.setAttribute("style",`padding:24px 40px 28px;background-color:${theme.tint};`); // 배너와 카드 사이 숨 쉴 여백 (2026-09-25 피드백)
      const cells=(info.cells||[]).filter(c=>c && (c.value||c.label));
      const panel=make("table",{role:"presentation",width:"100%",cellpadding:"0",cellspacing:"0",style:`width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #ecebf0;border-radius:16px;box-shadow:0 8px 28px rgba(20,25,32,0.08);`});
      const tr=make("tr");
      cells.forEach((c,i)=>{
        if(i){const d=make("td",{width:"1",style:"width:1px;padding:0;background-color:#ecebf0;"});tr.append(d);}
        const td=make("td",{style:"padding:18px 18px;vertical-align:top;"});
        td.append(text(c.label||"",`infobar.cells.${i}.label`,`font-size:11px;font-weight:700;letter-spacing:1px;color:${theme.accent};line-height:1.6;`));
        td.append(text(c.value||"",`infobar.cells.${i}.value`,"font-size:15px;font-weight:700;color:#141920;line-height:1.5;margin-top:4px;"));
        if(c.sub)td.append(text(c.sub,`infobar.cells.${i}.sub`,"font-size:12.5px;color:#8a8f98;line-height:1.5;margin-top:2px;"));
        tr.append(td);
      });
      panel.append(tr);host.append(panel);
    }
  }
  if(spec.sections.hero?.sourceTitle) {
    const el=doc.querySelector('[data-slot="hero.title"]');
    if(el) {el.textContent=spec.sections.hero.sourceTitle;el.setAttribute("data-slot","hero.sourceTitle");el.style.whiteSpace="pre-wrap";}
  }
  const footer=doc.querySelector('[data-section="footer"] > td');
  if(footer && spec.sections.footer.notes?.length) {
    const notes=make("div",{style:"padding-top:24px;"});
    spec.sections.footer.notes.forEach((v,i)=>notes.append(text(v,`footer.notes.${i}`,"font-size:14px;margin:12px 0;")));
    footer.append(notes);
  }
}
