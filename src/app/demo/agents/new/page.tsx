"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { ApiError, listRegistries, registerAgent } from "@/lib/garr-api";
import type { AgentCard, AgentProtocol, EntityOwner } from "@/lib/garr-types";

const NAME_PATTERN = /^[a-z0-9-]+$/;

export default function L2RegisterAgentPage() {
  const [registries, setRegistries] = useState<EntityOwner[]>([]);
  const [registriesError, setRegistriesError] = useState<string | null>(null);
  const [loadingRegistries, setLoadingRegistries] = useState(true);

  const [ownerId, setOwnerId] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [capabilitiesText, setCapabilitiesText] = useState("");
  const [protocol, setProtocol] = useState<AgentProtocol>("a2a");
  const [invocationUrl, setInvocationUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [signedCard, setSignedCard] = useState<AgentCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listRegistries("active");
        if (cancelled) return;
        setRegistries(list);
        if (list[0]) setOwnerId(list[0].owner_id);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
            ? err.message
            : "failed to load registries";
        setRegistriesError(msg);
      } finally {
        if (!cancelled) setLoadingRegistries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRegistry = registries.find((r) => r.owner_id === ownerId) ?? null;

  function validate(): string | null {
    if (!selectedRegistry) return "Pick a registry.";
    if (!name) return "Agent name is required.";
    if (!NAME_PATTERN.test(name)) {
      return "Agent name must be lowercase letters, digits, and hyphens only.";
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
    if (!selectedRegistry) return;
    setSubmitting(true);
    setError(null);
    setSignedCard(null);

    const capabilities = capabilitiesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const card = await registerAgent(selectedRegistry.rap.url, {
        name,
        display_name: displayName,
        description,
        capabilities,
        protocol,
        ...(invocationUrl.trim() ? { invocation_url: invocationUrl.trim() } : {}),
      });
      setSignedCard(card);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
          ? err.message
          : "request failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName("");
    setDisplayName("");
    setDescription("");
    setCapabilitiesText("");
    setInvocationUrl("");
    setProtocol("a2a");
    setSignedCard(null);
    setError(null);
  }

  const newLocator =
    signedCard && selectedRegistry
      ? `${name}@${selectedRegistry.domain}:global`
      : null;

  return (
    <PageShell
      title="Register an Agent"
      description="Add a new agent to one of the registered organizations. The organization's registry signs the AgentCard with its Ed25519 root key and stores it. The agent is immediately discoverable through the Nanda Index."
    >
      {registriesError ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          Failed to load registries: {registriesError}
          <p className="mt-2 text-xs">
            The Nanda Index may not be seeded yet. Run{" "}
            <span className="font-mono">npm run demo:seed</span> on the backend.
          </p>
        </div>
      ) : null}

      {!registriesError && !loadingRegistries && registries.length === 0 ? (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No registries found. Seed first via{" "}
          <span className="font-mono">npm run demo:seed</span>, or onboard one
          on the <a href="/register" className="font-medium underline">Register Registry page</a>.
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
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              disabled={loadingRegistries || registries.length === 0}
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            >
              {registries.map((r) => (
                <option key={r.owner_id} value={r.owner_id}>
                  {r.display_name} — {r.domain} ({r.rap.url})
                </option>
              ))}
            </select>
            {selectedRegistry ? (
              <span className="mt-1 block text-xs text-slate-500">
                Cards will be signed by{" "}
                <span className="font-mono">{selectedRegistry.auth.key_id}</span>
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Agent name (slug)
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="analytics-agent"
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <span className="mt-1 block text-xs text-slate-500">
              lowercase letters, digits, hyphens — becomes the identifier
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Analytics Agent"
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Protocol
            </span>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as AgentProtocol)}
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="a2a">a2a</option>
              <option value="rest">rest</option>
              <option value="mcp">mcp</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Aggregates and reports usage analytics across product surfaces."
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
              placeholder="analytics.query, analytics.report"
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <span className="mt-1 block text-xs text-slate-500">
              comma-separated capability identifiers
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Invocation URL (optional)
            </span>
            <input
              value={invocationUrl}
              onChange={(e) => setInvocationUrl(e.target.value)}
              placeholder={selectedRegistry ? `https://${selectedRegistry.domain}/a2a/${name || "<name>"}` : "https://example.com/a2a/agent"}
              className="mt-2 block w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <span className="mt-1 block text-xs text-slate-500">
              defaults to <span className="font-mono">{selectedRegistry?.rap.url ?? "<rap>"}/invoke/&lt;name&gt;</span> if left blank
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || registries.length === 0}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing card..." : "Register agent (RAP will sign)"}
          </button>
          {signedCard ? (
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

      {signedCard ? (
        <div className="mt-8 space-y-5">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <div className="font-medium text-base">
              Agent registered and signed.
            </div>
            <div className="mt-2">
              agent_id:{" "}
              <span className="rounded bg-white/70 px-2 py-0.5 font-mono text-xs">
                {signedCard.id}
              </span>
            </div>
            <div className="mt-1">
              signed_by:{" "}
              <span className="rounded bg-white/70 px-2 py-0.5 font-mono text-xs">
                {signedCard.signed_by}
              </span>
            </div>
            {newLocator ? (
              <div className="mt-3 text-xs">
                Try it on{" "}
                <a
                  href={`/demo/resolve?prefillA=${encodeURIComponent(newLocator)}`}
                  className="font-medium underline"
                >
                  A2A Card Exchange
                </a>{" "}
                with locator{" "}
                <span className="font-mono">{newLocator}</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Signed AgentCard (returned by the registry's RAP)
            </div>
            <JsonPanel data={signedCard} />
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
