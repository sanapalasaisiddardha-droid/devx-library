import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { books } from "../data/books";

/**
 * Rotating "wheel of cards" like the reference video: covers sit on a large
 * circle whose centre is below the fold, so only the top arc (a fan of ~5-6
 * cards) shows. The ring rotates slowly + infinitely; the top card is upright,
 * largest and brightest, and cards tilt + fade as they curve away.
 * Transform-only → 60fps. The 0→360 loop is seamless (all transforms periodic).
 */

// more covers around a bigger ring → a wider curve with more cards on show
const IDS = [2, 5, 11, 4, 28, 20, 55, 18, 3, 6, 7, 8, 9, 13, 16, 17, 22, 23, 29, 30];
const ITEMS = IDS.map((i) => books[i]).filter(Boolean);
const N = ITEMS.length;
const STEP = 360 / N;
const R = 660;          // bigger diameter → wider curve, room for ~7 cards
const CARD_W = 216;     // big cards
const CARD_H = 302;
const rad = (d) => (d * Math.PI) / 180;

function ArcCard({ angle, baseDeg, book, onOpenBook }) {
  const eff = useTransform(angle, (a) => a + baseDeg);
  const x = useTransform(eff, (d) => R * Math.sin(rad(d)));
  const y = useTransform(eff, (d) => -R * Math.cos(rad(d)));
  const rotate = useTransform(eff, (d) => (((d + 180) % 360) + 360) % 360 - 180);
  const prom = useTransform(eff, (d) => (Math.cos(rad(d)) + 1) / 2); // 1 at top → 0 at bottom
  const scale = useTransform(prom, [0.66, 1], [0.72, 1.1]);
  const opacity = useTransform(prom, [0.66, 0.84, 1], [0, 0.78, 1]); // top ~7 cards of the fan show
  const zIndex = useTransform(prom, (p) => Math.round(p * 100));
  // only the prominent (visible) cards catch clicks — hidden ones stay inert
  const pointerEvents = useTransform(prom, (p) => (p > 0.7 ? "auto" : "none"));

  return (
    <motion.div
      onClick={() => onOpenBook?.(book)}
      title={`Open: ${book.title}`}
      style={{
        x, y, rotate, scale, opacity, zIndex, pointerEvents, cursor: "pointer",
        width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2,
      }}
      className="group absolute left-0 top-0"
    >
      <div className="glass h-full w-full overflow-hidden rounded-[20px] p-1.5 shadow-[0_40px_80px_-24px_rgba(0,0,0,0.85)] transition duration-300 group-hover:shadow-[0_50px_90px_-20px_rgba(124,92,255,0.5)] group-hover:ring-2 group-hover:ring-lime/70">
        <img
          src={book.cover}
          alt=""
          draggable="false"
          className="h-full w-full rounded-[14px] object-cover transition duration-300 group-hover:brightness-110"
        />
      </div>
    </motion.div>
  );
}

export default function ArcCarousel({ px, py, onOpenBook }) {
  const angle = useMotionValue(0);
  const fallback = useMotionValue(0);
  const tx = useTransform(px ?? fallback, (v) => v * 26);
  const ty = useTransform(py ?? fallback, (v) => v * 14);

  useEffect(() => {
    const controls = animate(angle, 360, { duration: 46, ease: "linear", repeat: Infinity, repeatType: "loop" });
    return () => controls.stop();
  }, [angle]);

  return (
    <motion.div style={{ x: tx, y: ty }} className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft glow pooling under the fan */}
      <div className="absolute bottom-0 left-1/2 h-80 w-[42rem] max-w-[92vw] -translate-x-1/2 rounded-full bg-[radial-gradient(60%_60%_at_50%_60%,rgba(124,92,255,0.32),transparent_70%)] blur-2xl" />
      {/* hub: circle centre anchored below the viewport bottom → fan always sits
          in the lower area, never colliding with the heading regardless of height */}
      <div className="absolute bottom-[-250px] left-1/2 origin-center scale-[0.5] sm:scale-[0.72] lg:scale-100">
        {ITEMS.map((book, i) => (
          <ArcCard key={book.id} angle={angle} baseDeg={i * STEP} book={book} onOpenBook={onOpenBook} />
        ))}
      </div>
    </motion.div>
  );
}
