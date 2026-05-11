"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { JsonPanel } from "@/components/JsonPanel";
import { TableEmptyState } from "@/components/TableEmptyState";
import { ApiError, listRegistries } from "@/lib/garr-api";
import type { EntityOwner, EntityStatus } from "@/lib/garr-types";
import { getMockRegistries } from "@/lib/garr-api";

export default function RegistriesPage() {
  const [status, setStatus] = useState<EntityStatus | "all">("all");
  const [items, setItems] = useState<EntityOwner[]>([]);
  const [selected, setSelected] = useState<EntityOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextStatus: typeof status) {
    setLoading(true);
    setError(null);

    try {
      const data = await listRegistries(nextStatus);
      setItems(data);
      setSelected(data[0] ?? null);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError("Could not load registries.");
      const fallback = getMockRegistries();
      const filtered =
        nextStatus === "all"
          ? fallback
          : fallback.filter((item) => item.status === nextStatus);
      setItems(filtered);
      setSelected(filtered[0] ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <PageShell
      title="Browse Registries"
      description="Table view with status filter and expandable row details, matching the frontend checklist in the spec."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "active", "stale", "pending", "suspended"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-4 py-2 text-sm capitalize ${
              status === s
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-black/10 bg-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          Loading registries...
        </div>
      ) : error ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <TableEmptyState
          title="No registries found"
          description="There are no matching registries for the selected filter."
          actionLabel="Register one"
          actionHref="/register"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4">Domain</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.owner_id}
                    onClick={() => setSelected(item)}
                    className="cursor-pointer border-t hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-950">
                        {item.display_name}
                      </div>
                      <div className="text-sm text-slate-500">{item.owner_id}</div>
                    </td>
                    <td className="px-5 py-4">{item.domain}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            {selected ? (
              <>
                <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-semibold">{selected.display_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selected.domain}</p>
                  <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <div>
                      <span className="font-medium">Signed by:</span>{" "}
                      {selected.signature.signed_by}
                    </div>
                    <div>
                      <span className="font-medium">Expires:</span>{" "}
                      {selected.signature.expires_at}
                    </div>
                    <div>
                      <span className="font-medium">Serial:</span> {selected.serial}
                    </div>
                  </div>
                </div>
                <JsonPanel data={selected} />
              </>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}