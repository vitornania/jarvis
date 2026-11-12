import { motion, useReducedMotion } from 'motion/react';

/** Quiet mark — product-ui-taste: no orbiting chrome, no glow, soft enter only. */
export function Hero3D({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  if (compact) return null;
  return (
    <div className="hero3d" aria-hidden="true">
      <motion.div
        className="hero3d-wordmark"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        JARVIS
      </motion.div>
    </div>
  );
}

export function RailGlyph() {
  return (
    <span className="brand-glyph rail-glyph-3d" aria-hidden="true">
      J
    </span>
  );
}
