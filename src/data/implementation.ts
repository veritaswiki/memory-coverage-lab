import type { MemoryProject } from "./projects";

export type ImplementationPhase =
  | "production"
  | "hardening"
  | "evaluating"
  | "watchlist"
  | "deferred";

export type RiskLevel = "low" | "medium" | "high";

export interface ImplementationUpdate {
  date: string;
  title: string;
  detail: string;
}

export type WorkflowStageState = "done" | "current" | "queued" | "watch";

export interface WorkflowStage {
  key: "plan" | "review" | "qa" | "ship" | "learn";
  label: string;
  title: string;
  state: WorkflowStageState;
}

export interface ProjectImplementation {
  phase: ImplementationPhase;
  phaseLabel: string;
  lane: string;
  progress: number;
  owner: string;
  lastUpdated: string;
  nextMilestone: string;
  riskLevel: RiskLevel;
  risk: string;
  updates: ImplementationUpdate[];
}

export const phaseLabels: Record<ImplementationPhase, string> = {
  production: "Published",
  hardening: "Retesting",
  evaluating: "Evaluating",
  watchlist: "Watchlist",
  deferred: "Deferred",
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "Low uncertainty",
  medium: "Medium uncertainty",
  high: "High uncertainty",
};

const workflowTemplates: Omit<WorkflowStage, "state">[] = [
  {
    key: "plan",
    label: "Plan",
    title: "Define category boundaries and sample scope",
  },
  {
    key: "review",
    label: "Review",
    title: "Review public evidence and counterexamples",
  },
  {
    key: "qa",
    label: "QA",
    title: "Retest capability, conflict, and governance scenarios",
  },
  {
    key: "ship",
    label: "Ship",
    title: "Publish scorecards with uncertainty notes",
  },
  {
    key: "learn",
    label: "Learn",
    title: "Track changes, regressions, and next questions",
  },
];

const workflowStates: Record<ImplementationPhase, WorkflowStageState[]> = {
  production: ["done", "done", "done", "done", "current"],
  hardening: ["done", "done", "current", "queued", "queued"],
  evaluating: ["done", "current", "queued", "queued", "queued"],
  watchlist: ["current", "queued", "queued", "queued", "watch"],
  deferred: ["queued", "queued", "queued", "queued", "watch"],
};

const projectImplementations: Record<string, ProjectImplementation> = {
  mem0: {
    phase: "hardening",
    phaseLabel: phaseLabels.hardening,
    lane: "User memory API",
    progress: 72,
    owner: "Benchmark desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Complete deletion, conflict repair, and cross-session recall retests.",
    riskLevel: "medium",
    risk: "Hosted memory API retention, permissions, and update policies need line-by-line validation.",
    updates: [
      {
        date: "2026-05-22",
        title: "Added to the public memory API sample",
        detail: "Rescored across user memory, SDK access, recall, and governance capability groups.",
      },
      {
        date: "2026-05-22",
        title: "Repositioned from adoption advice to third-party observation",
        detail: "The page shows objective benchmark dimensions without implying a default technical route.",
      },
    ],
  },
  "zep-graphiti": {
    phase: "hardening",
    phaseLabel: phaseLabels.hardening,
    lane: "Temporal graph",
    progress: 68,
    owner: "Graph benchmark",
    lastUpdated: "2026-05-22",
    nextMilestone: "Retest temporal graph quality with conflicting facts and time-update samples.",
    riskLevel: "medium",
    risk: "Graph performance is strong, but source boundaries, update strategy, and application loops still need validation.",
    updates: [
      {
        date: "2026-05-22",
        title: "Classified under temporal graph memory",
        detail: "Uses entities, relationships, time, and contradiction repair as the primary evaluation lens.",
      },
    ],
  },
  supermemory: {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "Personal context",
    progress: 56,
    owner: "Source recall desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Design tests for multi-source authorization, recall explanation, and user control.",
    riskLevel: "medium",
    risk: "More personal sources increase the need to verify authorization, deletion, and explainable recall.",
    updates: [
      {
        date: "2026-05-22",
        title: "Added a personal memory API sample",
        detail: "Entered the comparison through end-user context and source-connection behavior.",
      },
    ],
  },
  letta: {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "Stateful agent",
    progress: 54,
    owner: "Runtime benchmark",
    lastUpdated: "2026-05-22",
    nextMilestone: "Validate how memory blocks manage long-term goals, tool state, and preferences.",
    riskLevel: "high",
    risk: "Agent runtime expands the adoption surface and should not be treated as a direct retrieval-component substitute.",
    updates: [
      {
        date: "2026-05-22",
        title: "Regrouped from the runtime perspective",
        detail: "Emphasizes stateful agent capability rather than treating it as a pure memory API.",
      },
    ],
  },
  langmem: {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "Workflow memory",
    progress: 58,
    owner: "Framework desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Retest checkpoints, recovery, branching, and context injection with multi-step tasks.",
    riskLevel: "medium",
    risk: "The framework ecosystem is strong, but long-term fact storage and governance need external composition.",
    updates: [
      {
        date: "2026-05-22",
        title: "Published as a framework-memory baseline",
        detail: "Used to measure workflow memory rather than a complete long-term memory platform.",
      },
    ],
  },
  llamaindex: {
    phase: "hardening",
    phaseLabel: phaseLabels.hardening,
    lane: "RAG memory",
    progress: 64,
    owner: "Grounding desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Add retests for multi-hop citation, document updates, and agent-tool reads.",
    riskLevel: "medium",
    risk: "RAG capability is mature, but user-level long-term memory and conflict repair are not default strengths.",
    updates: [
      {
        date: "2026-05-22",
        title: "Added to the knowledge-application orchestration sample",
        detail: "Presented through indexing, recall, citation, and agent-tool dimensions.",
      },
    ],
  },
  cognee: {
    phase: "watchlist",
    phaseLabel: phaseLabels.watchlist,
    lane: "Knowledge pipeline",
    progress: 42,
    owner: "Ingestion desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Evaluate entity accuracy and relationship noise from document ingestion to graph output.",
    riskLevel: "medium",
    risk: "Automated pipelines can amplify source errors and need version and source constraints.",
    updates: [
      {
        date: "2026-05-22",
        title: "Kept in the knowledge-pipeline watch group",
        detail: "Focuses on ingestion, graph generation, and reusable pipeline behavior.",
      },
    ],
  },
  vectorstack: {
    phase: "production",
    phaseLabel: phaseLabels.production,
    lane: "Retrieval substrate",
    progress: 76,
    owner: "Infrastructure desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Publish vector database evaluation separately from full memory-system evaluation.",
    riskLevel: "low",
    risk: "The category boundary is clear: retrieval substrate maturity does not imply a complete memory product.",
    updates: [
      {
        date: "2026-05-22",
        title: "Published as an infrastructure baseline",
        detail: "Calibrates semantic retrieval without endorsing long-term memory completeness.",
      },
    ],
  },
  openmemory: {
    phase: "watchlist",
    phaseLabel: phaseLabels.watchlist,
    lane: "Local-first memory",
    progress: 38,
    owner: "Privacy desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Compare local storage, sync, permissions, and cross-application read paths.",
    riskLevel: "high",
    risk: "Open implementations vary widely, so one result should not be generalized to the full route.",
    updates: [
      {
        date: "2026-05-22",
        title: "Added a local-first observation lane",
        detail: "Treated as a research object for privacy, portability, and open storage.",
      },
    ],
  },
  ragie: {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "Managed RAG",
    progress: 46,
    owner: "Managed retrieval desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Retest document-ingestion latency, connector stability, and citation accuracy.",
    riskLevel: "medium",
    risk: "Launch speed can hide shallow long-term memory depth, so the category needs separate labeling.",
    updates: [
      {
        date: "2026-05-22",
        title: "Added a managed retrieval-service sample",
        detail: "Used as a boundary comparison between managed RAG and memory API routes.",
      },
    ],
  },
  haystack: {
    phase: "production",
    phaseLabel: phaseLabels.production,
    lane: "RAG framework",
    progress: 66,
    owner: "Pipeline desk",
    lastUpdated: "2026-05-22",
    nextMilestone: "Publish the capability boundary between RAG pipelines and long-term memory.",
    riskLevel: "low",
    risk: "The framework position is clear; the main risk is being misread as a complete memory platform.",
    updates: [
      {
        date: "2026-05-22",
        title: "Published as a retrieval-pipeline baseline",
        detail: "Used to measure pipeline maturity and RAG engineering quality.",
      },
    ],
  },
} satisfies Record<string, ProjectImplementation>;

const fallbackImplementation: ProjectImplementation = {
  phase: "deferred",
  phaseLabel: phaseLabels.deferred,
  lane: "Untracked",
  progress: 0,
  owner: "Research desk",
  lastUpdated: "Unregistered",
  nextMilestone: "Add public sources, a retest plan, and category boundaries.",
  riskLevel: "high",
  risk: "No research record exists, so benchmark status cannot be judged.",
  updates: [],
};

export function getProjectImplementation(slug: string): ProjectImplementation {
  return projectImplementations[slug] ?? fallbackImplementation;
}

export function getProjectWorkflow(slug: string): WorkflowStage[] {
  const implementation = getProjectImplementation(slug);
  const states = workflowStates[implementation.phase];

  return workflowTemplates.map((stage, index) => ({
    ...stage,
    state: states[index] ?? "queued",
  }));
}

export function getImplementationStats(projects: MemoryProject[]) {
  const implementations = projects.map((project) =>
    getProjectImplementation(project.slug),
  );

  const averageProgress =
    implementations.length === 0
      ? 0
      : Math.round(
          implementations.reduce(
            (total, implementation) => total + implementation.progress,
            0,
          ) / implementations.length,
        );

  return {
    averageProgress,
    production: implementations.filter(
      (implementation) => implementation.phase === "production",
    ).length,
    active: implementations.filter((implementation) =>
      ["production", "hardening"].includes(implementation.phase),
    ).length,
    evaluating: implementations.filter(
      (implementation) => implementation.phase === "evaluating",
    ).length,
    highRisk: implementations.filter(
      (implementation) => implementation.riskLevel === "high",
    ).length,
  };
}
