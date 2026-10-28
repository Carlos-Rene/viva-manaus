function setProfile(role) {
  if (role === "developer" && !serverIdentity.isDeveloper) {
    notify("Sua conta não tem acesso de desenvolvedor.");
    go("profiles");
    return;
  }
  activeProfile = role === "developer" ? "developer" : "user";
  document.body.dataset.profile = activeProfile;
  document.getElementById("activeProfileText").textContent =
    activeProfile === "developer"
      ? "Desenvolvedor autorizado"
      : "Usuário · Viva";
  document.querySelector("header .avatar").textContent =
    activeProfile === "developer" ? "D" : "U";
  document
    .getElementById("devShortcut")
    .classList.toggle("hidden", activeProfile !== "developer");
  renderYoutube();
  go(activeProfile === "developer" ? "developer" : "home");
  notify(
    activeProfile === "developer"
      ? "Painel de desenvolvedor autorizado"
      : "Modo usuário: vídeos prontos para assistir",
  );
}

function renderDeveloper() {
  const allowed = activeProfile === "developer" && serverIdentity.isDeveloper;
  document.getElementById("devDenied").classList.toggle("hidden", allowed);
  document.getElementById("devContent").classList.toggle("hidden", !allowed);
  if (!allowed) return;
  document.getElementById("catalogCount").textContent =
    state.youtube.length +
    " vídeos disponíveis para o perfil usuário neste navegador.";
  document.getElementById("devVideos").innerHTML =
    state.youtube
      .map(
        (v, i) =>
          `<article class="lesson"><span class="eyebrow">PUBLICADO · ${v.type.toUpperCase()}</span><h3>${htmlEscape(v.title)}</h3><p>Vídeo: ${v.start}s até ${v.start + 60}s · Prática: ${planLabel(v.plan || { mode: "time", seconds: 60 })}</p><a class="text-link" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">Conferir vídeo no YouTube ↗</a><button class="btn ghost" onclick="previewPublished(${i})">Ver como usuário</button><button class="chip" onclick="removeYoutube(${i})">Remover do catálogo</button></article>`,
      )
      .join("") ||
    "<p>Seu catálogo está vazio. Publique o primeiro vídeo acima.</p>";
}

function previewPublished(i) {
  videoFilter = "Todos";
  go("exercises");
  playYoutube(i);
  document.getElementById("ytSlot" + i).scrollIntoView({ behavior: "smooth" });
}

function applyConfiguration() {
  activities.splice(
    0,
    activities.length,
    ...state.activityCatalog.map((a) => [...a]),
  );
  const cfg = state.settings;
  document.documentElement.style.setProperty("--lime", cfg.accent);
  document.documentElement.style.setProperty("--bg", cfg.background);
  let style = document.getElementById("configStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "configStyles";
    document.head.append(style);
  }
  style.textContent = `main{background:${cfg.background}}.btn:not(.ghost),#checkin .row:last-child>.btn{background:${cfg.accent};color:#13200e}.selected{outline-color:${cfg.accent}!important}.park-map-marker>span{background:${cfg.routeColor}}`;
  document.querySelector("header .brand").childNodes.forEach((n) => {
    if (n.nodeType === 3 && n.textContent.trim()) n.textContent = cfg.brand;
  });
  contentTargets.forEach((el) => {
    const value = state.texts[el.dataset.editKey];
    if (typeof value === "string") el.textContent = value;
  });
  document.querySelector("#home h1").textContent = cfg.welcome;
  document.querySelector("#home .home-intro").textContent = cfg.intro;
  walkLine?.setStyle({ color: cfg.routeColor });
  renderParks();
  renderEvents();
  renderActivities();
  renderYoutube();
}

function adminAllowed() {
  if (activeProfile === "developer" && serverIdentity.isDeveloper) return true;
  notify("Abra o perfil desenvolvedor para editar.");
  return false;
}

async function saveEditorData(data) {
  if (!adminAllowed()) return;
  try {
    validateConfig(data);
    await publishCatalog(data);
    applyConfiguration();
    renderAdminEditors();
    notify("Catálogo publicado no aplicativo.");
  } catch (e) {
    notify(e.message);
  }
}

function saveSettings(e) {
  e.preventDefault();
  const data = structuredClone(editorData());
  ["brand", "welcome", "intro", "accent", "routeColor", "background"].forEach(
    (k) =>
      (data.settings[k] = document.getElementById("cfg-" + k).value.trim()),
  );
  saveEditorData(data);
}

function saveJsonArea(key) {
  if (!adminAllowed()) return;
  try {
    const data = structuredClone(editorData());
    data[key] = JSON.parse(document.getElementById("edit-" + key).value);
    saveEditorData(data);
  } catch {
    notify("JSON inválido. Confira vírgulas, aspas e colchetes.");
  }
}

function saveAllJson() {
  if (!adminAllowed()) return;
  try {
    saveEditorData(JSON.parse(document.getElementById("edit-all").value));
  } catch {
    notify("O arquivo JSON não é válido.");
  }
}

function renderAdminEditors() {
  if (activeProfile !== "developer" || !serverIdentity.isDeveloper) return;
  const data = editorData();
  ["brand", "welcome", "intro", "accent", "routeColor", "background"].forEach(
    (k) => (document.getElementById("cfg-" + k).value = data.settings[k]),
  );
  ["activities", "parks", "events", "texts"].forEach(
    (k) =>
      (document.getElementById("edit-" + k).value = JSON.stringify(
        data[k],
        null,
        2,
      )),
  );
  document.getElementById("edit-all").value = JSON.stringify(data, null, 2);
  document.getElementById("adminParkCount").textContent =
    state.parks.length +
    " parques · " +
    state.events.length +
    " eventos · " +
    state.activityCatalog.length +
    " atividades";
}

function adminTab(name) {
  document
    .querySelectorAll(".admin-section")
    .forEach((el) => el.classList.toggle("hidden", el.id !== "admin-" + name));
  document
    .querySelectorAll("[data-admin-tab]")
    .forEach((el) =>
      el.classList.toggle("selected", el.dataset.adminTab === name),
    );
  if (name === "videos") originalRenderDeveloper();
}

function exportConfig() {
  if (!adminAllowed()) return;
  const blob = new Blob([JSON.stringify(editorData(), null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "viva-configuracao-manaus.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importConfig(e) {
  if (!adminAllowed()) return;
  let f = e.target.files[0];
  if (!f) return;
  if (f.size > 1000000) {
    notify("Use um JSON de até 1 MB.");
    return;
  }
  try {
    const data = JSON.parse(await f.text());
    saveEditorData(data);
  } catch {
    notify("Não foi possível importar esse JSON.");
  }
  e.target.value = "";
}

function applyCatalogData(data) {
  validateConfig(data);
  state.settings = data.settings;
  state.activityCatalog = data.activities;
  migrateCuriousLookCopy(state.activityCatalog, data.texts);
  state.parks = mergeBundledParkData(data.parks);
  state.events = data.events;
  state.youtube = data.videos;
  state.texts = data.texts;
  persist();
}

async function publishCatalog(data) {
  const headers = { "Content-Type": "application/json" };
  headers[catalogVersion ? "If-Match" : "If-None-Match"] =
    catalogVersion || "*";
  let response;
  try {
    response = await fetch("/api/catalog", {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    throw Error("Não foi possível publicar. Verifique a conexão.");
  }
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Publicação não autorizada.");
  catalogVersion = result.version;
  applyCatalogData(data);
}

async function initializeAccount() {
  try {
    const response = await fetch("/api/me", { cache: "no-store" });
    if (!response.ok) throw Error();
    const identity = await response.json();
    serverIdentity = { ...identity, ready: true };
    document.getElementById("accountStatus").textContent =
      identity.authenticated
        ? "Conta conectada: " + identity.email
        : "Entre com sua conta para acessar o app.";
    document.getElementById("accountRole").textContent = identity.isDeveloper
      ? "Sua conta está autorizada a gerenciar o conteúdo."
      : "Perfil de usuário. O painel de edição é restrito à equipe autorizada.";
    document
      .getElementById("openDevButton")
      .classList.toggle("hidden", !identity.isDeveloper);
    document.getElementById("devLoginEmail").value = identity.email || "";
    document.getElementById("devLoginStatus").textContent = identity.isDeveloper
      ? "Conta verificada. Seu acesso de desenvolvedor está autorizado."
      : identity.authenticated
        ? "Conta conectada, mas sem autorização de desenvolvedor."
        : "Faça login com a conta autorizada.";
    document
      .getElementById("devLoginContinue")
      .classList.toggle("hidden", !identity.isDeveloper);
    if (new URLSearchParams(location.search).get("panel") === "developer")
      go("devlogin");
    const cat = await fetch("/api/catalog", { cache: "no-store" });
    if (cat.ok) {
      const data = await cat.json();
      catalogVersion = data.version;
      if (data.config) {
        applyCatalogData(data.config);
        applyConfiguration();
      }
    }
  } catch {
    serverIdentity = { ready: true, isDeveloper: false };
    document.getElementById("accountStatus").textContent =
      "Não foi possível verificar a conta neste ambiente.";
    document.getElementById("accountRole").textContent =
      "O painel de desenvolvedor permanece bloqueado.";
  } finally {
    document.getElementById("splash").classList.add("done");
    setTimeout(
      () => document.getElementById("splash").classList.add("splash-hidden"),
      300,
    );
  }
}
