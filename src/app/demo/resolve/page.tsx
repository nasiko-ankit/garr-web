"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { ApiError, resolveLocator } from "@/lib/garr-api";
import type { ResolveResponse } from "@/lib/garr-types";

type StepStatus = "pending" | "running" | "ok" | "error";

const STATUS_STYLES: Record<StepStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-500",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
};

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

/** card_url = `<rap>/agents/<slug>` — strip from "/agents/" onward. */
function rapUrlFromCardUrl(cardUrl: string): string {
  const idx = cardUrl.indexOf("/agents/");
  return idx !== -1 ? cardUrl.slice(0, idx) : cardUrl;
}

interface SideState {
  locator: string;
  status: StepStatus;
  parsed?: { identifier: string; namespace: string; mode: string };
  resolved?: ResolveResponse;
  rapUrl?: string;
  error?: string;
}

function newSide(initialLocator: string): SideState {
  return { locator: initialLocator, status: "pending" };
}

const DEFAULT_A = "search-agent@google.demo:global";
const DEFAULT_B = "products-agent@meta.demo:global";

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

function NarrationLine({ done, text }: { done: boolean; text: string }) {
  return (
    <div
      className={
        "flex items-start gap-2 text-sm " +
        (done ? "text-slate-800" : "text-slate-400")
      }
    >
      <span className={done ? "text-emerald-600" : "text-slate-300"}>
        {done ? "✓" : "○"}
      </span>
      <span className="font-mono">{text}</span>
    </div>
  );
}

function SideColumn({
  label,
  side,
  onLocatorChange,
  onRun,
  busy,
}: {
  label: string;
  side: SideState;
  onLocatorChange: (v: string) => void;
  onRun: () => void;
  busy: boolean;
}) {
  const ok = side.status === "ok" && !!side.resolved;
  const errored = side.status === "error";

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {label}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {side.parsed ? `${side.parsed.identifier}@${side.parsed.namespace}` : "—"}
          </h2>
        </div>
        <StatusPill status={side.status} />
      </div>

      <input
        value={side.locator}
        onChange={(e) => onLocatorChange(e.target.value)}
        placeholder="agent@namespace:mode"
        className="w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
      />

      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Resolving..." : "Resolve this side"}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1">
        <NarrationLine
          done={ok}
          text={`→ Querying NANDA for ${side.parsed?.namespace ?? "<namespace>"}…`}
        />
        <NarrationLine
          done={ok}
          text={`✓ RAP URL: ${side.rapUrl ?? "<pending>"}`}
        />
        <NarrationLine
          done={ok}
          text={`→ Fetching AgentCard ${side.parsed?.identifier ?? "<id>"} from RAP…`}
        />
        <NarrationLine done={ok} text="✓ AgentCard received" />
        <NarrationLine done={ok} text="→ Verifying signature…" />
        <NarrationLine
          done={ok}
          text={`✓ Signature valid. Verified by: ${side.resolved?.agent_card.signed_by ?? "<key_id>"}`}
        />
      </div>

      {errored ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {side.error}
        </div>
      ) : null}

      {side.resolved ? (
        <div className="space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
              IndexRecord (from Nanda Index)
            </div>
            <JsonPanel data={side.resolved.index_record} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
              AgentCard (from RAP, signed by {side.resolved.agent_card.signed_by})
            </div>
            <JsonPanel data={side.resolved.agent_card} />
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
            <span className="text-[11px] uppercase tracking-[0.18em] text-indigo-700 block mb-1">
              A2A invocation_url
            </span>
            <span className="font-mono text-indigo-900 break-all">
              {side.resolved.agent_card.invocation_url}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function A2AExchangePage() {
  const searchParams = useSearchParams();

  const [sideA, setSideA] = useState<SideState>(() => newSide(DEFAULT_A));
  const [sideB, setSideB] = useState<SideState>(() => newSide(DEFAULT_B));
  const [running, setRunning] = useState(false);

  // Honor ?prefillA= and ?prefillB= so deep-links from /demo/agents/new land
  // with the freshly-registered agent pre-filled and auto-resolved.
  useEffect(() => {
    const pA = searchParams.get("prefillA");
    const pB = searchParams.get("prefillB");
    const single = searchParams.get("prefill");
    if (pA) setSideA((s) => ({ ...s, locator: pA }));
    if (pB) setSideB((s) => ({ ...s, locator: pB }));
    if (single && !pA) setSideA((s) => ({ ...s, locator: single }));
    if (pA || pB || single) {
      // small defer so state has been applied
      void runBoth(pA ?? single ?? DEFAULT_A, pB ?? DEFAULT_B);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function resolveOne(raw: string): Promise<SideState> {
    const parsedResult = parseLocator(raw);
    if (!parsedResult.ok) {
      return { locator: raw, status: "error", error: parsedResult.error };
    }
    const parsed = {
      identifier: parsedResult.identifier,
      namespace: parsedResult.namespace,
      mode: parsedResult.mode,
    };
    try {
      const resolved = await resolveLocator(raw.trim());
      return {
        locator: raw,
        status: "ok",
        parsed,
        resolved,
        rapUrl: rapUrlFromCardUrl(resolved.index_record.card_url),
      };
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
          ? err.message
          : "resolve failed";
      return { locator: raw, status: "error", parsed, error: msg };
    }
  }

  async function runSide(which: "A" | "B") {
    const setSide = which === "A" ? setSideA : setSideB;
    const current = which === "A" ? sideA : sideB;
    setSide({ ...current, status: "running" });
    const next = await resolveOne(current.locator);
    setSide(next);
  }

  async function runBoth(a: string, b: string) {
    setRunning(true);
    setSideA({ locator: a, status: "running" });
    setSideB({ locator: b, status: "running" });
    const [nextA, nextB] = await Promise.all([resolveOne(a), resolveOne(b)]);
    setSideA(nextA);
    setSideB(nextB);
    setRunning(false);
  }

  const exchangeComplete =
    sideA.status === "ok" &&
    sideB.status === "ok" &&
    !!sideA.resolved &&
    !!sideB.resolved;

  return (
    <PageShell
      title="A2A Card Exchange"
      description="Two agents query the Nanda Index, retrieve each other's signed AgentCards, and verify the signatures. Each side runs the full resolution chain — Index lookup, RAP fetch, signature verification. No real invocation — the demo stops at card exchange."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Manager's example
        </span>
        <code className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono">
          {DEFAULT_A}
        </code>
        <span className="text-slate-400">↔</span>
        <code className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono">
          {DEFAULT_B}
        </code>
        <button
          type="button"
          onClick={() => void runBoth(sideA.locator, sideB.locator)}
          disabled={running}
          className="ml-auto rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Running..." : "Run A2A exchange"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SideColumn
          label="Agent A"
          side={sideA}
          onLocatorChange={(v) => setSideA((s) => ({ ...s, locator: v }))}
          onRun={() => void runSide("A")}
          busy={running || sideA.status === "running"}
        />
        <SideColumn
          label="Agent B"
          side={sideB}
          onLocatorChange={(v) => setSideB((s) => ({ ...s, locator: v }))}
          onRun={() => void runSide("B")}
          busy={running || sideB.status === "running"}
        />
      </div>

      {exchangeComplete ? (
        <div className="mt-6 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-700">
            Exchange complete
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-2xl text-emerald-900">
            <span className="font-mono">
              {sideA.parsed?.identifier}@{sideA.parsed?.namespace}
            </span>
            <span>⇄</span>
            <span className="font-mono">
              {sideB.parsed?.identifier}@{sideB.parsed?.namespace}
            </span>
          </div>
          <p className="mt-3 text-sm text-emerald-800">
            Both agents have each other's signed AgentCards. They can now communicate
            via their respective <span className="font-mono">invocation_url</span> endpoints.
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Demo stops here — no real A2A call is made (matches{" "}
            <span className="font-mono">scripts/demo-flow.ts</span>).
          </p>
        </div>
      ) : null}
    </PageShell>
  );
}
