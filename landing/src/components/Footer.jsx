import { motion } from "framer-motion";
import Features from "./Features";
import { stats, categories, books } from "../data/books";

// top categories by number of books (for the footer links)
const counts = {};
books.forEach((b) => (counts[b.cat] = (counts[b.cat] || 0) + 1));
const topCats = categories
  .filter((c) => counts[c.id])
  .sort((a, b) => counts[b.id] - counts[a.id])
  .slice(0, 6);

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] } }),
};

function Col({ title, children, i }) {
  return (
    <motion.div variants={fade} custom={i}>
      <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm text-white/60">{children}</ul>
    </motion.div>
  );
}

const Link = ({ href, children }) => (
  <li>
    <a href={href} className="transition-colors hover:text-white">
      {children}
    </a>
  </li>
);

export default function Footer() {
  return (
    <footer className="relative mt-10 border-t border-white/10">
      {/* soft top glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet/60 to-transparent" />

      {/* feature highlights, now living in the footer */}
      <Features />

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        className="mx-auto max-w-6xl border-t border-white/10 px-6 py-16"
      >
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr]">
          {/* brand */}
          <motion.div variants={fade}>
            <a href="#" className="flex items-center gap-2.5 font-display text-lg font-semibold">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-[#38bdf8] shadow-[0_10px_24px_-8px_rgba(124,92,255,0.8)]">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              DevX
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              A hand-picked, beautifully organised shelf of computer-science &amp; engineering
              books, notes and code — shared openly for the community.
            </p>
            {/* by the numbers (relocated from the hero) */}
            <div className="mt-6 flex gap-8">
              {[
                { n: stats.resources, l: "Resources" },
                { n: stats.categories, l: "Categories" },
                { n: `${stats.gb} GB`, l: "Content" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-2xl font-semibold text-white">{s.n}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-white/40">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* explore */}
          <Col title="Explore" i={1}>
            <Link href="#features">Features</Link>
            <Link href="#library">Library</Link>
            <Link href="#library">Start reading</Link>
            <Link href="#top">Back to top</Link>
          </Col>

          {/* categories */}
          <Col title="Categories" i={2}>
            {topCats.map((c) => (
              <Link key={c.id} href="#library">
                {c.name}
              </Link>
            ))}
          </Col>
        </div>

        {/* bottom bar */}
        <motion.div
          variants={fade}
          className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row"
        >
          <p>© {new Date().getFullYear()} DevX · shared for educational purposes</p>
          <p>Built with care for the community ✦</p>
        </motion.div>
      </motion.div>
    </footer>
  );
}
