/**
 * CreatePostBox.
 *
 * BACKEND/REDIS RELATION:
 * Creating a post writes to Postgres and enqueues Redis Stream work for feed
 * fan-out. The UI inserts the post optimistically because the author's local
 * Redis timeline is updated immediately, while follower feeds are eventual.
 */

import clsx from "clsx";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";

const MAX_LENGTH = 280;

export function CreatePostBox({ onCreate }: { onCreate: (content: string) => Promise<void> }) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH) return;

    setIsSubmitting(true);
    setContent("");
    try {
      await onCreate(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  }

  const remaining = MAX_LENGTH - content.length;
  const nearLimit = remaining <= 40;
  const overLimit = remaining < 0;

  return (
    <Card
      className={clsx(
        "relative transition-shadow duration-200",
        isFocused && "shadow-[0_22px_70px_-20px_rgba(244,63,94,0.35)]",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_8px_20px_-8px_rgba(244,63,94,0.55)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
            Compose a post
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Writes to Postgres, fans out through a Redis Stream.
          </p>
        </div>
      </div>

      <textarea
        className={clsx(
          "min-h-28 w-full resize-none rounded-2xl border bg-slate-50/80 p-4 text-[15px] leading-6 outline-none transition",
          "placeholder:text-slate-400 dark:bg-slate-950/60 dark:placeholder:text-slate-500",
          overLimit
            ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-400/30"
            : "border-slate-200/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 dark:border-slate-800/70 dark:focus:border-rose-500",
        )}
        placeholder="What did Redis make faster today?"
        value={content}
        maxLength={MAX_LENGTH + 20}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            void submit();
          }
        }}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Cmd
          </kbd>{" "}
          +{" "}
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Enter
          </kbd>{" "}
          to post · optimistic UI
        </p>
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              "text-xs font-semibold tabular-nums",
              overLimit
                ? "text-rose-600"
                : nearLimit
                  ? "text-amber-600"
                  : "text-slate-400",
            )}
          >
            {remaining}
          </span>
          <Button
            disabled={!content.trim() || isSubmitting || overLimit}
            onClick={() => void submit()}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
            Post
          </Button>
        </div>
      </div>
    </Card>
  );
}
