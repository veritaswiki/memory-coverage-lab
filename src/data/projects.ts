import type { CapabilityScores } from "./capabilities";

export type SupportKind =
  | "official-cloud"
  | "official-oss"
  | "local-system"
  | "plugin"
  | "framework";

export interface EvidenceSignal {
  label: string;
  strength: "强" | "中" | "弱" | "本地";
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
    slug: "llm-wiki",
    name: "LLM Wiki / Luxos-Vault",
    shortName: "LLM Wiki",
    layer: "Readable Corpus",
    summary:
      "把 Vault 里的长文、报告、proof 和人读知识导出成 LLM 可消费的语料层。",
    role: "人读证据、长文上下文、报告出口、审计入口。",
    supportKind: "local-system",
    officialSupport:
      "本地 Personal AI OS 组件，支持来自 Vault export 脚本与项目约束。",
    technologySignal:
      "外部产品信号较少；价值来自本地 corpus、proof 与 LLM Wiki 导出链路。",
    fitPosition:
      "适合作为所有记忆方案的证据仓与可读输出面。",
    color: "#245f4f",
    accent: "#ec9f3e",
    map: { x: 0.25, y: 0.28 },
    scores: {
      ...full,
      episodic: 0.25,
      semanticRetrieval: 0.38,
      graphMemory: 0.32,
      timelineProof: 0.86,
      wikiCorpus: 0.98,
      multimodalGrounding: 0.82,
      reflectionPlanning: 0.56,
      agentHooks: 0.48,
      runtimeState: 0.34,
      evaluationBenchmarks: 0.54,
      contradictionRepair: 0.58,
      governance: 0.74,
      selfHostLan: 0.88,
      officialSurface: 0.28,
      ecosystemSignal: 0.36,
      projectFit: 0.92,
    },
    evidence: [
      {
        label: "Vault proof",
        strength: "本地",
        detail: "报告、验证记录和 LLM Wiki export 可以保存可读证据。",
      },
      {
        label: "Export routine",
        strength: "本地",
        detail: "本机已有 Personal AI OS LLM Wiki daily export 脚本。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "记忆方案对比报告进入 Vault 与 LLM Wiki",
        detail: "调研报告写入 Luxos-Vault，并触发本地 LLM Wiki 导出。",
      },
    ],
    pairsWith: ["gbrain", "hindsight", "nowledge-mem"],
  },
  {
    slug: "gbrain",
    name: "GBrain",
    shortName: "GBrain",
    layer: "Graph + Proof Spine",
    summary:
      "结构化保存项目事实、source evidence、决策、proof metadata 和 timeline。",
    role: "知识图谱主干、时间线、证明引用、项目事实源。",
    supportKind: "local-system",
    officialSupport:
      "本地 GBrain CLI/MCP 已纳入 Personal AI OS worker contract。",
    technologySignal:
      "主要是本地系统工程信号；对外传播依赖后续公开文档。",
    fitPosition:
      "适合作为项目事实与可审计长期知识的中心。",
    color: "#156c7a",
    accent: "#c8cf3f",
    map: { x: 0.45, y: 0.32 },
    scores: {
      ...full,
      episodic: 0.36,
      semanticRetrieval: 0.72,
      graphMemory: 0.95,
      timelineProof: 0.93,
      wikiCorpus: 0.68,
      multimodalGrounding: 0.54,
      reflectionPlanning: 0.74,
      agentHooks: 0.74,
      runtimeState: 0.68,
      evaluationBenchmarks: 0.62,
      contradictionRepair: 0.78,
      governance: 0.82,
      selfHostLan: 0.86,
      officialSurface: 0.48,
      ecosystemSignal: 0.38,
      projectFit: 0.98,
    },
    evidence: [
      {
        label: "CLI/MCP",
        strength: "本地",
        detail: "支持 query、put、get、timeline-add 等本地工作流。",
      },
      {
        label: "Proof route",
        strength: "本地",
        detail: "AGENTS 约束要求重要事实和验证结果进入 GBrain/Vault。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "对比报告写入 GBrain page + timeline",
        detail: "记忆方案调研被写回 GBrain slug 与 timeline 事件。",
      },
    ],
    pairsWith: ["llm-wiki", "hindsight", "nowledge-mem"],
  },
  {
    slug: "hindsight",
    name: "Hindsight",
    shortName: "Hindsight",
    layer: "Episodic Memory",
    summary:
      "通过共享 API 保存跨会话片段、偏好线索和 Agent 经验回忆。",
    role: "对话记忆、episodic recall、跨机器会话连续性。",
    supportKind: "local-system",
    officialSupport:
      "本地 API 已配置为 shared codex bank，属于 Personal AI OS 内部能力。",
    technologySignal:
      "公开生态信号有限；实际价值来自本地多 Agent 使用链路。",
    fitPosition:
      "适合作为对话层记忆，与 GBrain 的结构化 proof 层互补。",
    color: "#b7553e",
    accent: "#0f8b75",
    map: { x: 0.65, y: 0.24 },
    scores: {
      ...full,
      episodic: 0.96,
      semanticRetrieval: 0.62,
      graphMemory: 0.22,
      timelineProof: 0.42,
      wikiCorpus: 0.2,
      multimodalGrounding: 0.28,
      reflectionPlanning: 0.7,
      agentHooks: 0.72,
      runtimeState: 0.4,
      evaluationBenchmarks: 0.44,
      contradictionRepair: 0.52,
      governance: 0.58,
      selfHostLan: 0.82,
      officialSurface: 0.34,
      ecosystemSignal: 0.28,
      projectFit: 0.9,
    },
    evidence: [
      {
        label: "Shared bank",
        strength: "本地",
        detail: "Codex bank 可作为跨会话 episodic memory 层。",
      },
      {
        label: "API health",
        strength: "本地",
        detail: "当前 worker contract 标记 Hindsight 可用。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "Codex 会话通过 Hindsight 保持 episodic recall",
        detail: "会话记忆归 Hindsight，项目事实归 GBrain/Vault。",
      },
    ],
    pairsWith: ["gbrain", "llm-wiki", "nowledge-mem"],
  },
  {
    slug: "nowledge-mem",
    name: "Nowledge Mem",
    shortName: "Nowledge Mem",
    layer: "Cross-tool Memory",
    summary:
      "跨工具个人知识图谱与工作记忆插件，面向 Codex 会话读取和沉淀上下文。",
    role: "working memory、thread search、memory search、跨工具 recall。",
    supportKind: "plugin",
    officialSupport:
      "当前 Codex 环境已启用 Nowledge Mem 插件与 memory/search/status skills。",
    technologySignal:
      "属于插件生态能力；公开博客信号取决于插件作者社区传播。",
    fitPosition:
      "适合作为 Agent 入口层的轻量 recall 和跨会话工作记忆。",
    color: "#7a5a12",
    accent: "#1a8172",
    map: { x: 0.78, y: 0.43 },
    scores: {
      ...full,
      episodic: 0.78,
      semanticRetrieval: 0.72,
      graphMemory: 0.64,
      timelineProof: 0.5,
      wikiCorpus: 0.46,
      multimodalGrounding: 0.42,
      reflectionPlanning: 0.72,
      agentHooks: 0.92,
      runtimeState: 0.62,
      evaluationBenchmarks: 0.58,
      contradictionRepair: 0.58,
      governance: 0.64,
      selfHostLan: 0.58,
      officialSurface: 0.58,
      ecosystemSignal: 0.46,
      projectFit: 0.86,
    },
    evidence: [
      {
        label: "Codex plugin",
        strength: "本地",
        detail: "环境中可用 working-memory、search-memory、save-thread skills。",
      },
      {
        label: "Cross-tool KG",
        strength: "中",
        detail: "工具描述定位为跨 AI 工具个人知识图谱与语义搜索。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "会话启动读取 working memory",
        detail: "适合在 Codex 入口侧加载当前优先级与近期决策。",
      },
    ],
    pairsWith: ["gbrain", "hindsight", "llm-wiki"],
  },
  {
    slug: "vikingdb",
    name: "VikingDB / OpenViking",
    shortName: "VikingDB",
    layer: "Vector Substrate",
    summary:
      "向量数据库和检索底座，适合承载语义召回、embedding 索引与 RAG 检索。",
    role: "高性能向量索引、召回层、检索基础设施。",
    supportKind: "official-cloud",
    officialSupport:
      "VikingDB 属于官方云产品面；OpenViking 提供开源向量数据库路线。",
    technologySignal:
      "技术交流集中在向量数据库、RAG、云服务和开源仓库使用场景。",
    fitPosition:
      "适合作为底层检索组件，需要上层记忆治理、事件模型和项目事实层配合。",
    color: "#354f9a",
    accent: "#d26945",
    map: { x: 0.34, y: 0.56 },
    scores: {
      ...full,
      episodic: 0.14,
      semanticRetrieval: 0.96,
      graphMemory: 0.24,
      timelineProof: 0.16,
      wikiCorpus: 0.42,
      multimodalGrounding: 0.48,
      reflectionPlanning: 0.22,
      agentHooks: 0.48,
      runtimeState: 0.22,
      evaluationBenchmarks: 0.66,
      contradictionRepair: 0.32,
      governance: 0.38,
      selfHostLan: 0.52,
      officialSurface: 0.82,
      ecosystemSignal: 0.58,
      projectFit: 0.45,
    },
    evidence: [
      {
        label: "Official surface",
        strength: "强",
        detail: "有云产品/开源仓库形态，适合采购或基础设施评估。",
      },
      {
        label: "Memory gap",
        strength: "中",
        detail: "向量检索层需要和 GBrain/Hindsight/治理层组合。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "作为 RAG/向量底座纳入方案对比",
        detail: "定位为 memory substrate，而非完整 Agent memory OS。",
      },
    ],
    pairsWith: ["gbrain", "llm-wiki", "mem0"],
  },
  {
    slug: "mem0",
    name: "Mem0 / Supermemory",
    shortName: "Mem0",
    layer: "Memory API",
    summary:
      "面向 AI 应用的长期记忆 API/SDK，覆盖用户记忆、检索和应用集成。",
    role: "产品化 memory API、SDK、应用侧长期记忆。",
    supportKind: "official-oss",
    officialSupport:
      "Mem0 与 Supermemory 具备官方 SDK、文档、开源仓库与托管产品信号。",
    technologySignal:
      "技术博客、教程和 Agent memory 讨论较多，适合快速验证外部 memory API。",
    fitPosition:
      "适合作为产品化用户记忆层，和本地 proof/治理层连接后更稳。",
    color: "#8e4a66",
    accent: "#73a942",
    map: { x: 0.58, y: 0.6 },
    scores: {
      ...full,
      episodic: 0.86,
      semanticRetrieval: 0.82,
      graphMemory: 0.44,
      timelineProof: 0.46,
      wikiCorpus: 0.32,
      multimodalGrounding: 0.34,
      reflectionPlanning: 0.78,
      agentHooks: 0.78,
      runtimeState: 0.38,
      evaluationBenchmarks: 0.76,
      contradictionRepair: 0.66,
      governance: 0.58,
      selfHostLan: 0.5,
      officialSurface: 0.9,
      ecosystemSignal: 0.78,
      projectFit: 0.66,
    },
    evidence: [
      {
        label: "SDK/API",
        strength: "强",
        detail: "适合用官方 API/SDK 快速接入产品级用户记忆。",
      },
      {
        label: "Blog signal",
        strength: "强",
        detail: "Agent memory 主题下有较高传播度和教程素材。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "作为外部 memory API 候选",
        detail: "需要明确数据边界、留存策略和本地 proof 写回规则。",
      },
    ],
    pairsWith: ["gbrain", "llm-wiki", "vikingdb"],
  },
  {
    slug: "zep-graphiti",
    name: "Zep / Graphiti",
    shortName: "Zep / Graphiti",
    layer: "Temporal Graph Memory",
    summary:
      "面向 Agent 的时序知识图谱记忆，强调实体、关系、事实更新和时间上下文。",
    role: "时序图谱记忆、上下文事实更新、Agent recall。",
    supportKind: "official-oss",
    officialSupport:
      "Zep 与 Graphiti 拥有官方产品/开源仓库/文档路线。",
    technologySignal:
      "技术传播集中在 temporal knowledge graph、Agent memory 和 GraphRAG。",
    fitPosition:
      "适合作为可替换或补强 GBrain 图谱能力的外部路线。",
    color: "#456b2f",
    accent: "#dd7c48",
    map: { x: 0.49, y: 0.78 },
    scores: {
      ...full,
      episodic: 0.72,
      semanticRetrieval: 0.78,
      graphMemory: 0.9,
      timelineProof: 0.78,
      wikiCorpus: 0.36,
      multimodalGrounding: 0.38,
      reflectionPlanning: 0.78,
      agentHooks: 0.7,
      runtimeState: 0.36,
      evaluationBenchmarks: 0.68,
      contradictionRepair: 0.86,
      governance: 0.56,
      selfHostLan: 0.58,
      officialSurface: 0.82,
      ecosystemSignal: 0.74,
      projectFit: 0.62,
    },
    evidence: [
      {
        label: "Temporal KG",
        strength: "强",
        detail: "时序图谱路线贴近长期 Agent memory 的核心问题。",
      },
      {
        label: "Pairing",
        strength: "中",
        detail: "和本地 Vault/GBrain 组合时，需要定义事实 ownership。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "作为 temporal graph memory 候选",
        detail: "适合评估复杂事实更新、实体关系和时间语义。",
      },
    ],
    pairsWith: ["gbrain", "hindsight", "llm-wiki"],
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
      "具备官方开源项目、文档和面向 AI memory/RAG 的产品定位。",
    technologySignal:
      "技术交流主要围绕 ECL、AI memory、GraphRAG 和 data pipeline。",
    fitPosition:
      "适合补强文档摄取和图谱生成，和 Vault/GBrain 的边界需要设计清楚。",
    color: "#9a5b1f",
    accent: "#2d8fb8",
    map: { x: 0.21, y: 0.72 },
    scores: {
      ...full,
      episodic: 0.45,
      semanticRetrieval: 0.76,
      graphMemory: 0.78,
      timelineProof: 0.52,
      wikiCorpus: 0.7,
      multimodalGrounding: 0.64,
      reflectionPlanning: 0.58,
      agentHooks: 0.6,
      runtimeState: 0.32,
      evaluationBenchmarks: 0.62,
      contradictionRepair: 0.58,
      governance: 0.52,
      selfHostLan: 0.64,
      officialSurface: 0.78,
      ecosystemSignal: 0.64,
      projectFit: 0.58,
    },
    evidence: [
      {
        label: "Pipeline fit",
        strength: "中",
        detail: "适合把文档和图谱构建流程产品化。",
      },
      {
        label: "Boundary work",
        strength: "中",
        detail: "需要和 Vault 证据、GBrain ownership 形成明确分工。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "作为知识管道候选纳入对比",
        detail: "重点评估文档摄取、图谱生成和可复用 pipeline。",
      },
    ],
    pairsWith: ["llm-wiki", "gbrain", "vikingdb"],
  },
  {
    slug: "letta",
    name: "Letta",
    shortName: "Letta",
    layer: "Agent Runtime",
    summary:
      "围绕 stateful agent 和长期记忆的 Agent runtime / framework 路线。",
    role: "Agent 状态、工具调用、记忆上下文与应用框架。",
    supportKind: "official-oss",
    officialSupport:
      "具备官方开源项目、文档与 Agent framework 产品路线。",
    technologySignal:
      "技术传播集中在 stateful agents、tool use、memory blocks 和 agent OS。",
    fitPosition:
      "适合作为外部 Agent runtime 参考，和 Hermes lane/profile 边界需要对齐。",
    color: "#5f5a1f",
    accent: "#b7557b",
    map: { x: 0.72, y: 0.73 },
    scores: {
      ...full,
      episodic: 0.72,
      semanticRetrieval: 0.54,
      graphMemory: 0.34,
      timelineProof: 0.38,
      wikiCorpus: 0.28,
      multimodalGrounding: 0.3,
      reflectionPlanning: 0.82,
      agentHooks: 0.82,
      runtimeState: 0.76,
      evaluationBenchmarks: 0.58,
      contradictionRepair: 0.52,
      governance: 0.48,
      selfHostLan: 0.62,
      officialSurface: 0.8,
      ecosystemSignal: 0.7,
      projectFit: 0.5,
    },
    evidence: [
      {
        label: "Runtime signal",
        strength: "强",
        detail: "在 stateful agent 方向上具备明确框架定位。",
      },
      {
        label: "Integration gap",
        strength: "中",
        detail: "需要和 Hermes 控制面、GBrain proof 层清晰分工。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "作为 Agent runtime 路线候选",
        detail: "适合研究 memory block 和 stateful agent 设计。",
      },
    ],
    pairsWith: ["hindsight", "gbrain", "mem0"],
  },
  {
    slug: "langmem",
    name: "LangMem / LangGraph",
    shortName: "LangMem",
    layer: "Framework Memory",
    summary:
      "LangChain/LangGraph 生态下的状态、checkpoint、memory helper 与 Agent 编排。",
    role: "框架级状态、workflow memory、agent orchestration。",
    supportKind: "framework",
    officialSupport:
      "依托 LangChain/LangGraph 官方生态与文档。",
    technologySignal:
      "技术博客、教程和工程案例丰富，便于快速对接通用 Agent workflow。",
    fitPosition:
      "适合在 Python/TS agent workflow 中作为框架记忆层参考。",
    color: "#2d6372",
    accent: "#d2a642",
    map: { x: 0.85, y: 0.62 },
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
      runtimeState: 0.78,
      evaluationBenchmarks: 0.72,
      contradictionRepair: 0.5,
      governance: 0.46,
      selfHostLan: 0.6,
      officialSurface: 0.84,
      ecosystemSignal: 0.86,
      projectFit: 0.48,
    },
    evidence: [
      {
        label: "Ecosystem",
        strength: "强",
        detail: "LangChain/LangGraph 生态有大量教程和技术交流。",
      },
      {
        label: "Framework fit",
        strength: "中",
        detail: "更适合 workflow memory，需要外部 proof 和 corpus 层。",
      },
    ],
    cases: [
      {
        when: "2026-05-21",
        title: "作为框架级 memory 路线纳入对比",
        detail: "用于对照本地 Hermes/GBrain/Hindsight 架构边界。",
      },
    ],
    pairsWith: ["mem0", "vikingdb", "llm-wiki"],
  },
];
