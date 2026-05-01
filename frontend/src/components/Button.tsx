/**
 * Button primitive.
 *
 * A lightweight shared component keeps the UI consistent without pulling in a
 * large design system. The `primary` variant uses the app's brand gradient
 * with a soft glow so calls-to-action feel distinct from secondary actions.
 */

import clsx from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger" | "outline";
    size?: "sm" | "md" | "lg";
  }
>;

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "group relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
        "transition-all duration-200 active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-rose-400 focus-visible:ring-offset-white",
        "dark:focus-visible:ring-offset-slate-950",

        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-3 text-sm",

        variant === "primary" &&
          "bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.6)] hover:shadow-[0_14px_40px_-10px_rgba(244,63,94,0.7)] hover:brightness-[1.05]",

        variant === "ghost" &&
          "bg-slate-100/80 text-slate-700 hover:bg-slate-200/90 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700/70",

        variant === "outline" &&
          "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",

        variant === "danger" &&
          "bg-rose-600 text-white shadow-[0_10px_30px_-10px_rgba(225,29,72,0.55)] hover:bg-rose-700",

        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
