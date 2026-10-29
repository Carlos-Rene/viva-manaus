const WALK_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function distanceMeters(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  let dl = rad(b[0] - a[0]),
    dn = rad(b[1] - a[1]),
    v =
      Math.sin(dl / 2) ** 2 +
      Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
}

function initWalkMap(attempt = 0) {
  const container = document.getElementById("walkMap");
  if (!container) return;
  const status = document.getElementById("mapStatus");
  if (!window.L) {
    if (status)
      status.textContent =
        "O mapa não pôde ser iniciado porque a biblioteca Leaflet não foi carregada.";
    return;
  }
  const { width, height } = container.getBoundingClientRect();
  if (!width || !height) {
    if (attempt < 5) {
      requestAnimationFrame(() => initWalkMap(attempt + 1));
    } else if (status) {
      status.textContent =
        "O mapa aguarda uma área visível. Abra a seção Parques novamente para carregá-lo.";
    }
    return;
  }
  if (!walkMap) {
    walkMap = L.map(container, {
      maxBounds: MANAUS_BOUNDS,
      maxBoundsViscosity: 0.65,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    }).setView([-3.12, -60.02], 12);
    loadManausBase();
    const tileLayer = L.tileLayer(WALK_MAP_TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(walkMap);
    let loadedTiles = 0;
    let failedTiles = 0;
    tileLayer.on("tileload", () => {
      loadedTiles += 1;
    });
    tileLayer.on("tileerror", () => {
      failedTiles += 1;
    });
    tileLayer.on("load", () => {
      if (!status) return;
      status.textContent = loadedTiles
        ? `Mapa de ruas OpenStreetMap carregado.${
            failedTiles
              ? ` Alguns blocos não foram carregados (${failedTiles}).`
              : ""
          }`
        : "Não foi possível carregar os blocos do OpenStreetMap. Verifique a conexão; o mapa esquemático e a seleção de parques continuam disponíveis.";
      loadedTiles = 0;
      failedTiles = 0;
    });
    parkLayer = L.layerGroup().addTo(walkMap);
    walkLine = L.polyline([], {
      color: state.settings.routeColor,
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(walkMap);
    walkMap.on("dragstart", () => {
      if (walkSession && !walkSession.demo) setFollowWalkPosition(false);
    });
    walkMap.on("zoomstart", (event) => {
      if (event.originalEvent && walkSession && !walkSession.demo)
        setFollowWalkPosition(false);
    });
    walkMap.on("resize", () => walkMap.invalidateSize({ pan: false }));
    walkMap.whenReady(() => {
      walkMap.invalidateSize({ pan: false });
      if (selectedPark) showSelectedPark(selectedPark, false);
    });
  } else {
    walkMap.invalidateSize({ pan: false });
  }
  const trackingDetails = document.getElementById("trackingDetails");
  if (
    trackingDetails &&
    trackingDetails.dataset.navigationBoundsBound !== "true"
  ) {
    trackingDetails.addEventListener("toggle", () => {
      if (trackingDetails.open && selectedPark) {
        showSelectedPark(selectedPark, false);
      } else if (!trackingDetails.open) {
        restoreWalkMapNavigationBounds();
      }
    });
    trackingDetails.dataset.navigationBoundsBound = "true";
  }
  if (selectedPark && trackingDetails?.open) {
    showSelectedPark(selectedPark, false);
  } else {
    restoreWalkMapNavigationBounds();
  }
  setFollowWalkPosition(followWalkPosition);
  renderParks();
  renderWalk();
}

function setWalkMapNavigationBounds(bounds, viscosity = 0.65) {
  if (!walkMap) return;
  walkMap.options.maxBoundsViscosity = viscosity;
  walkMap.setMaxBounds(bounds);
}

function restoreWalkMapNavigationBounds() {
  setWalkMapNavigationBounds(MANAUS_BOUNDS, 0.65);
}

function geoError(e) {
  return e.code === 1
    ? "Localização não autorizada. Permita o GPS nas configurações do navegador."
    : e.code === 3
      ? "O GPS demorou para responder. Vá para uma área aberta e tente novamente."
      : "Sua localização está indisponível. Verifique o GPS e tente novamente.";
}

function centerAt(point, force = false) {
  if (!walkMap || !followWalkPosition || !validPoint(point)) return;
  if (!force && lastFollowPoint && distanceMeters(lastFollowPoint, point) < 8)
    return;
  lastFollowPoint = [...point];
  const pixel = walkMap.latLngToContainerPoint(point);
  const size = walkMap.getSize();
  const marginX = Math.min(64, size.x * 0.2);
  const marginY = Math.min(64, size.y * 0.2);
  if (
    force ||
    pixel.x < marginX ||
    pixel.x > size.x - marginX ||
    pixel.y < marginY ||
    pixel.y > size.y - marginY
  ) {
    walkMap.panInside(point, {
      padding: [marginY, marginX],
      animate: true,
      duration: 0.35,
    });
  }
}

function validPoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -90 &&
    point[0] <= 90 &&
    point[1] >= -180 &&
    point[1] <= 180
  );
}

function setFollowWalkPosition(enabled) {
  followWalkPosition = enabled;
  const button = document.getElementById("walkFollowToggle");
  if (button) {
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled
      ? "Acompanhamento automático: ligado"
      : "Acompanhamento automático: desligado";
  }
  const recenter = document.getElementById("walkRecenter");
  if (recenter) recenter.disabled = !walkMap;
}

function recenterWalk() {
  if (!lastWalkPosition) {
    locateForParks();
    return;
  }
  setFollowWalkPosition(true);
  centerAt(lastWalkPosition.point, true);
}

function renderUserPosition(point) {
  if (!walkMap) return;
  if (!userPositionMarker) {
    const icon = L.divIcon({
      className: "walk-position-marker",
      html: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    userPositionMarker = L.marker(point, {
      icon,
      keyboard: false,
      title: "Sua posição atual",
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(walkMap);
  } else {
    userPositionMarker.setLatLng(point);
  }
}

function renderWalkPosition(point, accuracy) {
  if (!walkMap) return;
  lastWalkPosition = { point: [...point], accuracy };
  renderUserPosition(point);
  centerAt(point);
  const recenter = document.getElementById("walkRecenter");
  if (recenter) recenter.disabled = false;
}

function pointInRing(point, ring) {
  const [lat, lon] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i],
      [lonJ, latJ] = ring[j];
    const cross = (lon - lonI) * (latJ - latI) - (lat - latI) * (lonJ - lonI);
    if (
      Math.abs(cross) < 1e-10 &&
      lon >= Math.min(lonI, lonJ) &&
      lon <= Math.max(lonI, lonJ) &&
      lat >= Math.min(latI, latJ) &&
      lat <= Math.max(latI, latJ)
    )
      return true;
    if (
      (latI > lat) !== (latJ > lat) &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    )
      inside = !inside;
  }
  return inside;
}

function pointInParkBoundary(point, boundary) {
  const features =
    boundary?.type === "FeatureCollection"
      ? boundary.features
      : [boundary?.type === "Feature" ? boundary : { geometry: boundary }];
  const polygons = features.flatMap((feature) => {
    const geometry = feature?.geometry;
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type))
      return [];
    return geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.coordinates;
  });
  if (!polygons.length) return null;
  return polygons.some(
    (rings) =>
      pointInRing(point, rings[0]) &&
      !rings.slice(1).some((ring) => pointInRing(point, ring)),
  );
}

function showSelectedPark(park, frame = true) {
  if (!walkMap || !park) return;
  parkBoundaryLayer?.remove();
  parkBoundaryLayer = null;
  const hasVerifiedBoundary =
    park.boundaryAccuracy === "verified" &&
    !!park.boundarySource &&
    validParkBoundary(park.boundary);
  const status = document.getElementById("parkBoundaryStatus");
  const hasApproximateBoundary =
    park.boundaryAccuracy === "approximate" &&
    typeof park.boundaryAttribution === "string" &&
    validParkBoundary(park.boundary);
  if (hasVerifiedBoundary || hasApproximateBoundary) {
    parkBoundaryLayer = L.geoJSON(park.boundary, {
      style: {
        color: hasVerifiedBoundary ? "#d5ff78" : "#ffd27a",
        weight: hasVerifiedBoundary ? 3 : 2,
        opacity: 0.95,
        dashArray: hasVerifiedBoundary ? null : "7 6",
        fillColor: hasVerifiedBoundary ? "#b8e760" : "#ffd27a",
        fillOpacity: hasVerifiedBoundary ? 0.13 : 0.08,
      },
    }).addTo(walkMap);
    const bounds = parkBoundaryLayer.getBounds();
    if (bounds.isValid()) {
      const restrictToBilharesRectangle =
        park.id === "bilhares" && hasApproximateBoundary;
      setWalkMapNavigationBounds(
        hasVerifiedBoundary
          ? bounds.pad(0.18)
          : restrictToBilharesRectangle
            ? bounds
            : MANAUS_BOUNDS,
        restrictToBilharesRectangle ? 1 : 0.65,
      );
      if (frame)
        walkMap.fitBounds(bounds, {
          padding: [32, 32],
          maxZoom: 17,
          animate: true,
          duration: 0.55,
        });
    }
    if (status)
      status.textContent = hasVerifiedBoundary
        ? `Limite verificado conforme a fonte ${park.boundarySource}. O trajeto GPS continua sendo registrado fora dele.`
        : park.id === "bilhares"
          ? `Polígono aproximado, não oficial, fornecido nos dados do projeto Viva. A navegação está limitada ao retângulo que envolve o polígono; ele inclui áreas fora do parque e não é uma geofence. O GPS continua registrando normalmente.`
          : `Área aproximada, não oficial, exibida apenas para orientação. Atribuição: ${park.boundaryAttribution} A navegação continua limitada à região de Manaus; não há geofence.`;
  } else {
    restoreWalkMapNavigationBounds();
    if (frame && validPoint(park.point))
      walkMap.flyTo(park.point, 16, { animate: true, duration: 0.55 });
    if (status)
      status.textContent = !validPoint(park.point)
        ? "As coordenadas deste parque estão indisponíveis ou inválidas. O mapa permanece na área geral de Manaus; não é possível enquadrar o parque."
        : "Ponto de referência do parque; nenhum limite geográfico foi fornecido. O mapa permanece limitado à região de Manaus, sem restrição física de caminhada.";
  }
}

function updateParkBoundaryStatus(point, accuracy) {
  if (
    !selectedPark?.boundary ||
    selectedPark.boundaryAccuracy !== "verified" ||
    !selectedPark.boundarySource ||
    !validParkBoundary(selectedPark.boundary)
  )
    return null;
  if (!Number.isFinite(accuracy) || accuracy > 40) {
    const status = document.getElementById("parkBoundaryStatus");
    if (status)
      status.textContent =
        "Precisão GPS baixa; não foi possível avaliar a posição em relação ao limite configurado.";
    return null;
  }
  const inside = pointInParkBoundary(point, selectedPark.boundary);
  if (inside === null) return null;
  const status = document.getElementById("parkBoundaryStatus");
  if (status)
    status.textContent = `${
      inside ? "Dentro" : "Fora"
    } da área configurada para ${selectedPark.name}. O registro GPS continua ativo.`;
  if (!inside && walkSession && !walkSession.boundaryWarning) {
    walkSession.boundaryWarning = true;
    notify("Você está fora do limite configurado do parque. O GPS continua registrando.");
  } else if (inside && walkSession) {
    walkSession.boundaryWarning = false;
  }
  return inside;
}

function elapsedWalk() {
  return walkSession
    ? walkSession.accum +
        (walkSession.running ? performance.now() - walkSession.since : 0)
    : 0;
}

function formatDuration(ms) {
  let s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function renderWalk() {
  let ms = elapsedWalk(),
    meters = walkSession?.meters || 0;
  document.getElementById("walkDistance").textContent = (meters / 1000).toFixed(
    2,
  );
  document.getElementById("walkTime").textContent = formatDuration(ms);
  let pace = meters >= 50 ? ms / 60000 / (meters / 1000) : null;
  document.getElementById("walkPace").textContent =
    pace && pace < 100
      ? Math.floor(pace) +
        ":" +
        String(Math.floor((pace % 1) * 60)).padStart(2, "0")
      : "—";
  const active = !!walkSession;
  document.getElementById("walkStart").disabled = active;
  document.getElementById("walkDemo").disabled = active;
  document.getElementById("walkPause").disabled = !active;
  document.getElementById("walkFinish").disabled = !active;
  document.getElementById("walkPause").textContent = walkSession?.running
    ? "Pausar"
    : "Retomar";
  document.getElementById("walkMode").textContent = walkSession?.demo
    ? "DEMONSTRAÇÃO · DADOS SIMULADOS"
    : active
      ? "CAMINHADA GPS · " + (walkSession.running ? "EM ANDAMENTO" : "PAUSADA")
      : "PRONTO PARA CAMINHAR";
}

function stopWatch() {
  if (walkWatch !== null) {
    navigator.geolocation?.clearWatch(walkWatch);
    walkWatch = null;
  }
}

function watchWalking() {
  stopWatch();
  try {
    walkWatch = navigator.geolocation.watchPosition(
      (p) => {
        if (!walkSession?.running || walkSession.demo) return;
        const c = p.coords,
          point = [c.latitude, c.longitude];
        if (!validPoint(point)) {
          document.getElementById("gpsStatus").textContent =
            "O GPS retornou coordenadas inválidas. Aguardando uma posição válida.";
          return;
        }
        renderWalkPosition(point, c.accuracy);
        const insidePark = updateParkBoundaryStatus(point, c.accuracy);
        if (!Number.isFinite(c.accuracy) || c.accuracy > 40) {
          document.getElementById("gpsStatus").textContent =
            "Sinal GPS impreciso. Aguardando uma posição melhor para medir a distância.";
          return;
        }
        if (walkSession.last) {
          const delta = distanceMeters(walkSession.last.point, point),
            seconds = (p.timestamp - walkSession.last.time) / 1000;
          if (seconds <= 0 || delta / seconds > 7) {
            document.getElementById("gpsStatus").textContent =
              "Salto de GPS descartado. Aguardando sinal estável.";
            return;
          }
          if (delta < Math.max(5, c.accuracy * 0.35)) return;
          walkSession.meters += delta;
        }
        walkSession.last = { point, time: p.timestamp };
        walkSession.points.push(point);
        walkSession.segments[walkSession.segments.length - 1].push(point);
        walkLine?.setLatLngs(walkSession.segments);
        renderRoute();
        document.getElementById("gpsStatus").textContent =
          `GPS ativo · precisão aproximada de ${Math.round(c.accuracy)} m${
            insidePark === false ? " · fora do limite configurado" : ""
          }`;
        renderWalk();
      },
      (e) => {
        if (!walkSession || walkSession.demo) return;
        pauseWalk(true);
        document.getElementById("gpsStatus").textContent =
          geoError(e) + " A caminhada foi pausada.";
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  } catch (e) {
    walkWatch = null;
    if (walkSession && !walkSession.demo) {
      pauseWalk(true);
      document.getElementById("gpsStatus").textContent =
        geoError(e) + " A caminhada foi pausada.";
    }
  }
}

async function startWalk(demo = false) {
  if (walkSession || walkStarting) return;
  if (!demo && !navigator.geolocation) {
    notify("GPS indisponível neste navegador.");
    return;
  }
  let initial = null;
  if (!demo) {
    walkStarting = true;
    document.getElementById("walkDemo").disabled = true;
    document.getElementById("gpsStatus").textContent =
      "Permita o acesso à localização para iniciar a caminhada.";
    document.getElementById("walkStart").disabled = true;
    try {
      initial = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 2000,
        }),
      );
      if (
        !validPoint([initial.coords.latitude, initial.coords.longitude]) ||
        !Number.isFinite(initial.coords.accuracy)
      )
        throw Error("O navegador retornou uma posição inválida. Tente novamente.");
    } catch (e) {
      document.getElementById("gpsStatus").textContent = e.code
        ? geoError(e)
        : e.message;
      document.getElementById("walkStart").disabled = false;
      document.getElementById("walkDemo").disabled = false;
      walkStarting = false;
      return;
    }
  }
  walkStarting = false;
  initWalkMap();
  walkSession = {
    demo,
    meters: 0,
    points: [],
    segments: [[]],
    last: null,
    running: true,
    since: performance.now(),
    accum: 0,
    boundaryWarning: false,
  };
  walkLine?.setLatLngs([]);
  walkLine?.setStyle({
    dashArray: demo ? "6 7" : null,
    opacity: demo ? 0.65 : 0.9,
  });
  document.getElementById("gpsStatus").textContent = demo
    ? "Simulação para testar o fluxo. Não usa sua localização."
    : "Buscando GPS… Mantenha a tela aberta durante a caminhada.";
  if (initial) {
    const point = [initial.coords.latitude, initial.coords.longitude];
    renderWalkPosition(point, initial.coords.accuracy);
    updateParkBoundaryStatus(point, initial.coords.accuracy);
    if (initial.coords.accuracy <= 40) {
      walkSession.last = { point, time: initial.timestamp };
      walkSession.points.push(point);
      walkSession.segments[0].push(point);
      renderRoute();
    }
  }
  if (!demo) watchWalking();
  walkTimer = setInterval(() => {
    if (walkSession?.running && walkSession.demo) {
      let p = demoPoint(walkSession.points.length);
      if (walkSession.last)
        walkSession.meters += distanceMeters(walkSession.last.point, p);
      walkSession.last = { point: p };
      walkSession.points.push(p);
      walkSession.segments[walkSession.segments.length - 1].push(p);
      walkLine?.setLatLngs(walkSession.segments);
      renderRoute();
      centerAt(p);
    }
    renderWalk();
  }, 1000);
  renderWalk();
}

function demoPoint(i) {
  return [-3.1375 + Math.sin(i / 10) * 0.00024, -60.0177 + 0.000014 * i];
}

function pauseWalk(force = false) {
  if (!walkSession) return;
  if (walkSession.running) {
    walkSession.accum = elapsedWalk();
    walkSession.running = false;
    walkSession.last = null;
    stopWatch();
  } else if (!force) {
    walkSession.segments.push([]);
    walkSession.running = true;
    walkSession.since = performance.now();
    walkSession.last = null;
    if (!walkSession.demo) watchWalking();
  }
  renderWalk();
}

function finishWalk() {
  if (!walkSession) return;
  pauseWalk(true);
  let ms = elapsedWalk(),
    km = walkSession.meters / 1000,
    demo = walkSession.demo;
  stopWatch();
  clearInterval(walkTimer);
  if (!demo && ms >= 1000) {
    state.logs.push({
      name: "Caminhada GPS" + (selectedPark ? " · " + selectedPark.name : ""),
      date: today(),
      minutes: Math.round(ms / 6000) / 10,
      km,
      route: walkSession.segments.map((segment) => segment.map((p) => [...p])),
    });
    persist();
  }
  document.getElementById("walkSummary").textContent =
    `${demo ? "Simulação concluída (não salva no histórico)" : "Caminhada registrada"} · ${km.toFixed(2)} km · ${formatDuration(ms)}. O resumo e o trajeto ficam salvos neste navegador.`;
  walkSession = null;
  walkLine?.setStyle({ dashArray: null, opacity: 0.9 });
  renderWalk();
}

function toggleWalkFollowing() {
  setFollowWalkPosition(!followWalkPosition);
  if (followWalkPosition && lastWalkPosition)
    centerAt(lastWalkPosition.point, true);
}

function routeSvg(segments) {
  const points = segments.flat();
  if (!points.length)
    return '<rect width="320" height="230" rx="15" fill="#17251d"/><text x="160" y="118" fill="#acbba3" text-anchor="middle" font-size="12">Aguardando sinal de GPS</text>';
  const lat0 = (points[0][0] * Math.PI) / 180,
    xs = points.map((p) => p[1] * Math.cos(lat0)),
    ys = points.map((p) => p[0]);
  let minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  let span = Math.max(maxX - minX, maxY - minY, 0.0002);
  const project = (p) => [
    24 + ((p[1] * Math.cos(lat0) - minX) * 272) / span,
    206 - ((p[0] - minY) * 182) / span,
  ];
  const paths = segments
    .filter((s) => s.length > 1)
    .map(
      (s) =>
        '<polyline points="' +
        s
          .map((p) =>
            project(p)
              .map((n) => n.toFixed(1))
              .join(","),
          )
          .join(" ") +
        '" fill="none" stroke="#a9bc94" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    )
    .join("");
  const start = project(points[0]),
    end = project(points[points.length - 1]);
  return (
    '<rect width="320" height="230" rx="15" fill="#17251d"/>' +
    paths +
    `<circle cx="${start[0]}" cy="${start[1]}" r="5" fill="#e6eddc"/><circle cx="${end[0]}" cy="${end[1]}" r="6" fill="#d89261"/>`
  );
}

function renderRoute() {
  if (!walkSession) return;
  document.getElementById("routeDrawing").innerHTML = routeSvg(
    walkSession.segments,
  );
  document.getElementById("routePointCount").textContent =
    walkSession.points.length + " pontos de GPS";
}

function showStoredRoute(i) {
  const log = state.logs[i];
  if (!log?.route) return;
  modal(
    `<h2>Trajeto da caminhada</h2><p>${log.date.split("-").reverse().join("/")} · ${log.km.toFixed(2)} km</p><svg viewBox="0 0 320 230" style="width:100%" aria-label="Trajeto salvo">${routeSvg(log.route)}</svg><p class="sub">Registro por GPS, sem fundo de ruas. Salvo neste navegador.</p>`,
  );
}
