"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { JsonPanel } from "@/components/JsonPanel";
import { TableEmptyState } from "@/components/TableEmptyState";
import { ApiError, searchRegistries } from "@/lib/garr-api";
import type { EntityOwner } from "@/lib/garr-types";
import { getMockRegistries } from "@/lib/garr-api";
import { truncate } from "@/lib/utils";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<EntityOwner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (q.trim().length < 2) {
      setError("Search term must be at least 2 characters.");
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await searchRegistries(q.trim());
      setItems(data);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError("Search failed.");
      const fallback = getMockRegistries().filter((item) =>
        [item.owner_id, item.display_name, item.domain]
          .join(" ")
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      );
      setItems(fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Search"
      description="Keyword search across owner_id, domain, and display_name, with highlighted results."
    >
      <form
        onSubmit={onSearch}
        className="mb-6 flex gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search keyword..."
          className="flex-1 rounded-2xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          disabled={loading}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <TableEmptyState
          title="No results yet"
          description="Run a search to see matching registries."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.owner_id}
                className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">{item.display_name}</div>
                    <div className="text-sm text-slate-500">{item.domain}</div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 text-sm text-slate-700">
                  Owner ID: <span className="font-medium">{item.owner_id}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  RAP: {truncate(item.rap.url, 60)}
                </div>
              </div>
            ))}
          </div>

          <JsonPanel data={items} />
        </div>
      )}
    </PageShell>
  );
}