import type { CapabilityScores } from "./capabilities";

export type SupportKind =
  | "official-cloud"
  | "official-oss"
  | "plugin"
  | "framework"
  | "infrastructure";

export interface EvidenceSignal {
  label: string;
  strength: "强" | "中" | "弱" | "观察";
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
      "面向 AI 应用的长期用户记忆 API/SDK，覆盖写入、抽取、检索和应用集成。",
    role: "产品化 memory API、用户级长期记忆、应用侧召回。",
    supportKind: "official-oss",
    officialSupport:
      "公开文档、SDK、托管服务和开源仓库形成较完整的产品入口。",
    technologySignal:
      "开发者讨论集中在 agent memory、用户偏好留存、跨会话召回和应用嵌入。",
    fitPosition:
      "适合作为用户记忆层候选；治理、留存和评测需要单独验证。",
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
        strength: "强",
        detail: "API、SDK 与托管入口降低了产品接入成本。",
      },
      {
        label: "Retention questions",
        strength: "中",
        detail: "需要在评测中单独检查删除、更新、冲突和权限边界。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "User memory API benchmark",
        detail: "验证偏好写入、事实更新、召回延迟和跨会话稳定性。",
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
      "面向 Agent 的时序知识图谱记忆，强调实体、关系、事实更新和时间上下文。",
    role: "实体关系、事实演化、图谱召回、时间语义。",
    supportKind: "official-oss",
    officialSupport:
      "公开产品、文档和开源路线提供 temporal graph memory 的明确入口。",
    technologySignal:
      "技术传播围绕 temporal knowledge graph、Agent memory 和 GraphRAG。",
    fitPosition:
      "适合评测复杂事实变化；弱点通常在应用侧集成和治理闭环。",
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
        strength: "强",
        detail: "图谱和时间维度贴近长期 Agent memory 的核心问题。",
      },
      {
        label: "Boundary clarity",
        strength: "中",
        detail: "评测需要区分事实更新、事实来源和最终采用策略。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Contradictory entity benchmark",
        detail: "观察同一实体在多轮会话中的冲突、修正和可追溯性。",
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
      "面向应用与个人资料源的记忆 API，强调跨来源数据摄取、搜索和上下文注入。",
    role: "个人记忆、资料源连接、上下文检索、应用集成。",
    supportKind: "official-cloud",
    officialSupport:
      "公开产品入口和 API 定位清晰，适合评估应用级记忆体验。",
    technologySignal:
      "讨论多集中在个人记忆、搜索、资料源连接和 AI 应用上下文层。",
    fitPosition:
      "适合作为端用户记忆体验候选；需要关注数据来源授权和召回解释。",
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
        strength: "强",
        detail: "产品定位直接面向个人上下文与应用侧记忆。",
      },
      {
        label: "Explainability",
        strength: "中",
        detail: "需要在 benchmark 中检查召回来源和用户可控性。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Personal source recall",
        detail: "测试多来源资料进入模型上下文后的准确率和可解释性。",
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
      "围绕 stateful agent 和 memory blocks 的 Agent runtime / framework 路线。",
    role: "Agent 状态、工具调用、记忆上下文、运行时编排。",
    supportKind: "official-oss",
    officialSupport:
      "开源项目、文档和框架路线为 stateful agent 提供明确产品面。",
    technologySignal:
      "技术传播集中在 stateful agents、tool use、memory blocks 和 agent runtime。",
    fitPosition:
      "适合评测 Agent 如何管理自己的长期状态；不应和纯检索层混为一类。",
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
        strength: "强",
        detail: "stateful agent 的状态管理是清晰差异化能力。",
      },
      {
        label: "Operational scope",
        strength: "中",
        detail: "引入 runtime 会扩大工程面，需要和现有应用边界分开评估。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Stateful agent scenario",
        detail: "评测 Agent 在长期目标、工具状态和用户偏好之间的取舍。",
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
      "LangChain/LangGraph 生态下的状态、checkpoint、memory helper 与工作流编排。",
    role: "框架级状态、workflow memory、checkpoint、agent orchestration。",
    supportKind: "framework",
    officialSupport:
      "依托 LangChain/LangGraph 官方生态、文档和开发者工作流。",
    technologySignal:
      "教程、模板和工程案例丰富，便于快速对接通用 Agent workflow。",
    fitPosition:
      "适合在既有 agent workflow 中落地；独立长期记忆能力需要外部组件补齐。",
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
        strength: "强",
        detail: "生态案例多，接入路径清晰。",
      },
      {
        label: "Memory depth",
        strength: "中",
        detail: "更像 workflow 能力，需要与图谱、检索和治理层组合。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Workflow checkpoint benchmark",
        detail: "测试多步骤 Agent 任务中的状态恢复、分支和回放能力。",
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
      "围绕索引、检索、Agent 工具和上下文编排的知识应用框架。",
    role: "文档索引、检索增强、agent tools、上下文构建。",
    supportKind: "framework",
    officialSupport:
      "公开框架、文档和生态组件覆盖知识应用开发的主要入口。",
    technologySignal:
      "开发者材料丰富，常用于 RAG、agentic retrieval 和知识库应用。",
    fitPosition:
      "适合作为知识应用编排层；长期记忆治理与用户记忆仍需独立设计。",
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
        strength: "强",
        detail: "索引、检索和 agent tool 链路成熟度高。",
      },
      {
        label: "Long memory gap",
        strength: "中",
        detail: "长期事实更新、用户记忆和治理策略需要外部评估。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Corpus-grounded recall",
        detail: "评测文档索引、检索准确率和多跳引用完整性。",
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
      "把文档、图谱、检索和 AI 记忆管道整合成可编排的知识处理链。",
    role: "文档摄取、知识图谱、RAG 管道、数据编排。",
    supportKind: "official-oss",
    officialSupport:
      "开源项目、文档和 AI memory/RAG 定位提供较强研究入口。",
    technologySignal:
      "技术交流主要围绕 AI memory、GraphRAG 和 data pipeline。",
    fitPosition:
      "适合补强文档摄取和图谱生成；最终记忆策略仍需 benchmark 判定。",
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
        strength: "中",
        detail: "文档到图谱的自动化路径适合单独评测。",
      },
      {
        label: "Governance need",
        strength: "中",
        detail: "自动摄取需要来源、版本和更新策略约束。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Ingestion-to-graph benchmark",
        detail: "观察文档摄取后的实体准确率、关系噪声和更新成本。",
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
      "以 Qdrant、Weaviate、Pinecone 等为代表的向量检索底座，用于语义召回和 RAG 索引。",
    role: "向量索引、混合检索、召回层、基础设施。",
    supportKind: "infrastructure",
    officialSupport:
      "多个成熟产品和开源项目提供稳定的检索基础设施选择。",
    technologySignal:
      "工程资料丰富，但多数关注检索性能而不是完整记忆行为。",
    fitPosition:
      "适合作为底层检索组件；不能单独代表长期记忆系统。",
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
        strength: "强",
        detail: "向量检索的产品成熟度和可替换性较高。",
      },
      {
        label: "Memory mismatch",
        strength: "强",
        detail: "只解决召回底座，不负责事实演化和策略治理。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Retrieval substrate benchmark",
        detail: "评测召回精度、延迟、过滤、重排和多租户边界。",
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
      "开放式本地记忆存储路线，强调用户可控、私有化部署和跨应用读取。",
    role: "本地记忆、隐私控制、开放存储、跨应用上下文。",
    supportKind: "plugin",
    officialSupport:
      "公开生态仍在形成，适合放在观察组做隐私和可携带性评测。",
    technologySignal:
      "开发者讨论聚焦本地优先、MCP memory、跨工具记忆和数据可携带性。",
    fitPosition:
      "适合隐私敏感场景；产品成熟度、迁移能力和权限模型要重点验证。",
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
        strength: "中",
        detail: "本地优先路线对隐私和数据主权更友好。",
      },
      {
        label: "Maturity watch",
        strength: "观察",
        detail: "不同实现成熟度差异大，需要按具体项目复测。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Local-first memory review",
        detail: "比较本地存储、同步、权限和跨工具读取边界。",
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
      "托管型 RAG 与文档摄取服务，面向快速把企业或应用资料变成可检索上下文。",
    role: "文档摄取、托管检索、连接器、上下文 API。",
    supportKind: "official-cloud",
    officialSupport:
      "托管产品入口适合快速验证资料摄取和检索效果。",
    technologySignal:
      "工程讨论集中在连接器、文档处理、RAG API 和上线速度。",
    fitPosition:
      "适合评估上线速度；长期记忆、冲突修复和用户级策略需要外部组合。",
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
        strength: "中",
        detail: "托管摄取和检索适合快速试点。",
      },
      {
        label: "Memory depth",
        strength: "弱",
        detail: "完整长期记忆能力通常需要额外编排和治理层。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "Managed ingestion run",
        detail: "评测从文档上传到可用上下文的延迟、准确率和成本。",
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
      "用于构建搜索、RAG 和问答管道的开源框架，适合检索工作流对照。",
    role: "检索管道、RAG flow、组件编排、评测样例。",
    supportKind: "framework",
    officialSupport:
      "公开文档、组件生态和开源路线提供成熟的检索工程基础。",
    technologySignal:
      "开发者资料围绕 search、RAG、document pipelines 和 evaluation。",
    fitPosition:
      "适合评估检索管道质量；不是用户级长期记忆产品。",
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
        strength: "中",
        detail: "检索工作流和组件化能力适合工程对照。",
      },
      {
        label: "Category boundary",
        strength: "强",
        detail: "需要明确区分 RAG pipeline 与长期记忆产品。",
      },
    ],
    cases: [
      {
        when: "2026-Q2",
        title: "RAG pipeline comparison",
        detail: "以同一资料集对比检索、重排、引用和响应一致性。",
      },
    ],
    pairsWith: ["vectorstack", "llamaindex", "cognee"],
  },
];
