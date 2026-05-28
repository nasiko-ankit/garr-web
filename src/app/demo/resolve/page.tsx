"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";

// Shape of the GARR /api/v1/resolve response. Local to this demo page so
// we don't grow the shared garr-types.ts surface for a one-off demo.
type ResolutionMode = "global" | "dnssrv" | "nandaindex.org";

interface IndexRecord {
  agent_id: string;
  agent_name: string;
  card_url: string;
  ttl: number;
  signature: string;
}

interface AgentCard {
  id: string;
  display_name: string;
  description: string;
  capabilities: string[];
  invocation_url: string;
  protocol: string;
  visibility: "public" | "private";
  signature: string;
  [k: string]: unknown;
}

interface ResolveResponse {
  locator: string;
  resolution_mode: ResolutionMode;
  resolved_via: string;
  index_record: IndexRecord;
  agent_card: AgentCard;
}

interface HandshakeResponse {
  handshake_ok: boolean;
  callee_card: AgentCard;
  echoed_caller_id: string;
  at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_GARR_API_BASE_URL ?? "";

const PRESETS = [
  {
    label: "Walmart · order-status",
    locator: "order-status@walmart-demo.local:global",
  },
  {
    label: "Google · search-bot",
    locator: "search-bot@google-demo.local:global",
  },
];

type StepStatus = "pending" | "running" | "ok" | "error" | "skipped";

function parseLocator(raw: string):
  | { ok: true; identifier: string; namespace: string; mode: string }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon === -1) return { ok: false, error: "missing :mode suffix" };
  const mode = trimmed.slice(lastColon + 1);
  const idPart = trimmed.slice(0, lastColon);
  const atIdx = idPart.lastIndexOf("@");
  if (atIdx === -1) return { ok: false, error: "missing @ separator" };
  const identifier = idPart.slice(0, atIdx);
  const namespace = idPart.slice(atIdx + 1);
  if (!identifier || !namespace || !mode) {
    return { ok: false, error: "locator has empty parts" };
  }
  return { ok: true, identifier, namespace, mode };
}

/** Maps an agent's namespace (e.g. "google-demo.local") to its registry slug. */
function registrySlugForNamespace(ns: string): string {
  return ns.replace(/\.local$/, "");
}

const STATUS_STYLES: Record<StepStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-500",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  skipped: "border-slate-200 bg-slate-50 text-slate-500",
};

function StatusPill({ status }: { status: StepStatus }) {
  return (
    <span
      className={
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] " +
        STATUS_STYLES[status]
      }
    >
      {status}
    </span>
  );
}

function StepCard({
  index,
  title,
  description,
  status,
  children,
}: {
  index: number;
  title: string;
  description: string;
  status: StepStatus;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Step {index}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <StatusPill status={status} />
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

export default function CrossRegistryDemoPage() {
  const searchParams = useSearchParams();
  const [locator, setLocator] = useState(
    "order-status@walmart-demo.local:global"
  );

  // Honor ?prefill= so the "try this new agent" link from /demo/agents/new
  // lands here with the new locator pre-filled and immediately resolved.
  useEffect(() => {
    const prefill = searchParams.get("prefill");
    if (prefill && prefill !== locator) {
      setLocator(prefill);
      void runResolve(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [parseStatus, setParseStatus] = useState<StepStatus>("pending");
  const [parsed, setParsed] = useState<
    { identifier: string; namespace: string; mode: string } | null
  >(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [nandaStatus, setNandaStatus] = useState<StepStatus>("pending");
  const [resolveResponse, setResolveResponse] = useState<ResolveResponse | null>(
    null
  );

  const [cardStatus, setCardStatus] = useState<StepStatus>("pending");

  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const [handshakeStatus, setHandshakeStatus] = useState<StepStatus>("pending");
  const [handshakeResponse, setHandshakeResponse] =
    useState<HandshakeResponse | null>(null);
  const [handshakeError, setHandshakeError] = useState<string | null>(null);
  const [handshaking, setHandshaking] = useState(false);

  function resetAll() {
    setParseStatus("pending");
    setParsed(null);
    setParseError(null);
    setNandaStatus("pending");
    setResolveResponse(null);
    setCardStatus("pending");
    setResolveError(null);
    setHandshakeStatus("pending");
    setHandshakeResponse(null);
    setHandshakeError(null);
  }

  async function runResolve(raw: string) {
    resetAll();
    setResolving(true);

    // Step 1 — parse locator client-side
    setParseStatus("running");
    const parsedResult = parseLocator(raw);
    if (!parsedResult.ok) {
      setParseStatus("error");
      setParseError(parsedResult.error);
      setNandaStatus("skipped");
      setCardStatus("skipped");
      setResolving(false);
      return;
    }
    const { identifier, namespace, mode } = parsedResult;
    setParsed({ identifier, namespace, mode });
    setParseStatus("ok");

    // Step 2 & 3 — one backend call drives both
    setNandaStatus("running");
    setCardStatus("running");
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/resolve?locator=${encodeURIComponent(raw.trim())}`,
        { cache: "no-store" }
      );
      const body = (await res.json()) as ResolveResponse | { error?: string; detail?: string };
      if (!res.ok) {
        const e = body as { error?: string; detail?: string };
        throw new Error(
          `${res.status}: ${e.detail ?? e.error ?? "resolve failed"}`
        );
      }
      const ok = body as ResolveResponse;
      setResolveResponse(ok);
      setNandaStatus("ok");
      setCardStatus("ok");
    } catch (err) {
      setNandaStatus("error");
      setCardStatus("skipped");
      setResolveError(err instanceof Error ? err.message : "resolve failed");
    } finally {
      setResolving(false);
    }
  }

  async function runHandshake() {
    if (!resolveResponse) return;
    setHandshakeStatus("running");
    setHandshakeError(null);
    setHandshakeResponse(null);
    setHandshaking(true);

    // Fetch Google's search-bot card via the mock gateway and use it as the
    // caller. Avoids hardcoding a static JSON blob in the frontend.
    try {
      const callerRes = await fetch(
        `${API_BASE}/mock/registries/google-demo/cards/search-bot@google-demo.local`,
        { cache: "no-store" }
      );
      if (!callerRes.ok) {
        throw new Error(
          `failed to fetch caller card (HTTP ${callerRes.status}). Did you run scripts/seed-demo.mjs?`
        );
      }
      const callerCard = (await callerRes.json()) as AgentCard;

      const calleeSlug = registrySlugForNamespace(
        resolveResponse.index_record.agent_id.split("@")[1] ?? ""
      );

      const res = await fetch(
        `${API_BASE}/mock/agents/${calleeSlug}/invoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caller_card: callerCard,
            callee_agent_id: resolveResponse.index_record.agent_id,
          }),
        }
      );
      const body = (await res.json()) as HandshakeResponse | { error?: string; detail?: string };
      if (!res.ok) {
        const e = body as { error?: string; detail?: string };
        throw new Error(
          `${res.status}: ${e.detail ?? e.error ?? "handshake failed"}`
        );
      }
      setHandshakeResponse(body as HandshakeResponse);
      setHandshakeStatus("ok");
    } catch (err) {
      setHandshakeStatus("error");
      setHandshakeError(
        err instanceof Error ? err.message : "handshake failed"
      );
    } finally {
      setHandshaking(false);
    }
  }

  return (
    <PageShell
      title="Cross-registry resolution"
      description="Walk a locator through the GARR resolver: locator parse → NANDA Index lookup → AgentCard fetch → A2A handshake. Uses the local mock NANDA and seeded demo registries."
    >
      <form
        className="mb-6 flex flex-col gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void runResolve(locator);
        }}
      >
        <input
          value={locator}
          onChange={(e) => setLocator(e.target.value)}
          placeholder="agent@namespace:mode"
          className="flex-1 rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="submit"
          disabled={resolving}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resolving ? "Resolving..." : "Resolve"}
        </button>
      </form>

      <div className="mb-8 flex flex-wrap gap-2 text-xs">
        <span className="text-slate-500 uppercase tracking-[0.18em] mr-2 self-center">
          Try:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.locator}
            type="button"
            onClick={() => {
              setLocator(p.locator);
              void runResolve(p.locator);
            }}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 hover:border-slate-400"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <StepCard
          index={1}
          title="Parse locator"
          description="Client-side split into identifier@namespace:mode."
          status={parseStatus}
        >
          {parsed ? (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  identifier
                </dt>
                <dd className="mt-1 font-mono text-slate-900">
                  {parsed.identifier}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  namespace
                </dt>
                <dd className="mt-1 font-mono text-slate-900">
                  {parsed.namespace}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  mode
                </dt>
                <dd className="mt-1 font-mono text-slate-900">{parsed.mode}</dd>
              </div>
            </dl>
          ) : parseError ? (
            <div className="text-sm text-rose-700">{parseError}</div>
          ) : null}
        </StepCard>

        <StepCard
          index={2}
          title="NANDA Index lookup"
          description="Resolver queries the mock NANDA Index for an IndexRecord."
          status={nandaStatus}
        >
          {resolveResponse ? (
            <div>
              <div className="mb-3 text-sm text-slate-700">
                <span className="font-medium">resolved_via:</span>{" "}
                <span className="font-mono">{resolveResponse.resolved_via}</span>
              </div>
              <JsonPanel data={resolveResponse.index_record} />
            </div>
          ) : resolveError && nandaStatus === "error" ? (
            <div className="text-sm text-rose-700">{resolveError}</div>
          ) : null}
        </StepCard>

        <StepCard
          index={3}
          title="Fetch AgentCard"
          description="Resolver pulls the signed AgentCard from card_url."
          status={cardStatus}
        >
          {resolveResponse ? <JsonPanel data={resolveResponse.agent_card} /> : null}
        </StepCard>

        <StepCard
          index={4}
          title="A2A handshake"
          description="POST a Google caller card to the callee's invocation_url. The mock returns the callee's card + handshake_ok."
          status={handshakeStatus}
        >
          <div className="flex flex-col gap-4">
            <div>
              <button
                type="button"
                disabled={!resolveResponse || handshaking}
                onClick={() => void runHandshake()}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {handshaking ? "Running..." : "Run handshake"}
              </button>
              {!resolveResponse ? (
                <span className="ml-3 text-xs text-slate-500">
                  resolve first to enable
                </span>
              ) : null}
            </div>
            {handshakeError ? (
              <div className="text-sm text-rose-700">{handshakeError}</div>
            ) : null}
            {handshakeResponse ? <JsonPanel data={handshakeResponse} /> : null}
          </div>
        </StepCard>
      </div>
    </PageShell>
  );
}
