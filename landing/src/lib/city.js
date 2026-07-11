// Deterministic 3D city layout — every visitor sees the same city.
// The city is a grid of blocks separated by streets. Categories are contiguous
// "districts" spiralling out from the central park; each book is a glowing
// building on a plot inside its district. Everything is seeded, never random.

import { books, categories, floatingBooks } from "../data/books";

export const GRID = 9;        // blocks per side
export const PITCH = 13;      // block + street spacing
export const BLOCK = 10;      // block footprint
export const EXTENT = (GRID * PITCH) / 2;

const FEATURED = new Set(floatingBooks.map((f) => f.id));

// small fast seeded PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// center-out ring order of grid cells
function spiralOrder() {
  const c = (GRID - 1) / 2;
  const cells = [];
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++)
      cells.push({ i, j, ring: Math.max(Math.abs(i - c), Math.abs(j - c)), ang: Math.atan2(j - c, i - c) });
  cells.sort((a, b) => a.ring - b.ring || a.ang - b.ang);
  return cells;
}

const blockCenter = (i, j) => [(i - (GRID - 1) / 2) * PITCH, (j - (GRID - 1) / 2) * PITCH];

export function buildCity() {
  const rand = mulberry32(20260711);
  const order = spiralOrder();

  // --- assign cells ---------------------------------------------------------
  const cellUse = new Map(); // "i,j" -> {type, district}
  const key = (c) => `${c.i},${c.j}`;

  // central park = the exact centre cell + its east neighbour
  const centre = order[0];
  cellUse.set(key(centre), { type: "park" });
  cellUse.set(`${centre.i + 1},${centre.j}`, { type: "park" });

  // districts sized by book count (big categories closest to the centre)
  const counts = {};
  books.forEach((b) => (counts[b.cat] = (counts[b.cat] || 0) + 1));
  const districts = categories
    .filter((c) => counts[c.id])
    .map((c) => ({ ...c, count: counts[c.id], blocksNeeded: Math.ceil(counts[c.id] / 6) }))
    .sort((a, b) => b.count - a.count);

  const districtCells = {}; // catId -> [{i,j}]
  let cursor = 0;
  for (const d of districts) {
    districtCells[d.id] = [];
    while (districtCells[d.id].length < d.blocksNeeded && cursor < order.length) {
      const c = order[cursor++];
      if (cellUse.has(key(c))) continue;
      cellUse.set(key(c), { type: "district", district: d.id });
      districtCells[d.id].push(c);
    }
  }

  // remaining cells: sprinkle outer parks, rest are generic city blocks
  for (let k = cursor; k < order.length; k++) {
    const c = order[k];
    if (cellUse.has(key(c))) continue;
    cellUse.set(key(c), rand() < 0.13 ? { type: "park" } : { type: "generic" });
  }

  // --- build geometry lists -------------------------------------------------
  const whites = [];   // {x,z,w,h} plain buildings (instanced)
  const bookSpots = [];// {book, x, z, w, h, featured}
  const parks = [];    // {x,z}
  const trees = [];    // {x,z,s}
  const labels = [];   // {name, x, z}

  const plotOffsets = [-BLOCK / 3, 0, BLOCK / 3]; // 3x3 plots per block

  // book queue per district
  const queue = {};
  books.forEach((b) => (queue[b.cat] = queue[b.cat] || []).push(b));

  for (const [k, use] of cellUse) {
    const [i, j] = k.split(",").map(Number);
    const [cx, cz] = blockCenter(i, j);

    if (use.type === "park") {
      parks.push({ x: cx, z: cz });
      const n = 8 + Math.floor(rand() * 6);
      for (let t = 0; t < n; t++)
        trees.push({ x: cx + (rand() - 0.5) * (BLOCK - 2), z: cz + (rand() - 0.5) * (BLOCK - 2), s: 0.7 + rand() * 0.8 });
      continue;
    }

    // shuffled plot list for this block
    const plots = [];
    for (const ox of plotOffsets) for (const oz of plotOffsets) plots.push([cx + ox, cz + oz]);
    for (let p = plots.length - 1; p > 0; p--) {
      const q = Math.floor(rand() * (p + 1));
      [plots[p], plots[q]] = [plots[q], plots[p]];
    }

    let booksHere = 0;
    if (use.type === "district") {
      const q = queue[use.district] || [];
      // up to 6 books per block so whites fill the gaps
      while (q.length && booksHere < 6) {
        const b = q.shift();
        const [x, z] = plots.pop();
        bookSpots.push({ book: b, x, z, w: 2.7, h: 3.4 + rand() * 3.2, featured: FEATURED.has(b.id) });
        booksHere++;
      }
    }
    for (const [x, z] of plots) {
      if (rand() < 0.12) continue; // occasional empty plot for breathing room
      whites.push({ x, z, w: 2.2 + rand() * 0.9, h: 1.2 + rand() * (use.type === "generic" ? 5.2 : 3.4) });
    }
    // corner street trees
    if (rand() < 0.4) trees.push({ x: cx + BLOCK / 2 + 0.9, z: cz + BLOCK / 2 + 0.9, s: 0.6 + rand() * 0.5 });
  }

  // district labels at centroid of their cells
  for (const d of districts) {
    const cells = districtCells[d.id];
    if (!cells.length) continue;
    let x = 0, z = 0;
    for (const c of cells) { const [cx, cz] = blockCenter(c.i, c.j); x += cx; z += cz; }
    labels.push({ name: d.name, x: x / cells.length, z: z / cells.length });
  }

  return { whites, bookSpots, parks, trees, labels };
}

export const CITY = buildCity();
