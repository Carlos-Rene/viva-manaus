import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const cameraSource = fs.readFileSync(
  "src/client/scripts/features/camera.js",
  "utf8",
);
const natureView = fs.readFileSync("src/client/views/nature.html", "utf8");
const homeView = fs.readFileSync("src/client/views/home.html", "utf8");
const aboutView = fs.readFileSync("src/client/views/about.html", "utf8");
const navigationView = fs.readFileSync("src/client/index.html", "utf8");
const appSource = fs.readFileSync("src/client/scripts/app.js", "utf8");
const developerSource = fs.readFileSync(
  "src/client/scripts/features/developer.js",
  "utf8",
);

const status = { textContent: "" };
const analysisStatus = { textContent: "" };
const consent = { checked: false };
const analysisButton = {
  disabled: false,
  attributes: {},
  setAttribute(name, value) {
    this.attributes[name] = value;
  },
  removeAttribute(name) {
    delete this.attributes[name];
  },
};
const photoActions = {
  classList: {
    hidden: true,
    add() {
      this.hidden = true;
    },
    remove() {
      this.hidden = false;
    },
  },
};
const cameraPanel = {
  classList: {
    add() {},
    remove() {},
  },
};
const photoInput = { value: "" };
const cameraFeed = { srcObject: null, videoWidth: 0, videoHeight: 0 };
const photoContainer = {
  content: null,
  innerHTML: "",
  replaceChildren(content) {
    this.content = content;
  },
};
const elements = new Map([
  ["cameraStatus", status],
  ["photoActions", photoActions],
  ["cameraPanel", cameraPanel],
  ["photo", photoInput],
  ["cameraFeed", cameraFeed],
  ["analysisStatus", analysisStatus],
  ["photoAnalysisConsent", consent],
  ["analyzePhotoButton", analysisButton],
]);
let createdUrls = 0;
const revokedUrls = [];
let resultModal = "";
let resolveAnalysis;
let analysisCalls = 0;
let lastCanvas;

const context = vm.createContext({
  Blob,
  FormData,
  async createImageBitmap(file) {
    assert.ok(file.size > 1024 * 1024);
    return {
      width: 2400,
      height: 1200,
      close() {},
    };
  },
  URL: {
    createObjectURL(file) {
      assert.ok(file instanceof Blob);
      createdUrls += 1;
      return `blob:local-${createdUrls}`;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  },
  document: {
    getElementById(id) {
      return elements.get(id);
    },
    querySelector(selector) {
      return selector === "#nature .discovery-photo" ? photoContainer : null;
    },
    createElement(tag) {
      if (tag === "canvas")
        return (lastCanvas = {
          width: 0,
          height: 0,
          getContext() {
            return { drawImage() {} };
          },
          toBlob(callback) {
            callback(new Blob([[0xff, 0xd8, 0xff]], { type: "image/jpeg" }));
          },
        });
      return { src: "", alt: "", style: "" };
    },
  },
  navigator: {
    mediaDevices: {
      async getUserMedia() {
        const error = new Error("Permission denied");
        error.name = "NotAllowedError";
        throw error;
      },
    },
  },
  modal(markup) {
    resultModal = markup;
  },
  closeModal() {},
  fetch(url, options) {
    analysisCalls += 1;
    assert.equal(url, "/api/analyze-image");
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("photo").type, "image/jpeg");
    return new Promise((resolve) => {
      resolveAnalysis = resolve;
    });
  },
  notify() {},
  cameraRequest: 0,
  cameraStream: null,
});

vm.runInContext(cameraSource, context);

context.discoverPhoto();
assert.match(analysisStatus.textContent, /Fotografe algo curioso/);
assert.equal(resultModal, "");

const galleryPhoto = new Blob([new Uint8Array(1024 * 1024 + 1)], {
  type: "image/jpeg",
});
context.previewPhoto({
  target: {
    files: [galleryPhoto],
    value: "curiosity.jpg",
  },
});
assert.equal(photoContainer.content.src, "blob:local-1");
assert.equal(photoContainer.content.alt, "Sua foto curiosa");
assert.equal(photoActions.classList.hidden, false);
assert.match(status.textContent, /Marque o consentimento/);

await context.discoverPhoto();
assert.match(analysisStatus.textContent, /Marque o consentimento/);
assert.equal(analysisCalls, 0);

consent.checked = true;
const pendingAnalysis = context.discoverPhoto();
assert.equal(analysisStatus.textContent, "Observando sua descoberta…");
assert.equal(analysisButton.disabled, true);
assert.equal(analysisButton.attributes["aria-busy"], "true");
await new Promise(setImmediate);
assert.equal(lastCanvas.width, 1600);
assert.equal(lastCanvas.height, 800);
resolveAnalysis({
  ok: true,
  async json() {
    return {
      subjectTitle: "Ave possivelmente observada",
      visibleDescription: "A foto mostra uma ave pousada em um galho.",
      facts: ["A plumagem visível tem tons claros."],
      uncertain: true,
      uncertaintyNotice: "A imagem não permite confirmar a espécie.",
    };
  },
});
await pendingAnalysis;
assert.match(resultModal, /O que você encontrou\?/);
assert.match(resultModal, /Ave possivelmente observada/);
assert.match(resultModal, /plumagem visível tem tons claros/);
assert.match(resultModal, /Identificação incerta/);
assert.match(resultModal, /não permite confirmar a espécie/);
assert.match(resultModal, /Explorar outra descoberta/);
assert.equal(analysisButton.disabled, false);
assert.equal(analysisCalls, 1);

const retry = context.discoverPhoto();
await new Promise(setImmediate);
resolveAnalysis({
  ok: false,
  status: 429,
  async json() {
    return { error: "Muitas análises em pouco tempo." };
  },
});
await retry;
assert.match(analysisStatus.textContent, /Muitas análises/);
assert.equal(analysisButton.disabled, false);

photoInput.value = "curiosity.jpg";
context.clearDiscoveryPhoto();
assert.deepEqual(revokedUrls, ["blob:local-1"]);
assert.equal(photoInput.value, "");
assert.equal(photoActions.classList.hidden, true);
assert.equal(consent.checked, false);
assert.equal(status.textContent, "Foto removida.");

cameraFeed.videoWidth = 640;
cameraFeed.videoHeight = 480;
context.captureDiscoveryPhoto();
assert.equal(photoContainer.content.src, "blob:local-2");
assert.equal(photoContainer.content.alt, "Foto curiosa capturada no app");

await vm.runInContext("openCamera()", context);
assert.match(status.textContent, /câmera não foi autorizada/i);

assert.match(homeView, /<h2>Olhar curioso<\/h2>/);
assert.match(homeView, /Explorar Olhar curioso/);
assert.match(navigationView, /visual-curiosity\.svg[\s\S]*?Olhar curioso/);
assert.match(natureView, /Fotografar algo curioso/);
assert.match(natureView, /Descobrir mais sobre minha foto/);
assert.match(natureView, /serviço de análise configurado/);
assert.match(natureView, /não a salva permanentemente/);
assert.match(natureView, /photoAnalysisConsent/);
assert.doesNotMatch(natureView, /Que planta é essa|planta interessante/);
assert.match(aboutView, /Olhar curioso/);
assert.match(aboutView, /serviço de análise configurado/);
assert.match(natureView, /Sem pressa, sem obrigação/);

const migrationStart = appSource.indexOf("function migrateCuriousLookCopy(");
const migrationEnd = appSource.indexOf(
  "\nif (migrateCuriousLookCopy(state.activityCatalog, state.texts)) persist();",
  migrationStart,
);
assert.ok(migrationStart >= 0 && migrationEnd > migrationStart);
const migratedActivity = [
  "Caminhada curiosa",
  "Observe três plantas diferentes no seu caminho.",
  "🌿",
  "Ao ar livre",
  15,
  "Caminhe em ritmo confortável por um local conhecido. Pare em um lugar seguro para observar uma planta e abrir Olhares curiosos.",
];
const migrationContext = vm.createContext({
  activities: [
    [
      "Caminhada curiosa",
      "Perceba algo que desperte sua curiosidade pelo caminho.",
      "🔎",
      "Ao ar livre",
      15,
      "Caminhe em ritmo confortável por um local conhecido. Se algo chamar sua atenção, pare em um lugar seguro para observar e, se quiser, fotografar sua descoberta no Olhar curioso.",
    ],
  ],
});
vm.runInContext(appSource.slice(migrationStart, migrationEnd), migrationContext);
const legacyTexts = {
  "text-nature-H1-0": "Uma descoberta pelo caminho.",
  "text-nature-P-0":
    "Sua pausa também pode ser um convite para observar a natureza.",
};
const migratedCatalog = [migratedActivity];
assert.equal(
  migrationContext.migrateCuriousLookCopy(migratedCatalog, legacyTexts),
  true,
);
assert.deepEqual(
  JSON.parse(JSON.stringify(migratedCatalog[0])),
  JSON.parse(JSON.stringify(migrationContext.activities[0])),
);
assert.equal(legacyTexts["text-nature-H1-0"], "Olhar curioso");
assert.match(legacyTexts["text-nature-P-0"], /Fotografe algo curioso/);
const customCatalog = [["Caminhada curiosa", "Minha descrição personalizada"]];
const customTexts = { "text-nature-H1-0": "Título personalizado" };
assert.equal(
  migrationContext.migrateCuriousLookCopy(customCatalog, customTexts),
  false,
);
assert.equal(customCatalog[0][1], "Minha descrição personalizada");
assert.equal(customTexts["text-nature-H1-0"], "Título personalizado");
assert.match(developerSource, /migrateCuriousLookCopy\(state\.activityCatalog, data\.texts\)/);

console.log("Curious-photo flow, legacy-copy migration, camera denial and copy: OK.");
