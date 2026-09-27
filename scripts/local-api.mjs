/**
 * 로컬 API 브리지 — 진짜 Lambda 핸들러를 프로세스 안에서 돌린다. Bedrock은 로컬 AWS 자격증명으로 실제 호출.
 * 저장소는 TABLE 환경변수가 있으면 그 DynamoDB 테이블, 없으면 메모리(LOCAL_STORE=memory).
 *
 *   export AWS_REGION=ap-northeast-2            # Bedrock을 호출할 리전
 *   npm run local                                  # sync:templates 후 http://127.0.0.1:8787
 *   LOCAL_API=http://127.0.0.1:8787 npm run dev    # Vite가 /api 와 /config.json 을 여기로 프록시
 */
import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
process.env.AWS_REGION ||= "ap-northeast-2";
delete process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
if (!process.env.TABLE) process.env.LOCAL_STORE ||= "memory";

const { handler } = await import("../lambda/api/handler.mjs");

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/config.json") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ apiUrl: "/api" }));
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  const started = Date.now();
  try {
    const result = await handler({
      requestContext: { http: { method: req.method } },
      rawPath: url.pathname,
      queryStringParameters: url.search ? Object.fromEntries(url.searchParams) : undefined,
      body: body || undefined,
      isBase64Encoded: false,
    });
    res.writeHead(result.statusCode, { "content-type": "application/json", ...(result.headers || {}) });
    res.end(result.body || "");
    console.log(`${req.method} ${url.pathname}${url.search} -> ${result.statusCode} (${Date.now() - started}ms)`);
  } catch (e) {
    console.error("bridge failure:", e);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "local bridge failure" }));
  }
}).listen(port, "127.0.0.1", () => console.log(`local API http://127.0.0.1:${port}  store=${process.env.TABLE || "memory"}`));
