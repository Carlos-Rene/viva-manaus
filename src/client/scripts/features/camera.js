let discoveryPhotoUrl = null;
let discoveryPhotoObjectUrl = null;
let discoveryPhotoFile = null;

function showDiscoveryPhoto(source, alt, file) {
  const container = document.querySelector("#nature .discovery-photo");
  if (!container) return;
  if (discoveryPhotoObjectUrl) URL.revokeObjectURL(discoveryPhotoObjectUrl);
  discoveryPhotoObjectUrl = source.startsWith("blob:") ? source : null;
  discoveryPhotoUrl = source;
  discoveryPhotoFile = file;
  document.getElementById("photoAnalysisConsent").checked = false;
  document.getElementById("analysisStatus").textContent = "";

  const image = document.createElement("img");
  image.src = source;
  image.alt = alt;
  image.style = "width:100%;height:280px;object-fit:cover;border-radius:14px";
  image.onerror = () => {
    if (discoveryPhotoUrl !== source) return;
    clearDiscoveryPhoto();
    document.getElementById("cameraStatus").textContent =
      "Não foi possível abrir esta imagem. Tente escolher outra foto.";
  };
  container.replaceChildren(image);
  document.getElementById("photoActions").classList.remove("hidden");
}

function previewPhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size
  ) {
    event.target.value = "";
    document.getElementById("cameraStatus").textContent =
      "Escolha uma imagem JPEG, PNG ou WebP válida.";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = "";
    document.getElementById("cameraStatus").textContent =
      "A imagem deve ter no máximo 5 MB.";
    return;
  }
  showDiscoveryPhoto(
    URL.createObjectURL(file),
    "Sua foto curiosa",
    file,
  );
  stopCamera();
  document.getElementById("cameraStatus").textContent =
    "Foto pronta. Marque o consentimento para enviá-la para análise.";
}

function escapeAnalysisText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showAnalysisResult(analysis) {
  const facts = analysis.facts.length
    ? `<ul>${analysis.facts.map((fact) => `<li>${escapeAnalysisText(fact)}</li>`).join("")}</ul>`
    : "<p>Não há fatos adicionais que possam ser afirmados com segurança a partir desta imagem.</p>";
  const uncertainty = analysis.uncertain
    ? `<div class="notice" role="status"><b>Identificação incerta.</b> ${escapeAnalysisText(analysis.uncertaintyNotice || "A imagem não permite identificar o assunto com segurança.")}</div>`
    : "";
  const photo = `<img src="${escapeAnalysisText(discoveryPhotoUrl)}" alt="Foto enviada para análise" style="width:100%;max-height:280px;object-fit:contain;border-radius:14px">`;
  modal(
    `<div class="eyebrow" style="padding-top:20px">OLHAR CURIOSO</div><h1>O que você encontrou?</h1>${photo}<h2>${escapeAnalysisText(analysis.subjectTitle)}</h2><p>${escapeAnalysisText(analysis.visibleDescription)}</p>${facts}${uncertainty}<p class="sub">A análise pode conter erros. Use fontes confiáveis para confirmar informações importantes.</p><button class="btn" style="margin-top:20px" onclick="closeModal();clearDiscoveryPhoto()">Explorar outra descoberta</button>`,
  );
}

async function preparePhotoForAnalysis(file) {
  if (file.size <= 1024 * 1024 || typeof createImageBitmap !== "function")
    return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!compressed)
      throw new Error(
        "Não foi possível preparar a imagem para análise. Tente outra foto.",
      );
    return compressed;
  } catch {
    throw new Error(
      "Não foi possível preparar a imagem para análise. Tente outra foto.",
    );
  } finally {
    bitmap?.close();
  }
}

async function discoverPhoto() {
  const status = document.getElementById("analysisStatus");
  const button = document.getElementById("analyzePhotoButton");
  if (!discoveryPhotoFile || !discoveryPhotoUrl) {
    status.textContent =
      "Fotografe algo curioso ou escolha uma imagem antes de continuar.";
    return;
  }
  if (!document.getElementById("photoAnalysisConsent").checked) {
    status.textContent =
      "Marque o consentimento para enviar esta foto ao serviço de análise configurado.";
    return;
  }
  if (discoveryPhotoFile.size > 5 * 1024 * 1024) {
    status.textContent = "A imagem deve ter no máximo 5 MB.";
    return;
  }

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  status.textContent = "Observando sua descoberta…";
  try {
    const photo = await preparePhotoForAnalysis(discoveryPhotoFile);
    const form = new FormData();
    form.append(
      "photo",
      photo,
      photo.type === "image/jpeg" ? "olhar-curioso.jpg" : "olhar-curioso",
    );
    const response = await fetch("/api/analyze-image", {
      method: "POST",
      body: form,
    });
    let result;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    if (!response.ok)
      throw new Error(
        result?.error ||
          "Não foi possível analisar esta imagem agora. Tente novamente.",
      );
    if (
      !result ||
      typeof result.subjectTitle !== "string" ||
      typeof result.visibleDescription !== "string" ||
      !Array.isArray(result.facts) ||
      typeof result.uncertain !== "boolean"
    )
      throw new Error(
        "Não foi possível analisar esta imagem agora. Tente novamente.",
      );
    status.textContent = "";
    showAnalysisResult(result);
  } catch (error) {
    status.textContent =
      error?.name === "TypeError"
        ? "Não foi possível analisar esta imagem agora. Tente novamente."
        : error?.message ||
          "Não foi possível analisar esta imagem agora. Tente novamente.";
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function stopCamera() {
  cameraRequest++;
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  const feed = document.getElementById("cameraFeed");
  if (feed) feed.srcObject = null;
  document.getElementById("cameraPanel")?.classList.add("hidden");
}

async function openCamera() {
  stopCamera();
  const request = ++cameraRequest;
  const status = document.getElementById("cameraStatus");
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent =
      "A câmera não está disponível neste navegador. Você ainda pode escolher uma foto da galeria.";
    return;
  }
  status.textContent =
    "Permita o uso da câmera para fotografar algo que chamou sua atenção.";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    if (request !== cameraRequest) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    document.getElementById("cameraFeed").srcObject = stream;
    document.getElementById("cameraPanel").classList.remove("hidden");
    status.textContent = "Enquadre sua descoberta e toque em Tirar foto.";
  } catch (error) {
    status.textContent =
      error.name === "NotAllowedError"
        ? "A câmera não foi autorizada. Você pode permitir nas configurações do navegador ou escolher uma foto da galeria."
        : "Não foi possível abrir a câmera. Confira se ela está em uso ou escolha uma imagem da galeria.";
  }
}

function captureDiscoveryPhoto() {
  const video = document.getElementById("cameraFeed");
  if (!video.videoWidth) {
    notify("Aguarde a imagem da câmera carregar.");
    return;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (file) => {
        if (!file) {
          document.getElementById("cameraStatus").textContent =
            "Não foi possível guardar a foto da câmera. Tente novamente ou escolha uma imagem da galeria.";
          return;
        }
        showDiscoveryPhoto(
          URL.createObjectURL(file),
          "Foto curiosa capturada no app",
          file,
        );
        stopCamera();
        document.getElementById("cameraStatus").textContent =
          "Foto capturada. Marque o consentimento para enviá-la para análise.";
      },
      "image/jpeg",
      0.85,
    );
  } catch {
    document.getElementById("cameraStatus").textContent =
      "Não foi possível guardar a foto da câmera. Tente novamente ou escolha uma imagem da galeria.";
  }
}

function clearDiscoveryPhoto() {
  stopCamera();
  if (discoveryPhotoObjectUrl) URL.revokeObjectURL(discoveryPhotoObjectUrl);
  discoveryPhotoObjectUrl = null;
  discoveryPhotoUrl = null;
  discoveryPhotoFile = null;
  document.querySelector("#nature .discovery-photo").innerHTML =
    '✨<span class="tag">UM NOVO OLHAR PARA O COTIDIANO</span>';
  document.getElementById("photo").value = "";
  document.getElementById("photoAnalysisConsent").checked = false;
  document.getElementById("photoActions").classList.add("hidden");
  document.getElementById("analysisStatus").textContent = "";
  document.getElementById("cameraStatus").textContent = "Foto removida.";
}
