/**
 * SearchPage.
 *
 * WHAT:
 * Debounced recent-activity search.
 *
 * BACKEND/REDIS RELATION:
 * The backend keeps a capped Redis LIST of recent activity. This page queries
 * that recent log. It is not full-text search; it demonstrates a pragmatic
 * "last N events" Redis pattern for operational/social activity.
 */

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { api } from "../services/api";
import { debounce } from "../utils/debounce";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runSearch = useMemo(
    () =>
      debounce(async (next: string) => {
        if (!next.trim()) {
          setResults([]);
          return;
        }

        setIsLoading(true);
        try {
          setResults(await api.searchRecentActivity(next));
        } finally {
          setIsLoading(false);
        }
      }, 350),
    [],
  );

  function updateQuery(next: string) {
    setQuery(next);
    runSearch(next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span className="gradient-text">Recent</span> activity search
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Debounced queries over the backend's Redis capped activity log.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 transition focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-400/20 dark:border-slate-800/70 dark:bg-slate-950/60">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            placeholder="Search e.g. post:42, follow, comment"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
          />
          {isLoading && (
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              searching…
            </span>
          )}
        </div>
      </Card>

      {!isLoading && query && results.length === 0 && (
        <EmptyState title="No recent activity found" body="Try another keyword." />
      )}

      <div className="space-y-3">
        {results.map((result, index) => (
          <Card key={index}>
            <pre className="overflow-auto text-xs text-slate-700 dark:text-slate-200">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
