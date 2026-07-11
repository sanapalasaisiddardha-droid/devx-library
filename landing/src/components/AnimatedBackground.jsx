import { motion, useTransform } from "framer-motion";

/**
 * Full-screen animated background:
 *  - deep radial base gradient
 *  - 3 blurred glowing blobs that slowly drift (CSS) + parallax with the mouse (Framer)
 *  - fine film-grain noise overlay
 * All movement is transform-only for 60fps.
 */
export default function AnimatedBackground({ px, py }) {
  // mouse parallax offsets (different depth per blob)
  const b1x = useTransform(px, (v) => v * 40);
  const b1y = useTransform(py, (v) => v * 40);
  const b2x = useTransform(px, (v) => v * -55);
  const b2y = useTransform(py, (v) => v * -45);
  const b3x = useTransform(px, (v) => v * 34);
  const b3y = useTransform(py, (v) => v * -38);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#141033_0%,#07060d_60%)]" />

      {/* glowing blobs */}
      <motion.div style={{ x: b1x, y: b1y }} className="absolute -left-[12vw] -top-[10vw] h-[46vw] w-[46vw]">
        <div className="h-full w-full animate-drift rounded-full bg-[radial-gradient(circle,#7c5cff,transparent_68%)] opacity-50 blur-[90px]" />
      </motion.div>
      <motion.div style={{ x: b2x, y: b2y }} className="absolute -right-[8vw] top-[2vw] h-[40vw] w-[40vw]">
        <div className="h-full w-full animate-drift-slow rounded-full bg-[radial-gradient(circle,#3b82f6,transparent_68%)] opacity-45 blur-[90px]" />
      </motion.div>
      <motion.div style={{ x: b3x, y: b3y }} className="absolute left-[26vw] top-[42vh] h-[42vw] w-[42vw]">
        <div className="h-full w-full animate-drift rounded-full bg-[radial-gradient(circle,#d946ef,transparent_70%)] opacity-30 blur-[100px]" />
      </motion.div>

      {/* vignette to sink the blobs into the base */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_10%,transparent_40%,#07060d_92%)]" />

      {/* noise */}
      <div className="noise absolute inset-0" />
    </div>
  );
}
