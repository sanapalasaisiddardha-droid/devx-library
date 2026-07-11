// Real-world geography for the DevX map.
// Books live at the world's most iconic landmarks — wonders of the world and
// famous monuments — scattered across every continent. Big categories split
// across several countries so the whole globe glows.

import { books, floatingBooks } from "../data/books";

// Client-side MapTiler key — restrict it to your domain in the MapTiler
// dashboard (Account → Keys → Allowed HTTP origins) before deploying.
export const MAPTILER_KEY = "MSles60yjPF9GIPHp8Dt";
export const MAP_STYLE = `https://api.maptiler.com/maps/streets-v4-dark/style.json?key=${MAPTILER_KEY}`;

// One or more landmarks per category. at = [lng, lat]
export const LANDMARKS = [
  { cat: "sysdesign", name: "Statue of Liberty",   place: "New York · USA",       at: [-74.0445, 40.6892] },
  { cat: "coding",    name: "Tokyo Tower",          place: "Tokyo · Japan",        at: [139.7454, 35.6586] },
  { cat: "softeng",   name: "Brandenburg Gate",     place: "Berlin · Germany",     at: [13.3777, 52.5163] },
  { cat: "systems",   name: "Big Ben",              place: "London · UK",          at: [-0.1246, 51.5007] },
  { cat: "ml",        name: "Great Wall of China",  place: "Beijing · China",      at: [116.5704, 40.4319] },
  { cat: "crypto",    name: "Pyramids of Giza",     place: "Cairo · Egypt",        at: [31.1342, 29.9792] },
  { cat: "graphics",  name: "Eiffel Tower",         place: "Paris · France",       at: [2.2945, 48.8584] },
  { cat: "image",     name: "Colosseum",            place: "Rome · Italy",         at: [12.4922, 41.8902] },
  { cat: "discrete",  name: "Taj Mahal",            place: "Agra · India",         at: [78.0421, 27.1751] },
  { cat: "discrete",  name: "Saint Basil's",        place: "Moscow · Russia",      at: [37.6208, 55.7525] },
  { cat: "discrete",  name: "CN Tower",             place: "Toronto · Canada",     at: [-79.3871, 43.6426] },
  { cat: "theory",    name: "Acropolis",            place: "Athens · Greece",      at: [23.7257, 37.9715] },
  { cat: "wireless",  name: "Christ the Redeemer",  place: "Rio · Brazil",         at: [-43.2105, -22.9519] },
  { cat: "wireless",  name: "Belém Tower",          place: "Lisbon · Portugal",    at: [-9.2159, 38.6916] },
  { cat: "web",       name: "Sydney Opera House",   place: "Sydney · Australia",   at: [151.2153, -33.8568] },
  { cat: "code",      name: "Machu Picchu",         place: "Cusco · Peru",         at: [-72.545, -13.1631] },
  { cat: "code",      name: "Obelisco",             place: "Buenos Aires · Argentina", at: [-58.3816, -34.6037] },
];

const FEATURED = new Set(floatingBooks.map((f) => f.id));
const GOLDEN = 2.39996; // golden angle, radians

// split each category's books evenly across its landmarks, then spread each
// group on a deterministic golden-angle spiral around its landmark
export const BOOK_PINS = (() => {
  const byCat = {};
  books.forEach((b) => (byCat[b.cat] = byCat[b.cat] || []).push(b));

  const pins = [];
  for (const [cat, list] of Object.entries(byCat)) {
    const spots = LANDMARKS.filter((l) => l.cat === cat);
    if (!spots.length) continue;
    const per = Math.ceil(list.length / spots.length);
    list.forEach((b, i) => {
      const lm = spots[Math.min(Math.floor(i / per), spots.length - 1)];
      const k = i % per;
      const r = 0.003 + 0.0042 * Math.sqrt(k);
      const th = k * GOLDEN;
      const lat = lm.at[1] + r * Math.sin(th);
      const lng = lm.at[0] + (r * Math.cos(th)) / Math.cos((lm.at[1] * Math.PI) / 180);
      pins.push({ book: b, lngLat: [lng, lat], landmark: lm, featured: FEATURED.has(b.id) });
    });
  }
  return pins;
})();

export const pinFor = (bookId) => BOOK_PINS.find((p) => p.book.id === bookId);

// landmark names per category (for the sidebar)
export const CAT_PLACES = LANDMARKS.reduce((m, l) => {
  (m[l.cat] = m[l.cat] || []).push(l.name);
  return m;
}, {});

// book count per landmark (for the beacons)
export const landmarkCount = (lm) =>
  BOOK_PINS.filter((p) => p.landmark === lm).length;
