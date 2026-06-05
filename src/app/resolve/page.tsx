"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { TableEmptyState } from "@/components/TableEmptyState";
import { ApiError, resolveAgent } from "@/lib/garr-api";
import type { ResolveResponse } from "@/lib/garr-types";
import { cn } from "@/lib/utils";
import { ProtocolBadge, VisibilityBadge } from "@/components/AgentBadges";

type ResolutionMode = "global" | "dnssrv" | "nandaindex.org";

const MODE_DESCRIPTIONS: Record<ResolutionMode, string> = {
  global: "Looks up the domain in GARR's own database → fetches the card from the org's RAP → verifies both signatures.",
  dnssrv: "Queries _agentindex._tcp.<domain> DNS SRV record → looks up agent in the index server found there.",
  "nandaindex.org": "Queries the public NANDA index at nandaindex.org to find the agent's card URL.",
};

function ResolutionPath({ result }: { result: ResolveResponse }) {
  const steps =
    result.resolution_mode === "global"
      ? [
          { label: "Client", note: result.locator },
          { label: "GARR", note: `looked up domain in registry (${result.resolved_via})` },
          { label: "RAP", note: result.index_record.card_url },
          { label: "AgentCard", note: "signature verified ✓" },
        ]
      : [
          { label: "Client", note: result.locator },
          { label: "Index", note: `resolved via ${result.resolved_via}` },
          { label: "RAP", note: result.index_record.card_url },
          { label: "AgentCard", note: "returned" },
        ];

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
        Resolution path
      </p>
      <div className="flex flex-wrap items-start gap-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-slate-50 text-xs font-semibold text-slate-700">
                {i + 1}
              </div>
              <p className="mt-1 text-center text-xs font-medium text-slate-900">{step.label}</p>
              <p className="mt-0.5 max-w-[110px] text-center text-[10px] leading-4 text-slate-500 break-all">
                {step.note}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 mt-3.5 h-px w-8 shrink-0 bg-slate-300" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-black/5 pt-4 text-sm text-slate-700">
        <div>
          <span className="font-medium">Mode:</span>{" "}
          <span className="font-mono text-xs">{result.resolution_mode}</span>
        </div>
        <div>
          <span className="font-medium">Via:</span>{" "}
          <span className="font-mono text-xs">{result.resolved_via}</span>
        </div>
        <div>
          <span className="font-medium">TTL:</span>{" "}
          <span className="font-mono text-xs">{result.index_record.ttl}s</span>
        </div>
        <div>
          <span className="font-medium">Card URL:</span>{" "}
          <a
            href={result.index_record.card_url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-xs text-indigo-600 underline-offset-2 hover:underline"
          >
            {result.index_record.card_url}
          </a>
        </div>
      </div>
    </div>
  );
}

function AgentCardPanel({ card }: { card: ResolveResponse["agent_card"] }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-950">{card.display_name}</h2>
          <p className="mt-0.5 font-mono text-xs text-slate-500 break-all">{card.id}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <VisibilityBadge visibility={card.visibility} />
          <ProtocolBadge protocol={card.protocol} />
        </div>
      </div>

      {card.description && (
        <p className="text-sm leading-6 text-slate-600">{card.description}</p>
      )}

      <div className="grid gap-2 text-sm text-slate-700">
        <div>
          <span className="font-medium">Version:</span>{" "}
          <span className="font-mono text-xs">{card.version}</span>
        </div>
        <div>
          <span className="font-medium">Invocation URL:</span>{" "}
          <a
            href={card.invocation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-xs text-indigo-600 underline-offset-2 hover:underline"
          >
            {card.invocation_url}
          </a>
        </div>
        <div>
          <span className="font-medium">Signed by:</span>{" "}
          <span className="font-mono text-xs">{card.signed_by}</span>
        </div>
        <div>
          <span className="font-medium">Updated:</span>{" "}
          <span className="text-slate-600">{new Date(card.updated_at).toLocaleString()}</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Capabilities{" "}
          <span className="font-normal text-slate-400">({card.capabilities.length})</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {card.capabilities.map((cap) => (
            <span key={cap} className="rounded-full border border-black/10 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700">
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-black/5 pt-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Signature (verified ✓)
        </p>
        <p className="break-all font-mono text-[11px] text-slate-400">
          {card.signature.slice(0, 64)}…
        </p>
      </div>
    </div>
  );
}

export default function ResolvePage() {
  const [identifier, setIdentifier] = useState("");
  const [mode, setMode] = useState<ResolutionMode>("global");
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [liveOrgs, setLiveOrgs] = useState<{ owner_id: string; domain: string; firstAgent: string }[]>([]);

  useEffect(() => {
    // Use default Next.js caching — the manifest is stable and signed; no need for no-store.
    // Build "Try:" chips from the manifest alone (one request), using owner_id as the
    // placeholder agent identifier. This avoids N per-RAP fetches on every page load.
    fetch(`${process.env.NEXT_PUBLIC_GARR_API_BASE_URL ?? ""}/global_agent_root.json`)
      .then((r) => r.json())
      .then((data: { entity_owners?: { owner_id: string; domain: string }[] }) => {
        const orgs = data.entity_owners ?? [];
        setLiveOrgs(
          orgs.map((org) => ({
            owner_id: org.owner_id,
            domain: org.domain,
            firstAgent: org.owner_id,
          }))
        );
      })
      .catch(() => {});
  }, []);

  async function onResolve(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!identifier.trim()) return;

    const locator = `${identifier.trim()}:${mode}`;
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = performance.now();

    try {
      const data = await resolveAgent(locator);
      setResult(data);
      setLatency(Math.round(performance.now() - t0));
    } catch (err) {
      setLatency(Math.round(performance.now() - t0));
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else {
        setError("Resolution failed — check the locator format and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Resolve Agent"
      description="Enter an agent locator (agent@domain) to retrieve and verify the full AgentCard."
    >
      <form
        onSubmit={onResolve}
        className="mb-6 rounded-3xl border border-black/10 bg-white p-5 shadow-sm space-y-4"
        suppressHydrationWarning
      >
        {/* Mode selector */}
        <div className="flex flex-wrap gap-2">
          {(["global", "dnssrv", "nandaindex.org"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm",
                mode === m
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-black/10 bg-white text-slate-700"
              )}
            >
              :{m}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500">{MODE_DESCRIPTIONS[mode]}</p>

        {mode === "global" && liveOrgs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Try:</span>
            {liveOrgs.map((org) => (
              <button
                key={org.owner_id}
                type="button"
                onClick={() => setIdentifier(`${org.firstAgent}@${org.domain}`)}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-xs text-indigo-700 hover:bg-indigo-100"
              >
                {org.firstAgent}@{org.domain}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex flex-1 items-center overflow-hidden rounded-2xl border border-black/10 bg-white focus-within:ring-2 focus-within:ring-slate-300">
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="agent@domain.com"
              className="flex-1 bg-transparent px-4 py-3 outline-none font-mono text-sm"
            />
            <span className="shrink-0 border-l border-black/10 px-3 py-3 font-mono text-sm text-slate-400">
              :{mode}
            </span>
          </div>
          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Resolving…" : "Resolve"}
          </button>
        </div>

        {latency !== null && (
          <p className="text-xs text-slate-400">Resolved in {latency} ms</p>
        )}
      </form>

      {error && (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result ? (
        <div className="space-y-5">
          <ResolutionPath result={result} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <AgentCardPanel card={result.agent_card} />
            <JsonPanel data={result} />
          </div>
        </div>
      ) : (
        !error && (
          <TableEmptyState
            title="No resolution yet"
            description='Enter an agent locator like "weather@google.com" and click Resolve.'
          />
        )
      )}
    </PageShell>
  );
}
