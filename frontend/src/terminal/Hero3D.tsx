import { motion, useReducedMotion } from 'motion/react';

/**
 * Taste-skill 3D mark — ink/mono depth, no purple glow.
 * Motions: (1) orbit yaw, (2) core float, (3) scan sweep / rail tilt.
 */
export function Hero3D({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <div className={`hero3d ${compact ? 'hero3d-compact' : ''}`} aria-hidden="true">
      <div className="hero3d-stage">
        <motion.div
          className="hero3d-orbit"
          animate={reduce ? undefined : { rotateY: 360, rotateX: [14, 20, 14] }}
          transition={reduce ? undefined : {
            rotateY: { duration: 28, repeat: Infinity, ease: 'linear' },
            rotateX: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <span className="hero3d-ring hero3d-ring-a" />
          <span className="hero3d-ring hero3d-ring-b" />
          <span className="hero3d-ring hero3d-ring-c" />
          <motion.div
            className="hero3d-core"
            animate={reduce ? undefined : { y: [0, -6, 0], rotateZ: [0, 3, 0] }}
            transition={reduce ? undefined : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
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
          animate={reduce ? undefined : { opacity: [0.25, 0.85, 0.25], y: ['10%', '80%', '10%'] }}
          transition={reduce ? undefined : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      {!compact && (
        <motion.div
          className="hero3d-wordmark"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
      style={{ transformStyle: 'preserve-3d' }}
      animate={reduce ? undefined : { rotateY: [0, 14, 0, -10, 0] }}
      transition={reduce ? undefined : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      J
    </motion.span>
  );
}
