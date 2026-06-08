"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { TableEmptyState } from "@/components/TableEmptyState";
import { ApiError, getIndexRecord, searchIndexRecords } from "@/lib/garr-api";

type Mode = "org_id" | "search";

export default function QueryPage() {
  const [mode, setMode] = useState<Mode>("org_id");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const start = performance.now();

    try {
      let data: unknown;
      if (mode === "org_id") {
        data = await getIndexRecord(query.trim());
      } else {
        data = await searchIndexRecords(query.trim());
      }
      setResult(data);
      setLatency(Math.round(performance.now() - start));
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError("Query failed.");
      setLatency(Math.round(performance.now() - start));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Index Query"
      description="Look up an organization by org ID or search by keyword."
    >
      <form className="space-y-4 rounded-3xl border border-black/10 bg-white p-5 shadow-sm" onSubmit={runQuery}>
        <div className="flex flex-wrap gap-2">
          {[
            ["org_id", "By Org ID"],
            ["search", "Keyword Search"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key as Mode)}
              className={`rounded-full border px-4 py-2 text-sm ${
                mode === key
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-black/10 bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "org_id" ? "nasiko" : "keyword"}
            className="rounded-2xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300 font-mono text-sm"
          />
          <button
            disabled={loading || !query.trim()}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Running..." : "Run query"}
          </button>
        </div>

        {latency !== null ? (
          <div className="text-sm text-slate-500">Latency: {latency} ms</div>
        ) : null}
      </form>

      <div className="mt-6">
        {error ? (
          <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <JsonPanel data={result} />
        ) : (
          <TableEmptyState
            title="No query yet"
            description="Run any query to see the response here."
          />
        )}
      </div>
    </PageShell>
  );
}
