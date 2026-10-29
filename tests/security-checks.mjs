import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../dist/server/index.js";

const password = "test-developer-password";
const secret = "test-session-secret-with-at-least-32-bytes";
const iterations = 310000;
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const material = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const digest = new Uint8Array(
  await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  ),
);
const passwordHash = `pbkdf2-sha256$v1$${iterations}$${Buffer.from(salt).toString("base64url")}$${Buffer.from(digest).toString("base64url")}`;
let stored = null;
let revision = 0;
const env = {
  VIVA_DEV_PASSWORD_HASH: passwordHash,
  VIVA_SESSION_SECRET: secret,
  ALLOWED_ORIGINS: "https://preview.viva.test",
  BUCKET: {
    async get() {
      return stored
        ? {
            etag: stored.etag,
            async json() {
              return stored.config;
            },
          }
        : null;
    },
    async put(key, text, options) {
      if (options.onlyIf.etagDoesNotMatch === "*" && stored) return null;
      if (
        options.onlyIf.etagMatches &&
        options.onlyIf.etagMatches !== stored?.etag
      )
        return null;
      stored = { config: JSON.parse(text), etag: "v" + ++revision };
      return { etag: stored.etag };
    },
  },
};
const call = (path, method = "GET", headers = {}, body, requestEnv = env, base = "https://viva.test") =>
  worker.fetch(
    new Request(base + path, {
      method,
      headers,
      ...(body !== undefined
        ? {
            body:
              typeof body === "string" ? body : JSON.stringify(body),
          }
        : {}),
    }),
    requestEnv,
  );
const loginHeaders = (ip, origin = "https://viva.test") => ({
  Origin: origin,
  "CF-Connecting-IP": ip,
  "Content-Type": "application/json",
});
const login = (ip, suppliedPassword = password, origin = "https://viva.test") =>
  call(
    "/api/auth/login",
    "POST",
    loginHeaders(ip, origin),
    { password: suppliedPassword },
    env,
    origin === "https://preview.viva.test" ? "http://preview.viva.test" : "https://viva.test",
  );

assert.equal(
  (await call(
    "/api/auth/login",
    "POST",
    { ...loginHeaders("203.0.113.1"), Origin: "https://evil.test" },
    { password },
  )).status,
  403,
);
assert.equal(
  (await call(
    "/api/auth/login",
    "POST",
    { "CF-Connecting-IP": "203.0.113.1", "Content-Type": "application/json" },
    { password },
  )).status,
  403,
);
assert.equal((await login("203.0.113.2", "incorrect-password")).status, 401);

const missingConfig = { BUCKET: env.BUCKET };
assert.equal(
  (
    await call(
      "/api/auth/login",
      "POST",
      loginHeaders("203.0.113.3"),
      { password },
      missingConfig,
    )
  ).status,
  503,
);
assert.deepEqual(
  await (
    await call("/api/me", "GET", {}, undefined, missingConfig)
  ).json(),
  { authenticated: false, isDeveloper: false },
);
assert.equal(
  (
    await call(
      "/api/auth/login",
      "POST",
      loginHeaders("203.0.113.4"),
      { password },
      { ...env, VIVA_DEV_PASSWORD_HASH: "invalid" },
    )
  ).status,
  503,
);
assert.equal(
  (
    await call(
      "/api/auth/login",
      "POST",
      loginHeaders("203.0.113.5"),
      { password },
      { ...env, VIVA_SESSION_SECRET: "short" },
    )
  ).status,
  503,
);
assert.equal(
  (
    await call(
      "/api/auth/login",
      "POST",
      loginHeaders("203.0.113.6"),
      "x".repeat(5000),
    )
  ).status,
  413,
);

for (let attempt = 0; attempt < 5; attempt++)
  assert.equal((await login("198.51.100.10", "wrong-password")).status, 401);
assert.equal((await login("198.51.100.10")).status, 429);

const loginResponse = await login("203.0.113.10");
assert.equal(loginResponse.status, 200);
const loginResult = await loginResponse.json();
assert.deepEqual(loginResult, { authenticated: true, isDeveloper: true });
assert.equal(JSON.stringify(loginResult).includes(password), false);
assert.equal(JSON.stringify(loginResult).includes(secret), false);
const setCookie = loginResponse.headers.get("Set-Cookie");
assert.match(setCookie, /^__Host-viva-session=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /Secure/);
assert.match(setCookie, /SameSite=Strict/);
assert.match(setCookie, /Path=\//);
assert.match(setCookie, /Max-Age=28800/);
const sessionCookie = setCookie.split(";", 1)[0];
assert.equal(
  (await (await call("/api/me", "GET", { Cookie: sessionCookie })).json())
    .isDeveloper,
  true,
);

const forgedCookie = "__Host-viva-session=v1.eyJzdWIiOiJkZXZlbG9wZXIifQ.invalid";
assert.deepEqual(
  await (await call("/api/me", "GET", { Cookie: forgedCookie })).json(),
  { authenticated: false, isDeveloper: false },
);
const token = sessionCookie.slice("__Host-viva-session=".length);
const modifiedCookie = `__Host-viva-session=${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
assert.equal(
  (
    await (
      await call("/api/me", "GET", { Cookie: modifiedCookie })
    ).json()
  ).isDeveloper,
  false,
);
async function signPayload(payload) {
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `v1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const signature = new Uint8Array(
    await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned)),
  );
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}
const now = Math.floor(Date.now() / 1000);
const expired = await signPayload({
  sub: "developer",
  iat: now - 90000,
  exp: now - 1800,
  nonce: Buffer.alloc(16, 1).toString("base64url"),
});
assert.equal(
  (
    await (
      await call("/api/me", "GET", {
        Cookie: `__Host-viva-session=${expired}`,
      })
    ).json()
  ).isDeveloper,
  false,
);

assert.equal(
  (await call("/api/auth/login", "GET")).status,
  405,
);
assert.equal(
  (
    await call(
      "/api/auth/logout",
      "POST",
      { Origin: "https://evil.test" },
    )
  ).status,
  403,
);

const data = {
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
};
const catalogHeaders = (extra = {}) => ({
  Origin: "https://viva.test",
  "Content-Type": "application/json",
  ...extra,
});
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ "If-None-Match": "*" }),
      data,
    )
  ).status,
  401,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({
        "If-None-Match": "*",
        "oai-authenticated-user-id": "developer",
        "oai-authenticated-user-email": "developer@example.test",
      }),
      data,
    )
  ).status,
  401,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: forgedCookie, "If-None-Match": "*" }),
      data,
    )
  ).status,
  401,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, Origin: "https://evil.test" }),
      data,
    )
  ).status,
  403,
);
assert.deepEqual(
  await (await call("/api/catalog")).json(),
  { version: null, config: null },
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-None-Match": "*" }),
      data,
    )
  ).status,
  200,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-None-Match": "*" }),
      data,
    )
  ).status,
  409,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "wrong" }),
      data,
    )
  ).status,
  409,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "v1" }),
      data,
    )
  ).status,
  200,
);
const publicCatalog = await (await call("/api/catalog")).json();
assert.equal(publicCatalog.version, "v2");
assert.equal(publicCatalog.config.settings.brand, "viva");

assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "v2" }),
      "{invalid json",
    )
  ).status,
  400,
);
const range = await call("/assets/videos/viva-como-funciona.mp4", "GET", {
  Range: "bytes=0-99",
});
assert.equal(range.status, 206);
assert.equal((await range.arrayBuffer()).byteLength, 100);
data.videos = [
  {
    id: "zGqvlPkjAcY",
    title: "Teste de treino",
    type: "Exercício",
    start: 0,
    plan: { mode: "reps", sets: 3, reps: 10, rest: 30 },
  },
];
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "v2" }),
      data,
    )
  ).status,
  200,
);
data.videos[0].plan.sets = 0;
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "v3" }),
      data,
    )
  ).status,
  400,
);
data.videos[0].plan = { mode: "time", seconds: 60 };
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "v3" }),
      data,
    )
  ).status,
  200,
);
data.videos[0].plan.seconds = -1;
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      catalogHeaders({ Cookie: sessionCookie, "If-Match": "v4" }),
      data,
    )
  ).status,
  400,
);

const logoutResponse = await call(
  "/api/auth/logout",
  "POST",
  { Origin: "https://viva.test", Cookie: sessionCookie },
);
assert.equal(logoutResponse.status, 200);
assert.match(logoutResponse.headers.get("Set-Cookie"), /Max-Age=0/);
const loggedOutCookie = logoutResponse.headers.get("Set-Cookie").split(";", 1)[0];
assert.equal(
  (
    await (
      await call("/api/me", "GET", { Cookie: loggedOutCookie })
    ).json()
  ).isDeveloper,
  false,
);

const previewOriginLogin = await login(
  "203.0.113.11",
  password,
  "https://preview.viva.test",
);
assert.equal(previewOriginLogin.status, 200);

console.log(
  "Checks passed: password authentication, session integrity and expiry, logout, origin validation, rate limiting, protected writes, public catalog reads, optimistic publication, and video ranges.",
);
