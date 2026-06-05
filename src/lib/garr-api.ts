import type {
  EntityOwner,
  EntityOwnerWire,
  EntityStatus,
  PendingChallengeResponse,
  RegisterPayload,
  ResolveResponse,
} from "./garr-types";

const API_BASE = process.env.NEXT_PUBLIC_GARR_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
    // GARR error envelope is `{ error, detail }`. `detail` is the human-readable
    // explanation ("domain 'X' is already registered") — surface it first so the
    // UI shows the why, not just the code.
    const errorCode = typeof obj["error"] === "string" ? obj["error"] : null;
    const detail = typeof obj["detail"] === "string" ? obj["detail"] : null;
    const message =
      detail && errorCode ? `${errorCode} — ${detail}` :
      detail ?? errorCode ??
      (typeof obj["message"] === "string" ? obj["message"] : `Request failed with status ${res.status}`);
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

/** Maps a flat EntityOwnerWire from the backend into the nested EntityOwner shape used by the UI. */
export function toEntityOwner(wire: EntityOwnerWire): EntityOwner {
  return {
    owner_id: wire.owner_id,
    display_name: wire.display_name,
    domain: wire.domain,
    contact_email: wire.contact_email,
    ttl_seconds: wire.ttl_seconds,
    serial: wire.serial,
    status: wire.status,
    auth: {
      algorithm: wire.algorithm,
      public_key: wire.public_key,
      key_id: wire.key_id,
      // dmarc_policy is write-time only and never returned by read endpoints
      dmarc_policy: "",
    },
    rap: {
      url: wire.rap_url,
      ...(wire.rap_fallback ? { fallback_url: wire.rap_fallback } : {}),
      protocol: "https",
    },
    signature: {
      signed_by: wire.signed_by,
      value: wire.signature_value,
      issued_at: wire.issued_at,
      expires_at: wire.expires_at,
    },
  };
}

/** Step 1 of registration — POST /api/v1/register → 202 challenge nonce. */
export async function registerOwner(
  payload: RegisterPayload
): Promise<PendingChallengeResponse> {
  return request<PendingChallengeResponse>("/api/v1/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Step 2 of registration — POST /api/v1/register/:owner_id/verify → 201 EntityOwner. */
export async function verifyOwner(
  ownerId: string,
  challengeSignature: string
): Promise<EntityOwner> {
  const wire = await request<EntityOwnerWire>(
    `/api/v1/register/${encodeURIComponent(ownerId)}/verify`,
    {
      method: "POST",
      body: JSON.stringify({ challenge_signature: challengeSignature }),
    }
  );
  return toEntityOwner(wire);
}

/** GET /api/v1/owners/:owner_id → EntityOwner. */
export async function getRegistry(ownerId: string): Promise<EntityOwner> {
  const wire = await request<EntityOwnerWire>(
    `/api/v1/owners/${encodeURIComponent(ownerId)}`
  );
  return toEntityOwner(wire);
}

/** GET /api/v1/search?q= → EntityOwner[]. */
export async function searchRegistries(q: string): Promise<EntityOwner[]> {
  const res = await request<{ results: EntityOwnerWire[] }>(
    `/api/v1/search?q=${encodeURIComponent(q)}`
  );
  return (res.results ?? []).map(toEntityOwner);
}

/**
 * Resolve a domain by searching for it and returning the first match.
 * Throws ApiError(404) if no match is found.
 *
 * NOTE: uses the search endpoint as a proxy — if the backend paginates and
 * the exact domain falls outside the first page, this will incorrectly 404.
 * A dedicated GET /api/v1/owners?domain= endpoint would fix this properly.
 */
export async function resolveDomain(domain: string): Promise<EntityOwner> {
  const needle = domain.trim().toLowerCase();
  const res = await request<{ results: EntityOwnerWire[] }>(
    `/api/v1/search?q=${encodeURIComponent(needle)}`
  );
  const match = (res.results ?? []).find(
    (r) => r.domain.toLowerCase() === needle
  );
  if (!match) {
    throw new ApiError("not_found", 404);
  }
  return toEntityOwner(match);
}

/**
 * List all active owners by fetching the root manifest and extracting entity_owners.
 * Optionally filter by status. Uses option C (§manifest) — zero backend changes required.
 */
export async function listRegistries(
  status?: EntityStatus | "all"
): Promise<EntityOwner[]> {
  const manifest = await request<{ entity_owners: EntityOwnerWire[] }>(
    "/global_agent_root.json"
  );
  const wires = manifest.entity_owners ?? [];
  const filtered =
    !status || status === "all"
      ? wires
      : wires.filter((w) => w.status === status);
  return filtered.map(toEntityOwner);
}

/** GET /global_agent_root.json — the signed root manifest. */
export async function getManifest(): Promise<unknown> {
  return request<unknown>("/global_agent_root.json");
}

/**
 * GET /api/v1/resolve?locator=<agent>@<domain>:<mode>
 * Returns a fully verified AgentCard + IndexRecord (Layer 3 resolution).
 *
 * Locator format: agent@domain:mode
 *   mode = global | dnssrv | nandaindex.org
 *
 * Example: scheduler@nasiko.com:global
 */
export async function resolveAgent(locator: string): Promise<ResolveResponse> {
  return request<ResolveResponse>(
    `/api/v1/resolve?locator=${encodeURIComponent(locator)}`
  );
}

