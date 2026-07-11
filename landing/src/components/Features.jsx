import { motion } from "framer-motion";

const FEATURES = [
  {
    title: "Organised by subject",
    body: "13 curated categories — from System Design and Machine Learning to Cryptography and Discrete Math.",
    icon: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </>
    ),
    grad: "from-violet to-[#38bdf8]",
  },
  {
    title: "Read in the browser",
    body: "Open any book instantly — no downloads required. Every cover links straight to the PDF.",
    icon: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    grad: "from-[#34d399] to-[#06b6d4]",
  },
  {
    title: "Search everything",
    body: "Find any title, author or topic in milliseconds with instant fuzzy search.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    grad: "from-[#f472b6] to-[#c084fc]",
  },
  {
    title: "Real book covers",
    body: "Beautiful, high-resolution covers for every classic — Kleppmann, Bishop, Rosen and more.",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </>
    ),
    grad: "from-[#fbbf24] to-[#fb923c]",
  },
  {
    title: "Free forever",
    body: "Shared openly for the community — no paywalls, no sign-ups, no tracking.",
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    grad: "from-[#a3e635] to-[#84cc16]",
  },
  {
    title: "Built for speed",
    body: "A featherweight, static experience that loads instantly and runs at a buttery 60fps.",
    icon: (
      <>
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </>
    ),
    grad: "from-[#60a5fa] to-[#7c5cff]",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};
const card = {
  hidden: { opacity: 0, y: 34 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
};

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-28">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-soft">Why you'll love it</p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Everything you need to keep learning
        </h2>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            variants={card}
            whileHover={{ y: -6 }}
            className="glass glass-hover group rounded-3xl p-7"
          >
            <div className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.grad}`}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {f.icon}
              </svg>
            </div>
            <h3 className="font-display text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-white/55">{f.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
