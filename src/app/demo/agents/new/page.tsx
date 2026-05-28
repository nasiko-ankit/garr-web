"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";

// Local types — this page is the only consumer, no need to widen garr-types.
interface RegistrySummary {
  slug: string;
  owner_id: string;
  agent_count: number;
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

interface IndexRecord {
  agent_id: string;
  agent_name: string;
  card_url: string;
  ttl: number;
  signature: string;
}

interface AddAgentResponse {
  agent_id: string;
  index_record: IndexRecord;
  agent_card: AgentCard;
}

const API_BASE = process.env.NEXT_PUBLIC_GARR_API_BASE_URL ?? "";

const NAME_PATTERN = /^[a-z0-9-]+$/;

export default function NewAgentPage() {
  const [registries, setRegistries] = useState<RegistrySummary[]>([]);
  const [registriesError, setRegistriesError] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [capabilitiesText, setCapabilitiesText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AddAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load registry list on mount so the dropdown stays in sync with the
  // server's seed files.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/mock/registries`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { registries: RegistrySummary[] };
        if (cancelled) return;
        setRegistries(body.registries);
        if (body.registries[0]) setSlug(body.registries[0].slug);
      } catch (err) {
        if (cancelled) return;
        setRegistriesError(
          err instanceof Error ? err.message : "failed to load registries"
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function validate(): string | null {
    if (!slug) return "Pick a registry.";
    if (!name) return "Agent name is required.";
    if (!NAME_PATTERN.test(name)) {
      return "Agent name: lowercase letters, digits, hyphens only.";
    }
    if (!displayName) return "Display name is required.";
    if (!description) return "Description is required.";
    const caps = capabilitiesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (caps.length === 0) return "At least one capability is required.";
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);

    const capabilities = capabilitiesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const res = await fetch(
        `${API_BASE}/mock/registries/${encodeURIComponent(slug)}/agents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            display_name: displayName,
            description,
            capabilities,
          }),
        }
      );
      const body = (await res.json()) as
        | AddAgentResponse
        | { error?: string; detail?: string };
      if (!res.ok) {
        const e2 = body as { error?: string; detail?: string };
        throw new Error(`${res.status}: ${e2.detail ?? e2.error ?? "failed"}`);
      }
      setResult(body as AddAgentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName("");
    setDisplayName("");
    setDescription("");
    setCapabilitiesText("");
    setResult(null);
    setError(null);
  }

  return (
    <PageShell
      title="Register an agent"
      description="Add a new agent to one of the demo registries. The registry signs the AgentCard with its private key; the new agent is immediately resolvable through GARR's cross-registry resolver."
    >
      {registriesError ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          Failed to load registries: {registriesError}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Registry
            </span>
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            >
              {registries.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.owner_id} ({r.agent_count} agents)
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Agent name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="weather-bot"
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <span className="mt-1 block text-xs text-slate-500">
              lowercase, digits, hyphens — becomes the identifier in agent_id
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Weather Bot"
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Reports current weather and short-range forecasts for a location."
              className="mt-2 block w-full resize-y rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Capabilities
            </span>
            <input
              value={capabilitiesText}
              onChange={(e) => setCapabilitiesText(e.target.value)}
              placeholder="weather.current, weather.forecast"
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <span className="mt-1 block text-xs text-slate-500">
              comma-separated capability identifiers
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing..." : "Register agent"}
          </button>
          {result ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-700 hover:border-slate-400"
            >
              Add another
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </form>

      {result ? (
        <div className="mt-8 space-y-5">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <div className="font-medium">
              Agent registered and signed.
            </div>
            <div className="mt-2">
              agent_id:{" "}
              <span className="rounded bg-white/70 px-2 py-0.5 font-mono text-xs">
                {result.agent_id}
              </span>
            </div>
            <div className="mt-3 text-xs">
              Try it on the resolution flow page —{" "}
              <a
                href={`/demo/resolve?prefill=${encodeURIComponent(
                  `${result.agent_id}:global`
                )}`}
                className="font-medium underline"
              >
                resolve {result.agent_id}:global
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Signed AgentCard
            </div>
            <JsonPanel data={result.agent_card} />
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Signed IndexRecord (what NANDA returns)
            </div>
            <JsonPanel data={result.index_record} />
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
