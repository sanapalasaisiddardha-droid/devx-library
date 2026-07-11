import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { books } from "../data/books";

/**
 * Full-screen loading animation shown while a book opens: a straight line of
 * glass cover cards (same card style as the old carousel, no curve). The
 * picked book sits centred and lit; its neighbours rise in a stagger.
 */
export default function LoadingCards({ book, onDone }) {
  const line = useMemo(() => {
    const mates = books.filter((b) => b.cat === book.cat && b.id !== book.id);
    const fill = books.filter((b) => b.cat !== book.cat && b.id !== book.id);
    const side = [...mates, ...fill].slice(0, 4);
    // 5 cards: two left, the book centred, two right
    return [side[0], side[1], book, side[2], side[3]].filter(Boolean);
  }, [book]);

  useEffect(() => {
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-ink/95 backdrop-blur-xl"
    >
      {/* straight line of cards */}
      <div className="flex items-end gap-4 px-6">
        {line.map((b, i) => {
          const isCentre = b.id === book.id;
          return (
            <motion.div
              key={b.id}
              initial={{ y: 60, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: isCentre ? 1 : 0.55, scale: isCentre ? 1.12 : 0.94 }}
              transition={{ duration: 0.55, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
              className={`glass overflow-hidden rounded-2xl p-1.5 ${
                isCentre ? "ring-2 ring-lime/80 shadow-[0_40px_90px_-25px_rgba(124,92,255,0.6)]" : "hidden sm:block"
              }`}
            >
              <img
                src={b.cover}
                alt=""
                draggable="false"
                className={`rounded-xl object-cover ${isCentre ? "h-56 w-40" : "h-44 w-32"}`}
              />
            </motion.div>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-8 max-w-sm px-6 text-center font-display text-lg font-semibold"
      >
        Opening “{book.title}”
      </motion.p>

      {/* progress shimmer */}
      <div className="mt-4 h-1 w-52 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-violet to-lime"
        />
      </div>
    </motion.div>
  );
}
