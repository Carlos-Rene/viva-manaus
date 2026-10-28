import assert from "node:assert/strict";
import worker from "../dist/server/index.js";
let stored = null,
  revision = 0;
const env = {
  VIVA_DEV_EMAILS: "owner@example.test",
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
const user = {
  "oai-authenticated-user-id": "user",
  "oai-authenticated-user-email": "person@example.test",
};
const owner = {
  "oai-authenticated-user-id": "owner",
  "oai-authenticated-user-email": "owner@example.test",
};
const call = (path, method = "GET", headers = {}, body) =>
  worker.fetch(
    new Request("https://viva.test" + path, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  );
assert.equal((await call("/api/catalog", "PUT", {}, {})).status, 401);
assert.equal((await call("/api/catalog", "PUT", user, {})).status, 403);
assert.equal((await call("/api/me", "GET", user)).status, 200);
assert.equal(
  (await (await call("/api/me", "GET", user)).json()).isDeveloper,
  false,
);
assert.equal(
  (await (await call("/api/me", "GET", owner)).json()).isDeveloper,
  true,
);
assert.equal(
  (
    await call(
      "/api/catalog",
      "PUT",
      { ...owner, Origin: "https://evil.test" },
      {},
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
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-None-Match": "*" }, data))
    .status,
  200,
);
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-None-Match": "*" }, data))
    .status,
  409,
);
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-Match": "wrong" }, data))
    .status,
  409,
);
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-Match": "v1" }, data))
    .status,
  200,
);
const read = await (await call("/api/catalog", "GET", user)).json();
assert.equal(read.version, "v2");
assert.equal(read.config.settings.brand, "viva");
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
  (await call("/api/catalog", "PUT", { ...owner, "If-Match": "v2" }, data))
    .status,
  200,
);
data.videos[0].plan.sets = 0;
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-Match": "v3" }, data))
    .status,
  400,
);
data.videos[0].plan = { mode: "time", seconds: 60 };
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-Match": "v3" }, data))
    .status,
  200,
);
data.videos[0].plan.seconds = -1;
assert.equal(
  (await call("/api/catalog", "PUT", { ...owner, "If-Match": "v4" }, data))
    .status,
  400,
);
console.log(
  "Checks passed: authentication, developer allowlist, origin, concurrent publication, shared reads and video ranges.",
);
