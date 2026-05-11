export type EntityStatus = "active" | "stale" | "suspended" | "pending";

export type AuthAlgorithm = "ed25519" | "rsa-sha256";

// Flat wire shape returned by every backend read endpoint (§5.2)
export interface EntityOwnerWire {
  owner_id: string;
  display_name: string;
  domain: string;
  contact_email: string;
  rap_url: string;
  rap_fallback: string | null;
  algorithm: AuthAlgorithm;
  public_key: string;
  key_id: string;
  ttl_seconds: number;
  serial: string;
  status: EntityStatus;
  issued_at: string;
  expires_at: string;
  signature_value: string;
  signed_by: string;
}

// 202 response from POST /api/v1/register (step 1 of challenge flow)
export interface PendingChallengeResponse {
  owner_id: string;
  challenge_nonce: string;
  challenge_expires_at: string;
  next_step: string;
}

export interface GarrSignature {
  signed_by: string;
  value: string;
  issued_at: string;
  expires_at: string;
}

export interface GarrAuth {
  algorithm: AuthAlgorithm;
  public_key: string;
  key_id: string;
  dmarc_policy: string;
}

export interface GarrRap {
  url: string;
  fallback_url?: string;
  protocol?: "https";
}

// Nested shape used throughout the UI — produced by toEntityOwner() in garr-api.ts
export interface EntityOwner {
  owner_id: string;
  display_name: string;
  domain: string;
  contact_email: string;
  auth: GarrAuth;
  rap: GarrRap;
  ttl_seconds: number;
  serial: string;
  status: EntityStatus;
  signature: GarrSignature;
}

// Flat body sent to POST /api/v1/register
export interface RegisterPayload {
  owner_id: string;
  display_name: string;
  domain: string;
  contact_email: string;
  rap_url: string;
  rap_fallback?: string;
  algorithm: AuthAlgorithm;
  public_key: string;
  key_id: string;
  ttl_seconds: number;
}