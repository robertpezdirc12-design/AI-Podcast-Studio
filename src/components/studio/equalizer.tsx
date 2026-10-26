'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface EqualizerProps {
  active: boolean;
  bars?: number;
  className?: string;
  barClassName?: string;
}

const WAVE = [0.35, 1, 0.5, 0.85, 0.4];

/**
 * Animirani ekvilizer (framer-motion). Stolpci dihajo, ko je `active`,
 * sicer mirujejo na nizki višini.
 */
export function Equalizer({ active, bars = 4, className, barClassName }: EqualizerProps) {
  return (
    <div className={cn('flex h-4 items-end gap-[3px]', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <motion.span
          key={i}
          className={cn('h-full w-[3px] rounded-full bg-amber-400', barClassName)}
          style={{ transformOrigin: 'bottom' }}
          initial={false}
          animate={active ? { scaleY: WAVE } : { scaleY: 0.35 }}
          transition={
            active
              ? { duration: 0.9 + i * 0.13, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }
              : { duration: 0.25, ease: 'easeOut' }
          }
        />
      ))}
    </div>
  );
}
