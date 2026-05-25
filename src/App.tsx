import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  DatabaseZap,
  GitMerge,
  Layers3,
  Network,
  Radar,
  Search,
  ShieldCheck,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { capabilityDefinitions } from "./data/capabilities";
import {
  getImplementationStats,
  getProjectImplementation,
  getProjectWorkflow,
  riskLabels,
} from "./data/implementation";
import { memoryProjects, type MemoryProject } from "./data/projects";
import {
  calculateCoverageScore,
  combineCapabilityScores,
  formatPercent,
  getCapabilityGroupScores,
  getCoverageGaps,
  getPairingProjects,
  getProjectCoverage,
  getStrongestCapabilities,
} from "./lib/coverage";
import researchDigest from "./data/researchDigest.json";
import { useMemoryBenchMotion } from "./useMemoryBenchMotion";

const defaultStack = ["mem0", "zep-graphiti", "llamaindex", "vectorstack"];

const modes = [
  { id: "map", label: "Research map", icon: Radar },
  { id: "matrix", label: "Capability matrix", icon: Boxes },
  { id: "stack", label: "Stack design", icon: GitMerge },
  { id: "evidence", label: "Evidence ledger", icon: ShieldCheck },
] as const satisfies Array<{ id: StudioMode; label: string; icon: LucideIcon }>;

type StudioMode = "map" | "matrix" | "stack" | "evidence";
type Locale = "en" | "zh";
type SelectStudioMode = (
  mode: StudioMode,
  shouldFocus?: boolean,
  shouldScrollToStudio?: boolean,
) => void;

function studioModeFromHash(hash: string): StudioMode | null {
  if (hash === "#evidence") {
    return "evidence";
  }

  if (hash === "#benchmarks") {
    return "map";
  }

  return null;
}

const heroWorkflow = [
  { label: "Define", value: "Category boundary", state: "done" },
  { label: "Publish", value: "Evidence public", state: "done" },
  { label: "Operate", value: "Benchmarks live", state: "current" },
  { label: "Verify", value: "Studio inspection", state: "queued" },
  { label: "Continue", value: "Trail tracked", state: "watch" },
] as const;

const studioSignals = [
  { label: "Memory APIs", match: "memory api", icon: BrainCircuit },
  { label: "Temporal graphs", match: "temporal graph", icon: Network },
  { label: "RAG frameworks", match: "rag", icon: DatabaseZap },
  { label: "Vector substrate", match: "retrieval substrate", icon: Radar },
];

const researchLanes = [
  "Memory API",
  "Temporal Graph Memory",
  "RAG framework",
  "Retrieval substrate",
  "Stateful agent runtime",
];

type ResearchDigestEntry = (typeof researchDigest.entries)[number];

const platformSteps = [
  {
    number: "01",
    label: "Define",
    title: "Memory benchmark dataset",
    body: "Category-separated runs across preference, entity update, retrieval grounding, deletion, and multi-session continuity prompts.",
  },
  {
    number: "02",
    label: "Publish",
    title: "Capability boundary explorer",
    body: "Coverage map, project matrix, stack design, and evidence ledger keep adjacent products comparable without collapsing categories.",
  },
  {
    number: "03",
    label: "Operate",
    title: "Continuous re-runs",
    body: "Scorecards are designed to refresh as vendors ship APIs, frameworks change, and model memory patterns drift.",
  },
  {
    number: "04",
    label: "Verify",
    title: "Neutral adoption briefs",
    body: "Evidence-led notes show where each memory layer fits, what it does not cover, and which claims still need validation.",
  },
];

const continuityStages = [
  { number: "01", label: "Define", body: "category boundary" },
  { number: "02", label: "Publish", body: "public evidence" },
  { number: "03", label: "Operate", body: "benchmark workflow" },
  { number: "04", label: "Verify", body: "studio inspection" },
  { number: "05", label: "Continue", body: "evidence trail" },
] as const;

const siteCopy = {
  en: {
    title: "MemoryBench — AI Memory Intelligence",
    description:
      "Objective third-party intelligence and benchmark exploration for AI memory products, RAG frameworks, temporal graphs, vector infrastructure, and stateful agent runtimes.",
    localeName: "English",
    alternateLocaleName: "Chinese",
    skip: "Skip to main content",
    topRail: {
      home: "MemoryBench home",
      navLabel: "primary navigation",
      research: "Research",
      studio: "Studio",
      evidence: "Evidence",
      openStudio: "Open studio",
      languageLabel: "Switch language",
    },
    modes: {
      map: "Research map",
      matrix: "Capability matrix",
      stack: "Stack design",
      evidence: "Evidence ledger",
    },
    hero: {
      eyebrow: "Objective AI memory intelligence",
      h1: "When AI agents remember, what survives and why?",
      lines: ["When AI agents", "remember, what", "survives", "and why?"],
      body:
        "MemoryBench separates memory APIs, temporal graphs, RAG frameworks, vector infrastructure, and stateful runtimes before any score is allowed to look comparable.",
      primary: "See public research",
      secondary: "Explore benchmark data",
      criteria: "criteria",
      evidenceLoop: "Evidence loop",
      categories: "memory categories",
    },
    workflow: heroWorkflow,
    lanes: researchLanes,
    continuity: continuityStages,
    surface: {
      rail: "Research thesis",
      railLabel: "research sequence",
      eyebrow: "memorybench / surfaces",
      heading: "Read the research. Run the benchmark.",
      lines: ["Read the research.", "Run the benchmark."],
      body:
        "MemoryBench is built as a public intelligence dossier first and an interactive benchmark second. Every lower section follows the same evidence sequence: define the category, show the research artifact, then move into the studio where the claim can be tested.",
      cards: [
        {
          label: "Evidence archive",
          title: "Research archive",
          body: "The public layer holds category boundaries, method notes, raw scoring assumptions, and study summaries behind the studio.",
          action: "View studies",
        },
        {
          label: "Method spine",
          title: "One evidence chain",
          body: "Every section uses the same sequence: define the layer, show the public claim, expose the score, then point back to evidence.",
          action: "Open ledger",
        },
        {
          label: "Interactive layer",
          title: "Benchmark studio",
          body: "Dense controls and dossier panels let teams inspect where a memory product fits, where it breaks, and what should be retested.",
          action: "Open studio",
        },
      ],
    },
    published: {
      rail: "Published evidence",
      railLabel: "published sequence",
      eyebrow: "Published",
      heading: "Public research",
      body:
        "These briefing lines are the editorial front of the same benchmark model. Every article is stored as GitHub-readable Markdown, then promoted into the public site.",
      action: "View study",
      githubAction: "Read on GitHub",
      archiveLabel: "GitHub research archive",
      generated: "generated",
      sources: "sources",
    },
    platform: {
      rail: "Operational layer",
      railLabel: "platform sequence",
      eyebrow: "Platform / for memory companies",
      heading: "An intelligence and optimization platform for AI memory products.",
      body:
        "Per-category benchmarks for the memory layers that agents actually use: APIs, temporal graphs, RAG frameworks, retrieval substrate, and stateful runtimes. The public research, studio controls, and proof ledger now share one operating model.",
      action: "See the benchmark",
      steps: platformSteps,
    },
    studio: {
      rail: "Benchmark studio",
      railLabel: "studio sequence",
      eyebrow: "MemoryBench Intelligence Studio",
      heading: "Category-first intelligence for AI memory systems",
      body:
        "The interface starts from first principles: define the category, inspect the evidence, compare the capability boundary, then design a stack with visible gaps.",
      metricLabel: "current benchmark context",
      visibleSystems: "Visible systems",
      criteria: "Criteria",
      filteredStack: "Filtered stack",
      stackCoverage: "Stack coverage",
      pending: "Pending",
      openGaps: "Open gaps",
      focusScore: "Focus score",
      controlsLabel: "studio controls",
      searchPlaceholder: "Search systems, layers, evidence, risks",
      searchLabel: "Search systems, layers, evidence, and risks",
      viewsLabel: "MemoryBench studio views",
      primaryArea: "MemoryBench primary work area",
    },
    empty: {
      eyebrow: "No matching dossier",
      heading: "No system or evidence line matches this filter.",
      body: "Try category terms such as graph, RAG, vector, runtime, governance, or API.",
    },
    panels: {
      boundaryMap: "AI memory boundary map",
      boundaryTitle: "AI memory boundary",
      circleMap: "Selectable AI memory coverage circle map",
      strongest: "Strongest signals",
      priorityGaps: "Priority gaps",
      noMajorGap: "No major gap",
      matrix: "capability matrix",
      matrixEyebrow: "Scientific capability matrix",
      matrixHeading: "Sixteen-axis category comparison",
      matrixBody: "Scores are heuristic research signals, not vendor endorsements.",
      system: "System",
      layer: "Layer",
      score: "Score",
      stackPlanner: "stack planner",
      stackEyebrow: "Portfolio design",
      stackHeading: "Compose a memory stack by category boundary",
      selectStack: "select stack systems",
      toggleStack: "Toggle",
      inStack: "in stack",
      noSystems: "No systems selected",
      selectOne: "Select at least one project to compute combined memory coverage.",
      combinedCoverage: "combined coverage",
      evidenceLedger: "evidence ledger",
      evidenceEyebrow: "Governance evidence",
      evidenceHeading: "Public surface, risk, case, and signal ledger",
      evidenceBody: "Evidence is separated from scores so category claims stay auditable.",
      selectDossier: "Select",
      dossierSuffix: "dossier",
      unscheduled: "Unscheduled",
      evidenceMore: "evidence",
      dossierLabel: "selected system dossier",
      researchState: "Research state",
      researchProgress: "research progress",
      capabilityGroups: "Capability groups",
      evidenceSplit: "Evidence split",
      productSurface: "Product surface",
      technologySignal: "Technology signal",
      researchProgressLabel: "Research progress",
      averageProgress: "average visible progress",
      highUncertainty: "high uncertainty line(s).",
      pairingCandidates: "Pairing candidates",
    },
    footer: {
      rail: "Method handoff",
      railLabel: "method handoff sequence",
      eyebrow: "MemoryBench / AI memory intelligence",
      heading: "Follow the evidence trail.",
      body:
        "The public surface closes where the studio starts: category boundary, benchmark evidence, implementation risk, and source trace remain part of one research loop.",
      linksLabel: "MemoryBench footer links",
      research: "Research thesis",
      evidence: "Evidence ledger",
      proofLabel: "MemoryBench proof summary",
      proof: [
        ["Method", "16 criteria", "same scoring model"],
        ["Coverage", "11 systems", "one category map"],
        ["Refresh", "continuous QA", "audited motion path"],
      ],
    },
  },
  zh: {
    title: "MemoryBench — AI 记忆产品情报",
    description:
      "面向 AI 记忆产品、RAG 框架、时间图谱、向量基础设施和有状态智能体运行时的第三方基准与研究情报。",
    localeName: "中文",
    alternateLocaleName: "English",
    skip: "跳到主要内容",
    topRail: {
      home: "MemoryBench 首页",
      navLabel: "主导航",
      research: "研究",
      studio: "工作台",
      evidence: "证据",
      openStudio: "打开工作台",
      languageLabel: "切换语言",
    },
    modes: {
      map: "研究地图",
      matrix: "能力矩阵",
      stack: "栈设计",
      evidence: "证据台账",
    },
    hero: {
      eyebrow: "客观 AI 记忆产品情报",
      h1: "当 AI 智能体开始记忆，什么会留下，为什么？",
      lines: ["当 AI 智能体", "开始记忆时，", "什么会留下，", "为什么？"],
      body:
        "MemoryBench 先拆开记忆 API、时间图谱、RAG 框架、向量基础设施和有状态运行时，再允许任何分数进入同一张比较表。",
      primary: "查看公开研究",
      secondary: "探索基准数据",
      criteria: "指标",
      evidenceLoop: "证据循环",
      categories: "记忆产品类别",
    },
    workflow: [
      { label: "定义", value: "类别边界", state: "done" },
      { label: "发布", value: "公开证据", state: "done" },
      { label: "运行", value: "基准在线", state: "current" },
      { label: "验证", value: "工作台审查", state: "queued" },
      { label: "追踪", value: "证据持续更新", state: "watch" },
    ],
    lanes: ["记忆 API", "时间图谱记忆", "RAG 框架", "检索底座", "有状态智能体运行时"],
    continuity: [
      { number: "01", label: "定义", body: "类别边界" },
      { number: "02", label: "发布", body: "公开证据" },
      { number: "03", label: "运行", body: "基准流程" },
      { number: "04", label: "验证", body: "工作台审查" },
      { number: "05", label: "追踪", body: "证据链路" },
    ],
    surface: {
      rail: "研究命题",
      railLabel: "研究序列",
      eyebrow: "memorybench / 研究表面",
      heading: "先读研究，再跑基准。",
      lines: ["先读研究。", "再跑基准。"],
      body:
        "MemoryBench 先是公开情报档案，其次才是交互式基准。页面下方每一段都遵循同一条证据顺序：定义类别、展示研究材料，再进入可检验主张的工作台。",
      cards: [
        {
          label: "证据档案",
          title: "研究档案",
          body: "公开层保存类别边界、方法说明、评分假设和工作台背后的研究摘要。",
          action: "查看研究",
        },
        {
          label: "方法主线",
          title: "同一条证据链",
          body: "每个段落都先定义层级，再呈现公开主张、暴露分数，最后回到证据。",
          action: "打开台账",
        },
        {
          label: "交互层",
          title: "基准工作台",
          body: "高密度控件和档案面板帮助团队判断一个记忆产品适合哪里、断在哪里、需要重测什么。",
          action: "打开工作台",
        },
      ],
    },
    published: {
      rail: "公开证据",
      railLabel: "发布序列",
      eyebrow: "公开研究",
      heading: "公开研究",
      body:
        "这些研究条目是同一套基准模型的编辑层。每篇文章先以 GitHub 可读 Markdown 保存，再发布到网站。",
      action: "查看研究",
      githubAction: "在 GitHub 阅读",
      archiveLabel: "GitHub 研究档案",
      generated: "生成于",
      sources: "来源",
    },
    platform: {
      rail: "运行层",
      railLabel: "平台序列",
      eyebrow: "平台 / 面向记忆产品团队",
      heading: "面向 AI 记忆产品的情报与优化平台。",
      body:
        "按照智能体真实使用的记忆层分别建立基准：API、时间图谱、RAG 框架、检索底座和有状态运行时。公开研究、工作台控件和证据台账现在共享同一个运行模型。",
      action: "查看基准",
      steps: [
        {
          number: "01",
          label: "定义",
          title: "记忆基准数据集",
          body: "按偏好、实体更新、检索落地、删除和多会话连续性拆分类别运行。",
        },
        {
          number: "02",
          label: "发布",
          title: "能力边界浏览器",
          body: "覆盖地图、项目矩阵、栈设计和证据台账让相邻产品可比较但不混为一类。",
        },
        {
          number: "03",
          label: "运行",
          title: "持续复测",
          body: "当厂商发布 API、框架变化、模型记忆模式漂移时，评分卡可以持续刷新。",
        },
        {
          number: "04",
          label: "验证",
          title: "中立采用简报",
          body: "基于证据的说明展示每层记忆适合哪里、不覆盖什么、哪些主张仍需验证。",
        },
      ],
    },
    studio: {
      rail: "基准工作台",
      railLabel: "工作台序列",
      eyebrow: "MemoryBench 情报工作台",
      heading: "面向 AI 记忆系统的类别优先情报",
      body:
        "界面从第一性原理出发：定义类别、审查证据、比较能力边界，再设计带有可见缺口的组合栈。",
      metricLabel: "当前基准上下文",
      visibleSystems: "可见系统",
      criteria: "指标",
      filteredStack: "筛选栈",
      stackCoverage: "栈覆盖",
      pending: "待选择",
      openGaps: "开放缺口",
      focusScore: "焦点分数",
      controlsLabel: "工作台控件",
      searchPlaceholder: "搜索系统、层级、证据、风险",
      searchLabel: "搜索系统、层级、证据和风险",
      viewsLabel: "MemoryBench 工作台视图",
      primaryArea: "MemoryBench 主工作区",
    },
    empty: {
      eyebrow: "没有匹配档案",
      heading: "没有系统或证据条目匹配当前筛选。",
      body: "可以尝试图谱、RAG、向量、运行时、治理或 API 等类别词。",
    },
    panels: {
      boundaryMap: "AI 记忆边界地图",
      boundaryTitle: "AI 记忆边界",
      circleMap: "可选择的 AI 记忆覆盖圆图",
      strongest: "最强信号",
      priorityGaps: "优先缺口",
      noMajorGap: "暂无主要缺口",
      matrix: "能力矩阵",
      matrixEyebrow: "科学能力矩阵",
      matrixHeading: "十六轴类别比较",
      matrixBody: "分数是启发式研究信号，不是厂商背书。",
      system: "系统",
      layer: "层级",
      score: "分数",
      stackPlanner: "栈规划器",
      stackEyebrow: "组合设计",
      stackHeading: "按类别边界组合记忆栈",
      selectStack: "选择栈内系统",
      toggleStack: "切换",
      inStack: "已在栈内",
      noSystems: "尚未选择系统",
      selectOne: "至少选择一个项目来计算组合记忆覆盖。",
      combinedCoverage: "组合覆盖",
      evidenceLedger: "证据台账",
      evidenceEyebrow: "治理证据",
      evidenceHeading: "公开表面、风险、案例和信号台账",
      evidenceBody: "证据与分数分开呈现，让类别主张保持可审计。",
      selectDossier: "选择",
      dossierSuffix: "档案",
      unscheduled: "未排期",
      evidenceMore: "条证据",
      dossierLabel: "已选系统档案",
      researchState: "研究状态",
      researchProgress: "研究进度",
      capabilityGroups: "能力组",
      evidenceSplit: "证据拆分",
      productSurface: "产品表面",
      technologySignal: "技术信号",
      researchProgressLabel: "研究进度",
      averageProgress: "平均可见进度",
      highUncertainty: "条高不确定性线索。",
      pairingCandidates: "组合候选",
    },
    footer: {
      rail: "方法交接",
      railLabel: "方法交接序列",
      eyebrow: "MemoryBench / AI 记忆产品情报",
      heading: "沿着证据链继续追踪。",
      body:
        "公开表面结束的地方，正是工作台开始的地方：类别边界、基准证据、实现风险和来源追踪仍然属于同一个研究循环。",
      linksLabel: "MemoryBench 页脚链接",
      research: "研究命题",
      evidence: "证据台账",
      proofLabel: "MemoryBench 证明摘要",
      proof: [
        ["方法", "16 项指标", "同一套评分模型"],
        ["覆盖", "11 个系统", "一张类别地图"],
        ["刷新", "持续 QA", "已审计动效路径"],
      ],
    },
  },
} as const;

type SiteCopy = (typeof siteCopy)[Locale];

function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const params = new URLSearchParams(window.location.search);
  const queryLocale = params.get("lang");
  if (queryLocale === "zh" || queryLocale === "en") {
    return queryLocale;
  }

  const storedLocale = window.localStorage.getItem("memorybench-locale");
  if (storedLocale === "zh" || storedLocale === "en") {
    return storedLocale;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function setMetaContent(selector: string, content: string) {
  const node = document.querySelector<HTMLMetaElement>(selector);
  if (node) {
    node.content = content;
  }
}

function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<StudioMode>(() =>
    typeof window === "undefined" ? "map" : studioModeFromHash(window.location.hash) ?? "map",
  );
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [selectedSlug, setSelectedSlug] = useState("mem0");
  const [query, setQuery] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const [stackSlugs, setStackSlugs] = useState<string[]>(defaultStack);
  const t = siteCopy[locale];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) {
      return memoryProjects;
    }

    return memoryProjects.filter((project) => {
      const implementation = getProjectImplementation(project.slug);
      const haystack = [
        project.name,
        project.shortName,
        project.layer,
        project.summary,
        project.role,
        project.officialSupport,
        project.technologySignal,
        project.fitPosition,
        implementation.phaseLabel,
        implementation.lane,
        implementation.owner,
        implementation.nextMilestone,
        implementation.risk,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const scopeProjects = normalizedQuery ? filteredProjects : memoryProjects;
  const selectedProject =
    filteredProjects.find((project) => project.slug === selectedSlug) ??
    filteredProjects[0] ??
    memoryProjects[0]!;
  const selectedImplementation = getProjectImplementation(selectedProject.slug);
  const stackProjects = scopeProjects.filter((project) =>
    stackSlugs.includes(project.slug),
  );
  const stackScores = combineCapabilityScores(stackProjects);
  const stats = getImplementationStats(filteredProjects);
  const focusCoverage = getProjectCoverage(selectedProject);
  const stackCoverage =
    stackProjects.length === 0 ? 0 : calculateCoverageScore(stackScores);
  const stackGaps = getCoverageGaps(stackScores);
  const hasMotionReduceOverride =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("motion") === "reduce";

  useEffect(() => {
    if (hasMotionReduceOverride) {
      document.documentElement.dataset.motionReduce = "true";
    } else {
      delete document.documentElement.dataset.motionReduce;
    }

    return () => {
      delete document.documentElement.dataset.motionReduce;
    };
  }, [hasMotionReduceOverride]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.locale = locale;
    document.title = t.title;
    window.localStorage.setItem("memorybench-locale", locale);
    setMetaContent('meta[name="description"]', t.description);
    setMetaContent('meta[property="og:title"]', t.title);
    setMetaContent('meta[property="og:description"]', t.description);
    setMetaContent('meta[property="og:locale"]', locale === "zh" ? "zh_CN" : "en_US");
    setMetaContent('meta[name="twitter:title"]', t.title);
    setMetaContent('meta[name="twitter:description"]', t.description);
  }, [locale, t.description, t.title]);

  useEffect(() => {
    const syncModeFromHash = () => {
      const hashMode = studioModeFromHash(window.location.hash);
      if (hashMode) {
        setMode(hashMode);
      }
    };

    syncModeFromHash();
    window.addEventListener("hashchange", syncModeFromHash);

    return () => {
      window.removeEventListener("hashchange", syncModeFromHash);
    };
  }, []);

  useMemoryBenchMotion(appRef, {
    mode,
    normalizedQuery,
    selectedProjectSlug: selectedProject.slug,
    stackKey: stackSlugs.join("|"),
  });

  function toggleStack(slug: string) {
    setStackSlugs((current) =>
      current.includes(slug)
        ? current.filter((currentSlug) => currentSlug !== slug)
        : [...current, slug],
    );
  }

  function selectProject(slug: string) {
    setSelectedSlug(slug);
  }

  function markTopNavigationCurrent(currentHref: "#research" | "#benchmarks" | "#evidence") {
    document.querySelectorAll<HTMLAnchorElement>(".top-rail nav a").forEach((link) => {
      const isCurrent = link.getAttribute("href") === currentHref;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function scrollStudioIntoView(currentHref: "#benchmarks" | "#evidence") {
    const syncStudioAnchor = () => {
      const target = document.getElementById("benchmarks");
      if (target && typeof window.scrollTo === "function") {
        const top = target.getBoundingClientRect().top + window.scrollY;
        const rootScrollBehavior = document.documentElement.style.scrollBehavior;
        const bodyScrollBehavior = document.body.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        try {
          window.scrollTo(0, top);
        } catch {
          window.scrollTo(0, top);
        } finally {
          window.requestAnimationFrame(() => {
            document.documentElement.style.scrollBehavior = rootScrollBehavior;
            document.body.style.scrollBehavior = bodyScrollBehavior;
          });
        }
      }
      markTopNavigationCurrent(currentHref);
    };

    window.setTimeout(syncStudioAnchor, 0);
    window.setTimeout(syncStudioAnchor, 180);
    window.setTimeout(() => markTopNavigationCurrent(currentHref), 520);
  }

  function activateMode(nextMode: StudioMode, shouldFocus = false, shouldScrollToStudio = false) {
    setMode(nextMode);

    if (shouldScrollToStudio) {
      const currentHref = nextMode === "evidence" ? "#evidence" : "#benchmarks";
      window.history.pushState({}, "", currentHref);
      markTopNavigationCurrent(currentHref);
      scrollStudioIntoView(currentHref);
    }

    if (shouldFocus) {
      window.requestAnimationFrame(() => {
        document.getElementById(`studio-tab-${nextMode}`)?.focus();
      });
    }
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentMode: StudioMode) {
    const currentIndex = modes.findIndex((item) => item.id === currentMode);
    const lastIndex = modes.length - 1;
    let nextMode: StudioMode | null = null;

    if (event.key === "ArrowRight") {
      nextMode = modes[currentIndex === lastIndex ? 0 : currentIndex + 1]!.id;
    } else if (event.key === "ArrowLeft") {
      nextMode = modes[currentIndex === 0 ? lastIndex : currentIndex - 1]!.id;
    } else if (event.key === "Home") {
      nextMode = modes[0]!.id;
    } else if (event.key === "End") {
      nextMode = modes[lastIndex]!.id;
    }

    if (nextMode) {
      event.preventDefault();
      activateMode(nextMode, true);
    }
  }

  return (
    <div
      className="opendesign-app"
      data-motion-reduce={hasMotionReduceOverride ? "true" : undefined}
      ref={appRef}
    >
      <a className="skip-link" href="#main-content">
        {t.skip}
      </a>
      <TopRail
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        onSelectMode={activateMode}
      />
      <main className="site-main" id="main-content" tabIndex={-1}>
        <Hero t={t} onSelectMode={activateMode} />
        <div className="page-continuum">
          <SurfaceSection t={t} onSelectMode={activateMode} />
          <PublishedResearch t={t} onSelectMode={activateMode} />
          <PlatformSection t={t} onSelectMode={activateMode} />

          <section className="studio-workbench briefing-section" id="benchmarks" aria-labelledby="studio-heading">
            <span id="evidence" className="scroll-anchor" aria-hidden="true" />
            <div className="section-frame briefing-frame studio-frame">
              <aside className="briefing-rail" aria-label={t.studio.railLabel}>
                <span>04</span>
                <p>{t.studio.rail}</p>
              </aside>
              <div className="workbench-frame">
                <header className="workbench-head">
                  <div>
                    <p className="eyebrow">{t.studio.eyebrow}</p>
                    <h2 id="studio-heading">{t.studio.heading}</h2>
                  </div>
                  <p>{t.studio.body}</p>
                </header>

                <section className="metric-ribbon" aria-label={t.studio.metricLabel}>
                  <Metric icon={Boxes} label={t.studio.visibleSystems} value={String(filteredProjects.length)} />
                  <Metric icon={Radar} label={t.studio.criteria} value={String(capabilityDefinitions.length)} />
                  <Metric
                    icon={Layers3}
                    label={normalizedQuery ? t.studio.filteredStack : t.studio.stackCoverage}
                    value={stackProjects.length === 0 ? t.studio.pending : `${stackCoverage}%`}
                  />
                  <Metric icon={TriangleAlert} label={t.studio.openGaps} value={String(stackGaps.length)} />
                  <Metric icon={Target} label={t.studio.focusScore} value={`${focusCoverage}%`} strong />
                </section>

                <section className="studio-controls" aria-label={t.studio.controlsLabel}>
                  <label className="search-control" htmlFor="memorybench-search">
                    <Search aria-hidden="true" size={18} />
                    <input
                      id="memorybench-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t.studio.searchPlaceholder}
                      aria-label={t.studio.searchLabel}
                    />
                  </label>

                  <div className="mode-tabs" role="tablist" aria-label={t.studio.viewsLabel}>
                    {modes.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          id={`studio-tab-${item.id}`}
                          aria-selected={mode === item.id}
                          aria-controls="studio-panel"
                          className={mode === item.id ? "active" : ""}
                          tabIndex={mode === item.id ? 0 : -1}
                          onClick={() => activateMode(item.id)}
                          onKeyDown={(event) => handleModeKeyDown(event, item.id)}
                        >
                          <Icon aria-hidden="true" size={17} />
                          <span>{t.modes[item.id]}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {filteredProjects.length === 0 ? (
                  <section
                    className="empty-scope"
                    id="studio-panel"
                    role="tabpanel"
                    aria-labelledby={`studio-tab-${mode}`}
                    aria-live="polite"
                  >
                    <p className="eyebrow">{t.empty.eyebrow}</p>
                    <h3>{t.empty.heading}</h3>
                    <p>{t.empty.body}</p>
                  </section>
                ) : (
                  <section className="studio-grid">
                    <section
                      className="primary-lab"
                      id="studio-panel"
                      role="tabpanel"
                      aria-labelledby={`studio-tab-${mode}`}
                      aria-label={t.studio.primaryArea}
                    >
                      {mode === "map" ? (
                        <BoundaryMap
                          t={t}
                          projects={filteredProjects}
                          selectedProject={selectedProject}
                          selectedStackSlugs={stackProjects.map((project) => project.slug)}
                          onSelectProject={selectProject}
                        />
                      ) : null}

                      {mode === "matrix" ? (
                        <CapabilityMatrix
                          t={t}
                          projects={filteredProjects}
                          selectedProject={selectedProject}
                          onSelectProject={selectProject}
                        />
                      ) : null}

                      {mode === "stack" ? (
                        <StackStudio
                          t={t}
                          projects={scopeProjects}
                          selectedSlugs={stackSlugs}
                          stackProjects={stackProjects}
                          stackCoverage={stackCoverage}
                          onToggleProject={toggleStack}
                        />
                      ) : null}

                      {mode === "evidence" ? (
                        <EvidenceLedger
                          t={t}
                          projects={filteredProjects}
                          selectedProject={selectedProject}
                          onSelectProject={selectProject}
                        />
                      ) : null}
                    </section>

                    <Dossier
                      t={t}
                      project={selectedProject}
                      implementation={selectedImplementation}
                      allProjects={memoryProjects}
                      stats={stats}
                    />
                  </section>
                )}
              </div>
            </div>
          </section>
          <SiteFooter t={t} onSelectMode={activateMode} />
        </div>
      </main>
    </div>
  );
}

function SurfaceSection({ t, onSelectMode }: { t: SiteCopy; onSelectMode: SelectStudioMode }) {
  return (
    <section className="surface-section briefing-section" id="research">
      <div className="section-frame briefing-frame">
        <aside className="briefing-rail" aria-label={t.surface.railLabel}>
          <span>01</span>
          <p>{t.surface.rail}</p>
        </aside>
        <div className="section-intro">
          <p className="eyebrow">{t.surface.eyebrow}</p>
          <h2 className="split-heading" aria-label={t.surface.heading}>
            {t.surface.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p>{t.surface.body}</p>
        </div>
        <div className="continuity-lane" aria-label="MemoryBench evidence flow">
          {t.continuity.map((stage) => (
            <article key={stage.number}>
              <span>{stage.number}</span>
              <strong>{stage.label}</strong>
              <p>{stage.body}</p>
            </article>
          ))}
        </div>
        <div className="surface-grid">
          <article>
            <span>{t.surface.cards[0].label}</span>
            <h3>{t.surface.cards[0].title}</h3>
            <p>{t.surface.cards[0].body}</p>
            <a className="action-link action-link-dark" href="#published">
              {t.surface.cards[0].action}
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </article>
          <article>
            <span>{t.surface.cards[1].label}</span>
            <h3>{t.surface.cards[1].title}</h3>
            <p>{t.surface.cards[1].body}</p>
            <a className="action-link action-link-dark" href="#evidence" onClick={(event) => {
              event.preventDefault();
              onSelectMode("evidence", false, true);
            }}>
              {t.surface.cards[1].action}
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </article>
          <article>
            <span>{t.surface.cards[2].label}</span>
            <h3>{t.surface.cards[2].title}</h3>
            <p>{t.surface.cards[2].body}</p>
            <a className="action-link action-link-dark" href="#benchmarks" onClick={(event) => {
              event.preventDefault();
              onSelectMode("map", false, true);
            }}>
              {t.surface.cards[2].action}
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

function PublishedResearch({ t, onSelectMode }: { t: SiteCopy; onSelectMode: SelectStudioMode }) {
  const entries = researchDigest.entries.slice(0, 4) as ResearchDigestEntry[];

  return (
    <section className="published-section briefing-section" id="published">
      <div className="section-frame briefing-frame">
        <aside className="briefing-rail" aria-label={t.published.railLabel}>
          <span>02</span>
          <p>{t.published.rail}</p>
        </aside>
        <div className="section-intro compact">
          <p className="eyebrow">{t.published.eyebrow}</p>
          <h2>{t.published.heading}</h2>
          <p>{t.published.body}</p>
        </div>
        <div className="archive-status" aria-label={t.published.archiveLabel}>
          <span>{t.published.generated}</span>
          <strong>{new Date(researchDigest.generatedAt).toISOString().slice(0, 10)}</strong>
          <a href={researchDigest.githubBaseUrl}>{t.published.archiveLabel}</a>
        </div>
        <div className="research-list">
          {entries.map((entry, index) => (
            <article key={entry.id}>
              <div className="research-index">
                <b>{String(index + 1).padStart(2, "0")}</b>
                <time dateTime={entry.date}>{entry.date.slice(0, 7)}</time>
              </div>
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.summary}</p>
              </div>
              <span>{entry.category} / {entry.sourceCount} {t.published.sources}</span>
              <div className="research-actions">
                <a className="action-link action-link-text" href="#evidence" onClick={(event) => {
                  event.preventDefault();
                  onSelectMode("evidence", false, true);
                }}>
                  {t.published.action}
                </a>
                <a className="action-link action-link-text" href={entry.githubUrl}>
                  {t.published.githubAction}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSection({ t, onSelectMode }: { t: SiteCopy; onSelectMode: SelectStudioMode }) {
  return (
    <section className="platform-section briefing-section" id="platform">
      <div className="section-frame briefing-frame platform-frame">
        <aside className="briefing-rail" aria-label={t.platform.railLabel}>
          <span>03</span>
          <p>{t.platform.rail}</p>
        </aside>
        <div className="platform-copy">
          <p className="eyebrow">{t.platform.eyebrow}</p>
          <h2>{t.platform.heading}</h2>
          <p>{t.platform.body}</p>
          <a
            className="outline-link action-link action-link-outline dark"
            href="#benchmarks"
            onClick={(event) => {
              event.preventDefault();
              onSelectMode("map", false, true);
            }}
          >
            {t.platform.action}
          </a>
        </div>
        <div className="platform-steps">
          {t.platform.steps.map((step) => (
            <article key={step.number}>
              <div>
                <span>{step.number}</span>
                <b>{step.label}</b>
                <Activity aria-hidden="true" size={18} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ t, onSelectMode }: { t: SiteCopy; onSelectMode: SelectStudioMode }) {
  return (
    <footer className="site-footer briefing-section" id="subscribe">
      <div className="section-frame briefing-frame footer-frame">
        <aside className="briefing-rail" aria-label={t.footer.railLabel}>
          <span>05</span>
          <p>{t.footer.rail}</p>
        </aside>
        <div className="footer-copy">
          <p className="eyebrow">{t.footer.eyebrow}</p>
          <h2>{t.footer.heading}</h2>
          <p>{t.footer.body}</p>
          <div className="footer-actions" aria-label={t.footer.linksLabel}>
            <a className="action-link action-link-outline" href="#research">{t.footer.research}</a>
            <a className="action-link action-link-accent" href="#evidence" onClick={(event) => {
              event.preventDefault();
              onSelectMode("evidence", false, true);
            }}>
              {t.footer.evidence}
            </a>
            <a className="action-link action-link-outline" href="https://github.com/veritaswiki/memory-coverage-lab">GitHub</a>
          </div>
        </div>
        <div className="footer-proof-grid" aria-label={t.footer.proofLabel}>
          {t.footer.proof.map(([label, value, body]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </footer>
  );
}

function TopRail({
  locale,
  t,
  onLocaleChange,
  onSelectMode,
}: {
  locale: Locale;
  t: SiteCopy;
  onLocaleChange: (locale: Locale) => void;
  onSelectMode: SelectStudioMode;
}) {
  const nextLocale = locale === "en" ? "zh" : "en";

  return (
    <header className="top-rail">
      <a className="wordmark" href="#top" aria-label={t.topRail.home}>
        <span>MemoryBench</span>
        <b>/ai-memory-intelligence</b>
      </a>
      <nav aria-label={t.topRail.navLabel}>
        <a href="#research">{t.topRail.research}</a>
        <a href="#benchmarks" onClick={(event) => {
          event.preventDefault();
          onSelectMode("map", false, true);
        }}>{t.topRail.studio}</a>
        <a href="#evidence" onClick={(event) => {
          event.preventDefault();
          onSelectMode("evidence", false, true);
        }}>{t.topRail.evidence}</a>
      </nav>
      <div className="top-rail-actions">
        <button
          className="locale-toggle"
          type="button"
          aria-label={`${t.topRail.languageLabel}: ${t.alternateLocaleName}`}
          onClick={() => onLocaleChange(nextLocale)}
        >
          <span aria-current={locale === "en" ? "true" : undefined}>EN</span>
          <span aria-current={locale === "zh" ? "true" : undefined}>{"\u4e2d"}</span>
        </button>
        <a className="outline-link action-link action-link-outline" href="#benchmarks" onClick={(event) => {
          event.preventDefault();
          onSelectMode("map", false, true);
        }}>
          {t.topRail.openStudio}
        </a>
      </div>
      <div className="reading-progress" aria-hidden="true">
        <span />
      </div>
    </header>
  );
}

function Hero({ t, onSelectMode }: { t: SiteCopy; onSelectMode: SelectStudioMode }) {
  const signalValues = studioSignals.map((signal) => ({
    ...signal,
    value: averageCoverage(signal.match),
  }));

  return (
    <section
      className="hero-studio"
      id="top"
      data-opendesign-source="opendesign/mockups/memorybench-ai-studio"
    >
      <div className="hero-visual" aria-hidden="true">
        <div className="orbit orbit-outer" />
        <div className="orbit orbit-mid" />
        <div className="orbit orbit-inner" />
        <div className="signal-polygon" />
        <div className="criteria-core">
          <span>16</span>
          <b>{t.hero.criteria}</b>
        </div>
        {signalValues.map((signal, index) => {
          const Icon = signal.icon;

          return (
            <div key={signal.label} className={`hero-signal hero-signal-${index + 1}`}>
              <Icon aria-hidden="true" size={16} />
              <span>{signal.label}</span>
              <strong>{signal.value}%</strong>
            </div>
          );
        })}
        <div className="workflow-strip" aria-label="Hero evidence loop">
          <div>
            <Activity aria-hidden="true" size={16} />
            <span>{t.hero.evidenceLoop}</span>
          </div>
          {t.workflow.map((stage) => (
            <article key={stage.label} data-state={stage.state}>
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-copy">
        <p className="eyebrow">{t.hero.eyebrow}</p>
        <h1 aria-label={t.hero.h1}>
          {t.hero.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p>{t.hero.body}</p>
        <div className="hero-actions">
          <a className="action-link action-link-primary" href="#research">
            {t.hero.primary}
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <a className="action-link action-link-accent" href="#benchmarks" onClick={(event) => {
            event.preventDefault();
            onSelectMode("map", false, true);
          }}>
            {t.hero.secondary}
          </a>
        </div>
        <div className="lane-strip" id="memory-categories" aria-label={t.hero.categories}>
          {t.lanes.map((lane) => (
            <span key={lane}>{lane}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  strong,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <article className={strong ? "emphasis" : undefined}>
      <span>
        <Icon aria-hidden="true" size={15} />
        {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}

function BoundaryMap({
  t,
  projects,
  selectedProject,
  selectedStackSlugs,
  onSelectProject,
}: {
  t: SiteCopy;
  projects: MemoryProject[];
  selectedProject: MemoryProject;
  selectedStackSlugs: string[];
  onSelectProject: (slug: string) => void;
}) {
  const rankedProjects = [...projects].sort(
    (a, b) => getProjectCoverage(b) - getProjectCoverage(a),
  );
  const selectedGroups = getCapabilityGroupScores(selectedProject.scores);
  const topCapabilities = getStrongestCapabilities(selectedProject.scores, 3);
  const gaps = getCoverageGaps(selectedProject.scores, 0.62).slice(0, 4);

  return (
    <div className="boundary-workbench" aria-label={t.panels.boundaryMap}>
      <div className="boundary-canvas">
        <header className="panel-title">
          <div>
            <p className="eyebrow">{t.panels.boundaryTitle}</p>
            <h3>{selectedProject.name}</h3>
          </div>
          <strong>{getProjectCoverage(selectedProject)}%</strong>
        </header>

        <div className="circle-stage" role="group" aria-label={t.panels.circleMap}>
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
          <div className="axis axis-x" />
          <div className="axis axis-y" />
          {rankedProjects.map((project) => {
            const score = getProjectCoverage(project);
            const isSelected = project.slug === selectedProject.slug;
            const isStacked = selectedStackSlugs.includes(project.slug);
            const size = 44 + score * 0.72;
            const style = {
              "--x": `${project.map.x * 100}%`,
              "--y": `${project.map.y * 100}%`,
              "--size": `${size}px`,
              "--project": project.color,
              "--accent": project.accent,
            } as CSSProperties;

            return (
              <button
                key={project.slug}
                type="button"
                className={isSelected ? "map-node active" : "map-node"}
                aria-current={isSelected ? "true" : undefined}
                aria-label={`Open ${project.shortName} dossier${isStacked ? `, ${t.panels.inStack}` : ""}`}
                style={style}
                onClick={() => onSelectProject(project.slug)}
              >
                <span>{project.shortName}</span>
                <b>{score}%</b>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="boundary-legend">
        <div className="focus-card">
          <span>{selectedProject.layer}</span>
          <strong>{selectedProject.shortName}</strong>
          <p>{selectedProject.fitPosition}</p>
        </div>
        <div className="group-grid">
          {selectedGroups.map((group) => (
            <article key={group.key}>
              <span>{group.label}</span>
              <strong>{formatPercent(group.value)}</strong>
            </article>
          ))}
        </div>
        <SignalList title={t.panels.strongest} items={topCapabilities.map((item) => item.label)} />
        <SignalList
          title={t.panels.priorityGaps}
          items={gaps.length > 0 ? gaps.map((item) => item.label) : [t.panels.noMajorGap]}
        />
      </aside>
    </div>
  );
}

function CapabilityMatrix({
  t,
  projects,
  selectedProject,
  onSelectProject,
}: {
  t: SiteCopy;
  projects: MemoryProject[];
  selectedProject: MemoryProject;
  onSelectProject: (slug: string) => void;
}) {
  return (
    <div className="matrix-workbench" aria-label={t.panels.matrix}>
      <header className="panel-title">
        <div>
          <p className="eyebrow">{t.panels.matrixEyebrow}</p>
          <h3>{t.panels.matrixHeading}</h3>
        </div>
        <p>{t.panels.matrixBody}</p>
      </header>

      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.panels.system}</th>
              <th>{t.panels.layer}</th>
              <th>{t.panels.score}</th>
              {capabilityDefinitions.map((capability) => (
                <th key={capability.key}>{capability.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.slug} className={project.slug === selectedProject.slug ? "active" : ""}>
                <th>
                  <button
                    type="button"
                    aria-current={project.slug === selectedProject.slug ? "true" : undefined}
                    onClick={() => onSelectProject(project.slug)}
                  >
                    {project.name}
                  </button>
                </th>
                <td>{project.layer}</td>
                <td>
                  <strong>{getProjectCoverage(project)}%</strong>
                </td>
                {capabilityDefinitions.map((capability) => (
                  <td key={capability.key}>
                    {formatPercent(project.scores[capability.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StackStudio({
  t,
  projects,
  selectedSlugs,
  stackProjects,
  stackCoverage,
  onToggleProject,
}: {
  t: SiteCopy;
  projects: MemoryProject[];
  selectedSlugs: string[];
  stackProjects: MemoryProject[];
  stackCoverage: number;
  onToggleProject: (slug: string) => void;
}) {
  const combinedScores = combineCapabilityScores(stackProjects);
  const groups = getCapabilityGroupScores(combinedScores);
  const gaps = getCoverageGaps(combinedScores);

  return (
    <div className="stack-workbench" aria-label={t.panels.stackPlanner}>
      <header className="panel-title">
        <div>
          <p className="eyebrow">{t.panels.stackEyebrow}</p>
          <h3>{t.panels.stackHeading}</h3>
        </div>
        <strong>{stackProjects.length === 0 ? t.studio.pending : `${stackCoverage}%`}</strong>
      </header>

      <div className="stack-grid">
        <section className="selector-panel" aria-label={t.panels.selectStack}>
          {projects.map((project) => {
            const active = selectedSlugs.includes(project.slug);
            const implementation = getProjectImplementation(project.slug);

            return (
              <button
                key={project.slug}
                type="button"
                aria-pressed={active}
                aria-label={`${t.panels.toggleStack} ${project.shortName} ${t.panels.inStack}`}
                className={active ? "active" : ""}
                onClick={() => onToggleProject(project.slug)}
              >
                <span className="swatch" style={{ backgroundColor: project.color }} />
                <span>
                  <strong>{project.shortName}</strong>
                  <small>{implementation.lane}</small>
                </span>
                <b>{getProjectCoverage(project)}%</b>
              </button>
            );
          })}
        </section>

        <section className="combined-panel" aria-live="polite">
          {stackProjects.length === 0 ? (
            <div className="empty-stack">
              <h4>{t.panels.noSystems}</h4>
              <p>{t.panels.selectOne}</p>
            </div>
          ) : (
            <>
              <div className="group-grid">
                {groups.map((group) => (
                  <article key={group.key}>
                    <span>{group.label}</span>
                    <strong>{formatPercent(group.value)}</strong>
                  </article>
                ))}
              </div>
              <div className="gap-column">
                <h4>{t.panels.priorityGaps}</h4>
                {(gaps.length > 0 ? gaps.slice(0, 6) : [{ key: "none", label: t.panels.noMajorGap, value: 1 }]).map(
                  (gap) => (
                    <div key={gap.key} className="meter-row">
                      <span>{gap.label}</span>
                      <strong>{formatPercent(gap.value)}</strong>
                      <div
                        className="meter"
                        role="progressbar"
                        aria-label={`${gap.label} ${t.panels.combinedCoverage}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(gap.value * 100)}
                      >
                        <i style={{ width: `${gap.value * 100}%` }} />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EvidenceLedger({
  t,
  projects,
  selectedProject,
  onSelectProject,
}: {
  t: SiteCopy;
  projects: MemoryProject[];
  selectedProject: MemoryProject;
  onSelectProject: (slug: string) => void;
}) {
  function handleLedgerKeyDown(event: KeyboardEvent<HTMLElement>, slug: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelectProject(slug);
  }

  return (
    <div className="evidence-workbench" aria-label={t.panels.evidenceLedger}>
      <header className="panel-title">
        <div>
          <p className="eyebrow">{t.panels.evidenceEyebrow}</p>
          <h3>{t.panels.evidenceHeading}</h3>
        </div>
        <p>{t.panels.evidenceBody}</p>
      </header>

      <div className="evidence-list">
        {projects.map((project) => {
          const implementation = getProjectImplementation(project.slug);
          const strongest = getStrongestCapabilities(project.scores, 2);
          const visibleSignals = project.evidence.slice(0, 3);
          const hiddenSignalCount = Math.max(project.evidence.length - visibleSignals.length, 0);
          const isSelected = project.slug === selectedProject.slug;

          return (
            <article
              key={project.slug}
              className={isSelected ? "evidence-row active" : "evidence-row"}
              role="button"
              tabIndex={0}
              aria-current={isSelected ? "true" : undefined}
              aria-label={`${t.panels.selectDossier} ${project.name} ${t.panels.dossierSuffix}`}
              onClick={() => onSelectProject(project.slug)}
              onKeyDown={(event) => handleLedgerKeyDown(event, project.slug)}
            >
              <div>
                <span>{implementation.phaseLabel}</span>
                <h4>{project.name}</h4>
                <p>{project.officialSupport}</p>
              </div>
              <div>
                <b>{riskLabels[implementation.riskLevel]}</b>
                <p>{implementation.risk}</p>
              </div>
              <div>
                <b>{project.cases[0]?.when ?? t.panels.unscheduled}</b>
                <p>{project.cases[0]?.title ?? implementation.nextMilestone}</p>
              </div>
              <div className="signal-chips">
                {visibleSignals.map((signal) => (
                  <span key={signal.label} data-strength={signal.strength}>
                    {signal.label}: {signal.strength}
                  </span>
                ))}
                {strongest.slice(0, 1).map((capability) => (
                  <span key={capability.key}>{capability.label}</span>
                ))}
                {hiddenSignalCount > 0 ? <span>+{hiddenSignalCount} {t.panels.evidenceMore}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Dossier({
  t,
  project,
  implementation,
  allProjects,
  stats,
}: {
  t: SiteCopy;
  project: MemoryProject;
  implementation: ReturnType<typeof getProjectImplementation>;
  allProjects: MemoryProject[];
  stats: ReturnType<typeof getImplementationStats>;
}) {
  const groups = getCapabilityGroupScores(project.scores);
  const pairings = getPairingProjects(project, allProjects);
  const workflow = getProjectWorkflow(project.slug);

  return (
    <aside className="dossier-panel" tabIndex={0} aria-label={t.panels.dossierLabel}>
      <div className="dossier-head">
        <div>
          <p className="eyebrow">{project.layer}</p>
          <h3>{project.name}</h3>
        </div>
        <strong style={{ borderColor: project.accent }}>{getProjectCoverage(project)}%</strong>
      </div>

      <p>{project.summary}</p>

      <section className="dossier-section">
        <h4>{t.panels.researchState}</h4>
        <div className="progress-block">
          <div>
            <span>{implementation.lane}</span>
            <strong>{implementation.progress}%</strong>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-label={`${project.shortName} ${t.panels.researchProgress}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={implementation.progress}
          >
            <i style={{ width: `${implementation.progress}%` }} />
          </div>
        </div>
        <p>{implementation.nextMilestone}</p>
      </section>

      <section className="workflow-panel" aria-label="Plan Review QA Ship Learn workflow">
        {workflow.map((stage) => (
          <article key={stage.key} data-state={stage.state}>
            <span>{stage.label}</span>
            <strong>{stage.title}</strong>
          </article>
        ))}
      </section>

      <section className="dossier-section">
        <h4>{t.panels.capabilityGroups}</h4>
        <div className="group-grid compact">
          {groups.map((group) => (
            <article key={group.key}>
              <span>{group.label}</span>
              <strong>{formatPercent(group.value)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="dossier-section">
        <h4>{t.panels.evidenceSplit}</h4>
        <dl className="fact-list">
          <div>
            <dt>
              <BadgeCheck aria-hidden="true" size={15} />
              {t.panels.productSurface}
            </dt>
            <dd>{project.officialSupport}</dd>
          </div>
          <div>
            <dt>
              <Network aria-hidden="true" size={15} />
              {t.panels.technologySignal}
            </dt>
            <dd>{project.technologySignal}</dd>
          </div>
          <div>
            <dt>
              <ClipboardCheck aria-hidden="true" size={15} />
              {t.panels.researchProgressLabel}
            </dt>
            <dd>
              {stats.averageProgress}% {t.panels.averageProgress}; {stats.highRisk} {t.panels.highUncertainty}
            </dd>
          </div>
        </dl>
      </section>

      <section className="dossier-section">
        <h4>{t.panels.pairingCandidates}</h4>
        <div className="pair-list">
          {pairings.map((pairing) => (
            <span key={pairing.slug} style={{ borderColor: pairing.accent }}>
              {pairing.shortName}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="signal-list">
      <h4>{title}</h4>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </section>
  );
}

function averageCoverage(layerMatch: string) {
  const matches = memoryProjects.filter((project) =>
    project.layer.toLowerCase().includes(layerMatch.toLowerCase()),
  );

  if (matches.length === 0) {
    return 0;
  }

  return Math.round(
    matches.reduce((sum, project) => sum + getProjectCoverage(project), 0) /
      matches.length,
  );
}

export default App;
