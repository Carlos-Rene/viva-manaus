import fs from "node:fs";
import path from "node:path";
import { assetTypes } from "./asset-types.mjs";
const read = (p) => fs.readFileSync(p, "utf8");
const assets = {};
function asset(url, content) {
  assets[url] = {
    type: assetTypes[path.extname(url).toLowerCase()],
    data: Buffer.from(content).toString("base64"),
  };
}
function walk(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name),
      url = prefix + "/" + entry.name;
    if (entry.isDirectory()) walk(source, url);
    else if (assetTypes[path.extname(entry.name).toLowerCase()])
      asset(url, fs.readFileSync(source));
  }
}
walk("public");
asset(
  "/index.html",
  read("src/client/index.html").replace(/<!-- VIEW:([\w-]+) -->/g, (_, name) =>
    read(`src/client/views/${name}.html`),
  ),
);
walk("src/client/styles", "/styles");
const shared = read("src/shared/catalog-validation.js");
const manifest = JSON.parse(read("src/client/scripts/manifest.json"));
// Classic-script bundle preserves the global handlers used by the HTML views.
asset(
  "/scripts/app.js",
  [shared, ...manifest.map((file) => read("src/client/" + file))].join("\n;\n"),
);
const worker =
  "const ASSETS=" +
  JSON.stringify(assets) +
  ";\n" +
  shared +
  "\n" +
  read("src/server/worker.js");
fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist/server", { recursive: true });
fs.mkdirSync("dist/.openai", { recursive: true });
fs.writeFileSync("dist/server/index.js", worker);
fs.copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");
console.log(`Worker construído: ${Object.keys(assets).length} arquivos.`);
