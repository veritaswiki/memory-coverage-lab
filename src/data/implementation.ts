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
  production: "已纳入",
  hardening: "加固中",
  evaluating: "评估中",
  watchlist: "观察中",
  deferred: "暂缓",
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const projectImplementations: Record<string, ProjectImplementation> = {
  "llm-wiki": {
    phase: "production",
    phaseLabel: phaseLabels.production,
    lane: "Proof corpus",
    progress: 86,
    owner: "Vault / export",
    lastUpdated: "2026-05-21",
    nextMilestone: "把本轮 UI 验证截图和构建摘要追加到 proof 页面。",
    riskLevel: "low",
    risk: "主要风险是导出新鲜度和 proof 页面命名不一致。",
    updates: [
      {
        date: "2026-05-21",
        title: "报告进入 Vault 与 LLM Wiki",
        detail: "对比报告已作为人读证据层进入 Luxos-Vault，并触发 LLM Wiki 导出。",
      },
      {
        date: "2026-05-22",
        title: "前端使用 proof 语义",
        detail: "UI 现在把 LLM Wiki 定位为 readable corpus，而不是运行时记忆替代品。",
      },
    ],
  },
  gbrain: {
    phase: "production",
    phaseLabel: phaseLabels.production,
    lane: "Graph + proof",
    progress: 91,
    owner: "GBrain CLI/MCP",
    lastUpdated: "2026-05-21",
    nextMilestone: "为每次重要 UI/运行时验证写入 timeline 事件和页面引用。",
    riskLevel: "low",
    risk: "核心风险是页面、timeline 与 Vault proof 未保持同一事实边界。",
    updates: [
      {
        date: "2026-05-21",
        title: "报告写回 GBrain",
        detail: "agent-memory comparison 被登记为 GBrain page 与 timeline 事件。",
      },
      {
        date: "2026-05-22",
        title: "作为结构化事实源展示",
        detail: "Lab 详情面板已突出 GBrain 的 proof spine 和项目事实 ownership。",
      },
    ],
  },
  hindsight: {
    phase: "hardening",
    phaseLabel: phaseLabels.hardening,
    lane: "Episodic API",
    progress: 78,
    owner: "Hindsight local API",
    lastUpdated: "2026-05-22",
    nextMilestone: "补一条 Hindsight health smoke 和 retained embedding invariant 证据。",
    riskLevel: "medium",
    risk: "不能把 episodic recall 当成 proof store；API 健康需要现场验证。",
    updates: [
      {
        date: "2026-05-21",
        title: "保留为对话记忆层",
        detail: "AGENTS 约束确认 Hindsight 负责 episodic/conversation memory。",
      },
      {
        date: "2026-05-22",
        title: "纳入 retained runtime 叙事",
        detail: "Lab 把 Hindsight 与 GBrain/Vault 的 proof 边界拆开呈现。",
      },
    ],
  },
  "nowledge-mem": {
    phase: "hardening",
    phaseLabel: phaseLabels.hardening,
    lane: "Cross-tool recall",
    progress: 72,
    owner: "Codex plugin",
    lastUpdated: "2026-05-22",
    nextMilestone: "把工作记忆读取、搜索、保存的使用路径写成可复用验收项。",
    riskLevel: "medium",
    risk: "跨工具记忆很有用，但需要避免和 GBrain proof ownership 重叠。",
    updates: [
      {
        date: "2026-05-22",
        title: "用于本轮设计延续",
        detail: "本轮 refactor 读取了 Memory Coverage Lab 的 OpenDesign V3 记忆。",
      },
      {
        date: "2026-05-22",
        title: "记录新的设计语义",
        detail: "OpenDesign V3 的组件拆分和验证截图已回写为会话记忆。",
      },
    ],
  },
  vikingdb: {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "Vector substrate",
    progress: 38,
    owner: "Retrieval benchmark",
    lastUpdated: "2026-05-21",
    nextMilestone: "只做检索底座 benchmark，不进入 retained runtime 默认组合。",
    riskLevel: "medium",
    risk: "容易被误判为完整 memory OS；需要上层治理和事实模型配合。",
    updates: [
      {
        date: "2026-05-21",
        title: "纳入底座候选",
        detail: "已按向量数据库 / RAG substrate 进入对比，而非 proof 层。",
      },
    ],
  },
  mem0: {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "External memory API",
    progress: 45,
    owner: "API spike",
    lastUpdated: "2026-05-21",
    nextMilestone: "设计一个无敏感数据的 memory API PoC 和本地 proof 写回规则。",
    riskLevel: "high",
    risk: "托管 API 的数据留存、权限和本地 proof 回流必须先定义。",
    updates: [
      {
        date: "2026-05-21",
        title: "作为产品化记忆 API 候选",
        detail: "适合快速验证应用侧用户记忆，但不替代本地 proof corpus。",
      },
    ],
  },
  "zep-graphiti": {
    phase: "evaluating",
    phaseLabel: phaseLabels.evaluating,
    lane: "Temporal graph",
    progress: 42,
    owner: "Graph spike",
    lastUpdated: "2026-05-21",
    nextMilestone: "选择一组事实更新样例，和 GBrain timeline/proof 做差异评测。",
    riskLevel: "medium",
    risk: "需要明确 temporal KG 与 GBrain 结构化事实源的 ownership。",
    updates: [
      {
        date: "2026-05-21",
        title: "纳入 temporal graph 路线",
        detail: "适合评估实体关系、事实变化和时间语义。",
      },
    ],
  },
  cognee: {
    phase: "watchlist",
    phaseLabel: phaseLabels.watchlist,
    lane: "Knowledge pipeline",
    progress: 34,
    owner: "Ingestion review",
    lastUpdated: "2026-05-21",
    nextMilestone: "评估文档摄取链是否能减少 Vault 到 GBrain 的人工整理成本。",
    riskLevel: "medium",
    risk: "摄取自动化若缺少 proof 边界，可能污染可审计事实层。",
    updates: [
      {
        date: "2026-05-21",
        title: "纳入文档管道候选",
        detail: "重点观察文档摄取、图谱生成和可复用 pipeline。",
      },
    ],
  },
  letta: {
    phase: "watchlist",
    phaseLabel: phaseLabels.watchlist,
    lane: "Agent runtime",
    progress: 31,
    owner: "Runtime boundary",
    lastUpdated: "2026-05-21",
    nextMilestone: "只保留为 stateful agent 参考，不触碰 Hermes/retained runtime。",
    riskLevel: "high",
    risk: "引入 runtime 会扩大 ops 面，必须先有明确替换目标。",
    updates: [
      {
        date: "2026-05-21",
        title: "作为 Agent runtime 路线候选",
        detail: "用于对照 memory block 和 stateful agent 设计。",
      },
    ],
  },
  langmem: {
    phase: "watchlist",
    phaseLabel: phaseLabels.watchlist,
    lane: "Framework memory",
    progress: 36,
    owner: "Workflow review",
    lastUpdated: "2026-05-21",
    nextMilestone: "提取可借鉴的 workflow memory/checkpoint 模式，避免引入框架锁定。",
    riskLevel: "medium",
    risk: "适合框架工作流，不应被当作本地长期事实系统。",
    updates: [
      {
        date: "2026-05-21",
        title: "作为框架级记忆对照",
        detail: "用于理解 LangGraph 生态下的 workflow memory 和 checkpoint。",
      },
    ],
  },
} satisfies Record<string, ProjectImplementation>;

const fallbackImplementation: ProjectImplementation = {
  phase: "deferred",
  phaseLabel: phaseLabels.deferred,
  lane: "Untracked",
  progress: 0,
  owner: "Unassigned",
  lastUpdated: "未登记",
  nextMilestone: "补充实施路线和证据边界。",
  riskLevel: "high",
  risk: "缺少实施登记，无法判断采用状态。",
  updates: [],
};

export function getProjectImplementation(slug: string): ProjectImplementation {
  return projectImplementations[slug] ?? fallbackImplementation;
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
