import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import worker from "../dist/server/index.js";
const manifest = JSON.parse(
  fs.readFileSync("src/client/scripts/manifest.json", "utf8"),
);
assert.equal(new Set(manifest).size, manifest.length);
for (const file of manifest)
  assert.ok(fs.existsSync("src/client/" + file), file);
const response = await worker.fetch(new Request("https://viva.test/"), {});
assert.equal(response.status, 200);
const html = await response.text();
for (const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"?#]+)[^"]*"/g)) {
  if (match[1].match(/^\/sign(in|out)/)) continue;
  const asset = await worker.fetch(
    new Request("https://viva.test" + match[1]),
    {},
  );
  assert.equal(asset.status, 200, match[1]);
}
const script = await worker.fetch(
  new Request("https://viva.test/scripts/app.js"),
  {},
);
new vm.Script(await script.text());
assert.ok(!html.includes('src="app.js"'));
console.log("Estrutura, recursos locais e sintaxe do bundle: OK.");
