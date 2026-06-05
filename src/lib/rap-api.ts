import type { AgentCreatePayload, RapAgent, RapCatalog } from "./rap-types";

export class RapApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "RapApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function rapRequest<T>(
  baseUrl: string,
  adminKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminKey}`,
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
    const obj =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const errorCode =
      typeof obj["error"] === "string" ? obj["error"] : null;
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
    throw new RapApiError(message, res.status, data);
  }

  return data as T;
}

export async function rapFetchCatalog(
  baseUrl: string,
  adminKey: string
): Promise<RapCatalog> {
  return rapRequest<RapCatalog>(baseUrl, adminKey, "/agents.json");
}

export async function rapGetAgent(
  baseUrl: string,
  adminKey: string,
  slug: string
): Promise<RapAgent> {
  return rapRequest<RapAgent>(
    baseUrl,
    adminKey,
    `/agents/${encodeURIComponent(slug)}`
  );
}

export async function rapCreateAgent(
  baseUrl: string,
  adminKey: string,
  body: AgentCreatePayload
): Promise<RapAgent> {
  return rapRequest<RapAgent>(baseUrl, adminKey, "/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rapUpdateAgent(
  baseUrl: string,
  adminKey: string,
  slug: string,
  body: AgentCreatePayload
): Promise<RapAgent> {
  return rapRequest<RapAgent>(
    baseUrl,
    adminKey,
    `/agents/${encodeURIComponent(slug)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

export async function rapDeleteAgent(
  baseUrl: string,
  adminKey: string,
  slug: string
): Promise<void> {
  await rapRequest<null>(
    baseUrl,
    adminKey,
    `/agents/${encodeURIComponent(slug)}`,
    { method: "DELETE" }
  );
}
