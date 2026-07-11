import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { styleUrl, LANDMARKS, BOOK_PINS, pinFor, landmarkCount } from "../lib/geo";
import PlaceSearch from "./PlaceSearch";

/* ---------- flight path helpers (Indiana-Jones style takeoff → landing) ---------- */
const RAD = Math.PI / 180;

function haversineKm(a, b) {
  const dLat = (b[1] - a[1]) * RAD, dLng = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}

function bearingDeg(a, b) {
  const φ1 = a[1] * RAD, φ2 = b[1] * RAD, dλ = (b[0] - a[0]) * RAD;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

const EMPTY_LINE = { type: "Feature", geometry: { type: "LineString", coordinates: [] } };
const EMPTY_FC = { type: "FeatureCollection", features: [] };

/* ---------- live air traffic (community ADS-B: airplanes.live + adsb.lol) ---------- */
const TRAFFIC_ZOOM = 5.5; // above: query around the camera · below: global hub sweep
// tried in order — airplanes.live sends CORS natively; the others need a relay.
// A source that fails goes on a 90 s cooldown so one rate-limited feed can't
// blank the sky; the next source takes over immediately.
const relay = (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u);
const TRAFFIC_SOURCES = [
  { key: "ac", url: (lat, lng) => `https://api.airplanes.live/v2/point/${lat.toFixed(3)}/${lng.toFixed(3)}/250` },
  { key: "ac", url: (lat, lng) => relay(`https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lng.toFixed(3)}/250`) },
  { key: "aircraft", url: (lat, lng) => relay(`https://opendata.adsb.fi/api/v2/lat/${lat.toFixed(3)}/lon/${lng.toFixed(3)}/dist/250`) },
];
const srcCooldown = new Array(TRAFFIC_SOURCES.length).fill(0);

// returns the aircraft list, or null when every source is down
async function fetchTraffic(lat, lng) {
  for (let i = 0; i < TRAFFIC_SOURCES.length; i++) {
    if (Date.now() < srcCooldown[i]) continue;
    const s = TRAFFIC_SOURCES[i];
    try {
      const r = await fetch(s.url(lat, lng));
      if (r.ok) return (await r.json())[s.key] || [];
      srcCooldown[i] = Date.now() + 90000;
    } catch {
      srcCooldown[i] = Date.now() + 90000;
    }
  }
  return null;
}

// world-sweep sample points: the planet's busiest air corridors, every continent.
// Each covers a 250 nm radius; queried one per second to respect API limits.
const WORLD_HUBS = [
  [-73.9, 40.7],    // New York
  [-84.4, 33.7],    // Atlanta
  [-87.9, 41.9],    // Chicago
  [-97.0, 32.9],    // Dallas
  [-118.4, 33.9],   // Los Angeles
  [-99.1, 19.4],    // Mexico City
  [-46.6, -23.5],   // São Paulo
  [-74.1, 4.7],     // Bogotá
  [-0.45, 51.47],   // London
  [8.57, 50.03],    // Frankfurt
  [-3.57, 40.49],   // Madrid
  [28.75, 41.28],   // Istanbul
  [37.6, 55.75],    // Moscow
  [55.36, 25.25],   // Dubai
  [31.4, 30.12],    // Cairo
  [28.24, -26.13],  // Johannesburg
  [77.1, 28.55],    // Delhi
  [72.87, 19.09],   // Mumbai
  [103.99, 1.36],   // Singapore
  [114.0, 22.4],    // Hong Kong / Shenzhen
  [116.6, 40.07],   // Beijing
  [139.78, 35.55],  // Tokyo
  [151.18, -33.95], // Sydney
];

// altitude → color, like flight-tracker sites (warm = low, cool/purple = high)
const ALT_COLORS = [
  { max: 0, color: "#9aa0ae" },        // on the ground
  { max: 4000, color: "#ff9d42" },
  { max: 10000, color: "#ffd23e" },
  { max: 18000, color: "#a4e34d" },
  { max: 26000, color: "#3ddc97" },
  { max: 33000, color: "#4fc3f7" },
  { max: 40000, color: "#7c9bff" },
  { max: Infinity, color: "#c77dff" },
];
const altBucket = (alt) => {
  if (alt === "ground" || alt == null || alt === "") return 0;
  const n = Number(alt);
  for (let i = 1; i < ALT_COLORS.length; i++) if (n <= ALT_COLORS[i].max) return i;
  return ALT_COLORS.length - 1;
};

function addPlaneIcons(map) {
  const path = "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";
  ALT_COLORS.forEach((b, i) => {
    if (map.hasImage(`devx-plane-${i}`)) return;
    const size = 44;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.scale(size / 24, size / 24);
    // soft halo in the bucket colour so planes read against any map
    const g = ctx.createRadialGradient(12, 12, 2, 12, 12, 11);
    g.addColorStop(0, b.color + "66");
    g.addColorStop(1, b.color + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
    const p = new Path2D(path);
    ctx.fillStyle = b.color;
    ctx.strokeStyle = "rgba(10,12,20,0.9)";
    ctx.lineWidth = 0.9;
    ctx.fill(p);
    ctx.stroke(p);
    map.addImage(`devx-plane-${i}`, ctx.getImageData(0, 0, size, size));
  });
}

function ensureTrafficLayer(map) {
  addPlaneIcons(map);
  if (!map.getSource("devx-traffic")) {
    map.addSource("devx-traffic", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "devx-traffic",
      source: "devx-traffic",
      type: "symbol",
      layout: {
        "icon-image": ["concat", "devx-plane-", ["get", "altBucket"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.38, 6, 0.58, 11, 0.72],
        "icon-rotate": ["get", "track"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 0.95 },
    });
  }
}

// every useful field the API gives us, for the details panel
const acProps = (a) => ({
  hex: a.hex || "",
  callsign: (a.flight || "").trim() || a.r || a.hex || "",
  reg: a.r || "",
  t: a.t || "",
  desc: a.desc || "",
  squawk: a.squawk || "",
  cat: a.category || "",
  alt: a.alt_baro ?? "",
  altGeom: a.alt_geom ?? "",
  gs: Math.round(a.gs || 0),
  track: a.track ?? a.true_heading ?? 0,
  vr: a.baro_rate ?? a.geom_rate ?? "",
  lat: a.lat,
  lon: a.lon,
  src: a.type || "",
  rssi: a.rssi ?? "",
  seen: a.seen ?? "",
  altBucket: altBucket(a.alt_baro),
});

// live position of one aircraft (for path tracking)
const HEX_SOURCES = [
  { key: "ac", url: (hex) => `https://api.airplanes.live/v2/hex/${hex}` },
  { key: "ac", url: (hex) => relay(`https://api.adsb.lol/v2/hex/${hex}`) },
  { key: "aircraft", url: (hex) => relay(`https://opendata.adsb.fi/api/v2/hex/${hex}`) },
];
async function fetchHex(hex) {
  for (const s of HEX_SOURCES) {
    try {
      const r = await fetch(s.url(hex));
      if (r.ok) return ((await r.json())[s.key] || [])[0] || null;
    } catch { /* next source */ }
  }
  return null;
}

function ensureFlightLayers(map) {
  if (!map.getSource("devx-flight")) {
    map.addSource("devx-flight", { type: "geojson", data: EMPTY_LINE });
    map.addLayer({
      id: "devx-flight-glow", source: "devx-flight", type: "line",
      paint: { "line-color": "#c3ef3e", "line-width": 7, "line-opacity": 0.22, "line-blur": 4 },
    });
    map.addLayer({
      id: "devx-flight-line", source: "devx-flight", type: "line",
      paint: { "line-color": "#c3ef3e", "line-width": 2.2, "line-opacity": 0.9, "line-dasharray": [0.4, 1.6] },
    });
  }
}

function planeEl() {
  const el = document.createElement("div");
  el.className = "plane-pin";
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="#ffffff" stroke="#0e0c16" stroke-width="0.6">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
  </svg>`;
  return el;
}

// real 3D buildings — must be re-added after every setStyle() (style switches wipe custom layers)
function add3dBuildings(map, theme) {
  try {
    if (map.getLayer("devx-3d-buildings")) map.removeLayer("devx-3d-buildings");
    const layers = map.getStyle().layers;
    const labelId = layers.find((l) => l.type === "symbol" && l.layout?.["text-field"])?.id;
    map.addLayer(
      {
        id: "devx-3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": theme === "light" ? "#d9d3c7" : "#3a3648",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.82,
        },
      },
      labelId
    );
  } catch { /* style variations — non-fatal */ }
}

/**
 * The DevX world — a real, live MapLibre + MapTiler map (dark streets style)
 * with real 3D buildings. Every book is a glowing pin in the city that made
 * its field famous; zoomed out you see one beacon per category-district.
 * Picking a book flies the camera there, then the reader opens.
 */

const ZOOM_SPLIT = 8.5; // below: category beacons · above: individual books

function bookMarkerEl(pin, onPick) {
  const el = document.createElement("div");
  el.className = "book-pin" + (pin.featured ? " featured" : "");
  el.innerHTML = `
    <img class="poster" src="${pin.book.cover}" alt="" draggable="false" loading="lazy" />
    <span class="card">
      <img src="${pin.book.cover}" alt="" />
      <span class="meta">
        <span class="cat">${pin.book.category}</span>
        <span class="title">${pin.book.title}</span>
        <span class="hint">Click to read</span>
      </span>
    </span>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); onPick(pin.book); });
  return el;
}

function beaconEl(lm, count, onPick) {
  const el = document.createElement("div");
  el.className = "cat-beacon";
  el.innerHTML = `
    <span class="pulse"></span>
    <span class="label">
      <strong>${lm.name}</strong>
      <em>${lm.place} · ${count} book${count === 1 ? "" : "s"}</em>
    </span>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); onPick(lm); });
  return el;
}

export default function MapView({ flyTo, onPickBook, onArrived }) {
  const wrap = useRef(null);
  const mapRef = useRef(null);
  const [hint, setHint] = useState("Scroll to zoom · Drag to pan · Right-drag to tilt");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("siddlib.mapTheme") || "dark"; } catch { return "dark"; }
  });
  const [travel, setTravel] = useState(null); // destination label while the camera flies
  const [liveFlights, setLiveFlights] = useState(true); // real air traffic overlay
  const [selPlane, setSelPlane] = useState(null); // { hex, props, at } — flight details panel
  const [trafficDown, setTrafficDown] = useState(false); // all flight feeds busy/rate-limited
  const flightRef = useRef(null); // cleanup fn of the active plane animation

  // Plane rides the camera: on every camera move it sits at the screen centre
  // with the flown trail accumulating behind it. Perfectly synced with any
  // flight duration/easing, and always visible — pure movie travel-map.
  const startFlight = (map) => {
    flightRef.current?.(); // cancel a previous flight
    try { ensureFlightLayers(map); } catch { return; }
    const start = map.getCenter();
    const trail = [[start.lng, start.lat]];
    const marker = new maplibregl.Marker({ element: planeEl(), rotationAlignment: "map", pitchAlignment: "map" })
      .setLngLat(start)
      .addTo(map);
    const onMove = () => {
      const c = map.getCenter();
      const prev = trail[trail.length - 1];
      let lng = c.lng; // unwrap so the trail never jumps across ±180°
      while (lng - prev[0] > 180) lng -= 360;
      while (lng - prev[0] < -180) lng += 360;
      const here = [lng, c.lat];
      if (haversineKm(prev, here) < 0.5) return;
      trail.push(here);
      try {
        marker.setLngLat(here);
        marker.setRotation(bearingDeg(prev, here));
        map.getSource("devx-flight")?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: trail } });
      } catch { /* style switched mid-flight */ }
    };
    const cleanup = () => {
      map.off("move", onMove);
      marker.remove();
      if (flightRef.current === cleanup) flightRef.current = null;
      setTimeout(() => { try { map.getSource("devx-flight")?.setData(EMPTY_LINE); } catch { /* ignore */ } }, 1400);
    };
    flightRef.current = cleanup;
    map.on("move", onMove);
    map.once("moveend", cleanup);
  };

  // programmatic flight: travel banner + warp pulse + plane takeoff for long hops
  const cinematicFly = (opts, label) => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const from = [c.lng, c.lat];
    const to = Array.isArray(opts.center) ? opts.center : [opts.center.lng, opts.center.lat];
    if (haversineKm(from, to) > 300) startFlight(map);
    if (label) setTravel(label);
    map.flyTo({ essential: true, ...opts });
    map.once("moveend", () => setTravel(null));
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("siddlib.mapTheme", next); } catch { /* ignore */ }
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(styleUrl(next));
    map.once("style.load", () => add3dBuildings(map, next));
  };

  // ---- init once ----
  useEffect(() => {
    const map = new maplibregl.Map({
      container: wrap.current,
      style: styleUrl(theme),
      center: [30, 25],
      zoom: 1.6,
      pitch: 0,
      attributionControl: { compact: true, customAttribution: "Live flights © airplanes.live · adsb.lol" },
    });
    mapRef.current = map;
    window.devxMap = map; // debugging hook
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, showUserLocation: true }),
      "bottom-right"
    );

    // markers
    const bookMarkers = [];
    const beacons = [];
    for (const pin of BOOK_PINS) {
      const m = new maplibregl.Marker({ element: bookMarkerEl(pin, (b) => onPickBook(b)), anchor: "bottom" })
        .setLngLat(pin.lngLat)
        .addTo(map);
      bookMarkers.push(m);
    }
    for (const lm of LANDMARKS) {
      const count = landmarkCount(lm);
      if (!count) continue;
      const el = beaconEl(lm, count, (l) => {
        cinematicFly({ center: l.at, zoom: 14.2, pitch: 55, bearing: -15, speed: 1.6, curve: 1.5 }, l.name);
      });
      beacons.push(new maplibregl.Marker({ element: el }).setLngLat(lm.at).addTo(map));
    }

    const applyZoomVisibility = () => {
      const z = map.getZoom();
      const showBooks = z >= ZOOM_SPLIT;
      const big = z >= 12;
      bookMarkers.forEach((m) => {
        const el = m.getElement();
        el.style.display = showBooks ? "" : "none";
        el.classList.toggle("big", big);
      });
      beacons.forEach((m) => (m.getElement().style.display = showBooks ? "none" : ""));
      setHint(
        showBooks
          ? "Those posters are books — click one to read"
          : "Books live at the world's wonders — click a beacon to visit"
      );
    };
    map.on("zoom", applyZoomVisibility);
    applyZoomVisibility();

    // flatten the camera when zoomed out — a pitched world map looks broken
    map.on("zoomend", () => {
      if (map.getZoom() < 4.5 && map.getPitch() > 15) map.easeTo({ pitch: 0, duration: 500 });
    });

    map.on("load", () => {
      add3dBuildings(map, localStorage.getItem("siddlib.mapTheme") || "dark");

      // Landing: zoom STRAIGHT into the visitor's location. The world view
      // holds while the permission prompt is up; on grant we dive in. Only a
      // denial / timeout falls back to the last-read book (or world view).
      const fallbackIntro = () => {
        const last = Number(localStorage.getItem("siddlib.lastBook"));
        const pin = pinFor(last);
        if (pin) map.flyTo({ center: pin.lngLat, zoom: 13.2, pitch: 50, bearing: -12, speed: 0.9, curve: 1.6 });
        else map.flyTo({ center: [10, 30], zoom: 2.2, speed: 0.4 });
      };
      const flyHome = (pos) => {
        const here = [pos.coords.longitude, pos.coords.latitude];
        const el = document.createElement("div");
        el.className = "you-pin";
        el.title = "You are here";
        new maplibregl.Marker({ element: el }).setLngLat(here).addTo(map);
        // rooftop-level landing — right down among the 3D buildings
        cinematicFly({ center: here, zoom: 17, pitch: 62, bearing: -20, speed: 1.35, curve: 1.7 }, "your location");
      };

      if (navigator.geolocation) {
        let fellBack = false;
        const fallbackOnce = () => { if (!fellBack) { fellBack = true; fallbackIntro(); } };
        // safety net: user ignores the prompt → don't leave them staring at space
        const timer = setTimeout(fallbackOnce, 12000);
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(timer); flyHome(pos); }, // grant (even late) → go home
          () => { clearTimeout(timer); fallbackOnce(); },
          { timeout: 10000, maximumAge: 600000 }
        );
      } else {
        fallbackIntro();
      }
    });

    // click a live plane → flight details panel + live path tracking
    map.on("click", (e) => {
      let f;
      try { f = map.queryRenderedFeatures(e.point, { layers: ["devx-traffic"] })[0]; } catch { return; }
      if (!f) return;
      setSelPlane({ hex: f.properties.hex, props: f.properties, at: f.geometry.coordinates });
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- live air traffic ----
  // zoomed in (≥ TRAFFIC_ZOOM): 250 nm around the camera, every 10 s
  // zoomed out: rolling sweep across WORLD_HUBS (1 req/s) → planes everywhere
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let stop = false;
    let sweeping = false;
    let lastSweep = 0;
    const worldCache = new Map(); // hex → { feature, ts }

    const clear = () => { try { map.getSource("devx-traffic")?.setData(EMPTY_FC); } catch { /* ignore */ } };
    const acToFeature = (a) => ({
      type: "Feature",
      properties: acProps(a),
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
    });
    const setData = (features) => {
      if (stop) return;
      try {
        ensureTrafficLayer(map);
        map.getSource("devx-traffic")?.setData({ type: "FeatureCollection", features });
      } catch { /* style mid-switch */ }
    };

    const localTick = async () => {
      const c = map.getCenter();
      const ac = await fetchTraffic(c.lat, c.lng);
      if (stop || !liveFlights || map.getZoom() < TRAFFIC_ZOOM) return;
      if (ac === null) { setTrafficDown(true); return; } // feeds busy — keep what we have
      setTrafficDown(false);
      setData(ac.filter((a) => a.lat != null && a.lon != null).map(acToFeature));
    };

    const worldSweep = async () => {
      if (sweeping) return;
      sweeping = true;
      // nearest hubs first → planes around the user's view appear within seconds
      const c = map.getCenter();
      const hubs = [...WORLD_HUBS].sort(
        (a, b) => haversineKm([c.lng, c.lat], a) - haversineKm([c.lng, c.lat], b)
      );
      let completed = true;
      for (const [lng, lat] of hubs) {
        if (stop || !liveFlights || document.hidden || map.getZoom() >= TRAFFIC_ZOOM) {
          completed = false; // aborted — do NOT stamp lastSweep, so the next tick resweeps
          break;
        }
        const ac = await fetchTraffic(lat, lng);
        if (ac === null) { setTrafficDown(true); continue; } // all feeds busy — try next hub later
        setTrafficDown(false);
        const now = Date.now();
        ac.forEach((a) => {
          if (a.lat != null && a.lon != null && a.hex) worldCache.set(a.hex, { f: acToFeature(a), ts: now });
        });
        for (const [hex, v] of worldCache) if (now - v.ts > 240000) worldCache.delete(hex); // prune stale
        setData([...worldCache.values()].map((v) => v.f)); // continents light up as the sweep runs
        await new Promise((r) => setTimeout(r, 1050)); // ~1 req/s — polite to the API
      }
      sweeping = false;
      if (completed) lastSweep = Date.now();
    };

    const tick = () => {
      if (stop || !liveFlights || document.hidden || !map.isStyleLoaded()) return;
      if (map.getZoom() >= TRAFFIC_ZOOM) localTick();
      else if (Date.now() - lastSweep > 60000) worldSweep(); // refresh the world every ~60 s
      else setData([...worldCache.values()].map((v) => v.f));
    };

    const iv = setInterval(tick, 10000);
    map.on("moveend", tick);
    if (map.isStyleLoaded()) tick(); else map.once("load", tick);
    return () => { stop = true; clearInterval(iv); map.off("moveend", tick); clear(); };
  }, [liveFlights]);

  // ---- selected flight: poll its live position, draw the growing path + ring ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selPlane) return;
    const hex = selPlane.hex;
    let stop = false;
    const trail = [selPlane.at.slice()];

    const ensureSelLayers = () => {
      if (!map.getSource("devx-sel-trail")) {
        map.addSource("devx-sel-trail", { type: "geojson", data: EMPTY_LINE });
        map.addLayer({
          id: "devx-sel-trail-glow", source: "devx-sel-trail", type: "line",
          paint: { "line-color": "#c3ef3e", "line-width": 7, "line-opacity": 0.2, "line-blur": 4 },
        });
        map.addLayer({
          id: "devx-sel-trail", source: "devx-sel-trail", type: "line",
          paint: { "line-color": "#c3ef3e", "line-width": 2.4, "line-opacity": 0.9 },
        });
      }
      if (!map.getSource("devx-sel-pt")) {
        map.addSource("devx-sel-pt", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "devx-sel-ring", source: "devx-sel-pt", type: "circle",
          paint: {
            "circle-radius": 17,
            "circle-color": "rgba(195,239,62,0.10)",
            "circle-stroke-color": "#c3ef3e",
            "circle-stroke-width": 2,
          },
        });
      }
    };
    const draw = (coords) => {
      try {
        ensureSelLayers();
        map.getSource("devx-sel-trail")?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: trail } });
        map.getSource("devx-sel-pt")?.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: { type: "Point", coordinates: coords } }],
        });
      } catch { /* style mid-switch */ }
    };
    draw(trail[0]);

    const poll = async () => {
      if (stop) return;
      const a = await fetchHex(hex);
      if (stop || !a || a.lat == null) return;
      const c = [a.lon, a.lat];
      if (haversineKm(trail[trail.length - 1], c) > 0.05) trail.push(c);
      draw(c);
      setSelPlane((s) => (s && s.hex === hex ? { ...s, props: acProps(a), at: c } : s));
    };
    const iv = setInterval(poll, 6000);
    poll();
    return () => {
      stop = true;
      clearInterval(iv);
      try {
        map.getSource("devx-sel-trail")?.setData(EMPTY_LINE);
        map.getSource("devx-sel-pt")?.setData(EMPTY_FC);
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selPlane?.hex]);

  // ---- fly-to-book (sidebar / marker pick) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!flyTo || !map) return;
    const pin = pinFor(flyTo.book.id);
    if (!pin) { onArrived?.(flyTo.book); return; }
    cinematicFly(
      { center: pin.lngLat, zoom: 16.2, pitch: 60, bearing: -20, speed: 1.7, curve: 1.6 },
      `${pin.landmark.name} · ${pin.landmark.place}`
    );
    const done = () => { if (flyTo.open) onArrived?.(flyTo.book); };
    map.once("moveend", done);
    return () => map.off("moveend", done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo, onArrived]);

  return (
    <div className="fixed inset-0 z-0">
      <div ref={wrap} className="h-full w-full" />
      {/* top-right control cluster: theme toggle + place search */}
      <div className="absolute right-4 top-4 z-30 flex items-start gap-2.5">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light map" : "Switch to dark map"}
          aria-label="Toggle map theme"
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/12 bg-ink/85 text-white/80 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors hover:border-lime/60 hover:text-lime"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -120, opacity: 0, scale: 0.4 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 120, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="grid place-items-center"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setLiveFlights((v) => !v)}
          title={liveFlights ? "Hide live air traffic (adsb.lol)" : "Show live air traffic (adsb.lol)"}
          aria-label="Toggle live flights"
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors ${
            liveFlights
              ? "border-transparent bg-lime text-ink"
              : "border-white/12 bg-ink/85 text-white/60 hover:border-lime/60 hover:text-lime"
          }`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
          {liveFlights && trafficDown && (
            <span
              className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-ink bg-amber-400"
              title="Flight feeds are busy — retrying"
            />
          )}
        </motion.button>

        <PlaceSearch
          onGo={(center, name) =>
            cinematicFly({ center, zoom: 13.5, pitch: 45, bearing: 0, speed: 1.7, curve: 1.5 }, name)
          }
        />
      </div>

      {/* selected flight details panel (adsb.lol style) */}
      <AnimatePresence>
        {selPlane && (
          <motion.aside
            key={selPlane.hex}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-4 top-[4.5rem] z-30 w-72 overflow-hidden rounded-2xl border border-white/12 bg-ink/90 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold leading-tight">
                  {selPlane.props.callsign || "Unknown"}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  hex {selPlane.props.hex} {selPlane.props.reg && `· ${selPlane.props.reg}`}
                </p>
              </div>
              <span
                className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-ink"
                style={{ background: ALT_COLORS[Number(selPlane.props.altBucket) || 0].color }}
              >
                {selPlane.props.alt === "ground" ? "GROUND" : `${Number(selPlane.props.alt || 0).toLocaleString()} ft`}
              </span>
              <button
                onClick={() => setSelPlane(null)}
                aria-label="Close flight details"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(selPlane.props.t || selPlane.props.desc) && (
              <p className="border-b border-white/10 px-4 py-2 text-xs text-white/70">
                <span className="font-semibold text-white">{selPlane.props.t}</span>
                {selPlane.props.desc && <span className="text-white/50"> — {selPlane.props.desc}</span>}
              </p>
            )}

            {[
              ["SPATIAL", [
                ["Ground speed", selPlane.props.gs ? `${selPlane.props.gs} kts` : "—"],
                ["Baro altitude", selPlane.props.alt === "ground" ? "on ground" : selPlane.props.alt ? `${Number(selPlane.props.alt).toLocaleString()} ft` : "—"],
                ["WGS84 altitude", selPlane.props.altGeom ? `${Number(selPlane.props.altGeom).toLocaleString()} ft` : "—"],
                ["Vertical rate", selPlane.props.vr !== "" ? `${selPlane.props.vr} ft/min` : "—"],
                ["Track", `${Math.round(selPlane.props.track)}°`],
                ["Position", selPlane.props.lat != null ? `${Number(selPlane.props.lat).toFixed(3)}°, ${Number(selPlane.props.lon).toFixed(3)}°` : "—"],
              ]],
              ["AIRCRAFT · SIGNAL", [
                ["Squawk", selPlane.props.squawk || "—"],
                ["Category", selPlane.props.cat || "—"],
                ["Source", (selPlane.props.src || "").replace("_", " ").toUpperCase() || "—"],
                ["RSSI", selPlane.props.rssi !== "" ? `${selPlane.props.rssi} dBFS` : "—"],
                ["Last seen", selPlane.props.seen !== "" ? `${selPlane.props.seen}s ago` : "—"],
              ]],
            ].map(([title, rows]) => (
              <div key={title} className="px-4 py-2.5">
                <p className="pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-lime/80">{title}</p>
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 py-[3px]">
                    <span className="text-[11px] text-white/45">{k}</span>
                    <span className="text-right text-[11px] font-medium text-white/90">{v}</span>
                  </div>
                ))}
              </div>
            ))}

            <p className="border-t border-white/10 px-4 py-2 text-[10px] text-white/35">
              ● Live — path traces on the map while this panel is open
            </p>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* travel overlay: destination banner + warp pulse while the camera flies */}
      <AnimatePresence>
        {travel && (
          <>
            <motion.div
              key="warp"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.4, 0.15] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "radial-gradient(75% 60% at 50% 50%, transparent 58%, rgba(124,92,255,0.35) 100%)" }}
            />
            <motion.div
              key="banner"
              initial={{ y: -28, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: -20, opacity: 0, x: "-50%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-1/2 top-5 z-30 flex items-center gap-3 rounded-full border border-white/12 bg-ink/85 py-2.5 pl-4 pr-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            >
              <motion.svg
                animate={{ x: [0, 5, 0], y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c3ef3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </motion.svg>
              <span className="whitespace-nowrap text-xs font-medium text-white/85">
                Flying to <strong className="font-semibold text-white">{travel}</strong>
              </span>
              <span className="relative h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <motion.span
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-violet to-lime"
                />
              </span>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* soft vignette so the map sinks into the UI (lighter frame on the light map) */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          theme === "dark"
            ? "shadow-[inset_0_0_140px_50px_rgba(7,6,13,0.55)]"
            : "shadow-[inset_0_0_120px_40px_rgba(30,28,45,0.16)]"
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent ${
          theme === "dark" ? "from-ink/50" : "from-ink/15"
        }`}
      />

      <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-ink/80 px-4 py-2 text-xs font-medium text-white/70 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <span className={`h-1.5 w-1.5 rounded-full ${liveFlights && trafficDown ? "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]" : "bg-lime shadow-[0_0_8px_2px_rgba(195,239,62,0.6)]"}`} />
        {liveFlights && trafficDown ? "Live flight feeds are busy — retrying automatically…" : hint}
      </div>
    </div>
  );
}
