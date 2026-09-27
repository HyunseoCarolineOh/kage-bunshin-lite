/** Build-time markup only. Content is bound later through text nodes. */
const card = "background-color:{{color.white}}; border:1px solid {{color.line}}; border-radius:{{radius.card}}; box-shadow:{{shadow.card}}; padding:22px 24px;";
const body = "font-size:14px; line-height:1.65; color:{{color.ink}}; word-break:keep-all;";
const sub = "font-size:12.5px; line-height:1.6; color:{{color.muted}}; word-break:keep-all;";
const title = "font-size:16px; font-weight:700; line-height:1.45; color:{{color.ink}}; letter-spacing:-0.2px; word-break:keep-all;";
const pill = "display:inline-block; background-color:{{color.black}}; color:#ffffff; border-radius:100px; padding:11px 24px; font-size:14px; font-weight:700; text-decoration:none;";
const label = "display:inline-block; background-color:{{color.tintSection}}; color:{{color.accent}}; border-radius:50px; padding:6px 11px; font-size:12px; font-weight:700;";
const numCircle = "width:28px; height:28px; line-height:28px; border-radius:50%; background:{{gradient.accent}}; background-color:{{color.accent}}; color:#ffffff; text-align:center; font-size:13px; font-weight:700;";
const text = (path, css = body, optional = false) => `<div data-slot="${path}"${optional ? ` data-optional="${path}"` : ""} style="${css}"></div>`;
const link = (path, caption = "자세히 보기") => `<a data-link="${path}" style="${pill}">${caption}</a>`;
const textLink = (path, caption = "자세히 보기") => `<a data-link="${path}" style="display:inline-block; font-size:13px; font-weight:700; color:{{color.accent}}; text-decoration:underline; text-underline-offset:3px;">${caption}</a>`;
const image = (path, width = "100%") => `<img data-content-image="${path}" width="${width}" alt="" style="display:block; max-width:100%; height:auto; border-radius:10px;"/>`;
const heading = (name) => `${text(`${name}.eyebrow`, "{{style.eyebrow}}")}${text(`${name}.title`, "{{style.sectionTitle}}")}`;
const section = (name, inner, cell = "{{style.sectionWhite}}") => `<tr data-section="${name}"><td style="${cell}">${heading(name)}${inner}</td></tr>`;
const variants = (name, choices) => Object.entries(choices).map(([choice, html]) => `<div data-variant="${name}.layout:${choice}">${html}</div>`).join("");
const heroBasic = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td valign="top">${text("hero.title", "font-size:24px; line-height:1.35; font-weight:800; color:{{color.ink}}; letter-spacing:-0.5px;")}</td>
  <td width="90" valign="top" align="right" style="padding-top:4px;"><img src="{LOGO}" width="66" alt="Northwind Cloud" style="display:block;" data-slot-img="images.logo"/></td>
</tr></table>
<div style="padding-top:4px;"><div style="font-size:15px; line-height:1.6; color:{{color.ink}}; padding-top:10px; word-break:keep-all;" data-repeat="hero.paragraphs" data-slot="."></div></div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr data-repeat-row="hero.badges">
  <td width="10" style="{{style.spacer}}" data-spacer>&nbsp;</td>
  <td style="background-color:{{color.black}}; border-radius:{{radius.pill}}; padding:9px 16px;" data-repeat="."><span style="font-size:13.5px; font-weight:700; color:{{color.white}};" data-slot="."></span></td>
</tr></table>`;
const heroCentered = `<div align="center" style="text-align:center;">
  <img src="{LOGO}" width="66" alt="Northwind Cloud" style="display:block; margin:0 auto;" data-slot-img="images.logo"/>
  ${text("hero.title", "font-size:26px; line-height:1.35; font-weight:800; color:{{color.ink}}; letter-spacing:-0.5px; padding-top:22px; word-break:keep-all;")}
  <div style="font-size:15px; line-height:1.6; color:{{color.ink}}; padding-top:12px; word-break:keep-all;" data-repeat="hero.paragraphs" data-slot="."></div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 0;"><tr data-repeat-row="hero.badges">
    <td width="10" style="{{style.spacer}}" data-spacer>&nbsp;</td>
    <td style="background-color:{{color.black}}; border-radius:{{radius.pill}}; padding:9px 16px;" data-repeat="."><span style="font-size:13.5px; font-weight:700; color:{{color.white}};" data-slot="."></span></td>
  </tr></table>
</div>`;
const heroLetter = `<div data-optional="hero.letter" style="margin-top:30px;"><div style="${card} padding:24px 26px;">${text("hero.letter", "font-size:14.5px; line-height:1.85; color:{{color.ink}}; word-break:keep-all;")}</div></div>`;
// 배너 형태 4종 (2026-09-25 디자인 시안 1·2·3 채택): basic·centered는 연한 배경 원안, dark는 검정 배너, block은 왼쪽 컬러 블록 + 오른쪽 장식.
// 형태마다 배경이 다르므로 바깥 td는 여백 없이 두고, 형태별 안쪽 표가 배경·여백·편지 박스를 각자 가진다.
const heroBadges = (bg, fg, align = "") => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${align ? ` align="${align}"` : ""} style="margin:24px ${align ? "auto" : "0"} 0;"><tr data-repeat-row="hero.badges">
  <td width="10" style="{{style.spacer}}" data-spacer>&nbsp;</td>
  <td style="background-color:${bg}; border-radius:{{radius.pill}}; padding:9px 16px;" data-repeat="."><span style="font-size:13.5px; font-weight:700; color:${fg};" data-slot="."></span></td>
</tr></table>`;
const heroDark = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td valign="top">${text("hero.title", "font-size:24px; line-height:1.35; font-weight:800; color:{{color.white}}; letter-spacing:-0.5px;")}</td>
  <td width="90" valign="top" align="right" style="padding-top:4px;"><img src="{LOGO_WHITE}" width="66" alt="Northwind Cloud" style="display:block;" data-slot-img="images.logoWhite"/></td>
</tr></table>
<div style="padding-top:4px;"><div style="font-size:15px; line-height:1.6; color:#d7dbe3; padding-top:10px; word-break:keep-all;" data-repeat="hero.paragraphs" data-slot="."></div></div>
${heroBadges("{{color.white}}", "{{color.ink}}")}`;
const heroBlockLeft = `${text("hero.title", "font-size:24px; line-height:1.35; font-weight:800; color:{{color.white}}; letter-spacing:-0.5px;")}
<div style="padding-top:4px;"><div style="font-size:15px; line-height:1.6; color:{{color.white}}; padding-top:10px; word-break:keep-all;" data-repeat="hero.paragraphs" data-slot="."></div></div>
${heroBadges("{{color.white}}", "{{color.accent}}")}`;
const heroFrame = (inner, css, attrs = "") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${css}"${attrs ? ` ${attrs}` : ""}>${inner}${heroLetter}</td></tr></table>`;
const heroPaleCss = "background-color:{{color.tintHero}}; background-image:url('{HERO_BG}'); background-size:cover; background-position:center top; padding:44px 44px 46px 44px;";
const heroDarkCss = "background-color:{{color.ink}}; background-image:radial-gradient(circle at 88% 0%, {{color.accent}}66, {{color.ink}}00 58%); padding:44px 44px 46px 44px;";
const heroBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="400" valign="top" style="background:{{gradient.accent}}; background-color:{{color.accent}}; padding:44px 32px 46px 44px;">${heroBlockLeft}</td>
  <td width="240" valign="top" align="right" style="background-color:{{color.white}}; padding:0;"><img src="{HERO_DECO}" width="240" alt="" style="display:block;" data-slot-img="images.heroDeco"/></td>
</tr></table><div style="padding:0 44px; background-color:{{color.white}};">${heroLetter}</div>`;
const heroSection = `<tr data-section="hero"><td style="padding:0;">${variants("hero", {
  basic: heroFrame(heroBasic, heroPaleCss, 'data-slot-bg="images.heroBg"'),
  centered: heroFrame(heroCentered, heroPaleCss, 'data-slot-bg="images.heroBg"'),
  dark: heroFrame(heroDark, heroDarkCss),
  block: heroBlock,
})}</td></tr>`;
const lead = "font-size:15px; line-height:1.75; color:{{color.ink}}; word-break:keep-all;";
const metaRow = (key, caption) => `<tr data-optional=".${key}"><td valign="top" width="56" style="${sub} font-weight:700; color:{{color.accent}}; padding:4px 10px 4px 0; white-space:nowrap;">${caption}</td><td valign="top" style="${body} font-size:13.5px; padding:4px 0;" data-slot=".${key}"></td></tr>`;
const programCard = `<div style="${card}">${text(".title", `${title} font-size:17px;`)}${text(".oneLiner", "font-size:13px; font-weight:600; line-height:1.6; color:{{color.accent}}; margin-top:6px; word-break:keep-all;", true)}${text(".body", `${body} margin-top:10px;`, true)}
    <table data-prune-empty role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">${metaRow("date","일시")}${metaRow("time","시간")}${metaRow("location","장소")}${metaRow("audience","대상")}${metaRow("format","구성")}</table>
    <div style="margin-top:18px;"><a data-link=".href" data-slot=".cta" style="${pill}"></a></div></div>`;
// Unified card: every part is optional and self-removing — image (wrapper), graphic + big number, number badge (card.numbers variant),
// brand icon + wordmark (applyBrand; none → plain title), tag pill, kicker line, body, meta rows (table pruned when empty), hashtags, button with caption fallback.
const cardItem = `<div style="${card}">
    <div data-image-cell=".image" style="padding-bottom:16px;">${image(".image")}</div>
    <img data-graphic=".graphic" data-graphic-item="." width="260" height="160" style="display:block;width:100%;height:auto;" alt=""/>
    <div data-metric="." style="font-size:32px;line-height:1.2;font-weight:800;color:{{color.accent}};letter-spacing:-0.5px;margin-bottom:8px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td data-variant="card.numbers:on" width="38" valign="top"><div data-num style="${numCircle}"></div></td><td data-brand-icon-cell width="40" valign="middle" style="padding-right:8px;"><img data-brand-icon width="32" height="32" alt="" style="display:block;"/></td><td valign="middle" data-brand-wordmark data-base-style="${title}" data-slot=".title" style="${title}"></td></tr></table>
    ${text(".tag", `${label} margin-top:10px;`, true)}
    ${text(".kicker", "font-size:13px; font-weight:600; line-height:1.6; color:{{color.accent}}; margin-top:8px; word-break:keep-all;", true)}
    ${text(".body", `${sub} font-size:13px; margin-top:8px;`, true)}
    <table data-prune-empty role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">${metaRow("date","일시")}${metaRow("time","시간")}${metaRow("location","장소")}${metaRow("audience","대상")}${metaRow("format","구성")}</table>
    <div data-optional=".hashtags" style="padding-top:12px;"><span data-repeat=".hashtags" data-slot="." style="${label} margin:0 6px 6px 0;"></span></div>
    <div data-graphic-caption=".graphic" style="${sub} margin-top:8px;"></div>
    ${text(".source", "font-size:12px; color:{{color.muted}}; margin-top:10px;", true)}
    <div data-card-foot style="margin-top:20px;"><a data-link=".href" data-slot=".cta" data-caption="자세히 보기" style="${pill}"></a></div></div>`;
// Logo grid layout: small centered image, name, "방문하기" button (replaces the logoGrid module).
const cardLogoItem = `<div style="${card} text-align:center; padding:18px 12px;">
    <div data-image-cell=".image" style="padding-bottom:8px;"><img data-content-image=".image" width="96" alt="" style="display:block; margin:0 auto; max-width:96px; height:auto; border-radius:10px;"/></div>
    ${text(".title", `${body} font-weight:700;`)}
    ${text(".body", `${sub} font-size:12.5px; margin-top:4px;`, true)}
    <div data-card-foot style="margin-top:14px;"><a data-link=".href" data-slot=".cta" data-caption="방문하기" style="${pill}"></a></div></div>`;
// Banner layout: one headline number without card chrome (replaces the bignumber module).
const cardBannerItem = `<div style="padding:4px 0 18px 0;">
    <div data-metric="." style="font-size:34px; font-weight:800; letter-spacing:-1px; line-height:1.2; background:{{gradient.accent}}; background-color:{{color.accent}}; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:{{color.accent}};"></div>
    ${text(".title", "font-size:24px; font-weight:800; color:{{color.ink}}; letter-spacing:-0.5px; line-height:1.35; padding-top:6px; word-break:keep-all;")}
    ${text(".kicker", "font-size:15px; font-weight:600; line-height:1.6; color:{{color.accent}}; margin-top:8px; word-break:keep-all;", true)}
    ${text(".body", `${body} margin-top:10px;`, true)}
    ${text(".source", "font-size:12px; color:{{color.muted}}; margin-top:14px;", true)}
    <div style="margin-top:18px;"><a data-link=".href" data-slot=".cta" data-caption="자세히 보기" style="${pill}"></a></div></div>`;
const productHead = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td data-brand-icon-cell width="42"><img data-brand-icon width="32" height="32" alt=""/></td><td data-brand-wordmark data-base-style="font-size:20px;font-weight:800;" data-slot=".name"></td></tr></table>${text(".audience", `${label} margin-top:8px;`)}`;
const productBody = `${text(".question", `${title} margin-top:20px;`)}${text(".desc", `${sub} font-size:13px; margin-top:6px;`)}<div style="padding-top:12px;"><span data-repeat=".hashtags" data-slot="." style="${label} margin:0 6px 6px 0;"></span></div><div data-card-foot style="margin-top:14px;">${textLink(".href")}</div>`;
const productVertical = `<div data-grid="2"><div data-repeat="productCards.items"><div style="${card}">${productHead}${productBody}</div></div></div>`;
const productHorizontal = `<div data-repeat="productCards.items" style="padding-bottom:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${card}"><tr><td width="36%" valign="top" style="padding-right:24px;">${productHead}</td><td valign="top">${productBody}</td></tr></table></div>`;
const stepCard = `<div style="${card} padding:18px 20px; height:100%;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="38" valign="top"><div data-num style="${numCircle}"></div></td><td valign="middle">${text(".title", title)}</td></tr></table>${text(".sub", `${sub} margin-top:4px; padding-left:38px;`, true)}</div>`;
export const layouts = {
  hero: heroSection,
  productCards: section("productCards", variants("productCards", { vertical: productVertical, horizontal: productHorizontal })),
  values: section("values", variants("values", {
    cards: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr data-repeat="values.cards"><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid {{color.line}};" data-if-last-style="border-bottom:0;"><tr><td width="44" valign="top" style="padding:16px 0;"><div data-num style="${numCircle}"></div></td><td valign="top" style="padding:16px 0 16px 6px;">${text(".title", title)}${text(".sub", `${sub} margin-top:4px;`)}</td></tr></table></td></tr></table>`,
    diagram: `<div data-hub="values.centerLabel"><div data-repeat="values.cards"><div style="${card} padding:16px 14px; text-align:center;">${text(".title", `${title} font-size:14.5px;`)}${text(".sub", `${sub} margin-top:6px;`)}</div></div></div>`,
    // 2026-09-25 채택 (디자인 시안 2·3·6): 3열 카드 / 큰 숫자 / 틴트 타일 3열
    cols3: `<div data-grid="3"><div data-repeat="values.cards"><div style="${card} padding:20px 16px;"><div data-num style="${numCircle}"></div>${text(".title", `${title} font-size:14.5px; margin-top:12px;`)}${text(".sub", `${sub} margin-top:6px;`)}</div></div></div>`,
    numbers: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr data-repeat="values.cards"><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid {{color.line}};" data-if-last-style="border-bottom:0;"><tr><td width="72" valign="top" style="padding:18px 0;"><div data-num="pad2" style="font-size:34px; line-height:1; font-weight:800; color:{{color.accent}}; letter-spacing:-1px;"></div></td><td valign="top" style="padding:18px 0 18px 8px;">${text(".title", title)}${text(".sub", `${sub} margin-top:4px;`)}</td></tr></table></td></tr></table>`,
    tiles: `<div data-grid="3"><div data-repeat="values.cards"><div style="${card} background-color:{{color.tintCard}}; border:0; box-shadow:none; padding:20px 18px;"><div data-num="pad2" style="font-size:24px; line-height:1.1; font-weight:800; color:{{color.accent}}; letter-spacing:-0.5px;"></div>${text(".title", `${title} font-size:14.5px; margin-top:8px;`)}${text(".sub", `${sub} margin-top:6px;`)}</div></div></div>`,
  })),
  about: section("about", variants("about", {
    photo: `${image("images.photo")}${text("about.body", `${body} margin-top:20px;`, true)}<div style="${body} padding-top:12px;" data-bullets="about.bullets"><span style="color:{{color.accent}};">●</span></div>`,
    text: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top" width="82" style="padding-right:20px;"><img data-slot-img="images.logo" width="66" alt=""/></td><td>${text("about.body",body,true)}<div style="${body}" data-bullets="about.bullets"><span style="color:{{color.accent}};">●</span></div></td></tr></table>`,
  })),
  steps: section("steps", variants("steps", {
    list: `<div data-repeat="steps.items" style="padding-bottom:14px;">${stepCard}</div>`,
    process: `<div data-grid="3"><div data-repeat="steps.items">${stepCard}</div></div>`,
    compact: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr data-repeat="steps.items"><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid {{color.line}};" data-if-last-style="border-bottom:0;"><tr>
        <td width="44" valign="top" style="padding:14px 0;"><div data-num style="${numCircle}"></div></td>
        <td valign="top" style="padding:14px 0 14px 6px;">${text(".title", title)}${text(".sub", `${sub} margin-top:4px;`, true)}</td>
      </tr></table></td></tr></table>`,
  })),
  quotes: section("quotes", variants("quotes", {
    list: `<div data-repeat="quotes.items" style="padding-bottom:12px;"><div style="${card} padding:20px 24px;">
      ${text(".quote", "font-size:14.5px; color:{{color.ink}}; line-height:1.7; word-break:keep-all;")}
      <div style="font-size:13px; font-weight:600; color:{{color.accent}}; padding-top:8px;">— <span data-slot=".name"></span><span data-optional=".role"> · <span data-slot=".role"></span></span></div>
    </div></div>`,
    featured: `<div data-repeat="quotes.items" style="padding-bottom:14px;"><div style="${card} padding:30px 28px; text-align:center;">
      <div style="font-size:44px; line-height:1; font-weight:800; color:{{color.accent}}; font-family:Georgia,'Times New Roman',serif;">“</div>
      ${text(".quote", "font-size:18px; font-weight:700; color:{{color.ink}}; line-height:1.6; padding-top:6px; word-break:keep-all; letter-spacing:-0.2px;")}
      <div style="font-size:14px; font-weight:600; color:{{color.accent}}; padding-top:16px;"><span data-slot=".name"></span><span data-optional=".role"> · <span data-slot=".role"></span></span></div>
    </div></div>`,
  }), "{{style.sectionTint}}"),
  stats: section("stats", `<div data-grid="2"><div data-repeat="stats.items"><div style="${card}">
    <img data-graphic=".graphic" data-graphic-item="." width="260" height="160" style="display:block;width:100%;height:auto;" alt=""/>
    <div data-metric="." style="font-size:32px;line-height:1.2;font-weight:800;color:{{color.accent}};letter-spacing:-0.5px;margin-top:16px;"></div>
    ${text(".cap",`${sub} margin-top:2px;`)}
    ${text(".tag",`${label} margin-top:18px;`,true)}${text(".title",`${title} margin-top:18px;`,true)}${text(".story",`${sub} font-size:13px; margin-top:6px;`,true)}
    <div data-graphic-caption=".graphic" style="${sub} margin-top:8px;"></div>
    </div></div></div>`),
  article: section("article", `${text("article.lead", lead, true)}<div data-repeat="article.items" style="padding-top:22px;">${text(".heading", title)}${text(".body", `${body} margin-top:8px;`, true)}</div><div style="margin-top:20px;">${textLink("article.href")}</div>`),
  programs: section("programs", `${text("programs.intro", `${lead} padding-bottom:22px;`, true)}<div data-repeat="programs.items" style="padding-bottom:16px;">${programCard}</div>`, "{{style.sectionTint}}"),
  card: section("card", `${text("card.intro", `${lead} padding-bottom:22px;`, true)}${variants("card", {
    col1: `<div data-repeat="card.items" style="padding-bottom:16px;" data-if-last-style="padding-bottom:0;">${cardItem}</div>`,
    col2: `<div data-grid="2"><div data-repeat="card.items">${cardItem}</div></div>`,
    col3: `<div data-grid="3"><div data-repeat="card.items">${cardItem}</div></div>`,
    logo: `<div data-grid="3"><div data-repeat="card.items">${cardLogoItem}</div></div>`,
    banner: `<div data-repeat="card.items" data-if-last-style="padding-bottom:0;">${cardBannerItem}</div>`,
  })}`),
  customerStories: section("customerStories", `${text("customerStories.intro", `${lead} padding-bottom:22px;`, true)}<div data-grid="2"><div data-repeat="customerStories.items"><div style="${card}">
    ${image(".image")}${text(".title",`${title} margin-top:16px;`)}${text(".body",`${sub} font-size:13px; margin-top:6px;`)}
    <div data-card-foot style="margin-top:20px;">${link(".href","사례 자세히 보기")}</div></div></div>`),
  logoGrid: section("logoGrid", `<div data-grid="3"><div data-repeat="logoGrid.items"><div style="${card} text-align:center;padding:18px 12px;">
    ${image(".image","96")}${text(".name",`${body} font-weight:700;margin-top:8px;`)}
    <div data-card-foot style="margin-top:14px;">${link(".href","방문하기")}</div></div></div>`),
  // 마무리 형태 6종 (2026-09-25 디자인 시안 1·2·4·6·7 채택 + 기존 버튼형). 형태마다 배경이 달라 바깥 td는 여백 0.
  footer: (() => {
    const wrap = (inner, css) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${css}">${inner}</td></tr></table>`;
    const head = (color) => text("footer.headline", `font-size:22px;font-weight:800;line-height:1.35;letter-spacing:-0.4px;word-break:keep-all;color:${color};`);
    const bullets = (color, dot) => `<div style="${body} color:${color}; margin-top:16px;" data-bullets="footer.bullets"><span style="color:${dot};">●</span></div>`;
    const contactBlock = (color) => `${text("footer.contactLines", `${body} color:${color}; margin-top:24px;`, true)}<a data-slot-email="footer.contactEmail" style="${body} color:${color};"></a>`;
    const button = (bg, fg) => `<div style="margin-top:24px;"><a data-link="footer.href" data-slot="footer.cta" style="${pill} background-color:${bg}; color:${fg};"></a></div>`;
    const onColor = (color, dot, btnBg, btnFg) => `${head(color)}${text("footer.leftNote", `${body} color:${color}; margin-top:8px;`, true)}${bullets(color, dot)}${contactBlock(color)}${button(btnBg, btnFg)}`;
    // data-if-last-style는 style 전체를 바꾸므로 테두리만 뺀 완전한 스타일을 준다
    const rowLabelCss = "padding:12px 16px; font-size:12.5px; font-weight:700; color:{{color.accent}}; word-break:keep-all;";
    const rowValueCss = "padding:12px 14px; font-size:13.5px; font-weight:600; line-height:1.55; color:{{color.ink}}; word-break:keep-all;";
    const rowsTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px; border:1px solid {{color.line}}; border-radius:10px; border-collapse:separate; border-spacing:0;"><tr data-repeat="footer.rows"><td width="110" valign="top" style="${rowLabelCss} border-bottom:1px solid {{color.line}};" data-if-last-style="${rowLabelCss}" data-slot=".label"></td><td valign="top" style="${rowValueCss} border-bottom:1px solid {{color.line}};" data-if-last-style="${rowValueCss}" data-slot=".value"></td></tr></table>`;
    return `<tr data-section="footer"><td style="padding:0;">${variants("footer", {
      contact: wrap(`<div style="${card} padding:28px;">${text("footer.headline","font-size:22px;font-weight:800;line-height:1.35;letter-spacing:-0.4px;word-break:keep-all;")}${text("footer.leftNote",`${body} margin-top:8px;`,true)}<div style="${body} margin-top:16px;" data-bullets="footer.bullets"><span style="color:{{color.accent}};">●</span></div>${text("footer.contactLines",`${body} margin-top:24px;`,true)}<a data-slot-email="footer.contactEmail" style="${body}"></a><div style="margin-top:24px;"><a data-link="footer.href" data-slot="footer.cta" style="${pill}"></a></div></div>`, "{{style.sectionTint}}"),
      cta: wrap(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${card} padding:28px;"><tr><td valign="top">${text("footer.headline","font-size:22px;font-weight:800;line-height:1.35;letter-spacing:-0.4px;word-break:keep-all;")}${text("footer.leftNote",`${body} margin-top:8px;`,true)}<div style="${body} margin-top:16px;" data-bullets="footer.bullets"><span style="color:{{color.accent}};">●</span></div><div style="margin-top:24px;"><a data-link="footer.href" data-slot="footer.cta" style="${pill}"></a></div>${text("footer.contactLines",`${sub} margin-top:24px;`,true)}<a data-slot-email="footer.contactEmail" style="${sub}"></a></td><td data-image-cell="footer.image" width="145" style="padding-left:20px;" valign="middle">${image("footer.image","125")}</td></tr></table>`, "{{style.sectionTint}}"),
      dark: wrap(onColor("{{color.white}}", "{{color.accent}}", "{{color.white}}", "{{color.ink}}"), "background-color:{{color.ink}}; padding:40px 44px 46px;"),
      block: wrap(onColor("{{color.white}}", "{{color.white}}", "{{color.white}}", "{{color.accent}}"), "background:{{gradient.accent}}; background-color:{{color.accent}}; padding:40px 44px 46px;"),
      table: wrap(`<div style="${card} padding:28px;">${head("{{color.ink}}")}${text("footer.leftNote", `${body} margin-top:8px;`, true)}${rowsTable}${contactBlock("{{color.ink}}")}${button("{{color.black}}", "#ffffff")}</div>`, "{{style.sectionTint}}"),
      sentence: wrap(`<div style="${card} padding:28px;">${head("{{color.ink}}")}${text("footer.body", `${body} font-size:14.5px; line-height:1.75; color:{{color.ink}}; margin-top:12px;`, true)}${contactBlock("{{color.ink}}")}${button("{{color.black}}", "#ffffff")}</div>`, "{{style.sectionTint}}"),
    })}</td></tr>`;
  })(),
};
/** v2 fit for sections that keep their v1 inner markup: left-aligned headings, shared spacing, theme colors. */
export const refits = {
  qualify: { cell: "{{style.sectionWhite}}", headings: { title: "{{style.sectionTitle}}", condition: "font-size:13px; font-weight:600; color:{{color.muted}}; padding-bottom:22px;" } },
  agenda: {},
  timeline: {},
  infobar: { cell: "background-color:{{color.ink}}; padding:24px 16px;", repeatCell: "padding:6px 16px;" },
  bignumber: { cell: "{{style.sectionTint}}", replace: [["{{gradient.brandB}}", "{{gradient.accent}}"]] },
};
