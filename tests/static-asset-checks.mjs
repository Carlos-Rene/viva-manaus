import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import worker from "../dist/server/index.js";
import { assetTypes } from "../scripts/asset-types.mjs";

const requestAsset = (path, method = "GET") =>
  worker.fetch(new Request(`https://viva.test${path}`, { method }), {});

const logo = await requestAsset("/assets/images/viva-logo.jpg");
assert.equal(logo.status, 200);
assert.equal(logo.headers.get("Content-Type"), "image/jpeg");
assert.equal(logo.headers.get("X-Content-Type-Options"), "nosniff");
const logoBytes = new Uint8Array(await logo.arrayBuffer());
assert.deepEqual([...logoBytes.slice(0, 3)], [255, 216, 255]);
assert.deepEqual(
  Buffer.from(logoBytes),
  await readFile("public/assets/images/viva-logo.jpg"),
);

const transparentLogo = await requestAsset(
  "/assets/images/viva-logo-transparent.png",
);
assert.equal(transparentLogo.status, 200);
assert.equal(transparentLogo.headers.get("Content-Type"), "image/png");
const transparentLogoBytes = Buffer.from(await transparentLogo.arrayBuffer());
assert.deepEqual(
  [...transparentLogoBytes.subarray(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
);
assert.equal(transparentLogoBytes.readUInt32BE(16), 1024);
assert.equal(transparentLogoBytes.readUInt32BE(20), 1024);
assert.equal(transparentLogoBytes[25], 6);

for (const [path, contentType] of [
  ["/assets/images/visual-1.svg", "image/svg+xml"],
  ["/styles/app.css", "text/css; charset=utf-8"],
  ["/scripts/app.js", "text/javascript; charset=utf-8"],
  ["/site.webmanifest", "application/manifest+json; charset=utf-8"],
  ["/assets/images/viva-logo-transparent.png", "image/png"],
  ["/assets/images/viva-icon-180.png", "image/png"],
  ["/assets/images/viva-icon-192.png", "image/png"],
  ["/assets/images/viva-icon-512.png", "image/png"],
]) {
  const response = await requestAsset(path);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("Content-Type"), contentType, path);
}

for (const [filename, size] of [
  ["viva-icon-180.png", 180],
  ["viva-icon-192.png", 192],
  ["viva-icon-512.png", 512],
]) {
  const png = await readFile(`public/assets/images/${filename}`);
  assert.deepEqual([...png.subarray(0, 8)], [
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}

for (const [extension, contentType] of [
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".avif", "image/avif"],
]) {
  assert.equal(assetTypes[extension], contentType);
}

assert.equal((await requestAsset("/assets/images/not-found.jpg")).status, 404);
assert.equal((await requestAsset("/../../etc/passwd")).status, 404);
assert.equal(
  (await requestAsset("/assets/images/%2e%2e/%2e%2e/%2e%2e/etc/passwd"))
    .status,
  404,
);
assert.equal(
  (await requestAsset("/assets/images/viva-logo.jpg", "HEAD")).status,
  200,
);

const html = await (await requestAsset("/")).text();
const stylesheet = await (await requestAsset("/styles/app.css")).text();
const webManifest = await (await requestAsset("/site.webmanifest")).json();
const logoLinks = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(
  ([, , content]) =>
    content.includes('src="/assets/images/viva-logo-transparent.png"'),
);
assert.equal(logoLinks.length, 3);
for (const [, attributes, content] of logoLinks) {
  assert.match(attributes, /href="\/"/);
  assert.match(attributes, /aria-label="Voltar para o início"/);
  assert.match(attributes, /onclick="navigateFromLogo\(event\)"/);
  assert.match(content, /alt="Viva"/);
}
assert.ok(html.includes('href="/assets/images/viva-icon-192.png"'));
assert.match(
  stylesheet,
  /\.logo img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/s,
);
assert.match(
  stylesheet,
  /header \.brand img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/s,
);
assert.match(
  stylesheet,
  /header \.brand > img\s*\{\s*width:\s*43px !important;\s*height:\s*43px !important;/,
);
assert.match(
  stylesheet,
  /\.avatar\s*\{[^}]*width:\s*43px;[^}]*height:\s*43px;/s,
);
assert.match(
  stylesheet,
  /\.splash-logo img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/s,
);
assert.match(
  stylesheet,
  /\.logo:focus-visible,[\s\S]*?\.splash-logo:focus-visible\s*\{[^}]*outline:/,
);
assert.match(stylesheet, /\.brand\s*\{[^}]*cursor:\s*pointer;/s);

const coreScript = await readFile(
  "src/client/scripts/features/core.js",
  "utf8",
);
const navigationHelper = coreScript.match(
  /function navigateFromLogo\(event\) \{[\s\S]*?\n\}/,
)?.[0];
assert.ok(navigationHelper, "Logo navigation handler exists");
let homeIsActive = false;
let preventedDefault = false;
const navigationCalls = [];
const navigationContext = {
  document: {
    getElementById(id) {
      assert.equal(id, "home");
      return {
        classList: {
          contains(className) {
            assert.equal(className, "active");
            return homeIsActive;
          },
        },
      };
    },
  },
  go(id) {
    navigationCalls.push(id);
  },
};
vm.runInNewContext(
  `${navigationHelper}; globalThis.navigateFromLogo = navigateFromLogo;`,
  navigationContext,
);
navigationContext.navigateFromLogo({
  preventDefault() {
    preventedDefault = true;
  },
});
assert.equal(preventedDefault, true);
assert.deepEqual(navigationCalls, ["home"]);
homeIsActive = true;
navigationContext.navigateFromLogo({ preventDefault() {} });
assert.deepEqual(navigationCalls, ["home"]);

assert.deepEqual(
  webManifest.icons.map(({ src, sizes, type }) => [src, sizes, type]),
  [
    ["/assets/images/viva-icon-192.png", "192x192", "image/png"],
    ["/assets/images/viva-icon-512.png", "512x512", "image/png"],
  ],
);

const preview = spawn(process.execPath, ["scripts/preview-worker.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, VIVA_PREVIEW_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let previewOutput = "";
let previewError = "";
preview.stdout.setEncoding("utf8");
preview.stderr.setEncoding("utf8");
preview.stdout.on("data", (chunk) => {
  previewOutput += chunk;
});
preview.stderr.on("data", (chunk) => {
  previewError += chunk;
});

try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Preview server did not start: ${previewError}`)),
      20_000,
    );
    preview.stdout.on("data", (chunk) => {
      const match = /Worker preview ready on (\d+)/.exec(previewOutput);
      if (!match) return;
      clearTimeout(timeout);
      resolve(Number(match[1]));
    });
    preview.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    preview.once("exit", (code) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Preview server exited before starting (${code}): ${previewOutput}${previewError}`,
        ),
      );
    });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const previewLogo = await fetch(`${baseUrl}/assets/images/viva-logo.jpg`);
  assert.equal(previewLogo.status, 200);
  assert.equal(previewLogo.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(
    Buffer.from(await previewLogo.arrayBuffer()),
    await readFile("public/assets/images/viva-logo.jpg"),
  );
  assert.equal(
    (await fetch(`${baseUrl}/assets/images/missing.jpg`)).status,
    404,
  );
  assert.equal(
    (
      await fetch(
        `${baseUrl}/assets/images/%2e%2e/%2e%2e/%2e%2e/etc/passwd`,
      )
    ).status,
    404,
  );
  assert.equal((await fetch(`${baseUrl}/api/me`)).status, 200);
} finally {
  preview.kill("SIGTERM");
  if (preview.exitCode === null)
    await new Promise((resolve) => preview.once("exit", resolve));
}

console.log(
  "JPG logo, PWA icons, preview delivery, MIME types, missing files, API routing and path traversal: OK.",
);
