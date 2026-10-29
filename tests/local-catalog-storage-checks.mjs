import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import worker from "../dist/server/index.js";
import { createLocalCatalogBucket } from "../scripts/local-catalog-storage.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "viva-catalog-"));
const dataDirectory = path.join(temporaryDirectory, "data");
const catalogPath = path.join(dataDirectory, "catalog.json");
const secret = "local-test-session-secret-with-at-least-32-bytes";
const passwordHash = [
  "pbkdf2-sha256",
  "v1",
  "310000",
  Buffer.alloc(16, 1).toString("base64url"),
  Buffer.alloc(32, 2).toString("base64url"),
].join("$");

async function signedDeveloperCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "developer",
    iat: now,
    exp: now + 3600,
    nonce: Buffer.alloc(16, 3).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `v1.${encoded}`;
  const signature = new Uint8Array(
    await webcrypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  return `__Host-viva-session=${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}

const developerCookie = await signedDeveloperCookie();
const localEnv = () => ({
  LOCAL_PREVIEW: true,
  BUCKET: createLocalCatalogBucket(dataDirectory),
  VIVA_DEV_PASSWORD_HASH: passwordHash,
  VIVA_SESSION_SECRET: secret,
  ALLOWED_ORIGINS: "",
});
const call = (
  path,
  method = "GET",
  headers = {},
  body,
  env = localEnv(),
) =>
  worker.fetch(
    new Request(`https://viva.test${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  );
const headers = (extra = {}) => ({
  Origin: "https://viva.test",
  "Content-Type": "application/json",
  ...extra,
});
const catalog = () => ({
  settings: {
    brand: "viva",
    welcome: "Olá",
    intro: "Teste",
    accent: "#a9bc94",
    background: "#18221d",
    routeColor: "#9ab184",
  },
  activities: Array.from({ length: 20 }, () => [
    "A",
    "B",
    "C",
    "Movimento",
    5,
    "Passos",
  ]),
  parks: [],
  events: [],
  videos: [],
  texts: {},
});

try {
  const initiallyEmpty = await call("/api/catalog");
  assert.equal(initiallyEmpty.status, 200);
  assert.deepEqual(await initiallyEmpty.json(), {
    version: null,
    config: null,
  });
  const emptyFile = JSON.parse(await readFile(catalogPath, "utf8"));
  assert.deepEqual(emptyFile, {
    schemaVersion: 1,
    etag: null,
    config: null,
  });

  const unauthorized = await call(
    "/api/catalog",
    "PUT",
    headers({ "If-None-Match": "*" }),
    catalog(),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(JSON.parse(await readFile(catalogPath, "utf8")).etag, null);

  const blockedOrigin = await call(
    "/api/catalog",
    "PUT",
    headers({ Cookie: developerCookie, Origin: "https://evil.test" }),
    catalog(),
  );
  assert.equal(blockedOrigin.status, 403);

  const firstCatalog = catalog();
  const concurrentPublishes = await Promise.all(
    [firstCatalog, catalog()].map((config) =>
      call(
        "/api/catalog",
        "PUT",
        headers({ Cookie: developerCookie, "If-None-Match": "*" }),
        config,
      ),
    ),
  );
  assert.deepEqual(
    concurrentPublishes.map((response) => response.status).sort(),
    [200, 409],
  );

  const current = await (await call("/api/catalog")).json();
  const published = catalog();
  published.videos = [
    {
      id: "zGqvlPkjAcY",
      title: "Vídeo persistente",
      type: "Exercício",
      start: 0,
    },
  ];
  const publishResponse = await call(
    "/api/catalog",
    "PUT",
    headers({ Cookie: developerCookie, "If-Match": current.version }),
    published,
  );
  assert.equal(publishResponse.status, 200);
  const publishedVersion = (await publishResponse.json()).version;

  const restartedEnv = localEnv();
  const afterRestart = await (
    await call("/api/catalog", "GET", {}, undefined, restartedEnv)
  ).json();
  assert.equal(afterRestart.version, publishedVersion);
  assert.deepEqual(afterRestart.config.videos, published.videos);
  const storedText = await readFile(catalogPath, "utf8");
  assert.equal(storedText.includes(secret), false);
  assert.equal(storedText.includes(passwordHash), false);

  const deleted = { ...afterRestart.config, videos: [] };
  const deleteResponse = await call(
    "/api/catalog",
    "PUT",
    headers({ Cookie: developerCookie, "If-Match": afterRestart.version }),
    deleted,
    restartedEnv,
  );
  assert.equal(deleteResponse.status, 200);
  const finalEnv = localEnv();
  const afterDeleteRestart = await (
    await call("/api/catalog", "GET", {}, undefined, finalEnv)
  ).json();
  assert.deepEqual(afterDeleteRestart.config.videos, []);

  const malformedDirectory = path.join(temporaryDirectory, "malformed");
  const malformedPath = path.join(malformedDirectory, "catalog.json");
  await mkdir(malformedDirectory, { recursive: true });
  await writeFile(malformedPath, "{invalid", "utf8");
  const malformedEnv = {
    ...localEnv(),
    BUCKET: createLocalCatalogBucket(malformedDirectory),
  };
  const malformedResponse = await call(
    "/api/catalog",
    "GET",
    {},
    undefined,
    malformedEnv,
  );
  assert.equal(malformedResponse.status, 503);
  assert.equal(await readFile(malformedPath, "utf8"), "{invalid");
  const malformedWrite = await call(
    "/api/catalog",
    "PUT",
    headers({ Cookie: developerCookie, "If-None-Match": "*" }),
    catalog(),
    malformedEnv,
  );
  assert.equal(malformedWrite.status, 503);
  assert.equal(await readFile(malformedPath, "utf8"), "{invalid");

  const invalidConfigDirectory = path.join(
    temporaryDirectory,
    "invalid-config",
  );
  await mkdir(invalidConfigDirectory, { recursive: true });
  await writeFile(
    path.join(invalidConfigDirectory, "catalog.json"),
    JSON.stringify({
      schemaVersion: 1,
      etag: "local-0123456789abcdef0123456789abcdef",
      config: {},
    }),
    "utf8",
  );
  const invalidConfigResponse = await call(
    "/api/catalog",
    "GET",
    {},
    undefined,
    {
      ...localEnv(),
      BUCKET: createLocalCatalogBucket(invalidConfigDirectory),
    },
  );
  assert.equal(invalidConfigResponse.status, 503);

  let r2GetCalls = 0;
  let r2PutCalls = 0;
  let r2Config = null;
  const productionEnv = {
    LOCAL_PREVIEW: false,
    VIVA_DEV_PASSWORD_HASH: passwordHash,
    VIVA_SESSION_SECRET: secret,
    BUCKET: {
      async get(key) {
        assert.equal(key, "viva/catalog.json");
        r2GetCalls += 1;
        return r2Config
          ? {
              etag: "r2-version",
              async json() {
                return r2Config;
              },
            }
          : null;
      },
      async put(key, text, options) {
        assert.equal(key, "viva/catalog.json");
        assert.deepEqual(options.onlyIf, { etagDoesNotMatch: "*" });
        r2PutCalls += 1;
        r2Config = JSON.parse(text);
        return { etag: "r2-version" };
      },
    },
  };
  assert.equal(
    (await call("/api/catalog", "GET", {}, undefined, productionEnv)).status,
    200,
  );
  const productionWrite = await call(
    "/api/catalog",
    "PUT",
    headers({ Cookie: developerCookie, "If-None-Match": "*" }),
    catalog(),
    productionEnv,
  );
  assert.equal(productionWrite.status, 200);
  assert.equal(r2GetCalls, 1);
  assert.equal(r2PutCalls, 1);

  const productionWithoutBucket = await call(
    "/api/catalog",
    "GET",
    {},
    undefined,
    { LOCAL_PREVIEW: false },
  );
  assert.equal(productionWithoutBucket.status, 503);

  const failingBucketResponse = await call(
    "/api/catalog",
    "PUT",
    headers({ Cookie: developerCookie, "If-None-Match": "*" }),
    catalog(),
    {
      ...productionEnv,
      BUCKET: {
        async put() {
          throw new Error("storage unavailable");
        },
      },
    },
  );
  assert.equal(failingBucketResponse.status, 503);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  "Checks passed: local catalog creation, protected publication/deletion, concurrent updates, restart persistence, malformed files, and production R2 storage.",
);
