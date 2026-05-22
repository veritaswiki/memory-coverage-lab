export type CapabilityGroupKey =
  | "cognitive"
  | "grounding"
  | "agentic"
  | "assurance";

export const capabilityGroupDefinitions = [
  {
    key: "cognitive",
    label: "记忆认知层",
    summary: "事实、经验、工作记忆与反思规划是否能形成长期连续性。",
  },
  {
    key: "grounding",
    label: "检索与扎根",
    summary: "系统能否把生成绑定到语料、图谱、时间线和多模态证据。",
  },
  {
    key: "agentic",
    label: "Agent 运行层",
    summary: "写入、管理、读取、工具调用和运行态是否能稳定闭环。",
  },
  {
    key: "assurance",
    label: "治理可信层",
    summary: "评测、矛盾修复、权限留存和部署边界是否可审计。",
  },
] as const;

export const capabilityDefinitions = [
  {
    key: "episodic",
    label: "事件记忆",
    group: "cognitive",
    description: "保存跨会话观察、偏好、交互片段与可重新进入的经验上下文。",
    lens: "Experiential memory",
    weight: 1.15,
  },
  {
    key: "semanticRetrieval",
    label: "语义检索",
    group: "grounding",
    description: "向量/关键词混合召回、重排、查询改写和面向 Agent 的读取层。",
    lens: "Read path",
    weight: 1,
  },
  {
    key: "graphMemory",
    label: "关系图谱",
    group: "grounding",
    description: "实体、关系、claim、来源、社区结构与可查询知识图谱。",
    lens: "Relational substrate",
    weight: 1.05,
  },
  {
    key: "timelineProof",
    label: "时间线与证据",
    group: "grounding",
    description: "决策、验证、事件时间线、证明路径与 provenance 记录。",
    lens: "Temporal provenance",
    weight: 1.1,
  },
  {
    key: "wikiCorpus",
    label: "人读语料",
    group: "grounding",
    description: "人读知识库、文档导出、长文上下文、离线语料包与引用面。",
    lens: "Corpus memory",
    weight: 0.9,
  },
  {
    key: "multimodalGrounding",
    label: "多模态扎根",
    group: "grounding",
    description: "能否把图片、表格、PDF、网页、代码和操作证据纳入同一记忆面。",
    lens: "Multimodal memory",
    weight: 0.85,
  },
  {
    key: "reflectionPlanning",
    label: "反思规划",
    group: "cognitive",
    description: "从记忆中抽取反思、计划、策略更新和可执行下一步的能力。",
    lens: "Reflective control",
    weight: 1.1,
  },
  {
    key: "agentHooks",
    label: "Agent 接入",
    group: "agentic",
    description: "Codex、MCP、CLI、SDK、hooks 与工作流中的自动注入。",
    lens: "Tool/action coupling",
    weight: 1,
  },
  {
    key: "runtimeState",
    label: "运行态边界",
    group: "agentic",
    description: "任务账本、服务状态、profile、lane、预算与当前真实状态登记。",
    lens: "Manage path",
    weight: 0.95,
  },
  {
    key: "evaluationBenchmarks",
    label: "评测基准",
    group: "assurance",
    description: "支持单跳、多跳、时间、开放域、多会话和端到端任务评测。",
    lens: "Evaluation protocol",
    weight: 0.95,
  },
  {
    key: "contradictionRepair",
    label: "矛盾修复",
    group: "assurance",
    description: "检测冲突事实、过期记忆、幻觉 claim，并支持版本化修正。",
    lens: "Memory dynamics",
    weight: 1,
  },
  {
    key: "governance",
    label: "治理审计",
    group: "assurance",
    description: "Memory Steward、权限、留存策略、审批队列与来源边界。",
    lens: "Policy control",
    weight: 1.05,
  },
  {
    key: "selfHostLan",
    label: "部署控制",
    group: "assurance",
    description: "自托管、私有化、离线可运行、数据驻留和迁移策略。",
    lens: "Deployment boundary",
    weight: 0.85,
  },
  {
    key: "officialSurface",
    label: "官方产品面",
    group: "agentic",
    description: "官方 SDK、API、云服务、开源仓库、文档与维护承诺。",
    lens: "Product maturity",
    weight: 0.9,
  },
  {
    key: "ecosystemSignal",
    label: "生态交流",
    group: "agentic",
    description: "技术博客、教程、社区实践、案例复用与技术传播。",
    lens: "Adoption signal",
    weight: 0.75,
  },
  {
    key: "projectFit",
    label: "类别清晰度",
    group: "cognitive",
    description: "产品定位、能力边界和与相邻工具组合的清晰程度。",
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
