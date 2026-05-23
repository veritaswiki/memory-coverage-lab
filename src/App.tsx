import { useMemo, useState, type CSSProperties } from "react";
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

const defaultStack = ["mem0", "zep-graphiti", "llamaindex", "vectorstack"];

const modes = [
  { id: "map", label: "Research map", icon: Radar },
  { id: "matrix", label: "Capability matrix", icon: Boxes },
  { id: "stack", label: "Stack design", icon: GitMerge },
  { id: "evidence", label: "Evidence ledger", icon: ShieldCheck },
] as const satisfies Array<{ id: StudioMode; label: string; icon: LucideIcon }>;

type StudioMode = "map" | "matrix" | "stack" | "evidence";

const heroWorkflow = [
  { label: "Plan", value: "Scope locked", state: "done" },
  { label: "Review", value: "Docs challenged", state: "done" },
  { label: "QA", value: "Hard cases live", state: "current" },
  { label: "Ship", value: "Scorecards public", state: "queued" },
  { label: "Learn", value: "Changes tracked", state: "watch" },
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

const researchCards = [
  {
    month: "may-2026",
    dateTime: "2026-05",
    title: "AI memory products are not one category",
    body: "Memory APIs, temporal graphs, RAG frameworks and vector stores solve different parts of the agent memory problem.",
    meta: "11 systems / 16 criteria / 4 capability layers",
  },
  {
    month: "may-2026",
    dateTime: "2026-05",
    title: "Vector retrieval is mature, but not memory",
    body: "Retrieval infrastructure scores high on read paths while leaving preference updates, contradiction repair and policy control elsewhere.",
    meta: "Infrastructure baseline / category boundary",
  },
  {
    month: "may-2026",
    dateTime: "2026-05",
    title: "Temporal graphs are the strongest fact-dynamics bet",
    body: "Entity updates and relationship drift separate graph memory systems from simpler session recall or document search layers.",
    meta: "Temporal KG / conflict repair / source tracing",
  },
];

const platformSteps = [
  {
    number: "01",
    label: "Dataset",
    title: "Memory benchmark dataset",
    body: "Structured vendor runs across user preference, entity updates, retrieval grounding, deletion, and multi-session continuity prompts.",
  },
  {
    number: "02",
    label: "Dashboard",
    title: "Capability boundary explorer",
    body: "Coverage map, project matrix, stack design and evidence ledger for comparing adjacent products without collapsing categories.",
  },
  {
    number: "03",
    label: "Signal",
    title: "Continuous re-runs",
    body: "Scorecards are designed to refresh as vendors ship APIs, frameworks change, and model memory patterns drift.",
  },
  {
    number: "04",
    label: "Playbooks",
    title: "Neutral adoption briefs",
    body: "Evidence-led notes on where each memory layer fits, what it does not cover, and which claims need validation.",
  },
];

function App() {
  const [mode, setMode] = useState<StudioMode>("map");
  const [selectedSlug, setSelectedSlug] = useState("mem0");
  const [query, setQuery] = useState("");
  const [stackSlugs, setStackSlugs] = useState<string[]>(defaultStack);
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

  return (
    <div className="opendesign-app">
      <TopRail onSelectMode={setMode} />
      <Hero />
      <SurfaceSection />
      <PublishedResearch />
      <PlatformSection />

      <main className="studio-workbench" id="benchmarks">
        <span id="evidence" className="scroll-anchor" aria-hidden="true" />
        <header className="workbench-head">
          <div>
            <p className="eyebrow">MemoryBench Intelligence Studio</p>
            <h2>Category-first intelligence for AI memory systems</h2>
          </div>
          <p>
            The interface starts from first principles: define the category,
            inspect the evidence, compare the capability boundary, then design a
            stack with visible gaps.
          </p>
        </header>

        <section className="metric-ribbon" aria-label="current benchmark context">
          <Metric icon={Boxes} label="Visible systems" value={String(filteredProjects.length)} />
          <Metric icon={Radar} label="Criteria" value={String(capabilityDefinitions.length)} />
          <Metric
            icon={Layers3}
            label={normalizedQuery ? "Filtered stack" : "Stack coverage"}
            value={stackProjects.length === 0 ? "Pending" : `${stackCoverage}%`}
          />
          <Metric icon={TriangleAlert} label="Open gaps" value={String(stackGaps.length)} />
          <Metric icon={Target} label="Focus score" value={`${focusCoverage}%`} strong />
        </section>

        <section className="studio-controls" aria-label="studio controls">
          <label className="search-control" htmlFor="memorybench-search">
            <Search aria-hidden="true" size={18} />
            <input
              id="memorybench-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search systems, layers, evidence, risks"
              aria-label="Search systems, layers, evidence, and risks"
            />
          </label>

          <div className="mode-tabs" role="tablist" aria-label="MemoryBench studio views">
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
                  onClick={() => setMode(item.id)}
                >
                  <Icon aria-hidden="true" size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {filteredProjects.length === 0 ? (
          <section className="empty-scope" aria-live="polite">
            <p className="eyebrow">No matching dossier</p>
            <h3>No system or evidence line matches this filter.</h3>
            <p>Try category terms such as graph, RAG, vector, runtime, governance, or API.</p>
          </section>
        ) : (
          <section className="studio-grid">
            <section
              className="primary-lab"
              id="studio-panel"
              role="tabpanel"
              aria-labelledby={`studio-tab-${mode}`}
              aria-label="MemoryBench primary work area"
            >
              {mode === "map" ? (
                <BoundaryMap
                  projects={filteredProjects}
                  selectedProject={selectedProject}
                  selectedStackSlugs={stackProjects.map((project) => project.slug)}
                  onSelectProject={selectProject}
                />
              ) : null}

              {mode === "matrix" ? (
                <CapabilityMatrix
                  projects={filteredProjects}
                  selectedProject={selectedProject}
                  onSelectProject={selectProject}
                />
              ) : null}

              {mode === "stack" ? (
                <StackStudio
                  projects={scopeProjects}
                  selectedSlugs={stackSlugs}
                  stackProjects={stackProjects}
                  stackCoverage={stackCoverage}
                  onToggleProject={toggleStack}
                />
              ) : null}

              {mode === "evidence" ? <EvidenceLedger projects={filteredProjects} /> : null}
            </section>

            <Dossier
              project={selectedProject}
              implementation={selectedImplementation}
              allProjects={memoryProjects}
              stats={stats}
            />
          </section>
        )}
      </main>

      <footer className="site-footer" id="subscribe">
        <span>MemoryBench / AI memory intelligence</span>
        <a href="https://github.com/veritaswiki/memory-coverage-lab">GitHub</a>
      </footer>
    </div>
  );
}

function SurfaceSection() {
  return (
    <section className="surface-section" id="research">
      <div className="section-intro">
        <p className="eyebrow">memorybench / surfaces</p>
        <h2>Read the research. Run the benchmark.</h2>
      </div>
      <div className="surface-grid">
        <article>
          <span>Research Public</span>
          <h3>Public research</h3>
          <p>
            Open reports on memory category boundaries, methodology, raw scoring
            assumptions, and published studies behind every claim on this site.
          </p>
          <a href="#published">
            View studies
            <ArrowRight aria-hidden="true" size={17} />
          </a>
        </article>
        <article>
          <span>Platform Benchmark</span>
          <h3>Intelligence platform</h3>
          <p>
            Private dashboard shape, continuous re-runs, and category playbooks
            for teams that need to know how agents see their memory layer.
          </p>
          <a href="#benchmarks">
            Open studio
            <ArrowRight aria-hidden="true" size={17} />
          </a>
        </article>
      </div>
    </section>
  );
}

function PublishedResearch() {
  return (
    <section className="published-section" id="published">
      <div className="section-intro compact">
        <p className="eyebrow">Published</p>
        <h2>Public research</h2>
      </div>
      <div className="research-list">
        {researchCards.map((card) => (
          <article key={card.title}>
            <time dateTime={card.dateTime}>{card.month}</time>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            <span>{card.meta}</span>
            <a href="#benchmarks">View study</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section className="platform-section" id="platform">
      <div className="platform-copy">
        <p className="eyebrow">Platform / for memory companies</p>
        <h2>An intelligence and optimization platform for AI memory products.</h2>
        <p>
          Per-category benchmarks for the memory layers that agents actually use:
          APIs, temporal graphs, RAG frameworks, retrieval substrate, and
          stateful runtimes.
        </p>
        <a className="outline-link dark" href="#benchmarks">
          See the benchmark
        </a>
      </div>
      <div className="platform-steps">
        {platformSteps.map((step) => (
          <article key={step.number}>
            <div>
              <span>{step.number} / {step.label}</span>
              <Activity aria-hidden="true" size={18} />
            </div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TopRail({ onSelectMode }: { onSelectMode: (mode: StudioMode) => void }) {
  return (
    <header className="top-rail">
      <a className="wordmark" href="#top" aria-label="MemoryBench home">
        <span>MemoryBench</span>
        <b>/ai-memory-intelligence</b>
      </a>
      <nav aria-label="primary navigation">
        <a href="#research">Research</a>
        <a href="#benchmarks" onClick={() => onSelectMode("map")}>Studio</a>
        <a href="#evidence" onClick={() => onSelectMode("evidence")}>Evidence</a>
      </nav>
      <a className="outline-link" href="#benchmarks">
        Open studio
      </a>
    </header>
  );
}

function Hero() {
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
          <b>criteria</b>
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
            <span>Evidence loop</span>
          </div>
          {heroWorkflow.map((stage) => (
            <article key={stage.label} data-state={stage.state}>
              <span>{stage.label}</span>
              <strong>{stage.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-copy">
        <p className="eyebrow">Objective AI memory intelligence</p>
        <h1 aria-label="When AI agents remember, what survives and why?">
          <span>When AI agents</span>
          <span>remember, what</span>
          <span>survives</span>
          <span>and why?</span>
        </h1>
        <p>
          MemoryBench separates memory APIs, temporal graphs, RAG frameworks,
          vector infrastructure, and stateful runtimes before any score is allowed
          to look comparable.
        </p>
        <div className="hero-actions">
          <a href="#research">
            See public research
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <a href="#benchmarks">Explore benchmark data</a>
        </div>
        <div className="lane-strip" id="memory-categories" aria-label="memory categories">
          {researchLanes.map((lane) => (
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
  projects,
  selectedProject,
  selectedStackSlugs,
  onSelectProject,
}: {
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
    <div className="boundary-workbench" aria-label="AI memory boundary map">
      <div className="boundary-canvas">
        <header className="panel-title">
          <div>
            <p className="eyebrow">AI memory boundary</p>
            <h3>{selectedProject.name}</h3>
          </div>
          <strong>{getProjectCoverage(selectedProject)}%</strong>
        </header>

        <div className="circle-stage" role="group" aria-label="Selectable AI memory coverage circle map">
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
                aria-label={`Open ${project.shortName} dossier${isStacked ? ", in stack" : ""}`}
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
        <SignalList title="Strongest signals" items={topCapabilities.map((item) => item.label)} />
        <SignalList
          title="Priority gaps"
          items={gaps.length > 0 ? gaps.map((item) => item.label) : ["No major gap"]}
        />
      </aside>
    </div>
  );
}

function CapabilityMatrix({
  projects,
  selectedProject,
  onSelectProject,
}: {
  projects: MemoryProject[];
  selectedProject: MemoryProject;
  onSelectProject: (slug: string) => void;
}) {
  return (
    <div className="matrix-workbench" aria-label="capability matrix">
      <header className="panel-title">
        <div>
          <p className="eyebrow">Scientific capability matrix</p>
          <h3>Sixteen-axis category comparison</h3>
        </div>
        <p>Scores are heuristic research signals, not vendor endorsements.</p>
      </header>

      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Layer</th>
              <th>Score</th>
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
  projects,
  selectedSlugs,
  stackProjects,
  stackCoverage,
  onToggleProject,
}: {
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
    <div className="stack-workbench" aria-label="stack planner">
      <header className="panel-title">
        <div>
          <p className="eyebrow">Portfolio design</p>
          <h3>Compose a memory stack by category boundary</h3>
        </div>
        <strong>{stackProjects.length === 0 ? "Pending" : `${stackCoverage}%`}</strong>
      </header>

      <div className="stack-grid">
        <section className="selector-panel" aria-label="select stack systems">
          {projects.map((project) => {
            const active = selectedSlugs.includes(project.slug);
            const implementation = getProjectImplementation(project.slug);

            return (
              <button
                key={project.slug}
                type="button"
                aria-pressed={active}
                aria-label={`Toggle ${project.shortName} in stack`}
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
              <h4>No systems selected</h4>
              <p>Select at least one project to compute combined memory coverage.</p>
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
                <h4>Priority gaps</h4>
                {(gaps.length > 0 ? gaps.slice(0, 6) : [{ key: "none", label: "No major gap", value: 1 }]).map(
                  (gap) => (
                    <div key={gap.key} className="meter-row">
                      <span>{gap.label}</span>
                      <strong>{formatPercent(gap.value)}</strong>
                      <div
                        className="meter"
                        role="progressbar"
                        aria-label={`${gap.label} combined coverage`}
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

function EvidenceLedger({ projects }: { projects: MemoryProject[] }) {
  return (
    <div className="evidence-workbench" aria-label="evidence ledger">
      <header className="panel-title">
        <div>
          <p className="eyebrow">Governance evidence</p>
          <h3>Public surface, risk, case, and signal ledger</h3>
        </div>
        <p>Evidence is separated from scores so category claims stay auditable.</p>
      </header>

      <div className="evidence-list">
        {projects.map((project) => {
          const implementation = getProjectImplementation(project.slug);
          const strongest = getStrongestCapabilities(project.scores, 2);

          return (
            <article key={project.slug} className="evidence-row">
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
                <b>{project.cases[0]?.when ?? "Unscheduled"}</b>
                <p>{project.cases[0]?.title ?? implementation.nextMilestone}</p>
              </div>
              <div className="signal-chips">
                {project.evidence.map((signal) => (
                  <span key={signal.label} data-strength={signal.strength}>
                    {signal.label}: {signal.strength}
                  </span>
                ))}
                {strongest.map((capability) => (
                  <span key={capability.key}>{capability.label}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Dossier({
  project,
  implementation,
  allProjects,
  stats,
}: {
  project: MemoryProject;
  implementation: ReturnType<typeof getProjectImplementation>;
  allProjects: MemoryProject[];
  stats: ReturnType<typeof getImplementationStats>;
}) {
  const groups = getCapabilityGroupScores(project.scores);
  const pairings = getPairingProjects(project, allProjects);
  const workflow = getProjectWorkflow(project.slug);

  return (
    <aside className="dossier-panel" aria-label="selected system dossier">
      <div className="dossier-head">
        <div>
          <p className="eyebrow">{project.layer}</p>
          <h3>{project.name}</h3>
        </div>
        <strong style={{ borderColor: project.accent }}>{getProjectCoverage(project)}%</strong>
      </div>

      <p>{project.summary}</p>

      <section className="dossier-section">
        <h4>Research state</h4>
        <div className="progress-block">
          <div>
            <span>{implementation.lane}</span>
            <strong>{implementation.progress}%</strong>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-label={`${project.shortName} research progress`}
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
        <h4>Capability groups</h4>
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
        <h4>Evidence split</h4>
        <dl className="fact-list">
          <div>
            <dt>
              <BadgeCheck aria-hidden="true" size={15} />
              Product surface
            </dt>
            <dd>{project.officialSupport}</dd>
          </div>
          <div>
            <dt>
              <Network aria-hidden="true" size={15} />
              Technology signal
            </dt>
            <dd>{project.technologySignal}</dd>
          </div>
          <div>
            <dt>
              <ClipboardCheck aria-hidden="true" size={15} />
              Research progress
            </dt>
            <dd>
              {stats.averageProgress}% average visible progress; {stats.highRisk} high
              uncertainty line(s).
            </dd>
          </div>
        </dl>
      </section>

      <section className="dossier-section">
        <h4>Pairing candidates</h4>
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
