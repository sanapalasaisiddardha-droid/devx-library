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
const TRAFFIC_ZOOM = 5.5; // fetch only at region scale — the API is radius-based
// tried in order — airplanes.live sends CORS natively; adsb.lol needs a relay
const TRAFFIC_SOURCES = [
  (lat, lng) => `https://api.airplanes.live/v2/point/${lat.toFixed(3)}/${lng.toFixed(3)}/250`,
  (lat, lng) =>
    "https://corsproxy.io/?url=" +
    encodeURIComponent(`https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lng.toFixed(3)}/250`),
];

function addPlaneIcon(map) {
  if (map.hasImage("devx-live-plane")) return;
  const size = 44;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.scale(size / 24, size / 24);
  const path = new Path2D("M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z");
  ctx.fillStyle = "#8fd3ff";
  ctx.strokeStyle = "rgba(10,12,20,0.9)";
  ctx.lineWidth = 0.8;
  ctx.fill(path);
  ctx.stroke(path);
  map.addImage("devx-live-plane", ctx.getImageData(0, 0, size, size));
}

function ensureTrafficLayer(map) {
  addPlaneIcon(map);
  if (!map.getSource("devx-traffic")) {
    map.addSource("devx-traffic", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "devx-traffic",
      source: "devx-traffic",
      type: "symbol",
      layout: {
        "icon-image": "devx-live-plane",
        "icon-size": 0.5,
        "icon-rotate": ["get", "track"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": 0.95 },
    });
  }
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

    // click a live plane → flight details popup
    map.on("click", (e) => {
      let f;
      try { f = map.queryRenderedFeatures(e.point, { layers: ["devx-traffic"] })[0]; } catch { return; }
      if (!f) return;
      const p = f.properties;
      new maplibregl.Popup({ closeButton: false, offset: 14, className: "traffic-popup" })
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<strong>${p.callsign || "Unknown"}</strong>${p.t ? ` · ${p.t}` : ""}<br/>
           <span>${p.alt === "ground" ? "on the ground" : `${Number(p.alt).toLocaleString()} ft`} · ${p.gs} kts</span>`
        )
        .addTo(map);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- live air traffic: fetch nearby aircraft every 10s at region zoom ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let stop = false;
    const clear = () => { try { map.getSource("devx-traffic")?.setData(EMPTY_FC); } catch { /* ignore */ } };
    const tick = async () => {
      if (stop || !liveFlights) return;
      if (document.hidden || !map.isStyleLoaded() || map.getZoom() < TRAFFIC_ZOOM) { clear(); return; }
      const c = map.getCenter();
      try {
        let d = null;
        for (const src of TRAFFIC_SOURCES) {
          try {
            const r = await fetch(src(c.lat, c.lng));
            if (r.ok) { d = await r.json(); break; }
          } catch { /* try the next source */ }
        }
        if (!d) return;
        const features = (d.ac || [])
          .filter((a) => a.lat != null && a.lon != null)
          .map((a) => ({
            type: "Feature",
            properties: {
              callsign: (a.flight || a.r || a.hex || "").trim(),
              track: a.track ?? a.true_heading ?? 0,
              alt: a.alt_baro ?? "",
              gs: Math.round(a.gs || 0),
              t: a.t || "",
            },
            geometry: { type: "Point", coordinates: [a.lon, a.lat] },
          }));
        if (stop || !liveFlights) return;
        ensureTrafficLayer(map);
        map.getSource("devx-traffic")?.setData({ type: "FeatureCollection", features });
      } catch { /* relay hiccup — try again next tick */ }
    };
    const iv = setInterval(tick, 10000);
    map.on("moveend", tick);
    if (map.isStyleLoaded()) tick(); else map.once("load", tick);
    return () => { stop = true; clearInterval(iv); map.off("moveend", tick); clear(); };
  }, [liveFlights]);

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
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors ${
            liveFlights
              ? "border-transparent bg-lime text-ink"
              : "border-white/12 bg-ink/85 text-white/60 hover:border-lime/60 hover:text-lime"
          }`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
        </motion.button>

        <PlaceSearch
          onGo={(center, name) =>
            cinematicFly({ center, zoom: 13.5, pitch: 45, bearing: 0, speed: 1.7, curve: 1.5 }, name)
          }
        />
      </div>

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
        <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_8px_2px_rgba(195,239,62,0.6)]" />
        {hint}
      </div>
    </div>
  );
}
