import { motion, useScroll, useTransform } from "framer-motion";
import ArcCarousel from "./ArcCarousel";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export default function Hero({ px, py, onOpenBook }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 120]);
  const opacity = useTransform(scrollY, [0, 480], [1, 0]);
  const scale = useTransform(scrollY, [0, 480], [1, 0.96]);

  return (
    <section className="relative min-h-screen overflow-hidden px-6 pt-24">
      {/* rotating arc of covers — sits behind, fanning up from below the fold */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 z-0"
      >
        <ArcCarousel px={px} py={py} onOpenBook={onOpenBook} />
      </motion.div>

      {/* heading — centred, clearly above the fan */}
      <motion.div style={{ y, opacity, scale }} className="relative z-20 mx-auto max-w-3xl text-center">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.span variants={item} className="eyebrow">
            <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_12px_2px_rgba(198,255,77,0.7)]" />
            Free &amp; open study resources
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-5 font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl"
          >
            The library that builds <span className="text-gradient">great engineers.</span>
          </motion.h1>

          <motion.p variants={item} className="mx-auto mt-4 max-w-xl text-sm text-white/70 sm:text-base">
            A hand-picked shelf of computer-science &amp; engineering books, notes and code —
            organised, searchable and gorgeous to browse.
          </motion.p>

          <motion.div variants={item} className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a href="#library" className="btn btn-primary">
              Start reading
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a href="#features" className="btn btn-ghost">Explore the collection</a>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* scroll cue */}
      <motion.a
        href="#features"
        className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2 text-white/40"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        aria-label="Scroll down"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
        </svg>
      </motion.a>
    </section>
  );
}
