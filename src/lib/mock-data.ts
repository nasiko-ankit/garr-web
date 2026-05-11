import type { EntityOwner } from "./garr-types";

export const mockRegistries: EntityOwner[] = [
  {
    owner_id: "att",
    display_name: "AT&T Inc.",
    domain: "att.com",
    contact_email: "dmarc@att.com",
    auth: {
      algorithm: "ed25519",
      public_key: "<base64-encoded PEM>",
      key_id: "att-agent-root-2026",
      dmarc_policy: "v=DMARC1; p=reject; rua=mailto:dmarc@att.com",
    },
    rap: {
      url: "https://agents.att.com/.well-known/agent-registry/agents.json",
      fallback_url: "https://agents-backup.att.com/.well-known/agent-registry/agents.json",
      protocol: "https",
    },
    ttl_seconds: 86400,
    serial: "2026041101",
    status: "active",
    signature: {
      signed_by: "garr-root-2026",
      value: "<base64 signature>",
      issued_at: "2026-04-11T00:00:00Z",
      expires_at: "2026-04-12T00:00:00Z",
    },
  },
  {
    owner_id: "mit-lab",
    display_name: "MIT Lab",
    domain: "mit.edu",
    contact_email: "registry@mit.edu",
    auth: {
      algorithm: "ed25519",
      public_key: "<base64-encoded PEM>",
      key_id: "mit-lab-root-2026",
      dmarc_policy: "v=DMARC1; p=reject; rua=mailto:dmarc@mit.edu",
    },
    rap: {
      url: "https://agents.mit.edu/.well-known/agent-registry/agents.json",
      protocol: "https",
    },
    ttl_seconds: 86400,
    serial: "2026041102",
    status: "stale",
    signature: {
      signed_by: "garr-root-2026",
      value: "<base64 signature>",
      issued_at: "2026-04-11T00:00:00Z",
      expires_at: "2026-04-12T00:00:00Z",
    },
  },
  {
    owner_id: "nanda",
    display_name: "Nanda Initiative",
    domain: "nanda.org",
    contact_email: "registrar@nanda.org",
    auth: {
      algorithm: "ed25519",
      public_key: "<base64-encoded PEM>",
      key_id: "nanda-agent-root-2026",
      dmarc_policy: "v=DMARC1; p=reject; rua=mailto:dmarc@nanda.org",
    },
    rap: {
      url: "https://agents.nanda.org/.well-known/agent-registry/agents.json",
      protocol: "https",
    },
    ttl_seconds: 86400,
    serial: "2026041103",
    status: "active",
    signature: {
      signed_by: "garr-root-2026",
      value: "<base64 signature>",
      issued_at: "2026-04-11T00:00:00Z",
      expires_at: "2026-04-12T00:00:00Z",
    },
  },
];