import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE, LANDMARKS, BOOK_PINS, pinFor, landmarkCount } from "../lib/geo";
import PlaceSearch from "./PlaceSearch";

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

  // ---- init once ----
  useEffect(() => {
    const map = new maplibregl.Map({
      container: wrap.current,
      style: MAP_STYLE,
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
      // real 3D buildings (skip if the style already ships one)
      try {
        if (!map.getLayer("building-3d") && !map.getLayer("Building 3D")) {
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
                "fill-extrusion-color": "#3a3648",
                "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.82,
              },
            },
            labelId
          );
        }
      } catch { /* style variations — non-fatal */ }

      // intro: fly to the last-read book's city, else a gentle world spin-in
      const last = Number(localStorage.getItem("siddlib.lastBook"));
      const pin = pinFor(last);
      if (pin) {
        map.flyTo({ center: pin.lngLat, zoom: 13.2, pitch: 50, bearing: -12, speed: 0.9, curve: 1.6 });
      } else {
        map.flyTo({ center: [10, 30], zoom: 2.2, speed: 0.4 });
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
      <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-ink/75 px-4 py-2 text-xs font-medium text-white/65 backdrop-blur-md">
        {hint}
      </div>
    </div>
  );
}
