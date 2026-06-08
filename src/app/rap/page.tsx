"use client";

import { useCallback, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { cn } from "@/lib/utils";
import type { RegistryAgentRecord, RegistryAgentCreatePayload } from "@/lib/rap-types";
import {
  RegistryApiError,
  createRegistryAgent,
  deleteRegistryAgent,
  fetchRegistryAgents,
  updateRegistryAgent,
} from "@/lib/rap-api";

// ── Types ────────────────────────────────────────────────────────────────────

type ConnectState = "idle" | "connecting" | "connected";
type PanelMode = "view" | "create" | "edit";

interface FormState {
  agent_id: string;
  display_name: string;
  description: string;
  card_url: string;
  tags: string[];
  ttl_seconds: string;
}

const EMPTY_FORM: FormState = {
  agent_id:     "",
  display_name: "",
  description:  "",
  card_url:     "",
  tags:         [],
  ttl_seconds:  "3600",
};

function agentToForm(agent: RegistryAgentRecord): FormState {
  return {
    agent_id:     agent.agent_id,
    display_name: agent.display_name,
    description:  agent.description ?? "",
    card_url:     agent.card_url,
    tags:         agent.tags,
    ttl_seconds:  String(agent.ttl_seconds),
  };
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full rounded-2xl border px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-slate-300 bg-white disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-rose-300 bg-rose-50/40" : "border-black/10",
        )}
      />
      {error ? (
        <p className="mt-1 text-[11px] text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </label>
  );
}

// ── Tags chip input ───────────────────────────────────────────────────────────

function TagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function commit(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        Tags
      </span>
      <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-2xl border border-black/10 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-slate-300">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full border border-black/10 bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-0.5 leading-none text-slate-400 hover:text-slate-900"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (input) commit(input); }}
          placeholder={tags.length === 0 ? "e.g. customer-service, billing" : ""}
          className="min-w-[160px] flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-slate-300"
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Press Enter or comma to add. Backspace to remove last.
      </p>
    </div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  selected,
  onClick,
}: {
  agent: RegistryAgentRecord;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        selected
          ? "border-slate-950 bg-slate-50 shadow-sm"
          : "border-black/10 bg-white hover:bg-slate-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-slate-950">{agent.display_name}</span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.15em]",
            agent.status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500",
          )}
        >
          {agent.status}
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-slate-500">{agent.agent_id}</p>
      {agent.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-black/8 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500"
            >
              {tag}
            </span>
          ))}
          {agent.tags.length > 3 && (
            <span className="font-mono text-[10px] text-slate-400">
              +{agent.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ── Connect screen ────────────────────────────────────────────────────────────

function ConnectScreen({
  registryUrl,
  setRegistryUrl,
  adminToken,
  setAdminToken,
  onConnect,
  connectState,
  connectError,
}: {
  registryUrl: string;
  setRegistryUrl: (v: string) => void;
  adminToken: string;
  setAdminToken: (v: string) => void;
  onConnect: () => void;
  connectState: ConnectState;
  connectError: string | null;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm space-y-5">
        <div>
          <h2 className="font-serif text-xl italic text-slate-950">Connect to your registry</h2>
          <p className="mt-1 text-xs text-slate-500">
            Registry Manager lets you add, edit, and remove agent records on any Registry Server you control.
          </p>
        </div>

        <Field
          label="Registry Server URL"
          value={registryUrl}
          onChange={setRegistryUrl}
          placeholder="https://registry.nasiko.com"
          hint="The base URL of your running Registry Server."
        />
        <Field
          label="Admin Token"
          value={adminToken}
          onChange={setAdminToken}
          placeholder="your-admin-token"
          type="password"
          hint="Set as REGISTRY_ADMIN_TOKEN in your Registry Server's environment."
        />

        {connectError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {connectError}
          </div>
        )}

        <button
          onClick={onConnect}
          disabled={connectState === "connecting" || !registryUrl || !adminToken}
          className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connectState === "connecting" ? "Connecting…" : "Connect"}
        </button>
      </div>

      <div className="rounded-2xl border border-black/5 bg-slate-50 px-5 py-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Don&#39;t have a Registry Server yet?</p>
        <p className="mt-1">
          Deploy the <span className="font-mono">registry-server</span> from the GARR repo and set{" "}
          <span className="font-mono">REGISTRY_ADMIN_TOKEN</span> in its environment. Then register
          your org in the{" "}
          <a href="/dashboard/orgs/new" className="text-indigo-600 hover:underline">
            NANDA Index
          </a>{" "}
          pointing to it.
        </p>
      </div>
    </div>
  );
}

// ── Agent form (create / edit) ────────────────────────────────────────────────

function AgentForm({
  mode,
  form,
  patchForm,
  onSave,
  onCancel,
  saving,
  saveError,
}: {
  mode: "create" | "edit";
  form: FormState;
  patchForm: (key: keyof FormState, val: string | string[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-slate-950">
        {mode === "create" ? "New agent" : `Edit ${form.agent_id}`}
      </h2>

      <Field
        label="Agent ID"
        value={form.agent_id}
        onChange={(v) => patchForm("agent_id", v)}
        placeholder="my-agent"
        disabled={mode === "edit"}
        hint={
          mode === "edit"
            ? "Agent ID cannot be changed after creation."
            : "Lowercase letters, numbers, and hyphens. Permanent."
        }
      />

      <Field
        label="Display Name"
        value={form.display_name}
        onChange={(v) => patchForm("display_name", v)}
        placeholder="My Agent"
      />

      <Field
        label="Description (optional)"
        value={form.description}
        onChange={(v) => patchForm("description", v)}
        placeholder="What this agent does"
      />

      <Field
        label="Card URL"
        value={form.card_url}
        onChange={(v) => patchForm("card_url", v)}
        placeholder="https://agents.example.com/my-agent/a2a.json"
        hint="URL to the A2A card JSON that describes this agent's capabilities."
      />

      <TagsInput
        tags={form.tags}
        onChange={(tags) => patchForm("tags", tags)}
      />

      <Field
        label="TTL Seconds"
        value={form.ttl_seconds}
        onChange={(v) => patchForm("ttl_seconds", v)}
        placeholder="3600"
        hint="How long resolvers should cache this agent record. Default: 3600 (1 hour)."
      />

      {form.agent_id && form.card_url && (
        <div className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Card URL
          </p>
          <a
            href={form.card_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all font-mono text-xs text-indigo-600 hover:underline"
          >
            {form.card_url}
          </a>
        </div>
      )}

      {saveError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : mode === "create" ? "Create agent" : "Save changes"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-2xl border border-black/10 bg-white px-6 py-2.5 text-sm font-medium text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RegistryManagerPage() {
  const [registryUrl, setRegistryUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [connectError, setConnectError] = useState<string | null>(null);

  const [agents, setAgents] = useState<RegistryAgentRecord[]>([]);
  const [selected, setSelected] = useState<RegistryAgentRecord | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const patchForm = (key: keyof FormState, val: string | string[]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const connect = useCallback(async () => {
    setConnectState("connecting");
    setConnectError(null);
    try {
      const data = await fetchRegistryAgents(registryUrl, adminToken);
      setAgents(data);
      setSelected(data[0] ?? null);
      setConnectState("connected");
    } catch (err) {
      setConnectError(err instanceof RegistryApiError ? err.message : "Could not connect.");
      setConnectState("idle");
    }
  }, [registryUrl, adminToken]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRegistryAgents(registryUrl, adminToken);
      setAgents(data);
    } catch {
      // Silently fail on background refresh
    }
  }, [registryUrl, adminToken]);

  function startCreate() {
    setForm(EMPTY_FORM);
    setSelected(null);
    setSaveError(null);
    setPanelMode("create");
  }

  function startEdit() {
    if (!selected) return;
    setForm(agentToForm(selected));
    setSaveError(null);
    setPanelMode("edit");
  }

  function formToPayload(): RegistryAgentCreatePayload {
    return {
      agent_id:     form.agent_id,
      display_name: form.display_name,
      description:  form.description || undefined,
      card_url:     form.card_url,
      tags:         form.tags,
      ttl_seconds:  parseInt(form.ttl_seconds, 10) || 3600,
    };
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      if (panelMode === "create") {
        const created = await createRegistryAgent(registryUrl, adminToken, formToPayload());
        await refresh();
        setSelected(created);
        setPanelMode("view");
      } else if (panelMode === "edit" && selected) {
        const updated = await updateRegistryAgent(registryUrl, adminToken, selected.agent_id, formToPayload());
        await refresh();
        setSelected(updated);
        setPanelMode("view");
      }
    } catch (err) {
      setSaveError(err instanceof RegistryApiError ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent() {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteRegistryAgent(registryUrl, adminToken, selected.agent_id);
      const remaining = agents.filter((a) => a.agent_id !== selected.agent_id);
      await refresh();
      setSelected(remaining[0] ?? null);
      setPanelMode("view");
    } catch {
      // Reflect actual state via refresh
    } finally {
      setDeleting(false);
    }
  }

  // ── Connect gate ─────────────────────────────────────────────────────────────

  if (connectState !== "connected") {
    return (
      <PageShell
        title="Registry Manager"
        description="Manage agents on your Registry Server."
      >
        <ConnectScreen
          registryUrl={registryUrl}
          setRegistryUrl={setRegistryUrl}
          adminToken={adminToken}
          setAdminToken={setAdminToken}
          onConnect={connect}
          connectState={connectState}
          connectError={connectError}
        />
      </PageShell>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Registry Manager"
      description={`Connected to ${registryUrl}`}
    >
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">

        {/* Sidebar — agent list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Agents ({agents.length})
            </span>
            <button
              onClick={startCreate}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              + New
            </button>
          </div>

          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {agents.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-5 text-center">
                <p className="text-sm font-medium text-slate-700">No agents yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Register your first agent to make it discoverable.
                </p>
                <button
                  onClick={startCreate}
                  className="mt-3 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-medium text-white"
                >
                  + New agent
                </button>
              </div>
            ) : (
              agents.map((agent) => (
                <AgentCard
                  key={agent.agent_id}
                  agent={agent}
                  selected={selected?.agent_id === agent.agent_id}
                  onClick={() => {
                    setSelected(agent);
                    setPanelMode("view");
                    setSaveError(null);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Main panel */}
        <div>
          {panelMode === "create" || panelMode === "edit" ? (
            <AgentForm
              mode={panelMode}
              form={form}
              patchForm={patchForm}
              onSave={save}
              onCancel={() => { setPanelMode("view"); setSaveError(null); }}
              saving={saving}
              saveError={saveError}
            />
          ) : selected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={startEdit}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  onClick={deleteAgent}
                  disabled={deleting}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">{selected.display_name}</h2>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.15em]",
                        selected.status === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500",
                      )}
                    >
                      {selected.status}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-500">{selected.agent_id}</p>
                </div>

                {selected.description && (
                  <p className="text-sm text-slate-600">{selected.description}</p>
                )}

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      Card URL
                    </span>
                    <a
                      href={selected.card_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block break-all font-mono text-xs text-indigo-600 hover:underline"
                    >
                      {selected.card_url}
                    </a>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      TTL
                    </span>
                    <p className="mt-0.5 font-mono text-xs text-slate-700">{selected.ttl_seconds}s</p>
                  </div>
                  {selected.tags.length > 0 && (
                    <div>
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        Tags
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {selected.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-black/10 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <JsonPanel data={selected} />
            </div>
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm text-center">
              <p className="text-sm font-medium text-slate-700">Select an agent</p>
              <p className="mt-1 text-xs text-slate-400">
                Choose one from the list, or create a new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
