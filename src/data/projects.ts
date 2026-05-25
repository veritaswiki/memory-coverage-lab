import type { CapabilityScores } from "./capabilities";

export type SupportKind =
  | "official-cloud"
  | "official-oss"
  | "plugin"
  | "framework"
  | "infrastructure";

export interface EvidenceSignal {
  label: string;
  strength: "Strong" | "Medium" | "Weak" | "Watch";
  detail: string;
}

export interface CaseNote {
  when: string;
  title: string;
  detail: string;
}

export interface MemoryProject {
  slug: string;
  name: string;
  shortName: string;
  layer: string;
  summary: string;
  role: string;
  supportKind: SupportKind;
  officialSupport: string;
  technologySignal: string;
  fitPosition: string;
  color: string;
  accent: string;
  map: {
    x: number;
    y: number;
  };
  scores: CapabilityScores;
  evidence: EvidenceSignal[];
  cases: CaseNote[];
  pairsWith: string[];
}

const full = {
  episodic: 1,
  semanticRetrieval: 1,
  graphMemory: 1,
  timelineProof: 1,
  wikiCorpus: 1,
  multimodalGrounding: 1,
  reflectionPlanning: 1,
  agentHooks: 1,
  runtimeState: 1,
  evaluationBenchmarks: 1,
  contradictionRepair: 1,
  governance: 1,
  selfHostLan: 1,
  officialSurface: 1,
  ecosystemSignal: 1,
  projectFit: 1,
} satisfies CapabilityScores;

export const memoryProjects: MemoryProject[] = [
  {
    slug: "mem0",
    name: "Mem0",
    shortName: "Mem0",
    layer: "Memory API",
    summary:
      "A long-term user-memory API and SDK for AI applications, covering writes, extraction, retrieval, and app integration.",
    role: "Productized memory API, user-level long-term memory, and application-side recall.",
    supportKind: "official-oss",
    officialSupport:
      "Public docs, SDKs, hosted service, and open-source repositories form a relatively complete product surface.",
    technologySignal:
      "Developer discussion centers on agent memory, preference retention, cross-session recall, and app embedding.",
    fitPosition:
      "A plausible user-memory-layer candidate; governance, retention, and evaluation need separate validation.",
    color: "#8e4a66",
    accent: "#ff9f0a",
    map: { x: 0.62, y: 0.42 },
    scores: {
      ...full,
      episodic: 0.86,
      semanticRetrieval: 0.82,
      graphMemory: 0.46,
      timelineProof: 0.48,
      wikiCorpus: 0.34,
      multimodalGrounding: 0.36,
      reflectionPlanning: 0.78,
      agentHooks: 0.8,
      runtimeState: 0.42,
      evaluationBenchmarks: 0.74,
      contradictionRepair: 0.66,
      governance: 0.58,
      selfHostLan: 0.52,
      officialSurface: 0.9,
      ecosystemSignal: 0.8,
      projectFit: 0.74,
    },
    evidence: [
      {
        label: "SDK/API surface",
        strength: "Strong",
        detail: "APIs, SDKs, and hosted entry points reduce product integration cost.",
      },
      {
        label: "Retention questions",
        strength: "Medium",
        detail: "Deletion, update, conflict, and permission boundaries need separate benchmark checks.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "User memory API benchmark",
        detail: "Validate preference writes, fact updates, recall latency, and cross-session stability.",
      },
    ],
    pairsWith: ["zep-graphiti", "vectorstack", "ragie"],
  },
  {
    slug: "zep-graphiti",
    name: "Zep / Graphiti",
    shortName: "Zep",
    layer: "Temporal Graph Memory",
    summary:
      "Temporal knowledge-graph memory for agents, emphasizing entities, relationships, fact updates, and time context.",
    role: "Entity relations, fact evolution, graph recall, and temporal semantics.",
    supportKind: "official-oss",
    officialSupport:
      "Public product, docs, and open-source route provide a clear temporal graph memory entry point.",
    technologySignal:
      "Technical distribution centers on temporal knowledge graphs, agent memory, and GraphRAG.",
    fitPosition:
      "Well suited to complex fact-change evaluation; weaknesses usually sit in app integration and governance loops.",
    color: "#456b2f",
    accent: "#dd7c48",
    map: { x: 0.48, y: 0.75 },
    scores: {
      ...full,
      episodic: 0.72,
      semanticRetrieval: 0.78,
      graphMemory: 0.91,
      timelineProof: 0.8,
      wikiCorpus: 0.36,
      multimodalGrounding: 0.4,
      reflectionPlanning: 0.76,
      agentHooks: 0.7,
      runtimeState: 0.42,
      evaluationBenchmarks: 0.68,
      contradictionRepair: 0.86,
      governance: 0.56,
      selfHostLan: 0.6,
      officialSurface: 0.82,
      ecosystemSignal: 0.74,
      projectFit: 0.72,
    },
    evidence: [
      {
        label: "Temporal graph",
        strength: "Strong",
        detail: "Graph and time dimensions sit close to the core problem of long-term agent memory.",
      },
      {
        label: "Boundary clarity",
        strength: "Medium",
        detail: "Evaluation must separate fact updates, fact sources, and final adoption strategy.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Contradictory entity benchmark",
        detail: "Observe conflict, correction, and traceability for one entity across multiple sessions.",
      },
    ],
    pairsWith: ["mem0", "letta", "llamaindex"],
  },
  {
    slug: "supermemory",
    name: "Supermemory",
    shortName: "Supermemory",
    layer: "Personal Memory API",
    summary:
      "A memory API for applications and personal sources, emphasizing cross-source ingestion, search, and context injection.",
    role: "Personal memory, source connections, context retrieval, and application integration.",
    supportKind: "official-cloud",
    officialSupport:
      "Public product entry and API positioning are clear, making it useful for application-level memory evaluation.",
    technologySignal:
      "Discussion focuses on personal memory, search, source connections, and AI application context layers.",
    fitPosition:
      "A candidate for end-user memory experience; source authorization and recall explanation need attention.",
    color: "#7a4e9b",
    accent: "#73a942",
    map: { x: 0.73, y: 0.49 },
    scores: {
      ...full,
      episodic: 0.78,
      semanticRetrieval: 0.8,
      graphMemory: 0.38,
      timelineProof: 0.46,
      wikiCorpus: 0.58,
      multimodalGrounding: 0.56,
      reflectionPlanning: 0.66,
      agentHooks: 0.72,
      runtimeState: 0.42,
      evaluationBenchmarks: 0.58,
      contradictionRepair: 0.54,
      governance: 0.6,
      selfHostLan: 0.24,
      officialSurface: 0.82,
      ecosystemSignal: 0.62,
      projectFit: 0.7,
    },
    evidence: [
      {
        label: "User context",
        strength: "Strong",
        detail: "Product positioning is directly aimed at personal context and application-side memory.",
      },
      {
        label: "Explainability",
        strength: "Medium",
        detail: "Recall sources and user control need explicit benchmark checks.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Personal source recall",
        detail: "Test accuracy and explainability after multi-source material enters model context.",
      },
    ],
    pairsWith: ["mem0", "vectorstack", "llamaindex"],
  },
  {
    slug: "letta",
    name: "Letta",
    shortName: "Letta",
    layer: "Stateful Agent Runtime",
    summary:
      "An agent runtime and framework route around stateful agents and memory blocks.",
    role: "Agent state, tool calls, memory context, and runtime orchestration.",
    supportKind: "official-oss",
    officialSupport:
      "Open-source project, docs, and framework route provide a clear product surface for stateful agents.",
    technologySignal:
      "Technical distribution concentrates on stateful agents, tool use, memory blocks, and agent runtime.",
    fitPosition:
      "Useful for evaluating how agents manage long-term state; it should not be collapsed into pure retrieval layers.",
    color: "#5f5a1f",
    accent: "#b7557b",
    map: { x: 0.8, y: 0.68 },
    scores: {
      ...full,
      episodic: 0.72,
      semanticRetrieval: 0.56,
      graphMemory: 0.36,
      timelineProof: 0.42,
      wikiCorpus: 0.3,
      multimodalGrounding: 0.34,
      reflectionPlanning: 0.84,
      agentHooks: 0.84,
      runtimeState: 0.78,
      evaluationBenchmarks: 0.58,
      contradictionRepair: 0.54,
      governance: 0.5,
      selfHostLan: 0.62,
      officialSurface: 0.8,
      ecosystemSignal: 0.7,
      projectFit: 0.66,
    },
    evidence: [
      {
        label: "Runtime signal",
        strength: "Strong",
        detail: "State management for stateful agents is a clear differentiating capability.",
      },
      {
        label: "Operational scope",
        strength: "Medium",
        detail: "Introducing runtime expands the engineering surface and needs separate evaluation from existing app boundaries.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Stateful agent scenario",
        detail: "Evaluate tradeoffs across long-term goals, tool state, and user preferences.",
      },
    ],
    pairsWith: ["zep-graphiti", "mem0", "langmem"],
  },
  {
    slug: "langmem",
    name: "LangMem / LangGraph",
    shortName: "LangMem",
    layer: "Framework Memory",
    summary:
      "State, checkpoints, memory helpers, and workflow orchestration within the LangChain and LangGraph ecosystem.",
    role: "Framework-level state, workflow memory, checkpoints, and agent orchestration.",
    supportKind: "framework",
    officialSupport:
      "Backed by the official LangChain and LangGraph ecosystem, docs, and developer workflows.",
    technologySignal:
      "Tutorials, templates, and engineering examples make it easy to connect general agent workflows.",
    fitPosition:
      "Fits existing agent workflows; standalone long-term memory needs external components.",
    color: "#2d6372",
    accent: "#d2a642",
    map: { x: 0.88, y: 0.55 },
    scores: {
      ...full,
      episodic: 0.62,
      semanticRetrieval: 0.66,
      graphMemory: 0.42,
      timelineProof: 0.46,
      wikiCorpus: 0.34,
      multimodalGrounding: 0.4,
      reflectionPlanning: 0.72,
      agentHooks: 0.86,
      runtimeState: 0.8,
      evaluationBenchmarks: 0.72,
      contradictionRepair: 0.5,
      governance: 0.46,
      selfHostLan: 0.6,
      officialSurface: 0.84,
      ecosystemSignal: 0.86,
      projectFit: 0.64,
    },
    evidence: [
      {
        label: "Framework adoption",
        strength: "Strong",
        detail: "The ecosystem has many examples and a clear integration path.",
      },
      {
        label: "Memory depth",
        strength: "Medium",
        detail: "It reads more like workflow capability and needs composition with graph, retrieval, and governance layers.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Workflow checkpoint benchmark",
        detail: "Test state recovery, branching, and replay in multi-step agent tasks.",
      },
    ],
    pairsWith: ["letta", "mem0", "vectorstack"],
  },
  {
    slug: "llamaindex",
    name: "LlamaIndex Memory",
    shortName: "LlamaIndex",
    layer: "RAG + Agent Memory",
    summary:
      "A knowledge-application framework around indexing, retrieval, agent tools, and context orchestration.",
    role: "Document indexing, retrieval augmentation, agent tools, and context construction.",
    supportKind: "framework",
    officialSupport:
      "Public framework, docs, and ecosystem components cover the main entry points for knowledge-app development.",
    technologySignal:
      "Developer materials are extensive and commonly used for RAG, agentic retrieval, and knowledge-base apps.",
    fitPosition:
      "Works as a knowledge-application orchestration layer; long-term memory governance and user memory still need separate design.",
    color: "#354f9a",
    accent: "#d26945",
    map: { x: 0.32, y: 0.56 },
    scores: {
      ...full,
      episodic: 0.38,
      semanticRetrieval: 0.88,
      graphMemory: 0.54,
      timelineProof: 0.5,
      wikiCorpus: 0.78,
      multimodalGrounding: 0.68,
      reflectionPlanning: 0.56,
      agentHooks: 0.74,
      runtimeState: 0.52,
      evaluationBenchmarks: 0.68,
      contradictionRepair: 0.48,
      governance: 0.5,
      selfHostLan: 0.7,
      officialSurface: 0.86,
      ecosystemSignal: 0.88,
      projectFit: 0.66,
    },
    evidence: [
      {
        label: "RAG maturity",
        strength: "Strong",
        detail: "Indexing, retrieval, and agent-tool paths are mature.",
      },
      {
        label: "Long memory gap",
        strength: "Medium",
        detail: "Long-term fact updates, user memory, and governance strategy need external evaluation.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Corpus-grounded recall",
        detail: "Evaluate document indexing, retrieval accuracy, and multi-hop citation completeness.",
      },
    ],
    pairsWith: ["zep-graphiti", "mem0", "cognee"],
  },
  {
    slug: "cognee",
    name: "Cognee",
    shortName: "Cognee",
    layer: "Knowledge Pipeline",
    summary:
      "Combines documents, graphs, retrieval, and AI memory pipelines into an orchestrated knowledge-processing chain.",
    role: "Document ingestion, knowledge graphs, RAG pipelines, and data orchestration.",
    supportKind: "official-oss",
    officialSupport:
      "Open-source project, docs, and AI memory/RAG positioning provide a strong research entry point.",
    technologySignal:
      "Technical conversation centers on AI memory, GraphRAG, and data pipelines.",
    fitPosition:
      "Useful for document ingestion and graph generation; final memory strategy still needs benchmark judgment.",
    color: "#9a5b1f",
    accent: "#2d8fb8",
    map: { x: 0.18, y: 0.72 },
    scores: {
      ...full,
      episodic: 0.45,
      semanticRetrieval: 0.76,
      graphMemory: 0.78,
      timelineProof: 0.54,
      wikiCorpus: 0.7,
      multimodalGrounding: 0.64,
      reflectionPlanning: 0.58,
      agentHooks: 0.6,
      runtimeState: 0.36,
      evaluationBenchmarks: 0.62,
      contradictionRepair: 0.58,
      governance: 0.52,
      selfHostLan: 0.64,
      officialSurface: 0.78,
      ecosystemSignal: 0.64,
      projectFit: 0.62,
    },
    evidence: [
      {
        label: "Pipeline fit",
        strength: "Medium",
        detail: "The document-to-graph automation path deserves separate evaluation.",
      },
      {
        label: "Governance need",
        strength: "Medium",
        detail: "Automated ingestion needs source, version, and update-policy constraints.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Ingestion-to-graph benchmark",
        detail: "Observe entity accuracy, relationship noise, and update cost after document ingestion.",
      },
    ],
    pairsWith: ["llamaindex", "zep-graphiti", "vectorstack"],
  },
  {
    slug: "vectorstack",
    name: "Vector Database Stack",
    shortName: "Vector DB",
    layer: "Retrieval Substrate",
    summary:
      "A vector retrieval substrate represented by Qdrant, Weaviate, Pinecone, and similar systems for semantic recall and RAG indexing.",
    role: "Vector indexing, hybrid retrieval, recall layer, and infrastructure.",
    supportKind: "infrastructure",
    officialSupport:
      "Multiple mature products and open-source projects provide stable retrieval-infrastructure options.",
    technologySignal:
      "Engineering material is rich, but most of it focuses on retrieval performance rather than complete memory behavior.",
    fitPosition:
      "Useful as a lower-level retrieval component; it cannot alone represent a long-term memory system.",
    color: "#2d6f6a",
    accent: "#c8842e",
    map: { x: 0.35, y: 0.38 },
    scores: {
      ...full,
      episodic: 0.14,
      semanticRetrieval: 0.96,
      graphMemory: 0.28,
      timelineProof: 0.18,
      wikiCorpus: 0.42,
      multimodalGrounding: 0.5,
      reflectionPlanning: 0.22,
      agentHooks: 0.5,
      runtimeState: 0.32,
      evaluationBenchmarks: 0.68,
      contradictionRepair: 0.34,
      governance: 0.42,
      selfHostLan: 0.72,
      officialSurface: 0.88,
      ecosystemSignal: 0.82,
      projectFit: 0.44,
    },
    evidence: [
      {
        label: "Retrieval maturity",
        strength: "Strong",
        detail: "Vector retrieval has high product maturity and substitutability.",
      },
      {
        label: "Memory mismatch",
        strength: "Strong",
        detail: "It solves the recall substrate, not fact evolution or policy governance.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Retrieval substrate benchmark",
        detail: "Evaluate recall precision, latency, filtering, reranking, and multi-tenant boundaries.",
      },
    ],
    pairsWith: ["mem0", "llamaindex", "cognee"],
  },
  {
    slug: "openmemory",
    name: "OpenMemory-style Local Stores",
    shortName: "OpenMemory",
    layer: "Open Local Memory",
    summary:
      "An open local-memory storage route emphasizing user control, private deployment, and cross-application reads.",
    role: "Local memory, privacy control, open storage, and cross-application context.",
    supportKind: "plugin",
    officialSupport:
      "The public ecosystem is still forming, making it suitable for privacy and portability watchlist evaluation.",
    technologySignal:
      "Developer discussion focuses on local-first behavior, MCP memory, cross-tool memory, and data portability.",
    fitPosition:
      "Fits privacy-sensitive scenarios; product maturity, migration, and permission models need focused validation.",
    color: "#245f4f",
    accent: "#ec9f3e",
    map: { x: 0.22, y: 0.25 },
    scores: {
      ...full,
      episodic: 0.68,
      semanticRetrieval: 0.64,
      graphMemory: 0.42,
      timelineProof: 0.54,
      wikiCorpus: 0.62,
      multimodalGrounding: 0.46,
      reflectionPlanning: 0.58,
      agentHooks: 0.68,
      runtimeState: 0.54,
      evaluationBenchmarks: 0.42,
      contradictionRepair: 0.46,
      governance: 0.72,
      selfHostLan: 0.88,
      officialSurface: 0.44,
      ecosystemSignal: 0.52,
      projectFit: 0.7,
    },
    evidence: [
      {
        label: "Privacy posture",
        strength: "Medium",
        detail: "The local-first route is friendlier to privacy and data sovereignty.",
      },
      {
        label: "Maturity watch",
        strength: "Watch",
        detail: "Implementation maturity varies widely and must be retested by project.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Local-first memory review",
        detail: "Compare local storage, sync, permissions, and cross-tool read boundaries.",
      },
    ],
    pairsWith: ["letta", "langmem", "vectorstack"],
  },
  {
    slug: "ragie",
    name: "Ragie / Managed RAG",
    shortName: "Managed RAG",
    layer: "Managed Retrieval",
    summary:
      "Managed RAG and document-ingestion services for quickly turning company or application material into retrievable context.",
    role: "Document ingestion, managed retrieval, connectors, and context APIs.",
    supportKind: "official-cloud",
    officialSupport:
      "Managed product entry points are useful for quickly validating material ingestion and retrieval quality.",
    technologySignal:
      "Engineering discussion centers on connectors, document processing, RAG APIs, and launch speed.",
    fitPosition:
      "Useful for evaluating launch speed; long-term memory, conflict repair, and user-level policy need external composition.",
    color: "#b7553e",
    accent: "#0f8b75",
    map: { x: 0.42, y: 0.6 },
    scores: {
      ...full,
      episodic: 0.24,
      semanticRetrieval: 0.84,
      graphMemory: 0.32,
      timelineProof: 0.4,
      wikiCorpus: 0.72,
      multimodalGrounding: 0.66,
      reflectionPlanning: 0.32,
      agentHooks: 0.62,
      runtimeState: 0.38,
      evaluationBenchmarks: 0.56,
      contradictionRepair: 0.36,
      governance: 0.54,
      selfHostLan: 0.22,
      officialSurface: 0.8,
      ecosystemSignal: 0.56,
      projectFit: 0.5,
    },
    evidence: [
      {
        label: "Managed speed",
        strength: "Medium",
        detail: "Managed ingestion and retrieval are suitable for fast pilots.",
      },
      {
        label: "Memory depth",
        strength: "Weak",
        detail: "Complete long-term memory capability usually needs additional orchestration and governance layers.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Managed ingestion run",
        detail: "Evaluate latency, accuracy, and cost from document upload to usable context.",
      },
    ],
    pairsWith: ["mem0", "llamaindex", "vectorstack"],
  },
  {
    slug: "haystack",
    name: "Haystack",
    shortName: "Haystack",
    layer: "Search + RAG Framework",
    summary:
      "An open-source framework for building search, RAG, and QA pipelines, useful as a retrieval-workflow comparator.",
    role: "Retrieval pipelines, RAG flow, component orchestration, and evaluation samples.",
    supportKind: "framework",
    officialSupport:
      "Public docs, component ecosystem, and open-source route provide a mature retrieval-engineering foundation.",
    technologySignal:
      "Developer material centers on search, RAG, document pipelines, and evaluation.",
    fitPosition:
      "Useful for evaluating retrieval-pipeline quality; it is not a user-level long-term memory product.",
    color: "#7a5a12",
    accent: "#1a8172",
    map: { x: 0.54, y: 0.29 },
    scores: {
      ...full,
      episodic: 0.18,
      semanticRetrieval: 0.82,
      graphMemory: 0.28,
      timelineProof: 0.34,
      wikiCorpus: 0.64,
      multimodalGrounding: 0.52,
      reflectionPlanning: 0.28,
      agentHooks: 0.58,
      runtimeState: 0.4,
      evaluationBenchmarks: 0.7,
      contradictionRepair: 0.32,
      governance: 0.46,
      selfHostLan: 0.7,
      officialSurface: 0.78,
      ecosystemSignal: 0.74,
      projectFit: 0.46,
    },
    evidence: [
      {
        label: "Pipeline maturity",
        strength: "Medium",
        detail: "Retrieval workflow and componentization are suitable engineering comparators.",
      },
      {
        label: "Category boundary",
        strength: "Strong",
        detail: "The boundary between RAG pipelines and long-term memory products must stay explicit.",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "RAG pipeline comparison",
        detail: "Compare retrieval, reranking, citation, and response consistency on one dataset.",
      },
    ],
    pairsWith: ["vectorstack", "llamaindex", "cognee"],
  },
];
