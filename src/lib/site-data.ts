export const navigation = [
  { href: "/", label: "Overview" },
  { href: "/register", label: "Register" },
  { href: "/registries", label: "Browse" },
  { href: "/resolve", label: "Resolve" },
  { href: "/search", label: "Search" },
  { href: "/query", label: "Agent Query" },
  { href: "/demo/resolve", label: "Cross-registry demo" },
];

export const heroStats = [
  { value: "3", label: "registered registries" },
  { value: "3", label: "active / verified" },
  { value: "2026041103", label: "root serial" },
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