import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const validationSource = fs.readFileSync(
  "src/shared/catalog-validation.js",
  "utf8",
);
const walkingSource = fs.readFileSync(
  "src/client/scripts/features/walking.js",
  "utf8",
);
const parksSource = fs.readFileSync(
  "src/client/scripts/features/parks.js",
  "utf8",
);
const appCss = fs.readFileSync("src/client/styles/app.css", "utf8");
const appSource = fs.readFileSync("src/client/scripts/app.js", "utf8");
const leafletSource = fs.readFileSync(
  "public/vendor/leaflet/leaflet.js",
  "utf8",
);

const bilharesBoundary = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "bilhares",
        name: "Parque dos Bilhares",
        boundaryStatus: "approximate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-60.02894, -3.10128],
            [-60.02442, -3.10042],
            [-60.02453, -3.1015],
            [-60.02869, -3.10261],
            [-60.02894, -3.10128],
          ],
        ],
      },
    },
  ],
};

const mindu = {
  id: "mindu",
  name: "Parque Municipal do Mindu",
  district: "Parque Dez de Novembro",
  point: [-3.08091, -60.00357],
  pointAccuracy: "reference",
  description: "Área verde.",
  enabled: true,
};
const bilhares = {
  id: "bilhares",
  name: "Parque Ponte dos Bilhares",
  district: "Chapada",
  point: [-3.101667, -60.026944],
  pointAccuracy: "reference",
  description: "Parque urbano.",
  enabled: true,
  boundary: bilharesBoundary,
  boundaryAccuracy: "approximate",
  boundaryAttribution: "Polígono aproximado fornecido nos dados do projeto Viva.",
};

const status = { textContent: "" };
const elements = new Map();
const getElement = (id) => {
  if (!elements.has(id)) {
    elements.set(id, {
      textContent: "",
      href: "",
      open: false,
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() {
          return false;
        },
      },
      removeAttribute() {},
      scrollIntoView() {},
    });
  }
  return elements.get(id);
};
elements.set("parkBoundaryStatus", status);
elements.set("mapStatus", status);

const mapCalls = [];
const boundaryLayers = [];
const locationLayers = [];
const locationMarkers = [];
const locationCircles = [];
const map = {
  options: {},
  setMaxBounds(bounds) {
    this.options.maxBounds = bounds;
    mapCalls.push(["maxBounds", bounds]);
  },
  fitBounds(bounds, options) {
    mapCalls.push(["fitBounds", bounds, options]);
  },
  flyTo(point, zoom, options) {
    mapCalls.push(["flyTo", point, zoom, options]);
  },
};

function coordinatesForBoundary(boundary) {
  const features =
    boundary.type === "FeatureCollection" ? boundary.features : [boundary];
  const points = features.flatMap((feature) => {
    const geometry =
      feature.type === "Feature" ? feature.geometry : feature;
    return geometry.type === "Polygon"
      ? geometry.coordinates.flat()
      : geometry.coordinates.flat(2);
  });
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
    isValid() {
      return true;
    },
    pad() {
      return this;
    },
  };
}

const context = vm.createContext({
  URL,
  console,
  map,
  mapCalls,
  locationLayers,
  locationMarkers,
  locationCircles,
  navigator: {
    geolocation: {
      getCurrentPosition(callback, errorCallback) {
        this.currentPositionCallback = callback;
        this.currentPositionErrorCallback = errorCallback;
      },
      watchPosition(callback) {
        this.callback = callback;
        return 1;
      },
      clearWatch() {},
    },
  },
  document: { getElementById: getElement },
  L: {
    divIcon(options) {
      return options;
    },
    marker(point, options) {
      const marker = {
        point: [...point],
        options,
        addTo(layer) {
          this.layer = layer;
          locationLayers.push(layer);
          return this;
        },
        setLatLng(nextPoint) {
          this.point = [...nextPoint];
          return this;
        },
      };
      locationMarkers.push(marker);
      return marker;
    },
    circle(point, options) {
      const circle = {
        point: [...point],
        options,
        addTo(layer) {
          this.layer = layer;
          locationLayers.push(layer);
          return this;
        },
        setLatLng(nextPoint) {
          this.point = [...nextPoint];
          return this;
        },
        setRadius(radius) {
          this.radius = radius;
          return this;
        },
        remove() {
          this.removed = true;
        },
      };
      locationCircles.push(circle);
      return circle;
    },
    geoJSON(boundary, options) {
      const layer = {
        boundary,
        options,
        addTo() {
          return this;
        },
        getBounds() {
          return coordinatesForBoundary(boundary);
        },
        remove() {},
      };
      boundaryLayers.push(layer);
      return layer;
    },
  },
});

vm.runInContext(
  `
    let selectedPark = null;
    let state = { parks: ${JSON.stringify([mindu, bilhares])} };
    let walkMap = map;
    let parkBoundaryLayer = null;
    let parkLayer = null;
    let userPositionMarker = null;
    let nearbyCenter = null;
    let parkSearch = "";
    let locating = false;
    let walkSession = null;
    let walkWatch = null;
    let followWalkPosition = true;
    let lastWalkPosition = null;
    let lastFollowPoint = null;
    let walkLine = null;
    function renderParks() {}
    function notify() {}
  ` +
    validationSource +
    "\n" +
    walkingSource +
    "\n" +
    parksSource +
    `
      renderParks = () => {};
      selectPark("bilhares");
      globalThis.firstSelection = {
        id: selectedPark.id,
        registrationOpen: document.getElementById("trackingDetails").open,
        fit: mapCalls.filter(([type]) => type === "fitBounds").length,
        bounds: mapCalls.filter(([type]) => type === "fitBounds").at(-1)?.[1],
        fitOptions: mapCalls.filter(([type]) => type === "fitBounds").at(-1)?.[2],
        maxBounds: map.options.maxBounds,
        maxBoundsViscosity: map.options.maxBoundsViscosity,
        status: document.getElementById("parkBoundaryStatus").textContent,
        style: parkBoundaryLayer.options.style,
        renderedBoundary: parkBoundaryLayer.boundary,
        geofenceResult: updateParkBoundaryStatus([-3.101, -60.026], 5),
      };
      const actualRenderWalkPosition = renderWalkPosition;
      renderWalkPosition = () => {};
      renderRoute = () => {};
      renderWalk = () => {};
      walkLine = { setLatLngs() {} };
      walkSession = {
        running: true,
        demo: false,
        last: null,
        points: [],
        segments: [[]],
        meters: 0,
      };
      watchWalking();
      navigator.geolocation.callback({
        coords: { latitude: -3.099, longitude: -60.026, accuracy: 5 },
        timestamp: 1000,
      });
      globalThis.outsideGpsRoute = {
        points: walkSession.points,
        meters: walkSession.meters,
      };
      const existingMap = walkMap;
      selectPark("mindu");
      globalThis.secondSelection = {
        id: selectedPark.id,
        sameMap: walkMap === existingMap,
        centerCall: mapCalls.filter(([type]) => type === "flyTo").at(-1),
        boundaryLayer: parkBoundaryLayer,
        maxBounds: map.options.maxBounds,
        maxBoundsViscosity: map.options.maxBoundsViscosity,
        status: document.getElementById("parkBoundaryStatus").textContent,
      };
      followWalkPosition = false;
      recenterWalk();
      navigator.geolocation.currentPositionCallback({
        coords: { latitude: -3.09, longitude: -60.03, accuracy: 25 },
      });
      globalThis.firstParkLocation = {
        status: document.getElementById("mapStatus").textContent,
        markerCount: locationMarkers.length,
        circleCount: locationCircles.length,
        point: locationMarkers[0].point,
        markerLayer: locationMarkers[0].layer,
        iconSize: locationMarkers[0].options.icon.iconSize,
        iconAnchor: locationMarkers[0].options.icon.iconAnchor,
      };
      locateForParks();
      navigator.geolocation.currentPositionCallback({
        coords: { latitude: -3.095, longitude: -60.025, accuracy: 40 },
      });
      globalThis.updatedParkLocation = {
        markerCount: locationMarkers.length,
        circleCount: locationCircles.length,
        point: locationMarkers[0].point,
      };
      locateForParks();
      navigator.geolocation.currentPositionCallback({
        coords: { latitude: -3.096, longitude: -60.024, accuracy: 1001 },
      });
      globalThis.invalidAccuracyParkLocation = {
        markerCount: locationMarkers.length,
        circleCount: locationCircles.length,
        point: locationMarkers[0].point,
      };
      const parkMarkerCount = locationMarkers.length;
      const parkCircleCount = locationCircles.length;
      actualRenderWalkPosition([-3.097, -60.023], 25);
      actualRenderWalkPosition([-3.098, -60.022], 30);
      const currentMarker = locationMarkers[0];
      globalThis.walkingPosition = {
        markerCount: locationMarkers.length,
        additionalMarkerCount: locationMarkers.length - parkMarkerCount,
        circleCount: locationCircles.length - parkCircleCount,
        point: currentMarker.point,
        iconSize: currentMarker.options.icon.iconSize,
        iconAnchor: currentMarker.options.icon.iconAnchor,
        iconClass: currentMarker.options.icon.className,
        iconHtml: currentMarker.options.icon.html,
        accuracy: lastWalkPosition.accuracy,
      };
      globalThis.pointInApproximatePolygon =
        pointInParkBoundary([-3.101, -60.026], ${JSON.stringify(bilharesBoundary)});
    `,
  context,
);

assert.equal(context.validParkBoundary(bilharesBoundary), true);
assert.equal(context.validParkBoundary({ type: "FeatureCollection", features: [] }), false);
assert.equal(context.firstSelection.id, "bilhares");
assert.equal(context.firstSelection.registrationOpen, true);
assert.equal(context.firstSelection.fit, 1);
assert.equal(context.firstSelection.bounds.west, -60.02894);
assert.equal(context.firstSelection.bounds.east, -60.02442);
assert.equal(context.firstSelection.maxBounds.south, -3.10261);
assert.equal(context.firstSelection.maxBounds.north, -3.10042);
assert.equal(context.firstSelection.maxBoundsViscosity, 1);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.firstSelection.fitOptions)),
  { padding: [32, 32], maxZoom: 17, animate: true, duration: 0.55 },
);
assert.match(context.firstSelection.status, /Polígono aproximado, não oficial/);
assert.match(context.firstSelection.status, /retângulo que envolve o polígono/);
assert.match(context.firstSelection.status, /não é uma geofence/);
assert.equal(context.firstSelection.style.dashArray, "7 6");
assert.equal(context.firstSelection.renderedBoundary.type, "FeatureCollection");
assert.equal(context.firstSelection.geofenceResult, null);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.outsideGpsRoute.points)),
  [[-3.099, -60.026]],
);
assert.equal(context.outsideGpsRoute.meters, 0);
assert.equal(context.secondSelection.id, "mindu");
assert.equal(context.secondSelection.sameMap, true);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.secondSelection.centerCall.slice(1, 3))),
  [[-3.08091, -60.00357], 16],
);
assert.equal(context.secondSelection.boundaryLayer, null);
assert.deepEqual(JSON.parse(JSON.stringify(context.secondSelection.maxBounds)), [
  [-3.19, -60.16],
  [-2.88, -59.86],
]);
assert.equal(context.secondSelection.maxBoundsViscosity, 0.65);
assert.match(context.secondSelection.status, /nenhum limite geográfico foi fornecido/);
assert.match(context.firstParkLocation.status, /Sua posição foi localizada/);
assert.equal(context.firstParkLocation.markerCount, 1);
assert.equal(context.firstParkLocation.circleCount, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.firstParkLocation.point)),
  [-3.09, -60.03],
);
assert.equal(context.firstParkLocation.markerLayer, map);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.firstParkLocation.iconSize)),
  [16, 16],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.firstParkLocation.iconAnchor)),
  [8, 8],
);
assert.equal(context.updatedParkLocation.markerCount, 1);
assert.equal(context.updatedParkLocation.circleCount, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.updatedParkLocation.point)),
  [-3.095, -60.025],
);
assert.equal(context.invalidAccuracyParkLocation.markerCount, 1);
assert.equal(context.invalidAccuracyParkLocation.circleCount, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.invalidAccuracyParkLocation.point)),
  [-3.096, -60.024],
);
assert.equal(context.walkingPosition.markerCount, 1);
assert.equal(context.walkingPosition.additionalMarkerCount, 0);
assert.equal(context.walkingPosition.circleCount, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.walkingPosition.point)),
  [-3.098, -60.022],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.walkingPosition.iconSize)),
  [16, 16],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.walkingPosition.iconAnchor)),
  [8, 8],
);
assert.equal(context.walkingPosition.iconClass, "walk-position-marker");
assert.equal(context.walkingPosition.iconHtml, "");
assert.equal(context.walkingPosition.accuracy, 30);
assert.match(appCss, /\.walk-position-marker\s*\{/);
assert.doesNotMatch(appCss, /\.leaflet-div-icon\.walk-position-marker/);
assert.match(appCss, /border:\s*2px solid #fff/);
assert.match(appCss, /border-radius:\s*50%/);
assert.match(appCss, /background:\s*#238ddd/);
assert.match(appCss, /box-shadow:\s*0 1px 7px #000b/);
assert.doesNotMatch(appCss, /\.walk-position-marker\s+span/);
assert.ok(locationLayers.every((layer) => layer === map));
assert.equal(context.pointInApproximatePolygon, true);
assert.ok(leafletSource.includes("setMaxBounds:function"));
assert.ok(leafletSource.includes("maxBoundsViscosity"));
assert.ok(leafletSource.includes("_onPreDragLimit:function"));

for (const [longitude, latitude] of [
  ["-60.02894", "-3.10128"],
  ["-60.02442", "-3.10042"],
  ["-60.02453", "-3.1015"],
  ["-60.02869", "-3.10261"],
  ["-60.02894", "-3.10128"],
]) {
  assert.match(
    appSource,
    new RegExp(`\\[${longitude},\\s*${latitude}\\]`),
    `The supplied Bilhares polygon coordinate [${longitude}, ${latitude}] must remain unchanged.`,
  );
}
assert.match(
  fs.readFileSync("src/client/scripts/features/core.js", "utf8"),
  /if \(id !== "walk"\) restoreWalkMapNavigationBounds\(\);/,
);

context.restoreWalkMapNavigationBounds();
assert.deepEqual(JSON.parse(JSON.stringify(map.options.maxBounds)), [
  [-3.19, -60.16],
  [-2.88, -59.86],
]);
assert.equal(map.options.maxBoundsViscosity, 0.65);

console.log("Park selection, navigation bounds, transitions and approximate GeoJSON: OK.");
