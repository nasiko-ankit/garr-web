/** A single agent entry from the Registry Server (matches CatalogEntry on the backend). */
export interface RegistryAgentRecord {
  identifier: string;       // agent_id
  displayName: string;
  mediaType: string;
  url: string;              // A2A card URL (was card_url before migration 002)
  description?: string | null;
  tags?: string[];
  version?: string | null;
  updatedAt?: string;
  metadata?: {
    ttl_seconds?: number;
    status?: "active" | "inactive";
    [key: string]: unknown;
  };
}

/** Top-level AI Catalog document returned by GET /agents. */
export interface RegistryCatalogDocument {
  specVersion: string;
  entries: RegistryAgentRecord[];
}

/** Payload for creating a new agent. */
export interface RegistryAgentCreatePayload {
  agent_id: string;
  display_name: string;
  description?: string;
  url: string;
  media_type?: string;
  version?: string;
  tags?: string[];
  ttl_seconds?: number;
}

/** Payload for updating an existing agent (all fields optional). */
export interface RegistryAgentUpdatePayload {
  display_name?: string;
  description?: string;
  url?: string;
  media_type?: string;
  version?: string;
  tags?: string[];
  ttl_seconds?: number;
  status?: "active" | "inactive";
}

/** Auth response from POST /auth/register or POST /auth/login. */
export interface RegistryAuthResponse {
  token: string;
}

/** Current user info from GET /auth/me. */
export interface RegistryUser {
  user_id: string;
  email: string;
  display_name: string | null;
}
