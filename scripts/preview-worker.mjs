import http from "node:http";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createLocalAnalysisLimiter } from "./local-analysis-limiter.mjs";

const MAX_REQUEST_BYTES = 5 * 1024 * 1024 + 64 * 1024;
const ANALYSIS_LIMIT_ERROR =
  "Muitas análises em pouco tempo. Aguarde um pouco e tente novamente.";
const MAX_CONCURRENT_ANALYSES = 1;

class PayloadTooLargeError extends Error {}

function sendJson(req, res, status, value, closeRequest = false) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...(closeRequest ? { Connection: "close" } : {}),
  });
  res.end(JSON.stringify(value), closeRequest ? () => req.destroy() : undefined);
}

function readBoundedBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    function cleanup() {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    }

    function onData(chunk) {
      total += chunk.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        req.pause();
        cleanup();
        chunks.length = 0;
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(chunk);
    }

    function onEnd() {
      cleanup();
      resolve(Buffer.concat(chunks, total));
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
  });
}

async function previewEnvironment() {
  let contents = "";
  try {
    contents = await readFile(".env", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const fileValues = {};
  for (const line of contents.split(/\r?\n/)) {
    const match =
      /^\s*(ALLOWED_ORIGINS|OLLAMA_BASE_URL|OLLAMA_MODEL|OLLAMA_API_TOKEN|VIVA_DEV_EMAILS)\s*=\s*(.*?)\s*$/.exec(
        line,
      );
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2").split(/\s+#/)[0];
    fileValues[match[1]] = value;
  }
  return {
    ALLOWED_ORIGINS:
      process.env.ALLOWED_ORIGINS || fileValues.ALLOWED_ORIGINS,
    OLLAMA_BASE_URL:
      process.env.OLLAMA_BASE_URL || fileValues.OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || fileValues.OLLAMA_MODEL,
    OLLAMA_API_TOKEN:
      process.env.OLLAMA_API_TOKEN || fileValues.OLLAMA_API_TOKEN,
    VIVA_DEV_EMAILS: process.env.VIVA_DEV_EMAILS || fileValues.VIVA_DEV_EMAILS,
    LOCAL_PREVIEW: true,
    ANALYSIS_LIMITER: createLocalAnalysisLimiter(),
  };
}

spawnSync(process.execPath, ["scripts/build-worker.mjs"], { stdio: "inherit" });
const { default: worker } = await import(
  pathToFileURL(process.cwd() + "/dist/server/index.js")
);
const env = await previewEnvironment();
let activeAnalyses = 0;
const server = http.createServer(async (req, res) => {
  const contentLength = req.headers["content-length"];
  if (
    contentLength !== undefined &&
    Number(contentLength) > MAX_REQUEST_BYTES
  ) {
    sendJson(
      req,
      res,
      413,
      { error: "O envio excede o limite permitido de 5 MB." },
      true,
    );
    return;
  }

  const isAnalysis =
    req.method === "POST" &&
    req.url?.split("?", 1)[0] === "/api/analyze-image";
  if (isAnalysis && activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    sendJson(req, res, 429, { error: ANALYSIS_LIMIT_ERROR }, true);
    return;
  }
  if (isAnalysis) activeAnalyses += 1;

  try {
    const body = await readBoundedBody(req);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const request = new Request("http://" + req.headers.host + req.url, {
      method: req.method,
      headers,
      ...(!["GET", "HEAD"].includes(req.method)
        ? { body }
        : {}),
    });
    const result = await worker.fetch(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      sendJson(
        req,
        res,
        413,
        { error: "O envio excede o limite permitido de 5 MB." },
        true,
      );
    } else if (!res.destroyed && !res.headersSent) {
      console.error("Preview request failed:", error);
      sendJson(req, res, 500, {
        error: "Não foi possível concluir a solicitação na prévia.",
      });
    } else {
      console.error("Preview request failed:", error);
    }
  } finally {
    if (isAnalysis) activeAnalyses -= 1;
  }
});
server.requestTimeout = 60_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.listen(4173, "127.0.0.1", () =>
  console.log("Worker preview ready on 4173. No simulated sign-in."),
);
