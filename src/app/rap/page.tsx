"use client";

import { useCallback, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { JsonPanel } from "@/components/JsonPanel";
import { cn } from "@/lib/utils";
import type { RapAgent, RapCatalog, RapProtocol, RapVisibility } from "@/lib/rap-types";
import {
  RapApiError,
  rapCreateAgent,
  rapDeleteAgent,
  rapFetchCatalog,
  rapUpdateAgent,
} from "@/lib/rap-api";

// ── Types ────────────────────────────────────────────────────────────────────

type ConnectState = "idle" | "connecting" | "connected";
type PanelMode = "view" | "create" | "edit";
type VisibilityFilter = "all" | "public" | "private";

interface FormState {
  name: string;
  display_name: string;
  description: string;
  version: string;
  capabilities: string;
  invocation_url: string;
  protocol: RapProtocol;
  visibility: RapVisibility;
}

const EMPTY_FORM: FormState = {
  name: "",
  display_name: "",
  description: "",
  version: "1.0.0",
  capabilities: "",
  invocation_url: "",
  protocol: "a2a",
  visibility: "public",
};

function agentToForm(agent: RapAgent): FormState {
  return {
    name: agent.id.split("@")[0],
    display_name: agent.display_name,
    description: agent.description,
    version: agent.version,
    capabilities: agent.capabilities.join(", "),
    invocation_url: agent.invocation_url,
    protocol: agent.protocol,
    visibility: agent.visibility,
  };
}

function slugFromId(id: string) {
  return id.split("@")[0];
}

// ── Badges ───────────────────────────────────────────────────────────────────

function ProtocolBadge({ protocol }: { protocol: string }) {
  const colors: Record<string, string> = {
    a2a: "border-violet-200 bg-violet-50 text-violet-700",
    mcp: "border-blue-200 bg-blue-50 text-blue-700",
    rest: "border-slate-200 bg-slate-50 text-slate-700",
    https: "border-teal-200 bg-teal-50 text-teal-700",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        colors[protocol] ?? colors.rest
      )}
    >
      {protocol}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        visibility === "private"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {visibility}
    </span>
  );
}

// ── Form field components ─────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Agent detail panel ────────────────────────────────────────────────────────

function AgentDetail({
  agent,
  onEdit,
  onDeleteRequest,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  submitting,
}: {
  agent: RapAgent;
  onEdit: () => void;
  onDeleteRequest: () => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-950 break-words">
            {agent.display_name}
          </h2>
          <p className="mt-0.5 text-xs font-mono text-slate-500 break-all">{agent.id}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <VisibilityBadge visibility={agent.visibility} />
          <ProtocolBadge protocol={agent.protocol} />
        </div>
      </div>

      {agent.description ? (
        <p className="text-sm leading-6 text-slate-600">{agent.description}</p>
      ) : null}

      <div className="grid gap-2 text-sm text-slate-700">
        <div>
          <span className="font-medium">Version:</span>{" "}
          <span className="font-mono text-xs">{agent.version}</span>
        </div>
        <div>
          <span className="font-medium">Invocation URL:</span>{" "}
          <a
            href={agent.invocation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-xs font-mono text-indigo-600 underline-offset-2 hover:underline"
          >
            {agent.invocation_url}
          </a>
        </div>
        <div>
          <span className="font-medium">Signed by:</span>{" "}
          <span className="font-mono text-xs">{agent.signed_by}</span>
        </div>
        <div>
          <span className="font-medium">Created:</span>{" "}
          <span className="text-slate-600">
            {new Date(agent.created_at).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="font-medium">Updated:</span>{" "}
          <span className="text-slate-600">
            {new Date(agent.updated_at).toLocaleString()}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Capabilities{" "}
          <span className="font-normal text-slate-400">
            ({agent.capabilities.length})
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="rounded-full border border-black/10 bg-slate-50 px-2.5 py-1 text-xs font-mono text-slate-700"
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-black/5 pt-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Signature
        </p>
        <p className="break-all font-mono text-[11px] text-slate-400">
          {agent.signature.slice(0, 64)}…
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-4">
        <button
          onClick={onEdit}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Edit
        </button>

        {!deleteConfirm ? (
          <button
            onClick={onDeleteRequest}
            className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
            <span className="text-sm text-rose-700">Delete this agent?</span>
            <button
              onClick={onDeleteConfirm}
              disabled={submitting}
              className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={onDeleteCancel}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent create / edit form ──────────────────────────────────────────────────

function AgentForm({
  mode,
  form,
  setForm,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  mode: "create" | "edit";
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm space-y-4"
    >
      <h2 className="text-lg font-semibold text-slate-950">
        {mode === "create" ? "Register Agent" : "Edit Agent"}
      </h2>

      <Field
        label="Agent Name (slug)"
        value={form.name}
        onChange={(v) => update("name", v)}
        placeholder="billing-agent"
        disabled={mode === "edit"}
        hint={
          mode === "create"
            ? "Lowercase letters, digits, and hyphens only. e.g. scheduler, billing-agent."
            : "Slug cannot be changed after creation."
        }
      />

      <Field
        label="Display Name"
        value={form.display_name}
        onChange={(v) => update("display_name", v)}
        placeholder="Billing Agent"
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Description{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Processes invoices and manages billing operations."
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
      </label>

      <Field
        label="Version"
        value={form.version}
        onChange={(v) => update("version", v)}
        placeholder="1.0.0"
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Capabilities
        </span>
        <textarea
          rows={3}
          value={form.capabilities}
          onChange={(e) => update("capabilities", e.target.value)}
          placeholder="billing.invoice.create, billing.invoice.read, billing.payment.process"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-300"
        />
        <p className="mt-1 text-xs text-slate-500">
          Comma-separated capability strings.
        </p>
      </label>

      <Field
        label="Invocation URL"
        value={form.invocation_url}
        onChange={(v) => update("invocation_url", v)}
        placeholder="https://api.example.com/agents/billing"
        hint="Must start with https://"
      />

      <SelectField
        label="Protocol"
        value={form.protocol}
        onChange={(v) => update("protocol", v as RapProtocol)}
        options={[
          { value: "a2a", label: "a2a — Agent-to-Agent" },
          { value: "mcp", label: "mcp — Model Context Protocol" },
          { value: "rest", label: "rest — REST API" },
          { value: "https", label: "https — Generic HTTPS" },
        ]}
      />

      <SelectField
        label="Visibility"
        value={form.visibility}
        onChange={(v) => update("visibility", v as RapVisibility)}
        options={[
          { value: "public", label: "public — Listed without authentication" },
          { value: "private", label: "private — Requires admin key to fetch" },
        ]}
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 border-t border-black/5 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? mode === "create"
              ? "Registering…"
              : "Saving…"
            : mode === "create"
            ? "Register agent"
            : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-black/10 px-5 py-3 text-sm text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RapManagerPage() {
  // Connection
  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [rapUrl, setRapUrl] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [catalog, setCatalog] = useState<RapCatalog | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // List state
  const [filter, setFilter] = useState<VisibilityFilter>("all");
  const [selected, setSelected] = useState<RapAgent | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Action state
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const agents = catalog?.agents ?? [];
  const filtered =
    filter === "all" ? agents : agents.filter((a) => a.visibility === filter);

  // ── Connection handlers ───────────────────────────────────────────────────

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!rapUrl.trim() || !adminKey.trim()) return;
    setConnectState("connecting");
    setConnectError(null);
    try {
      const data = await rapFetchCatalog(rapUrl.trim(), adminKey.trim());
      setCatalog(data);
      setConnectState("connected");
    } catch (err) {
      setConnectState("idle");
      if (err instanceof RapApiError) {
        setConnectError(`${err.status}: ${err.message}`);
      } else {
        setConnectError(
          "Could not reach the RAP — check the URL and admin key, then try again."
        );
      }
    }
  }

  const refresh = useCallback(
    async (currentSelected?: RapAgent | null) => {
      setRefreshing(true);
      setActionError(null);
      try {
        const data = await rapFetchCatalog(rapUrl, adminKey);
        setCatalog(data);
        const sel = currentSelected ?? selected;
        if (sel) {
          const refreshed = data.agents.find((a) => a.id === sel.id);
          setSelected(refreshed ?? null);
        }
        return data;
      } catch (err) {
        if (err instanceof RapApiError)
          setActionError(`Refresh failed: ${err.message}`);
        else setActionError("Refresh failed.");
        return null;
      } finally {
        setRefreshing(false);
      }
    },
    [rapUrl, adminKey, selected]
  );

  function disconnect() {
    setCatalog(null);
    setConnectState("idle");
    setAdminKey("");
    setSelected(null);
    setPanelMode("view");
    setDeleteConfirm(false);
    setActionError(null);
    setConnectError(null);
  }

  // ── Panel handlers ────────────────────────────────────────────────────────

  function openCreate() {
    setForm(EMPTY_FORM);
    setPanelMode("create");
    setDeleteConfirm(false);
    setActionError(null);
  }

  function openEdit(agent: RapAgent) {
    setForm(agentToForm(agent));
    setPanelMode("edit");
    setDeleteConfirm(false);
    setActionError(null);
  }

  function cancelForm() {
    setPanelMode("view");
    setActionError(null);
  }

  // ── CRUD actions ──────────────────────────────────────────────────────────

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const caps = form.capabilities
        .split(/[,\n]/)
        .map((c) => c.trim())
        .filter(Boolean);
      const agent = await rapCreateAgent(rapUrl, adminKey, {
        name: form.name.trim(),
        display_name: form.display_name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.version.trim() ? { version: form.version.trim() } : {}),
        capabilities: caps,
        invocation_url: form.invocation_url.trim(),
        protocol: form.protocol,
        visibility: form.visibility,
      });
      await refresh(agent);
      setSelected(agent);
      setPanelMode("view");
    } catch (err) {
      if (err instanceof RapApiError) setActionError(`${err.status}: ${err.message}`);
      else setActionError("Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    const slug = slugFromId(selected.id);
    try {
      const caps = form.capabilities
        .split(/[,\n]/)
        .map((c) => c.trim())
        .filter(Boolean);
      const agent = await rapUpdateAgent(rapUrl, adminKey, slug, {
        name: slug,
        display_name: form.display_name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.version.trim() ? { version: form.version.trim() } : {}),
        capabilities: caps,
        invocation_url: form.invocation_url.trim(),
        protocol: form.protocol,
        visibility: form.visibility,
      });
      await refresh(agent);
      setSelected(agent);
      setPanelMode("view");
    } catch (err) {
      if (err instanceof RapApiError) setActionError(`${err.status}: ${err.message}`);
      else setActionError("Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    const slug = slugFromId(selected.id);
    try {
      await rapDeleteAgent(rapUrl, adminKey, slug);
      setSelected(null);
      setPanelMode("view");
      setDeleteConfirm(false);
      await refresh(null);
    } catch (err) {
      if (err instanceof RapApiError) setActionError(`${err.status}: ${err.message}`);
      else setActionError("Delete failed.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Not connected: connection form ────────────────────────────────────────

  if (connectState !== "connected") {
    return (
      <PageShell
        title="RAP Agent Manager"
        description="Connect to a Registry Access Point to browse, register, update, and delete agent cards."
      >
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={connect}
            className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm space-y-5"
          >
            <Field
              label="RAP Base URL"
              value={rapUrl}
              onChange={setRapUrl}
              placeholder="http://localhost:3001"
            />
            <Field
              label="Admin API Key"
              value={adminKey}
              onChange={setAdminKey}
              placeholder="your-admin-api-key"
              type="password"
            />

            {connectError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {connectError}
              </div>
            )}

            <button
              type="submit"
              disabled={
                connectState === "connecting" ||
                !rapUrl.trim() ||
                !adminKey.trim()
              }
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectState === "connecting" ? "Connecting…" : "Connect to RAP"}
            </button>
          </form>

          <div className="space-y-5 rounded-3xl border border-black/10 bg-slate-50 p-6 text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-800">What is the RAP?</p>
              <p className="mt-2 leading-6">
                A Registry Access Point (RAP) is the HTTPS service your
                organization runs to serve signed AgentCards. GARR stores a
                pointer to your RAP — resolution fetches cards directly from it.
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-800">Configuration</p>
              <ul className="mt-2 space-y-2">
                <li>
                  <span className="font-medium text-slate-700">RAP Base URL</span>
                  {" "}— root URL of your RAP server (e.g.,{" "}
                  <span className="font-mono text-xs">http://localhost:3001</span>)
                </li>
                <li>
                  <span className="font-medium text-slate-700">Admin API Key</span>
                  {" "}— the{" "}
                  <span className="font-mono text-xs">ADMIN_API_KEY</span> value
                  from your RAP server&apos;s .env
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              The admin key is sent directly from your browser to the RAP.
              Only use this on trusted networks or localhost.
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Connected: agent management UI ───────────────────────────────────────

  const publicCount = agents.filter((a) => a.visibility === "public").length;
  const privateCount = agents.filter((a) => a.visibility === "private").length;

  return (
    <PageShell
      title="RAP Agent Manager"
      description="Browse and manage agent cards on your Registry Access Point."
    >
      {/* Connection banner */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
        <span className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="font-medium text-slate-950">{catalog!.domain}</span>
        </span>
        <div className="flex gap-3 text-sm text-slate-500">
          <span>{agents.length} total</span>
          <span className="text-emerald-600">{publicCount} public</span>
          {privateCount > 0 && (
            <span className="text-amber-600">{privateCount} private</span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Generated {new Date(catalog!.generated_at).toLocaleTimeString()}
        </p>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="rounded-xl border border-black/10 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={disconnect}
            className="rounded-xl border border-black/10 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "public", "private"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm capitalize",
                filter === f
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-black/10 bg-white"
              )}
            >
              {f}
              {f !== "all" && (
                <span className="ml-1 text-xs opacity-60">
                  ({agents.filter((a) => a.visibility === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {panelMode !== "create" ? (
          <button
            onClick={openCreate}
            className="ml-auto rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white"
          >
            + Register Agent
          </button>
        ) : (
          <button
            onClick={cancelForm}
            className="ml-auto rounded-2xl border border-black/10 px-5 py-2.5 text-sm text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>

      {actionError && (
        <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">

        {/* Left — agent table */}
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
          {filtered.length > 0 ? (
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col style={{ width: "38%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">Agent</th>
                  <th className="px-4 py-4">Protocol</th>
                  <th className="px-4 py-4">Visibility</th>
                  <th className="px-4 py-4">Caps</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => {
                  const isSelected = selected?.id === agent.id;
                  return (
                    <tr
                      key={agent.id}
                      onClick={() => {
                        setSelected(agent);
                        setPanelMode("view");
                        setDeleteConfirm(false);
                        setActionError(null);
                      }}
                      className={cn(
                        "cursor-pointer border-t border-black/5 transition-colors",
                        isSelected
                          ? "bg-slate-50"
                          : "hover:bg-slate-50/60"
                      )}
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-slate-950 break-words">
                          {agent.display_name}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-400 break-all">
                          {agent.id}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <ProtocolBadge protocol={agent.protocol} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <VisibilityBadge visibility={agent.visibility} />
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-500">
                        {agent.capabilities.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                {filter === "all" ? "No agents registered yet." : `No ${filter} agents.`}
              </p>
              {filter === "all" && (
                <p className="mt-2 text-xs text-slate-400">
                  Use the &quot;Register Agent&quot; button to add your first agent.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right — detail / form panel */}
        <div className="min-w-0 space-y-4">
          {panelMode === "create" && (
            <AgentForm
              mode="create"
              form={form}
              setForm={setForm}
              onSubmit={submitCreate}
              onCancel={cancelForm}
              submitting={submitting}
              error={actionError}
            />
          )}

          {panelMode === "edit" && selected && (
            <AgentForm
              mode="edit"
              form={form}
              setForm={setForm}
              onSubmit={submitEdit}
              onCancel={cancelForm}
              submitting={submitting}
              error={actionError}
            />
          )}

          {panelMode === "view" && selected && (
            <>
              <AgentDetail
                agent={selected}
                onEdit={() => openEdit(selected)}
                onDeleteRequest={() => setDeleteConfirm(true)}
                deleteConfirm={deleteConfirm}
                onDeleteConfirm={confirmDelete}
                onDeleteCancel={() => setDeleteConfirm(false)}
                submitting={submitting}
              />
              <JsonPanel data={selected} />
            </>
          )}

          {panelMode === "view" && !selected && (
            <div className="rounded-3xl border border-black/10 bg-white p-10 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                Select an agent from the table to see its details.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
