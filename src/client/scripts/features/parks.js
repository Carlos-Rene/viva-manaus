function locateForParks() {
  if (locating) return;
  if (!navigator.geolocation) {
    notify("GPS indisponível. Pesquise um parque pelo nome.");
    return;
  }
  locating = true;
  document.getElementById("mapStatus").textContent =
    "Buscando sua posição em Manaus…";
  navigator.geolocation.getCurrentPosition(
    (p) => {
      locating = false;
      const pos = [p.coords.latitude, p.coords.longitude];
      if (!inManaus(pos)) {
        document.getElementById("mapStatus").textContent =
          "Você está fora do recorte de Manaus. Escolha um parque pela busca ou pelo mapa.";
        return;
      }
      nearbyCenter = pos;
      centerAt(pos);
      renderParks();
      document.getElementById("mapStatus").textContent =
        "Sua posição foi localizada. Distâncias em linha reta até os parques.";
    },
    (e) => {
      locating = false;
      document.getElementById("mapStatus").textContent = geoError(e);
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
  );
}

function findParks() {
  renderParks();
}

function normalizeSearch(v) {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/jeferson/g, "jefferson");
}

function renderParks() {
  const container = document.getElementById("parksList");
  if (!container) return;
  let parks = state.parks.filter(
    (p) =>
      p.enabled &&
      inManaus(p.point) &&
      normalizeSearch(p.name + " " + p.district).includes(
        normalizeSearch(parkSearch),
      ),
  );
  if (nearbyCenter)
    parks.sort(
      (a, b) =>
        distanceMeters(nearbyCenter, a.point) -
        distanceMeters(nearbyCenter, b.point),
    );
  document.getElementById("parkCount").textContent =
    parks.length + " parques selecionados em Manaus";
  container.innerHTML = "";
  parkLayer?.clearLayers();
  parks.forEach((p) => {
    const item = document.createElement("button");
    item.className =
      "park-choice " + (selectedPark?.id === p.id ? "park-selected" : "");
    item.innerHTML = `<span class="park-pin">⌖</span><span><b>${htmlEscape(p.name)}</b><small>${htmlEscape(p.district)}${nearbyCenter ? " · " + (distanceMeters(nearbyCenter, p.point) / 1000).toFixed(1) + " km em linha reta" : ""}</small></span><span>↗</span>`;
    item.onclick = () => selectPark(p.id);
    container.append(item);
    if (parkLayer) {
      const icon = L.divIcon({
        className: "park-map-marker",
        html: "<span>⌖</span>",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker(p.point, { icon })
        .addTo(parkLayer)
        .on("click", () => selectPark(p.id));
      marker.bindTooltip(
        p.name
          .replace("Parque Senador ", "")
          .replace("Parque Municipal do ", "")
          .replace("Parque Ponte dos ", ""),
        {
          permanent: true,
          direction: "right",
          className: "map-place-label",
          offset: [12, 0],
        },
      );
    }
  });
  if (!parks.length)
    container.innerHTML =
      "<p>Nenhum parque encontrado. Tente Jefferson, Mindu ou Bilhares.</p>";
}

function selectPark(id) {
  const p = state.parks.find((p) => p.id === id && p.enabled);
  if (!p) return;
  const changedPark = selectedPark?.id !== p.id;
  if (changedPark && !walkMap) initWalkMap();
  selectedPark = p;
  document.getElementById("selectedParkCard").classList.remove("hidden");
  document.getElementById("selectedParkName").textContent = p.name;
  document.getElementById("selectedParkInfo").textContent = p.description;
  document.getElementById("selectedParkArea").textContent =
    p.district + " · Manaus, AM";
  const source = document.getElementById("parkSource");
  source.href = httpUrl(p.source);
  source.classList.toggle("hidden", !source.href);
  const directions = document.getElementById("parkDirections");
  if (validPoint(p.point)) {
    directions.href =
      `https://www.google.com/maps/search/?api=1&query=${p.point[0]},${p.point[1]}`;
    directions.classList.remove("hidden");
  } else {
    directions.removeAttribute("href");
    directions.classList.add("hidden");
  }
  if (walkMap) showSelectedPark(p);
  renderParks();
  document.getElementById("trackingDetails").open = true;
  document.getElementById("walkMap").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  notify(p.name + " selecionado");
}

function searchParks(value) {
  parkSearch = value;
  renderParks();
}

function addParkFromForm(e) {
  e.preventDefault();
  let data = structuredClone(editorData());
  const point = [
    Number(document.getElementById("parkLat").value),
    Number(document.getElementById("parkLon").value),
  ];
  data.parks.push({
    id: "park-" + Date.now(),
    name: document.getElementById("newParkName").value.trim(),
    district: document.getElementById("newParkDistrict").value.trim(),
    description: document.getElementById("newParkDescription").value.trim(),
    point,
    source: document.getElementById("newParkSource").value.trim(),
    enabled: true,
  });
  saveEditorData(data);
}
