export interface RegistryAgentRecord {
  agent_id: string;
  display_name: string;
  description: string | null;
  card_url: string;
  tags: string[];
  ttl_seconds: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface RegistryAgentCreatePayload {
  agent_id: string;
  display_name: string;
  description?: string;
  card_url: string;
  tags?: string[];
  ttl_seconds?: number;
}
