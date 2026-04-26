/**
 * Reusable empty state.
 *
 * WHY:
 * Redis feeds, streams, and search logs are often empty on fresh development
 * databases. Showing a helpful empty state teaches the user what action creates
 * data instead of making the UI feel broken.
 */

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-2 text-sm">{body}</p>
    </div>
  );
}
