export const navigation = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Demo" },
  { href: "/register", label: "Register Registry" },
  { href: "/demo/agents/new", label: "Register Agent" },
  { href: "/demo/resolve", label: "A2A Card Exchange" },
  { href: "/registries", label: "Browse" },
];

export const heroStats = [
  { value: "2", label: "demo registries (google, meta)" },
  { value: "3", label: "demo steps" },
  { value: "Ed25519", label: "signing algorithm" },
  { value: "24h", label: "default TTL" },
];

export const whatGarrIs = [
  "A registry of registries",
  "A trust anchor for discovery",
  "The first hop in agent lookup",
  "A thin, stable root layer",
];

export const whatGarrIsNot = [
  "A registry of agents",
  "An agent executor",
  "A search engine",
  "A marketplace",
];

export const architectureLayers = [
  {
    layer: "ROOT (GARR)",
    function: "Authoritative index of all agent registries",
    analogy: "DNS Root Zone File",
    hosted: "This site",
  },
  {
    layer: "SWITCHBOARD",
    function: "Federated discovery across registries",
    analogy: "DNS Resolvers",
    hosted: "Public utility",
  },
  {
    layer: "REGISTRY (RAP)",
    function: "Agent catalog per organization",
    analogy: "Authoritative Name Server",
    hosted: "Each org's own infra",
  },
];