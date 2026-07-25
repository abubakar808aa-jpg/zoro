'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** Seconds to delay the reveal — use for staggering siblings. */
  delay?: number;
  /** Vertical travel distance in px (default 22). */
  y?: number;
  className?: string;
} & Omit<HTMLMotionProps<'div'>, 'children'>;

/**
 * Scroll-triggered fade + rise. Fires once when the element enters the viewport.
 * When the visitor prefers reduced motion, it renders statically (no transform,
 * no opacity animation) so content is never withheld behind an animation.
 */
export function Reveal({ children, delay = 0, y = 22, className, ...rest }: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -80px 0px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wrap a group so its direct <Reveal> children (or motion children using the
 * `item` variants) animate in sequence. Falls back to a plain div under reduced
 * motion.
 */
export function RevealGroup({ children, className, stagger = 0.08 }: { children: ReactNode; className?: string; stagger?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export const revealItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};
