export type RapProtocol = "a2a" | "mcp" | "rest" | "https";
export type RapVisibility = "public" | "private";

export interface RapAgent {
  id: string;
  display_name: string;
  description: string;
  version: string;
  capabilities: string[];
  invocation_url: string;
  protocol: RapProtocol;
  visibility: RapVisibility;
  signed_by: string;
  created_at: string;
  updated_at: string;
  signature: string;
}

export interface RapCatalog {
  owner_id: string;
  domain: string;
  generated_at: string;
  catalog_version: number;
  total: number;
  agents: RapAgent[];
}

export interface AgentCreatePayload {
  name: string;
  display_name: string;
  description?: string;
  version?: string;
  capabilities: string[];
  invocation_url: string;
  protocol: string;
  visibility?: RapVisibility;
}
