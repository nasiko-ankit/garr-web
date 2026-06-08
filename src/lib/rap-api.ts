import type {
  RegistryAgentRecord,
  RegistryCatalogDocument,
  RegistryAgentCreatePayload,
  RegistryAgentUpdatePayload,
  RegistryAuthResponse,
  RegistryUser,
} from "./rap-types";

export class RegistryApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "RegistryApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function registryRequest<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const hasBody = !!init?.body;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const errorCode = typeof obj["error"] === "string" ? obj["error"] : null;
    const detail =
      typeof obj["detail"] === "string"
        ? obj["detail"]
        : Array.isArray(obj["details"])
        ? (obj["details"] as string[]).join("; ")
        : null;
    const message =
      detail && errorCode
        ? `${errorCode} — ${detail}`
        : detail ?? errorCode ?? `Request failed with status ${res.status}`;
    throw new RegistryApiError(message, res.status, data);
  }

  return data as T;
}

// ── Auth (no token needed) ────────────────────────────────────────────────────

async function registryPublicRequest<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const errorCode = typeof obj["error"] === "string" ? obj["error"] : null;
    const detail = typeof obj["detail"] === "string" ? obj["detail"] : null;
    const message =
      detail && errorCode ? `${errorCode} — ${detail}` :
      detail ?? errorCode ?? `Request failed with status ${res.status}`;
    throw new RegistryApiError(message, res.status, data);
  }

  return data as T;
}

/** POST /auth/register — create a registry account. Returns JWT. */
export async function registerOnRegistry(
  baseUrl: string,
  email: string,
  password: string,
  displayName?: string
): Promise<string> {
  const res = await registryPublicRequest<RegistryAuthResponse>(baseUrl, "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  return res.token;
}

/** POST /auth/login — sign in to a registry server. Returns JWT. */
export async function loginToRegistry(
  baseUrl: string,
  email: string,
  password: string
): Promise<string> {
  const res = await registryPublicRequest<RegistryAuthResponse>(baseUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.token;
}

/** GET /auth/me — get current user info using a JWT. */
export async function getRegistryMe(baseUrl: string, token: string): Promise<RegistryUser> {
  return registryRequest<RegistryUser>(baseUrl, token, "/auth/me");
}

// ── Agents (public reads, auth required for writes) ───────────────────────────

/**
 * GET /agents — returns the full AI Catalog document.
 * No token needed for reads; pass empty string if unauthenticated.
 */
export async function fetchRegistryAgents(
  baseUrl: string,
  token: string = ""
): Promise<RegistryAgentRecord[]> {
  const doc = await registryRequest<RegistryCatalogDocument>(baseUrl, token, "/agents");
  return doc.entries ?? [];
}

/** GET /agents/:agent_id — single CatalogEntry. */
export async function getRegistryAgent(
  baseUrl: string,
  token: string,
  agentId: string
): Promise<RegistryAgentRecord> {
  return registryRequest<RegistryAgentRecord>(
    baseUrl,
    token,
    `/agents/${encodeURIComponent(agentId)}`
  );
}

/**
 * GET /agents/search?q= — keyword or URN search.
 * Returns matching agents as a flat array (from the CatalogDocument).
 * URN example: "urn:ai:moonbakery.com:order" → returns the "order" agent.
 */
export async function searchRegistryAgents(
  baseUrl: string,
  q: string,
  token: string = ""
): Promise<RegistryAgentRecord[]> {
  const doc = await registryRequest<RegistryCatalogDocument>(
    baseUrl,
    token,
    `/agents/search?q=${encodeURIComponent(q)}`
  );
  return doc.entries ?? [];
}

/** POST /agents — create a new agent (requires auth). */
export async function createRegistryAgent(
  baseUrl: string,
  token: string,
  body: RegistryAgentCreatePayload
): Promise<RegistryAgentRecord> {
  return registryRequest<RegistryAgentRecord>(baseUrl, token, "/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** PUT /agents/:agent_id — update an agent (requires auth). */
export async function updateRegistryAgent(
  baseUrl: string,
  token: string,
  agentId: string,
  body: RegistryAgentUpdatePayload
): Promise<RegistryAgentRecord> {
  return registryRequest<RegistryAgentRecord>(
    baseUrl,
    token,
    `/agents/${encodeURIComponent(agentId)}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

/** DELETE /agents/:agent_id — delete an agent (requires auth). */
export async function deleteRegistryAgent(
  baseUrl: string,
  token: string,
  agentId: string
): Promise<void> {
  await registryRequest<null>(
    baseUrl,
    token,
    `/agents/${encodeURIComponent(agentId)}`,
    { method: "DELETE" }
  );
}
