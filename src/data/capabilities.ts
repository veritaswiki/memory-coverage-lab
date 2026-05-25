export type CapabilityGroupKey =
  | "cognitive"
  | "grounding"
  | "agentic"
  | "assurance";

export const capabilityGroupDefinitions = [
  {
    key: "cognitive",
    label: "Memory cognition",
    summary: "Whether facts, experience, working memory, and reflection create long-term continuity.",
  },
  {
    key: "grounding",
    label: "Retrieval grounding",
    summary: "Whether generation can be bound to corpora, graphs, timelines, and multimodal evidence.",
  },
  {
    key: "agentic",
    label: "Agent runtime",
    summary: "Whether write, manage, read, tool-use, and runtime state form a stable operating loop.",
  },
  {
    key: "assurance",
    label: "Governance assurance",
    summary: "Whether evaluation, contradiction repair, permissions, retention, and deployment boundaries are auditable.",
  },
] as const;

export const capabilityDefinitions = [
  {
    key: "episodic",
    label: "Episodic memory",
    group: "cognitive",
    description: "Preserves cross-session observations, preferences, interaction fragments, and re-enterable experience context.",
    lens: "Experiential memory",
    weight: 1.15,
  },
  {
    key: "semanticRetrieval",
    label: "Semantic retrieval",
    group: "grounding",
    description: "Vector and keyword hybrid recall, reranking, query rewriting, and read paths for agents.",
    lens: "Read path",
    weight: 1,
  },
  {
    key: "graphMemory",
    label: "Relational graph",
    group: "grounding",
    description: "Entities, relationships, claims, sources, community structure, and queryable knowledge graphs.",
    lens: "Relational substrate",
    weight: 1.05,
  },
  {
    key: "timelineProof",
    label: "Timeline evidence",
    group: "grounding",
    description: "Decisions, validation, event timelines, proof paths, and provenance records.",
    lens: "Temporal provenance",
    weight: 1.1,
  },
  {
    key: "wikiCorpus",
    label: "Readable corpus",
    group: "grounding",
    description: "Human-readable knowledge bases, document exports, long-form context, offline corpora, and citation surfaces.",
    lens: "Corpus memory",
    weight: 0.9,
  },
  {
    key: "multimodalGrounding",
    label: "Multimodal grounding",
    group: "grounding",
    description: "Whether images, tables, PDFs, web pages, code, and operational evidence enter one memory surface.",
    lens: "Multimodal memory",
    weight: 0.85,
  },
  {
    key: "reflectionPlanning",
    label: "Reflection planning",
    group: "cognitive",
    description: "Extracts reflections, plans, strategy updates, and executable next steps from memory.",
    lens: "Reflective control",
    weight: 1.1,
  },
  {
    key: "agentHooks",
    label: "Agent hooks",
    group: "agentic",
    description: "Automatic injection through Codex, MCP, CLIs, SDKs, hooks, and workflow surfaces.",
    lens: "Tool/action coupling",
    weight: 1,
  },
  {
    key: "runtimeState",
    label: "Runtime state",
    group: "agentic",
    description: "Task ledgers, service status, profiles, lanes, budgets, and current-state registration.",
    lens: "Manage path",
    weight: 0.95,
  },
  {
    key: "evaluationBenchmarks",
    label: "Evaluation benchmarks",
    group: "assurance",
    description: "Supports single-hop, multi-hop, temporal, open-domain, multi-session, and end-to-end task evaluation.",
    lens: "Evaluation protocol",
    weight: 0.95,
  },
  {
    key: "contradictionRepair",
    label: "Contradiction repair",
    group: "assurance",
    description: "Detects conflicting facts, stale memories, hallucinated claims, and supports versioned correction.",
    lens: "Memory dynamics",
    weight: 1,
  },
  {
    key: "governance",
    label: "Governance audit",
    group: "assurance",
    description: "Memory stewardship, permissions, retention policies, approval queues, and source boundaries.",
    lens: "Policy control",
    weight: 1.05,
  },
  {
    key: "selfHostLan",
    label: "Deployment control",
    group: "assurance",
    description: "Self-hosting, private deployment, offline operation, data residency, and migration strategy.",
    lens: "Deployment boundary",
    weight: 0.85,
  },
  {
    key: "officialSurface",
    label: "Official surface",
    group: "agentic",
    description: "Official SDKs, APIs, cloud services, open-source repositories, docs, and maintenance commitment.",
    lens: "Product maturity",
    weight: 0.9,
  },
  {
    key: "ecosystemSignal",
    label: "Ecosystem signal",
    group: "agentic",
    description: "Technical blogs, tutorials, community practice, reusable cases, and technical distribution.",
    lens: "Adoption signal",
    weight: 0.75,
  },
  {
    key: "projectFit",
    label: "Category clarity",
    group: "cognitive",
    description: "Clarity of product positioning, capability boundaries, and composition with adjacent tools.",
    lens: "Category fit",
    weight: 1.25,
  },
] as const;

export type CapabilityKey = (typeof capabilityDefinitions)[number]["key"];

export type CapabilityScores = Record<CapabilityKey, number>;

export const capabilityKeys = capabilityDefinitions.map(
  (capability) => capability.key,
) as CapabilityKey[];

export function createEmptyCapabilityScores(): CapabilityScores {
  return Object.fromEntries(capabilityKeys.map((key) => [key, 0])) as CapabilityScores;
}
