/** API 클라이언트 — 배포 시 API 주소는 /config.json(BucketDeployment가 주입)에서 읽는다. 라우트는 둘: /generate, /flyers/{id}. */

let basePromise;
let cachedBase = null; // pagehide처럼 await 불가한 자리용

async function apiBase() {
  if (!basePromise) {
    basePromise = (async () => {
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
      let apiUrl;
      try {
        const res = await fetch("/config.json");
        if (!res.ok) throw new Error(`config.json ${res.status}`);
        ({ apiUrl } = await res.json());
      } catch (e) {
        basePromise = null; // 다음 호출에서 다시 시도한다
        throw friendly("서버 설정을 불러오지 못했어요. 새로고침한 뒤 다시 시도해 주세요.", e);
      }
      return apiUrl.replace(/\/$/, "");
    })().then((b) => (cachedBase = b));
  }
  return basePromise;
}

function friendly(message, cause) {
  return new Error(message, { cause });
}
const STATUS_TEXT = {
  429: "요청이 많아 잠시 쉬어야 해요. 1분 뒤 다시 시도해 주세요.",
  502: "서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.",
  503: "서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.",
  504: "서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.",
};

async function call(method, path, body, { signal } = {}) {
  const base = await apiBase();
  const payload = body ? JSON.stringify(body) : undefined;
  let res;
  try {
    res = await fetch(base + path, { method, signal, headers: payload ? { "content-type": "application/json" } : undefined, body: payload });
  } catch (e) {
    if (e?.name === "TimeoutError") throw friendly("서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.", e);
    if (e?.name === "AbortError") throw e;
    throw friendly("서버에 연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.", e);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || STATUS_TEXT[res.status] || `요청을 처리하지 못했어요 (오류 ${res.status}). 잠시 후 다시 시도해 주세요.`);
    error.status = res.status;
    throw error;
  }
  return data;
}

/** 원고 → 스펙 JSON. 한 번 호출, API Gateway 30초 상한 안에서 끝난다. */
export const generateFlyer = (brief) => call("POST", "/generate", { brief }, { signal: AbortSignal.timeout(40000) });
export const loadFlyer = (id) => call("GET", `/flyers/${id}`);
export const saveFlyer = (id, payload) => call("PUT", `/flyers/${id}`, payload);

/** 페이지 이탈 직전 최선의 저장 시도 — await 불가 자리라 fire-and-forget */
export function saveFlyerKeepalive(id, payload) {
  if (!cachedBase) return;
  fetch(`${cachedBase}/flyers/${id}`, { method: "PUT", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
    .catch(() => { /* 최선 시도일 뿐 */ });
}
