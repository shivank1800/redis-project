/**
 * Card primitive used by feed, trending, and profile panels.
 *
 * Uses a soft "glass" look: translucent surface, subtle border, and a
 * custom shadow so cards feel like they're floating on the ambient
 * gradient background defined in `index.css`.
 */

import clsx from "clsx";
import type { PropsWithChildren } from "react";

export function Card({
  children,
  className,
  hover = false,
  padded = true,
}: PropsWithChildren<{ className?: string; hover?: boolean; padded?: boolean }>) {
  return (
    <section
      className={clsx(
        "rounded-3xl border border-slate-200/70 bg-white/80 shadow-soft backdrop-blur",
        "dark:border-slate-800/70 dark:bg-slate-900/70",
        padded && "p-5 sm:p-6",
        hover &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-20px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
