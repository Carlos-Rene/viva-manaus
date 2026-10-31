function persist() {
  localStorage.setItem("viva-state", JSON.stringify(state));
  renderStats();
}

function notify(s) {
  let t = document.getElementById("toast");
  t.textContent = s;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}

function navigateFromLogo(event) {
  event.preventDefault();
  if (!document.getElementById("home")?.classList.contains("active"))
    go("home");
}

function go(id) {
  if (id === "developer" && !serverIdentity.isDeveloper) {
    notify("Entre com a senha de desenvolvedor para acessar o painel.");
    id = "devlogin";
  }
  if (id !== "walk") restoreWalkMapNavigationBounds();
  document.body.classList.remove("show-welcome");
  document
    .querySelectorAll("#presentation video,#about video")
    .forEach((v) => v.pause());
  if (id === "events") renderEvents();
  if (id === "developer") {
    renderDeveloper();
  }
  if (id !== "nature") stopCamera();
  document.querySelectorAll("video.lesson-video").forEach((v) => v.pause());
  document
    .querySelectorAll(".page")
    .forEach((x) => x.classList.toggle("active", x.id === id));
  document
    .querySelectorAll("nav button")
    .forEach((x) =>
      x.classList.toggle(
        "active",
        x.dataset.page === id ||
          (id === "exercises" && x.dataset.page === "activities"),
      ),
    );
  if (id === "activities") renderActivities();
  if (id === "routine") {
    renderStats();
    renderPersonalRhythm();
  }
  if (id === "walk") setTimeout(initWalkMap, 50);
  if (id === "exercises") renderYoutube();
  else document.querySelectorAll(".youtube-frame").forEach((f) => f.remove());
  window.scrollTo(0, 0);
}

function modal(html) {
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function editorData() {
  return {
    settings: state.settings,
    activities: state.activityCatalog,
    parks: state.parks,
    events: state.events,
    videos: state.youtube,
    texts: state.texts,
  };
}

function loadManausBase() {
  const pane = walkMap.createPane("manausBase");
  pane.style.zIndex = 210;
  L.rectangle(MANAUS_BOUNDS, {
    pane: "manausBase",
    color: "#52684c",
    weight: 1,
    fillOpacity: 0,
    interactive: false,
  }).addTo(walkMap);
  for (let lat = -3.18; lat < -2.88; lat += 0.02)
    L.polyline(
      [
        [lat, -60.16],
        [lat, -59.86],
      ],
      {
        pane: "manausBase",
        color: "#3e5544",
        weight: 1,
        opacity: 0.16,
        interactive: false,
      },
    ).addTo(walkMap);
  for (let lon = -60.16; lon < -59.86; lon += 0.02)
    L.polyline(
      [
        [-3.19, lon],
        [-2.88, lon],
      ],
      {
        pane: "manausBase",
        color: "#3e5544",
        weight: 1,
        opacity: 0.16,
        interactive: false,
      },
    ).addTo(walkMap);
  document.getElementById("mapStatus").textContent =
    "Carregando mapa de ruas OpenStreetMap. Se os blocos não estiverem disponíveis, as referências dos parques continuam acessíveis.";
}

function enterViva() {
  go("home");
}
