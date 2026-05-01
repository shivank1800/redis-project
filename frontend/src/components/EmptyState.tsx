/**
 * Reusable empty state.
 *
 * Redis feeds, streams, and search logs are often empty on fresh development
 * databases. A helpful empty state teaches the user what action creates data
 * instead of making the UI feel broken.
 */

import clsx from "clsx";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  icon,
  className,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-dashed border-slate-300/80 bg-white/40 p-8 text-center backdrop-blur",
        "dark:border-slate-700/80 dark:bg-slate-900/30",
        className,
      )}
    >
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-500/10 to-violet-600/10 text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}
