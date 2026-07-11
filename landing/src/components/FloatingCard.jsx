import { motion, useTransform } from "framer-motion";

/**
 * A reusable glassmorphism card that:
 *  - drifts on the Y axis in an infinite loop (float)
 *  - shifts with the mouse for a 3D parallax feel (depth)
 *  - fades/scales in on mount, and scales + glows on hover
 *
 * `px`/`py` are shared spring MotionValues from the mouse handler in App.
 */
export default function FloatingCard({
  px,
  py,
  depth = 30,
  delay = 0,
  duration = 7,
  float = 16,
  rotate = 0,
  className = "",
  children,
}) {
  // outer layer: mouse parallax (transform-only)
  const x = useTransform(px, (v) => v * depth);
  const y = useTransform(py, (v) => v * depth);

  return (
    <motion.div
      style={{ x, y }}
      className={`absolute ${className}`}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* inner layer: perpetual float + hover, kept separate so transforms don't fight */}
      <motion.div
        animate={{ y: [0, -float, 0], rotate: [rotate, rotate + 1.5, rotate] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        whileHover={{ scale: 1.07 }}
        className="glass glass-hover rounded-2xl p-2"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
