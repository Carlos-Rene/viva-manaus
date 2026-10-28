const MANAUS_BOUNDS = [
  [-3.19, -60.16],
  [-2.88, -59.86],
];

function inManaus(p) {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    p.every(Number.isFinite) &&
    p[0] >= MANAUS_BOUNDS[0][0] &&
    p[0] <= MANAUS_BOUNDS[1][0] &&
    p[1] >= MANAUS_BOUNDS[0][1] &&
    p[1] <= MANAUS_BOUNDS[1][1]
  );
}

function httpUrl(v) {
  try {
    const u = new URL(v);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

function validateConfig(data) {
  if (JSON.stringify(data).includes("<") || JSON.stringify(data).includes(">"))
    throw Error("Use apenas texto simples nos campos do catálogo.");
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Configuração inválida.");
  let c = data.settings;
  if (
    !c ||
    !["brand", "welcome", "intro"].every(
      (k) => typeof c[k] === "string" && c[k].length <= 300,
    ) ||
    !["accent", "routeColor", "background"].every((k) =>
      /^#[a-fA-F0-9]{6}$/.test(c[k]),
    )
  )
    throw Error("Confira nome, textos e cores (#RRGGBB).");
  if (
    !Array.isArray(data.activities) ||
    data.activities.length < 20 ||
    data.activities.length > 100
  )
    throw Error(
      "Mantenha de 20 a 100 atividades. As 20 primeiras sustentam as recomendações.",
    );
  data.activities.forEach((a) => {
    if (
      !Array.isArray(a) ||
      a.length !== 6 ||
      ![0, 1, 2, 3, 5].every(
        (i) => typeof a[i] === "string" && a[i].length <= 2000,
      ) ||
      !Number.isFinite(a[4]) ||
      a[4] < 1 ||
      a[4] > 300
    )
      throw Error(
        "Atividade inválida: [título, descrição, ícone, categoria, minutos, instruções].",
      );
  });
  if (!Array.isArray(data.parks) || data.parks.length > 100)
    throw Error("Lista de parques inválida.");
  data.parks.forEach((p) => {
    if (
      !validId(p.id) ||
      typeof p.name !== "string" ||
      typeof p.district !== "string" ||
      typeof p.description !== "string" ||
      !inManaus(p.point) ||
      typeof p.enabled !== "boolean" ||
      (p.source && !httpUrl(p.source)) ||
      (p.boundary !== undefined && !validParkBoundary(p.boundary)) ||
      (p.boundaryAccuracy !== undefined &&
        !["verified", "approximate"].includes(p.boundaryAccuracy)) ||
      (p.boundarySource && !httpUrl(p.boundarySource)) ||
      (p.boundaryAccuracy === "verified" && !httpUrl(p.boundarySource)) ||
      (p.boundaryAccuracy === "approximate" &&
        (typeof p.boundaryAttribution !== "string" ||
          p.boundaryAttribution.length > 300))
    )
      throw Error("Confira nome, coordenadas de Manaus e fonte dos parques.");
  });
  if (new Set(data.parks.map((p) => p.id)).size !== data.parks.length)
    throw Error("IDs de parques duplicados.");
  if (!Array.isArray(data.events) || data.events.length > 100)
    throw Error("Lista de eventos inválida.");
  data.events.forEach((e) => {
    if (
      !validId(e.id) ||
      ![
        "Bike",
        "Caminhada",
        "Corrida",
        "Atletismo",
        "Atividade em grupo",
      ].includes(e.type) ||
      !["name", "place", "description", "date", "time", "url"].every(
        (k) => typeof e[k] === "string",
      ) ||
      typeof e.demo !== "boolean" ||
      typeof e.published !== "boolean" ||
      (!e.demo && e.published && (!e.date || !httpUrl(e.url))) ||
      (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date))
    )
      throw Error(
        "Evento real publicado precisa de data e link de fonte. Confira os campos.",
      );
  });
  if (new Set(data.events.map((e) => e.id)).size !== data.events.length)
    throw Error("IDs de eventos duplicados.");
  if (!Array.isArray(data.videos) || data.videos.length > 200)
    throw Error("Lista de vídeos inválida.");
  data.videos.forEach((v) => {
    if (v.plan && !validWorkoutPlan(v.plan))
      throw Error("Tempo, séries ou repetições inválidos.");
    if (
      !/^[\w-]{11}$/.test(v.id) ||
      typeof v.title !== "string" ||
      !["Exercício", "Alongamento"].includes(v.type) ||
      !Number.isInteger(v.start) ||
      v.start < 0 ||
      v.start > 86400
    )
      throw Error("Vídeo inválido.");
  });
  if (
    !data.texts ||
    Object.values(data.texts).some(
      (v) => typeof v !== "string" || v.length > 2000,
    )
  )
    throw Error("Textos inválidos.");
  return data;
}

function validId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,70}$/.test(id);
}

function validParkBoundary(boundary) {
  if (boundary?.type === "FeatureCollection")
    return (
      Array.isArray(boundary.features) &&
      boundary.features.length > 0 &&
      boundary.features.every(
        (feature) =>
          feature?.type === "Feature" &&
          validParkBoundaryGeometry(feature.geometry),
      )
    );
  const geometry = boundary?.type === "Feature" ? boundary.geometry : boundary;
  return validParkBoundaryGeometry(geometry);
}

function validParkBoundaryGeometry(geometry) {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type))
    return false;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return (
    Array.isArray(polygons) &&
    polygons.length > 0 &&
    polygons.every(
      (rings) =>
        Array.isArray(rings) &&
        rings.length > 0 &&
        rings.every(
          (ring) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every(
              (coord) =>
                Array.isArray(coord) &&
                coord.length >= 2 &&
                Number.isFinite(coord[0]) &&
                Number.isFinite(coord[1]) &&
                inManaus([coord[1], coord[0]]),
            ) &&
            ring[0][0] === ring[ring.length - 1][0] &&
            ring[0][1] === ring[ring.length - 1][1],
        ),
    )
  );
}

function validWorkoutPlan(p) {
  return (
    p &&
    ["time", "reps"].includes(p.mode) &&
    (p.mode === "time"
      ? Number.isInteger(p.seconds) && p.seconds >= 10 && p.seconds <= 600
      : Number.isInteger(p.sets) &&
        p.sets >= 1 &&
        p.sets <= 10 &&
        Number.isInteger(p.reps) &&
        p.reps >= 1 &&
        p.reps <= 100 &&
        Number.isInteger(p.rest) &&
        p.rest >= 0 &&
        p.rest <= 300) &&
    (!p.focus || (typeof p.focus === "string" && p.focus.length <= 120))
  );
}
