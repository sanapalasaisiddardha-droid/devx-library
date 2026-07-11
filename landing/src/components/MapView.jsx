import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { styleUrl, LANDMARKS, BOOK_PINS, pinFor, landmarkCount } from "../lib/geo";
import PlaceSearch from "./PlaceSearch";

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
      attributionControl: { compact: true },
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
        map.flyTo({ center: l.at, zoom: 14.2, pitch: 55, bearing: -15, speed: 1.6, curve: 1.5 });
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
        // street-level landing — deep enough for the 3D buildings to rise
        map.flyTo({ center: here, zoom: 15.2, pitch: 58, bearing: -15, speed: 1.25, curve: 1.7, essential: true });
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

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- fly-to-book (sidebar / marker pick) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!flyTo || !map) return;
    const pin = pinFor(flyTo.book.id);
    if (!pin) { onArrived?.(flyTo.book); return; }
    map.flyTo({ center: pin.lngLat, zoom: 16.2, pitch: 60, bearing: -20, speed: 1.7, curve: 1.6, essential: true });
    if (flyTo.open) {
      const done = () => onArrived?.(flyTo.book);
      map.once("moveend", done);
      return () => map.off("moveend", done);
    }
  }, [flyTo, onArrived]);

  return (
    <div className="fixed inset-0 z-0">
      <div ref={wrap} className="h-full w-full" />
      <PlaceSearch
        onGo={(center) =>
          mapRef.current?.flyTo({ center, zoom: 13.5, pitch: 45, bearing: 0, speed: 1.7, curve: 1.5, essential: true })
        }
      />

      {/* dark / light map toggle */}
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to light map" : "Switch to dark map"}
        aria-label="Toggle map theme"
        className="absolute right-[19.5rem] top-4 z-30 grid h-10 w-10 place-items-center rounded-xl border border-white/12 bg-ink/85 text-white/75 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:border-lime/60 hover:text-lime"
      >
        {theme === "dark" ? (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>

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
