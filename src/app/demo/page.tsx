"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { ApiError, getRegistry } from "@/lib/garr-api";

type Health = "loading" | "ok" | "missing" | "error";

interface PreflightState {
  health: Health;
  detail: string;
}

const DEMO_OWNERS = ["google", "meta"];

const STEPS = [
  {
    step: "Step 1",
    title: "Register a Registry",
    href: "/register",
    description:
      "An organization registers its domain + RAP URL + public key with the Nanda Index. Three-factor proof: DMARC + RAP reachability + key possession. In demo mode all three checks are bypassed.",
    cta: "Open Register Registry",
  },
  {
    step: "Step 2",
    title: "Register an Agent",
    href: "/demo/agents/new",
    description:
      "An organization (e.g. google) adds a new agent to its registry. The registry signs the AgentCard with the org's root Ed25519 key. The agent is immediately discoverable through the Nanda Index.",
    cta: "Open Register Agent",
  },
  {
    step: "Step 3",
    title: "A2A Card Exchange",
    href: "/demo/resolve",
    description:
      "Two agents (e.g. search@google.demo ↔ products@meta.demo) query the Nanda Index, retrieve each other's signed AgentCards, and verify the signatures. After this exchange, both can communicate.",
    cta: "Open A2A Card Exchange",
  },
];

export default function DemoDashboardPage() {
  const [preflight, setPreflight] = useState<PreflightState>({
    health: "loading",
    detail: "Checking backend...",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getRegistry(DEMO_OWNERS[0]!);
        if (cancelled) return;
        setPreflight({ health: "ok", detail: "Backend is seeded and reachable." });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setPreflight({
            health: "missing",
            detail:
              "Backend is reachable but the demo orgs (google, meta) are not seeded. Run `npm run demo:seed` on the GARR backend.",
          });
        } else {
          const msg =
            err instanceof ApiError
              ? `${err.status}: ${err.message}`
              : err instanceof Error
              ? err.message
              : "unknown error";
          setPreflight({
            health: "error",
            detail: `Cannot reach backend. ${msg}`,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell
      title="GARR / Nanda Index — Live Demo"
      description="Three layers, three actions. Manager's example: search@google.com wants to talk to products@meta.com. The Nanda Index resolves the registries, each RAP returns a signed AgentCard, and the two agents exchange cards."
    >
      <PreflightBanner state={preflight} />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {STEPS.map((s) => (
          <Link
            key={s.step}
            href={s.href}
            className="group rounded-3xl border border-black/10 bg-white p-6 shadow-sm transition hover:border-slate-400 hover:shadow-md"
          >
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {s.step}
            </div>
            <h2 className="mt-2 font-serif text-2xl italic text-slate-950">
              {s.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{s.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-900 group-hover:underline">
              {s.cta} <span aria-hidden>→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-black/10 bg-slate-50 p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Suggested demo order
        </div>
        <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-slate-700">
          <li>
            <strong>A2A Card Exchange</strong> first — show the manager's example
            resolving immediately ({" "}
            <span className="font-mono">search-agent@google.demo</span> ↔{" "}
            <span className="font-mono">products-agent@meta.demo</span>). Both
            cards exchange end-to-end.
          </li>
          <li>
            <strong>Register Agent</strong> next — add a new agent (e.g.{" "}
            <span className="font-mono">analytics-agent</span> at{" "}
            <span className="font-mono">google.demo</span>), then click through
            to A2A Card Exchange to resolve the new agent live.
          </li>
          <li>
            <strong>Register Registry</strong> last — onboard a brand-new
            organization to show the bootstrapping flow.
          </li>
        </ol>
      </div>
    </PageShell>
  );
}

function PreflightBanner({ state }: { state: PreflightState }) {
  if (state.health === "loading") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Checking backend pre-flight...
      </div>
    );
  }
  if (state.health === "ok") {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <span className="font-medium">Pre-flight OK.</span> {state.detail} The
        google.demo and meta.demo registries are seeded and ready.
      </div>
    );
  }
  return (
    <div
      className={
        "rounded-3xl border p-4 text-sm " +
        (state.health === "missing"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-rose-200 bg-rose-50 text-rose-700")
      }
    >
      <div className="font-medium">
        {state.health === "missing" ? "Backend not seeded" : "Backend unreachable"}
      </div>
      <p className="mt-1">{state.detail}</p>
      <pre className="mt-3 rounded-xl bg-white/60 p-3 text-xs">{`# Terminal 1 — backend
$env:GARR_DEMO_MODE = "true"; npm run dev

# Terminal 2 — mock RAPs (after seed)
npm run demo:rap

# Terminal 3 — seed once
npm run demo:seed`}</pre>
    </div>
  );
}
