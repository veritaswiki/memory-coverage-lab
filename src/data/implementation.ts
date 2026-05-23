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
  production: "已发布",
  hardening: "复测中",
  evaluating: "评估中",
  watchlist: "观察中",
  deferred: "暂缓",
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "低不确定性",
  medium: "中不确定性",
  high: "高不确定性",
};

const workflowTemplates: Omit<WorkflowStage, "state">[] = [
  {
    key: "plan",
    label: "Plan",
    title: "定义类别边界与样本范围",
  },
  {
    key: "review",
    label: "Review",
    title: "审查公开证据与反例",
  },
  {
    key: "qa",
    label: "QA",
    title: "复测能力、冲突与治理场景",
  },
  {
    key: "ship",
    label: "Ship",
    title: "发布 scorecard 与不确定性标注",
  },
  {
    key: "learn",
    label: "Learn",
    title: "记录变更、回归与下一轮问题",
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
    nextMilestone: "补齐删除、冲突修正和跨会话召回复测。",
    riskLevel: "medium",
    risk: "托管记忆 API 的留存、权限和更新策略需要逐项验证。",
    updates: [
      {
        date: "2026-05-22",
        title: "纳入公开 memory API 样本",
        detail: "按用户记忆、SDK 接入、召回和治理四类能力重打分。",
      },
      {
        date: "2026-05-22",
        title: "定位从采用建议改为第三方观察",
        detail: "页面只展示客观 benchmark 维度，不暗示默认技术路线。",
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
    nextMilestone: "用冲突事实和时间更新样例复测 temporal graph 质量。",
    riskLevel: "medium",
    risk: "图谱表现强，但来源边界、更新策略和应用闭环仍需验证。",
    updates: [
      {
        date: "2026-05-22",
        title: "归入时序图谱记忆赛道",
        detail: "用实体、关系、时间和矛盾修复作为主要评估镜头。",
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
    nextMilestone: "设计多来源资料授权、召回解释和用户可控性测试。",
    riskLevel: "medium",
    risk: "个人资料源越多，越需要验证授权、删除和可解释召回。",
    updates: [
      {
        date: "2026-05-22",
        title: "新增个人记忆 API 样本",
        detail: "从端用户上下文和资料源连接角度进入平台对比。",
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
    nextMilestone: "验证 memory blocks 对长期目标、工具状态和偏好的管理能力。",
    riskLevel: "high",
    risk: "Agent runtime 会扩大采用面，不能和检索组件直接横向替代。",
    updates: [
      {
        date: "2026-05-22",
        title: "从 runtime 角度重分组",
        detail: "突出 stateful agent 能力，而不是把它当作纯 memory API。",
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
    nextMilestone: "用多步骤任务复测 checkpoint、恢复、分支和上下文注入。",
    riskLevel: "medium",
    risk: "框架生态强，但长期事实存储和治理能力需要外部组合。",
    updates: [
      {
        date: "2026-05-22",
        title: "作为 framework memory 基线",
        detail: "用于衡量工作流记忆，而非完整长期记忆平台。",
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
    nextMilestone: "补充多跳引用、文档更新和 agent tool 读取复测。",
    riskLevel: "medium",
    risk: "RAG 能力成熟，但用户级长期记忆和冲突修复不是默认强项。",
    updates: [
      {
        date: "2026-05-22",
        title: "纳入知识应用编排样本",
        detail: "按索引、召回、引用和 agent tool 维度重新呈现。",
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
    nextMilestone: "评估文档摄取到图谱的实体准确率和关系噪声。",
    riskLevel: "medium",
    risk: "自动管道容易放大错误来源，需要版本和来源约束。",
    updates: [
      {
        date: "2026-05-22",
        title: "保留在知识管道观察组",
        detail: "重点看摄取、图谱生成和可复用 pipeline。",
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
    nextMilestone: "把向量数据库评测与完整记忆评测分开发布。",
    riskLevel: "low",
    risk: "类别边界清晰：检索底座成熟，但不代表完整记忆产品。",
    updates: [
      {
        date: "2026-05-22",
        title: "作为基础设施基线发布",
        detail: "用于校准 semantic retrieval，不参与长期记忆完整性背书。",
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
    nextMilestone: "比较本地存储、同步、权限和跨应用读取方式。",
    riskLevel: "high",
    risk: "开放实现差异大，需避免把一种实现的结果泛化到整个路线。",
    updates: [
      {
        date: "2026-05-22",
        title: "新增本地优先观察线",
        detail: "作为隐私、可携带性和开放存储的研究对象。",
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
    nextMilestone: "复测文档摄取延迟、连接器稳定性和引用准确率。",
    riskLevel: "medium",
    risk: "上线速度可能掩盖长期记忆深度不足，需要单独标注类别。",
    updates: [
      {
        date: "2026-05-22",
        title: "纳入托管检索服务样本",
        detail: "作为 managed RAG 路线与 memory API 路线的边界对照。",
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
    nextMilestone: "发布 RAG pipeline 与长期 memory 的能力边界说明。",
    riskLevel: "low",
    risk: "框架定位清晰，主要风险是被误读为完整记忆平台。",
    updates: [
      {
        date: "2026-05-22",
        title: "作为检索管道基线发布",
        detail: "用于衡量 pipeline 成熟度和 RAG 工程质量。",
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
  lastUpdated: "未登记",
  nextMilestone: "补充公开资料、复测计划和类别边界。",
  riskLevel: "high",
  risk: "缺少研究登记，无法判断 benchmark 状态。",
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
