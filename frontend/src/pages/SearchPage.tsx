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
        <h1 className="text-3xl font-black tracking-tight">Recent activity search</h1>
        <p className="mt-1 text-sm text-slate-500">
          Debounced queries over the backend's Redis capped activity log.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search e.g. post:42, follow, comment"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
          />
        </div>
      </Card>

      {isLoading && <p className="text-sm text-slate-500">Searching...</p>}

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
