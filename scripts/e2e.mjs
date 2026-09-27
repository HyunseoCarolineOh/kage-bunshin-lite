/**
 * E2E — 홈 → 예시 원고 → 생성(실제 Bedrock) → 편집기 → 글자 클릭 수정 → 자동 저장 → HTML 내려받기 → 새로고침 복원.
 * 로컬:   npm run local  +  LOCAL_API=http://127.0.0.1:8787 npm run dev  →  node scripts/e2e.mjs
 * 운영:   node scripts/e2e.mjs https://<CloudFront 도메인>
 * 산출물: scripts/e2e-out/ (스크린샷·내려받은 HTML)
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "");
const out = join(dirname(fileURLToPath(import.meta.url)), "e2e-out", "e2e"); // 자기 하위 폴더만 비운다 (다른 스크립트의 시안·시트는 건드리지 않음)
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, tag, text) {
  const handle = await page.evaluateHandle((tag, text) => [...document.querySelectorAll(tag)].find((b) => b.textContent.trim().startsWith(text)), tag, text);
  const el = handle.asElement();
  if (!el) throw new Error(`요소 없음: <${tag}> "${text}"`);
  await el.click();
}
async function previewFrame(page) {
  await page.waitForSelector("iframe.preview-frame", { timeout: 20000 });
  for (let i = 0; i < 100; i++) {
    const frame = page.frames().find((f) => f !== page.mainFrame() && f.parentFrame() === page.mainFrame());
    if (frame) {
      try {
        if (await frame.$("[data-slot]")) {
          await frame.waitForSelector("body[data-kb-wired]", { timeout: 20000 }); // 편집 손잡이가 붙은 뒤에만 클릭한다
          return frame;
        }
      } catch { /* 프레임 교체 중 */ }
    }
    await sleep(200);
  }
  throw new Error("미리보기 프레임이 준비되지 않음");
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--window-size=1400,1000"], defaultViewport: { width: 1400, height: 1000 } });
const page = await browser.newPage();
page.on("pageerror", (e) => log("pageerror:", e.message));
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) log(`console.${m.type()}:`, m.text().slice(0, 200)); });
page.on("requestfailed", (r) => log("requestfailed:", r.method(), r.url().slice(0, 120), r.failure()?.errorText));
page.on("response", (r) => {
  if (r.url().includes("/api/")) log("api:", r.request().method(), new URL(r.url()).pathname, r.status());
  else if (r.status() >= 400) log(`http ${r.status()}:`, r.url().slice(0, 140));
});
page.on("framenavigated", (f) => { if (f === page.mainFrame()) log("navigated:", f.url()); });
try {
  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await page.screenshot({ path: join(out, "1-home.png") });
  await clickByText(page, "button", "예시 원고 넣기");
  log("원고", await page.$eval("textarea", (el) => el.value.length), "자");
  await clickByText(page, "button", "eDM 만들기");
  await page.waitForFunction(() => location.pathname.startsWith("/editor/"), { timeout: 90000 });
  const id = await page.evaluate(() => location.pathname.split("/").pop());
  log("편집기 진입", id);

  let frame = await previewFrame(page);
  const slots = await frame.$$eval("[data-slot]", (els) => els.map((e) => ({ path: e.getAttribute("data-slot"), text: e.innerText.trim() })).filter((s) => s.text));
  log("슬롯", slots.length, "개, 제목:", slots.find((s) => /hero\.title$/.test(s.path))?.text);
  const title = await page.$eval(".topbar-title", (el) => el.textContent);
  log("상단 제목:", title);
  await page.screenshot({ path: join(out, "2-editor.png") });

  // 클릭 편집 — hero.title 우선, 없으면 첫 슬롯
  const target = slots.find((s) => /hero\.title$/.test(s.path)) || slots[0];
  const marker = "E2E수정";
  const el = await frame.$(`[data-slot="${target.path}"]`);
  await el.click();
  await frame.waitForSelector(`[data-slot="${target.path}"][contenteditable="true"]`, { timeout: 5000 });
  await page.keyboard.press("End");
  await page.keyboard.type(" " + marker);
  // 확정은 blur 시점 (여러 줄 슬롯은 Enter가 줄바꿈이라 blur로 확정한다)
  await frame.evaluate((sel) => document.querySelector(sel).blur(), `[data-slot="${target.path}"]`);
  await page.waitForFunction(() => /저장됨/.test(document.querySelector(".save-state")?.textContent || ""), { timeout: 20000 });
  log("자동 저장 표시 확인");
  const saved = await page.evaluate(async (id) => (await fetch(`/api/flyers/${id}`)).json(), id);
  if (!JSON.stringify(saved.spec).includes(marker)) fail("수정한 글자가 서버에 저장되지 않음");
  else log("서버 저장 확인", target.path);

  // 내려받기
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: out, eventsEnabled: true });
  await clickByText(page, "button", "HTML 내려받기");
  for (let i = 0; i < 30 && !readdirSync(out).some((f) => f.endsWith(".html")); i++) await sleep(300);
  const files = readdirSync(out).filter((f) => f.endsWith(".html"));
  if (!files.length) fail("내려받은 HTML 없음");
  else {
    const html = readFileSync(join(out, files[0]), "utf8");
    log("내려받기", files[0], html.length, "bytes,", (html.match(/data:image\//g) || []).length, "개 이미지 내장,", html.includes(marker) ? "수정 반영" : "수정 누락");
    if (!html.includes(marker)) fail("내려받은 HTML에 수정이 없음");
    if (/src="http:\/\/127\.0\.0\.1|src="\/assets\//.test(html)) fail("내려받은 HTML에 외부 경로 이미지가 남음");
  }
  await page.screenshot({ path: join(out, "3-editor-after.png") });

  // 새로고침 → 서버에서 복원
  await page.reload({ waitUntil: "networkidle0" });
  frame = await previewFrame(page);
  const restored = await frame.$eval(`[data-slot="${target.path}"]`, (el) => el.innerText);
  if (!restored.includes(marker)) fail("새로고침 후 수정이 복원되지 않음"); else log("새로고침 복원 확인");
  log(process.exitCode ? "E2E 실패" : "E2E 통과");
} catch (e) {
  fail(e.message);
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
} finally {
  await browser.close();
}
