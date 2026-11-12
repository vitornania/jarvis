import { motion, useReducedMotion } from 'motion/react';

/**
 * Intentional 3D mark — wireframe cube + orbital rings.
 * Motions: (1) orbit yaw, (2) core float, (3) scan sweep.
 * No purple glow / soft aura (taste-skill anti-slop).
 */
export function Hero3D({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <div className={`hero3d ${compact ? 'hero3d-compact' : ''}`} aria-hidden="true">
      <div className="hero3d-stage">
        <motion.div
          className="hero3d-orbit"
          animate={reduce ? undefined : { rotateY: 360, rotateX: [16, 22, 16] }}
          transition={reduce ? undefined : {
            rotateY: { duration: 32, repeat: Infinity, ease: 'linear' },
            rotateX: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <span className="hero3d-ring hero3d-ring-a" />
          <span className="hero3d-ring hero3d-ring-b" />
          <span className="hero3d-ring hero3d-ring-c" />
          <motion.div
            className="hero3d-core"
            animate={reduce ? undefined : { y: [0, -7, 0], rotateZ: [0, 4, 0] }}
            transition={reduce ? undefined : { duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="hero3d-face hero3d-face-front">J</span>
            <span className="hero3d-face hero3d-face-back">_</span>
            <span className="hero3d-face hero3d-face-left" />
            <span className="hero3d-face hero3d-face-right" />
            <span className="hero3d-face hero3d-face-top" />
            <span className="hero3d-face hero3d-face-bottom" />
          </motion.div>
        </motion.div>
        <motion.div
          className="hero3d-scan"
          animate={reduce ? undefined : { opacity: [0.2, 0.9, 0.2], y: ['12%', '78%', '12%'] }}
          transition={reduce ? undefined : { duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      {!compact && (
        <motion.div
          className="hero3d-wordmark"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          JARVIS<span>_</span>
        </motion.div>
      )}
    </div>
  );
}

export function RailGlyph() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="brand-glyph rail-glyph-3d"
      aria-hidden="true"
      animate={reduce ? undefined : { rotateY: [0, 12, 0, -8, 0] }}
      transition={reduce ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    >
      J
    </motion.span>
  );
}
