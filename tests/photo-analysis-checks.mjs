import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../dist/server/index.js";
import { createLocalAnalysisLimiter } from "../scripts/local-analysis-limiter.mjs";

const endpoint = "https://viva.test/api/analyze-image";
const localPreviewEndpoint = "http://127.0.0.1:4173/api/analyze-image";
const origin = "https://viva.test";
const tunnelOrigin = "https://viva-preview.loca.lt";
const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0,
]);
const successfulAnalysis = {
  subjectTitle: "Ave possivelmente observada",
  visibleDescription: "A foto mostra uma ave pousada em um galho.",
  facts: ["A plumagem visível tem tons claros.", "O animal está em repouso."],
  uncertain: true,
  uncertaintyNotice: "A imagem não permite confirmar a espécie.",
};
const localLimiterKeys = [];
const localEnv = {
  OLLAMA_BASE_URL: "http://127.0.0.1:11434",
  LOCAL_PREVIEW: true,
  ANALYSIS_LIMITER: {
    async limit({ key }) {
      localLimiterKeys.push(key);
      return { success: true };
    },
  },
};
let modelStatus = 200;
let modelPayload = successfulAnalysis;
let modelError = null;
let modelCalls = 0;
let modelRequest;
globalThis.fetch = async (url, options) => {
  modelCalls += 1;
  modelRequest = { url: String(url), options };
  if (modelError) throw modelError;
  return new Response(
    JSON.stringify({ message: { content: JSON.stringify(modelPayload) } }),
    { status: modelStatus },
  );
};

function requestFor({
  bytes = png,
  type = "image/png",
  includePhoto = true,
  requestOrigin = origin,
  requestUrl = endpoint,
} = {}) {
  const form = new FormData();
  if (includePhoto)
    form.append("photo", new Blob([bytes], { type }), "olhar-curioso");
  return new Request(requestUrl, {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      "CF-Connecting-IP": "198.51.100.4",
      "X-Forwarded-For": "203.0.113.99",
    },
    body: form,
  });
}

async function call(request, testEnv = localEnv) {
  const response = await worker.fetch(request, testEnv);
  return { response, payload: await response.json() };
}

let result = await call(
  new Request(endpoint, { method: "GET", headers: { Origin: origin } }),
);
assert.equal(result.response.status, 405);

result = await call(requestFor({ requestOrigin: "https://other.test" }));
assert.equal(result.response.status, 403);

result = await call(
  requestFor({
    requestOrigin: tunnelOrigin,
    requestUrl: localPreviewEndpoint,
  }),
  { ...localEnv, ALLOWED_ORIGINS: tunnelOrigin },
);
assert.equal(result.response.status, 200);
assert.deepEqual(result.payload, successfulAnalysis);
assert.equal(modelRequest.url, "http://127.0.0.1:11434/api/chat");
assert.equal(localLimiterKeys.at(-1), "local-preview-global");
const localModelRequest = JSON.parse(modelRequest.options.body);
assert.equal(
  localModelRequest.messages[0].images[0],
  Buffer.from(png).toString("base64"),
);

const callsBeforeUnapprovedOrigin = modelCalls;
result = await call(
  requestFor({
    requestOrigin: "https://other.test",
    requestUrl: localPreviewEndpoint,
  }),
  { ...localEnv, ALLOWED_ORIGINS: tunnelOrigin },
);
assert.equal(result.response.status, 403);
assert.equal(modelCalls, callsBeforeUnapprovedOrigin);

result = await call(requestFor(), { LOCAL_PREVIEW: true });
assert.equal(result.response.status, 503);
assert.match(result.payload.error, /endereço do servidor Ollama/);

result = await call(requestFor(), {
  ...localEnv,
  ANALYSIS_LIMITER: undefined,
});
assert.equal(result.response.status, 503);
assert.match(result.payload.error, /configurado para uso público/);

result = await call(requestFor({ type: "image/gif" }));
assert.equal(result.response.status, 415);

result = await call(
  requestFor({ bytes: new Uint8Array([1, 2, 3]), type: "image/png" }),
);
assert.equal(result.response.status, 415);

result = await call(requestFor({ bytes: new Uint8Array(), type: "image/png" }));
assert.equal(result.response.status, 400);

result = await call(
  requestFor({
    bytes: new Uint8Array(5 * 1024 * 1024 + 1),
    type: "image/png",
  }),
);
assert.equal(result.response.status, 413);

result = await call(requestFor({ includePhoto: false }));
assert.equal(result.response.status, 400);

const productionEnv = {
  OLLAMA_BASE_URL: "https://ollama.example.test",
  OLLAMA_API_TOKEN: "server-only-test-token",
  OLLAMA_MODEL: "gemma3:4b",
  ANALYSIS_LIMITER: {
    async limit() {
      return { success: true };
    },
  },
};
const callsBeforeUnprotected = modelCalls;
result = await call(requestFor(), {
  OLLAMA_BASE_URL: "http://ollama.example.test",
  OLLAMA_API_TOKEN: "server-only-test-token",
  ANALYSIS_LIMITER: productionEnv.ANALYSIS_LIMITER,
});
assert.equal(result.response.status, 503);
assert.match(result.payload.error, /HTTPS protegido por token/);
assert.equal(modelCalls, callsBeforeUnprotected);

const callsBeforeLimit = modelCalls;
result = await call(requestFor(), {
  ...localEnv,
  ANALYSIS_LIMITER: {
    async limit() {
      return { success: false };
    },
  },
});
assert.equal(result.response.status, 429);
assert.match(result.payload.error, /Muitas análises/);
assert.equal(modelCalls, callsBeforeLimit);

result = await call(requestFor(), {
  ...localEnv,
  ANALYSIS_LIMITER: {
    async limit() {
      throw new Error("limiter unavailable");
    },
  },
});
assert.equal(result.response.status, 503);
assert.match(result.payload.error, /temporariamente indisponível/);

result = await call(requestFor(), {
  OLLAMA_BASE_URL: "https://ollama.example.test",
  OLLAMA_API_TOKEN: "server-only-test-token",
});
assert.equal(result.response.status, 503);
assert.match(result.payload.error, /configurado para uso público/);

result = await call(requestFor(), productionEnv);
assert.equal(result.response.status, 200);
assert.deepEqual(result.payload, successfulAnalysis);
assert.equal(
  modelRequest.url,
  "https://ollama.example.test/api/chat",
);
assert.equal(
  modelRequest.options.headers.Authorization,
  "Bearer server-only-test-token",
);
assert.equal(
  modelRequest.options.headers["Content-Type"],
  "application/json",
);
assert.ok(modelRequest.options.signal);
const sentRequest = JSON.parse(modelRequest.options.body);
assert.equal(sentRequest.model, "gemma3:4b");
assert.equal(sentRequest.stream, false);
assert.equal(sentRequest.messages[0].images[0], Buffer.from(png).toString("base64"));
assert.match(sentRequest.messages[0].content, /português brasileiro/);
assert.equal(modelRequest.options.signal.constructor.name, "AbortSignal");
assert.equal(modelRequest.options.signal.aborted, false);
const workerSource = fs.readFileSync("src/server/worker.js", "utf8");
assert.match(workerSource, /AbortSignal\.timeout\(120000\)/);

modelStatus = 429;
result = await call(requestFor());
assert.equal(result.response.status, 429);
assert.match(result.payload.error, /servidor de análise está ocupado/);

modelStatus = 401;
result = await call(requestFor());
assert.equal(result.response.status, 503);
assert.doesNotMatch(JSON.stringify(result.payload), /server-only-test-token/);

modelStatus = 404;
result = await call(requestFor());
assert.equal(result.response.status, 503);
assert.match(result.payload.error, /gemma3:4b não está disponível/);

modelStatus = 200;
modelError = Object.assign(new Error("timeout"), { name: "TimeoutError" });
result = await call(requestFor());
assert.equal(result.response.status, 504);
assert.match(result.payload.error, /demorou mais/);
modelError = null;

modelPayload = { ...successfulAnalysis, facts: "não é uma lista" };
result = await call(requestFor());
assert.equal(result.response.status, 502);
assert.match(result.payload.error, /análise inválida/);

const cameraSource = fs.readFileSync(
  "src/client/scripts/features/camera.js",
  "utf8",
);
assert.doesNotMatch(
  cameraSource,
  /OLLAMA_API_TOKEN|OLLAMA_BASE_URL|GEMINI_API_KEY|x-goog-api-key/,
);
assert.match(cameraSource, /fetch\("\/api\/analyze-image"/);

let clock = 0;
const globalLimiter = createLocalAnalysisLimiter({
  maxRequests: 2,
  windowMs: 1000,
  now: () => clock,
});
const firstWindow = await Promise.all([
  globalLimiter.limit({ key: "visitor-a" }),
  globalLimiter.limit({ key: "visitor-b" }),
  globalLimiter.limit({ key: "visitor-c" }),
]);
assert.equal(firstWindow.filter(({ success }) => success).length, 2);
assert.equal(firstWindow.filter(({ success }) => !success).length, 1);
clock = 1000;
assert.equal((await globalLimiter.limit({ key: "visitor-c" })).success, true);

let concurrentClock = 0;
const concurrentLimiter = createLocalAnalysisLimiter({
  maxRequests: 3,
  windowMs: 1000,
  now: () => concurrentClock,
});
const concurrentResults = await Promise.all(
  Array.from({ length: 20 }, () => concurrentLimiter.limit()),
);
assert.equal(
  concurrentResults.filter(({ success }) => success).length,
  3,
);

console.log(
  "Image-analysis API checks: image validation, local/global rate limits, fail-closed limiter, Ollama auth/configuration, timeout, provider errors and uncertainty: OK.",
);
