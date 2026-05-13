"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { JsonPanel } from "@/components/JsonPanel";
import { TableEmptyState } from "@/components/TableEmptyState";
import { ApiError, resolveDomain } from "@/lib/garr-api";
import type { EntityOwner } from "@/lib/garr-types";
import { getMockRegistries } from "@/lib/garr-api";

export default function ResolvePage() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<EntityOwner | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onResolve(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (domain.trim().length < 2) {
      setError("Enter a valid domain.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await resolveDomain(domain.trim());
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError("Resolution failed.");

      const fallback = getMockRegistries().find((item) => item.domain === domain.trim());
      if (fallback) setResult(fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Resolve"
      description="Domain lookup page with active/stale status, signed metadata, and a raw JSON view."
    >
      <form
        onSubmit={onResolve}
        className="mb-6 flex gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm"
      >
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 rounded-2xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          disabled={loading}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Resolving..." : "Resolve"}
        </button>
      </form>

      {error ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{result.display_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{result.domain}</p>
              </div>
              <StatusBadge status={result.status} />
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-700">
              <div>
                <span className="font-medium">Owner:</span> {result.owner_id}
              </div>
              <div>
                <span className="font-medium">Serial:</span> {result.serial}
              </div>
              <div>
                <span className="font-medium">Expires:</span>{" "}
                {result.signature.expires_at}
              </div>
              <div>
                <span className="font-medium">RAP:</span> {result.rap.url}
              </div>
            </div>
          </div>

          <JsonPanel data={result} />
        </div>
      ) : (
        <TableEmptyState
          title="No resolution yet"
          description="Resolve a domain to see the registry record."
        />
      )}
    </PageShell>
  );
}