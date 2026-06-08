import type { RegistryAgentRecord, RegistryAgentCreatePayload } from "./rap-types";

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
  adminToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
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

export async function fetchRegistryAgents(
  baseUrl: string,
  adminToken: string
): Promise<RegistryAgentRecord[]> {
  return registryRequest<RegistryAgentRecord[]>(baseUrl, adminToken, "/agents");
}

export async function getRegistryAgent(
  baseUrl: string,
  adminToken: string,
  agentId: string
): Promise<RegistryAgentRecord> {
  return registryRequest<RegistryAgentRecord>(
    baseUrl,
    adminToken,
    `/agents/${encodeURIComponent(agentId)}`
  );
}

export async function createRegistryAgent(
  baseUrl: string,
  adminToken: string,
  body: RegistryAgentCreatePayload
): Promise<RegistryAgentRecord> {
  return registryRequest<RegistryAgentRecord>(baseUrl, adminToken, "/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRegistryAgent(
  baseUrl: string,
  adminToken: string,
  agentId: string,
  body: RegistryAgentCreatePayload
): Promise<RegistryAgentRecord> {
  return registryRequest<RegistryAgentRecord>(
    baseUrl,
    adminToken,
    `/agents/${encodeURIComponent(agentId)}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

export async function deleteRegistryAgent(
  baseUrl: string,
  adminToken: string,
  agentId: string
): Promise<void> {
  await registryRequest<null>(
    baseUrl,
    adminToken,
    `/agents/${encodeURIComponent(agentId)}`,
    { method: "DELETE" }
  );
}
