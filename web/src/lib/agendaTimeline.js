import { themeFor } from "./themes.js";
/** Alternating session timeline. layout still describes list versus grouped data. */
export function renderAgendaTimeline(doc, spec) {
  const agenda = spec.sections.agenda;
  const host = doc.querySelector('[data-section="agenda"] > td');
  if (!host || !agenda || agenda.style === "classic") return false;
  const theme = themeFor(spec);
  // Preserve the built template's shared section surface, spacing and heading.
  const headings = ["eyebrow", "title"].map(key => host.querySelector(`[data-slot="agenda.${key}"]`));
  const ink = "#141920", muted = "#8a8f98", line = "#ecebf0";
  const make = (tag, attrs = {}) => {
    const el = doc.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
    return el;
  };
  const text = (value, path, css = "") => {
    const el = make("div", { ...(path ? {"data-slot":path}:{}), style:`color:${muted};font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;${css}` });
    el.textContent = value || "";return el;
  };
  const table = () => make("table", {role:"presentation",width:"100%",cellpadding:"0",cellspacing:"0",border:"0",style:"width:100%;table-layout:fixed;border-collapse:collapse;"});
  const empty = () => make("td", {style:"padding:0;font-size:0;line-height:0;"});
  const axis = dot => {
    const cell=make("td", {width:"2",style:`width:2px;padding:0;background-color:${theme.chartBg};vertical-align:middle;font-size:0;line-height:0;`});
    if(dot)cell.append(make("div", {style:`width:6px;height:6px;margin-left:-2px;background-color:${theme.accent};border-radius:50%;`}));
    return cell;
  };
  const timeline = (entries, path) => {
    const out=table(),cols=make("colgroup");cols.append(make("col"),make("col",{width:"2",style:"width:2px;"}),make("col"));out.append(cols);
    const start=make("tr",{style:"height:12px;"});start.append(empty(),axis(false),empty());out.append(start);
    entries.forEach((item,i)=>{
      const left=i%2===0,base=`${path}.${i}`;
      const mark=make("tr",{"data-agenda-step":base,"data-agenda-side":left?"left":"right",style:"height:6px;"});
      const leftMark=empty(),rightMark=empty();
      mark.append(leftMark,axis(true),rightMark);out.append(mark);
      const row=make("tr"),leftText=empty(),rightText=empty(),cell=left?leftText:rightText;
      cell.setAttribute("style",`padding:8px ${left?"20px 20px 0":"0 20px 20px"};text-align:${left?"right":"left"};vertical-align:top;`);
      const card=make("div",{style:`padding:16px;background-color:#ffffff;border:1px solid ${line};border-radius:10px;box-shadow:0 3px 12px rgba(20,25,32,0.04);`});
      cell.append(card);
      card.append(text(item.time || `SESSION ${String(i+1).padStart(2,"0")}`,item.time?`${base}.time`:null,`font-size:12px;line-height:1.4;font-weight:700;color:${theme.accent};letter-spacing:0.2px;`));
      card.append(text(item.title,`${base}.title`,`font-size:17px;line-height:1.4;font-weight:700;letter-spacing:-0.3px;color:${ink};margin-top:6px;`));
      if(item.speaker)card.append(text(item.speaker,`${base}.speaker`,`font-size:13px;font-weight:600;color:${theme.accent};margin-top:6px;`));
      if(item.desc)card.append(text(item.desc,`${base}.desc`,"margin-top:4px;"));
      row.append(leftText,axis(false),rightText);out.append(row);
    });
    return out;
  };
  // 2026-09-25 채택 형태 (Figma 시안 2·3): rail = 왼쪽 선 + 점, table = 번호 표. timeline(가운데 선)은 기존 초안 호환.
  const sessionLabel=(item,i,base,css)=>text(item.time || `SESSION ${String(i+1).padStart(2,"0")}`,item.time?`${base}.time`:null,css);
  const rail=(entries,path)=>{
    // 축은 2px 셀, 점은 음수 여백으로 축 위에 정확히 얹는다(가운데 선 타임라인과 같은 방식). 마지막 항목은 축 배경 없음.
    const out=table(),cols=make("colgroup");cols.append(make("col",{width:"2",style:"width:2px;"}),make("col",{width:"18",style:"width:18px;"}),make("col"));out.append(cols);
    entries.forEach((item,i)=>{
      const base=`${path}.${i}`,last=i===entries.length-1,row=make("tr");
      const axisCell=make("td",{width:"2",style:`width:2px;padding:0;vertical-align:top;font-size:0;line-height:0;${last?"":`background-color:${theme.chartBg};`}`});
      axisCell.append(make("div",{style:`width:10px;height:10px;margin:6px 0 0 -4px;background-color:${theme.accent};border-radius:50%;`}));
      const gap=make("td",{width:"18",style:"width:18px;padding:0;font-size:0;line-height:0;"});
      const cell=make("td",{style:"padding:0 0 22px;vertical-align:top;"});
      cell.append(sessionLabel(item,i,base,`font-size:11px;line-height:1.4;font-weight:700;color:${theme.accent};letter-spacing:1px;`));
      cell.append(text(item.title,`${base}.title`,`font-size:15px;line-height:1.45;font-weight:700;letter-spacing:-0.2px;color:${ink};margin-top:4px;`));
      if(item.speaker)cell.append(text(item.speaker,`${base}.speaker`,`font-size:13px;font-weight:600;color:${theme.accent};margin-top:4px;`));
      if(item.desc)cell.append(text(item.desc,`${base}.desc`,"margin-top:3px;"));
      row.append(axisCell,gap,cell);out.append(row);
    });
    return out;
  };
  const tableStyle=(entries,path)=>{
    const out=make("table",{role:"presentation",width:"100%",cellpadding:"0",cellspacing:"0",border:"0",style:`width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;border:1px solid ${line};border-radius:12px;overflow:hidden;`});
    const cols=make("colgroup");cols.append(make("col",{width:"72",style:"width:72px;"}),make("col"));out.append(cols);
    entries.forEach((item,i)=>{
      const base=`${path}.${i}`,last=i===entries.length-1,bg=i%2?theme.tint:"#ffffff",bb=last?"":`border-bottom:1px solid ${line};`,row=make("tr");
      const num=make("td",{width:"72",style:`width:72px;padding:16px 0 16px 18px;vertical-align:top;background-color:${bg};${bb}`});
      num.append(text(item.time || String(i+1).padStart(2,"0"),item.time?`${base}.time`:null,`font-size:${item.time?"12px":"18px"};line-height:1.3;font-weight:800;color:${theme.accent};letter-spacing:-0.3px;`));
      const cell=make("td",{style:`padding:16px 16px 16px 8px;vertical-align:top;background-color:${bg};${bb}`});
      cell.append(text(item.title,`${base}.title`,`font-size:14.5px;line-height:1.45;font-weight:700;color:${ink};`));
      if(item.speaker)cell.append(text(item.speaker,`${base}.speaker`,`font-size:12.5px;font-weight:600;color:${theme.accent};margin-top:3px;`));
      if(item.desc)cell.append(text(item.desc,`${base}.desc`,"font-size:12.5px;margin-top:3px;"));
      row.append(num,cell);out.append(row);
    });
    return out;
  };
  const renderList=agenda.style==="rail"?rail:agenda.style==="table"?tableStyle:timeline;
  host.setAttribute("data-agenda-style",agenda.style||"timeline");
  host.replaceChildren(...headings.filter(Boolean));
  if(agenda.layout!=="grouped")host.append(renderList(agenda.items||[],"agenda.items"));
  else for(const [i,block] of (agenda.blocks||[]).entries()) {
    const base=`agenda.blocks.${i}`;
    const heading=make("div",{style:"padding:20px 0 12px;"});
    heading.append(text(block.title,`${base}.title`,`font-size:17px;line-height:1.4;font-weight:800;color:${ink};letter-spacing:-0.3px;`));
    if(block.time)heading.append(text(block.time,`${base}.time`,"font-size:14px;margin-top:4px;"));
    if(block.kind==="parallel")heading.append(text("병렬 진행 · 각 트랙은 동시에 진행됩니다",null,`font-size:13px;font-weight:600;color:${theme.accent};margin-top:8px;`));
    host.append(heading);
    if(block.kind==="parallel")for(const [j,track] of block.tracks.entries()) {
      const trackPath=`${base}.tracks.${j}`,label=make("div",{style:`padding:12px 16px;border:1px solid ${theme.chartBg};border-radius:10px;background-color:${theme.tint};margin:8px 0 12px;`});
      label.append(text(track.title,`${trackPath}.title`,`font-size:15px;font-weight:700;color:${ink};`));
      if(track.time)label.append(text(track.time,`${trackPath}.time`,"font-size:14px;margin-top:3px;"));
      host.append(label,renderList(track.items,`${trackPath}.items`));
    } else host.append(renderList(block.items,`${base}.items`));
  }
  return true;
}
