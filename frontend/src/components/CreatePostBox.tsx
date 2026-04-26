/**
 * CreatePostBox.
 *
 * BACKEND/REDIS RELATION:
 * Creating a post writes to Postgres and enqueues Redis Stream work for feed
 * fan-out. The UI inserts the post optimistically because the author's local
 * Redis timeline is updated immediately, while follower feeds are eventual.
 */

import { SendHorizonal } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";

export function CreatePostBox({ onCreate }: { onCreate: (content: string) => Promise<void> }) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setContent("");
    try {
      await onCreate(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
        Create post
      </label>
      <textarea
        className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
        placeholder="What did Redis make faster today?"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            void submit();
          }
        }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Cmd/Ctrl + Enter to post. Optimistic UI is on.</p>
        <Button disabled={!content.trim() || isSubmitting} onClick={() => void submit()}>
          <SendHorizonal className="mr-2 h-4 w-4" />
          Post
        </Button>
      </div>
    </Card>
  );
}
