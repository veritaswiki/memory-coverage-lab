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
import { useMemoryBenchMotion } from "./useMemoryBenchMotion";

const defaultStack = ["mem0", "zep-graphiti", "llamaindex", "vectorstack"];

const modes = [
  { id: "map", label: "Research map", icon: Radar },
  { id: "matrix", label: "Capability matrix", icon: Boxes },
  { id: "stack", label: "Stack design", icon: GitMerge },
  { id: "evidence", label: "Evidence ledger", icon: ShieldCheck },
] as const satisfies Array<{ id: StudioMode; label: string; icon: LucideIcon }>;

type StudioMode = "map" | "matrix" | "stack" | "evidence";
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

const researchCards = [
  {
    index: "01",
    month: "may-2026",
    dateTime: "2026-05",
    title: "AI memory products are not one category",
    body: "Memory APIs, temporal graphs, RAG frameworks and vector stores solve different parts of the agent memory problem.",
    meta: "11 systems / 16 criteria / 4 capability layers",
  },
  {
    index: "02",
    month: "may-2026",
    dateTime: "2026-05",
    title: "Vector retrieval is mature, but not memory",
    body: "Retrieval infrastructure scores high on read paths while leaving preference updates, contradiction repair and policy control elsewhere.",
    meta: "Infrastructure baseline / category boundary",
  },
  {
    index: "03",
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

function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<StudioMode>(() =>
    typeof window === "undefined" ? "map" : studioModeFromHash(window.location.hash) ?? "map",
  );
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
        Skip to main content
      </a>
      <TopRail onSelectMode={activateMode} />
      <main className="site-main" id="main-content" tabIndex={-1}>
        <Hero onSelectMode={activateMode} />
        <div className="page-continuum">
          <SurfaceSection onSelectMode={activateMode} />
          <PublishedResearch onSelectMode={activateMode} />
          <PlatformSection onSelectMode={activateMode} />

          <section className="studio-workbench briefing-section" id="benchmarks" aria-labelledby="studio-heading">
            <span id="evidence" className="scroll-anchor" aria-hidden="true" />
            <div className="section-frame briefing-frame studio-frame">
              <aside className="briefing-rail" aria-label="studio sequence">
                <span>04</span>
                <p>Benchmark studio</p>
              </aside>
              <div className="workbench-frame">
                <header className="workbench-head">
                  <div>
                    <p className="eyebrow">MemoryBench Intelligence Studio</p>
                    <h2 id="studio-heading">Category-first intelligence for AI memory systems</h2>
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
                          tabIndex={mode === item.id ? 0 : -1}
                          onClick={() => activateMode(item.id)}
                          onKeyDown={(event) => handleModeKeyDown(event, item.id)}
                        >
                          <Icon aria-hidden="true" size={17} />
                          <span>{item.label}</span>
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

                      {mode === "evidence" ? (
                        <EvidenceLedger
                          projects={filteredProjects}
                          selectedProject={selectedProject}
                          onSelectProject={selectProject}
                        />
                      ) : null}
                    </section>

                    <Dossier
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
          <SiteFooter onSelectMode={activateMode} />
        </div>
      </main>
    </div>
  );
}

function SurfaceSection({ onSelectMode }: { onSelectMode: SelectStudioMode }) {
  return (
    <section className="surface-section briefing-section" id="research">
      <div className="section-frame briefing-frame">
        <aside className="briefing-rail" aria-label="research sequence">
          <span>01</span>
          <p>Research thesis</p>
        </aside>
        <div className="section-intro">
          <p className="eyebrow">memorybench / surfaces</p>
          <h2 className="split-heading" aria-label="Read the research. Run the benchmark.">
            <span>Read the research.</span>
            <span>Run the benchmark.</span>
          </h2>
          <p>
            MemoryBench is built as a public intelligence dossier first and an
            interactive benchmark second. Every lower section follows the same
            evidence sequence: define the category, show the research artifact,
            then move into the studio where the claim can be tested.
          </p>
        </div>
        <div className="continuity-lane" aria-label="MemoryBench evidence flow">
          {continuityStages.map((stage) => (
            <article key={stage.number}>
              <span>{stage.number}</span>
              <strong>{stage.label}</strong>
              <p>{stage.body}</p>
            </article>
          ))}
        </div>
        <div className="surface-grid">
          <article>
            <span>Evidence archive</span>
            <h3>Research archive</h3>
            <p>
              The public layer holds category boundaries, method notes, raw
              scoring assumptions, and study summaries behind the studio.
            </p>
            <a className="action-link action-link-dark" href="#published">
              View studies
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </article>
          <article>
            <span>Method spine</span>
            <h3>One evidence chain</h3>
            <p>
              Every section uses the same sequence: define the layer, show the
              public claim, expose the score, then point back to evidence.
            </p>
            <a className="action-link action-link-dark" href="#evidence" onClick={(event) => {
              event.preventDefault();
              onSelectMode("evidence", false, true);
            }}>
              Open ledger
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </article>
          <article>
            <span>Interactive layer</span>
            <h3>Benchmark studio</h3>
            <p>
              Dense controls and dossier panels let teams inspect where a memory
              product fits, where it breaks, and what should be retested.
            </p>
            <a className="action-link action-link-dark" href="#benchmarks" onClick={(event) => {
              event.preventDefault();
              onSelectMode("map", false, true);
            }}>
              Open studio
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

function PublishedResearch({ onSelectMode }: { onSelectMode: SelectStudioMode }) {
  return (
    <section className="published-section briefing-section" id="published">
      <div className="section-frame briefing-frame">
        <aside className="briefing-rail" aria-label="published sequence">
          <span>02</span>
          <p>Published evidence</p>
        </aside>
        <div className="section-intro compact">
          <p className="eyebrow">Published</p>
          <h2>Public research</h2>
          <p>
            These briefing lines are the editorial front of the same benchmark
            model: category boundary first, score interpretation second, studio
            inspection third.
          </p>
        </div>
        <div className="research-list">
          {researchCards.map((card) => (
            <article key={card.title}>
              <div className="research-index">
                <b>{card.index}</b>
                <time dateTime={card.dateTime}>{card.month}</time>
              </div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
              <span>{card.meta}</span>
              <a className="action-link action-link-text" href="#evidence" onClick={(event) => {
                event.preventDefault();
                onSelectMode("evidence", false, true);
              }}>
                View study
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSection({ onSelectMode }: { onSelectMode: SelectStudioMode }) {
  return (
    <section className="platform-section briefing-section" id="platform">
      <div className="section-frame briefing-frame platform-frame">
        <aside className="briefing-rail" aria-label="platform sequence">
          <span>03</span>
          <p>Operational layer</p>
        </aside>
        <div className="platform-copy">
          <p className="eyebrow">Platform / for memory companies</p>
          <h2>An intelligence and optimization platform for AI memory products.</h2>
          <p>
            Per-category benchmarks for the memory layers that agents actually use:
            APIs, temporal graphs, RAG frameworks, retrieval substrate, and
            stateful runtimes. The public research, studio controls, and proof
            ledger now share one operating model.
          </p>
          <a
            className="outline-link action-link action-link-outline dark"
            href="#benchmarks"
            onClick={(event) => {
              event.preventDefault();
              onSelectMode("map", false, true);
            }}
          >
            See the benchmark
          </a>
        </div>
        <div className="platform-steps">
          {platformSteps.map((step) => (
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

function SiteFooter({ onSelectMode }: { onSelectMode: SelectStudioMode }) {
  return (
    <footer className="site-footer briefing-section" id="subscribe">
      <div className="section-frame briefing-frame footer-frame">
        <aside className="briefing-rail" aria-label="method handoff sequence">
          <span>05</span>
          <p>Method handoff</p>
        </aside>
        <div className="footer-copy">
          <p className="eyebrow">MemoryBench / AI memory intelligence</p>
          <h2>Follow the evidence trail.</h2>
          <p>
            The public surface closes where the studio starts: category boundary,
            benchmark evidence, implementation risk, and source trace remain part
            of one research loop.
          </p>
          <div className="footer-actions" aria-label="MemoryBench footer links">
            <a className="action-link action-link-outline" href="#research">Research thesis</a>
            <a className="action-link action-link-accent" href="#evidence" onClick={(event) => {
              event.preventDefault();
              onSelectMode("evidence", false, true);
            }}>
              Evidence ledger
            </a>
            <a className="action-link action-link-outline" href="https://github.com/veritaswiki/memory-coverage-lab">GitHub</a>
          </div>
        </div>
        <div className="footer-proof-grid" aria-label="MemoryBench proof summary">
          <article>
            <span>Method</span>
            <strong>16 criteria</strong>
            <p>same scoring model</p>
          </article>
          <article>
            <span>Coverage</span>
            <strong>11 systems</strong>
            <p>one category map</p>
          </article>
          <article>
            <span>Refresh</span>
            <strong>continuous QA</strong>
            <p>audited motion path</p>
          </article>
        </div>
      </div>
    </footer>
  );
}

function TopRail({ onSelectMode }: { onSelectMode: SelectStudioMode }) {
  return (
    <header className="top-rail">
      <a className="wordmark" href="#top" aria-label="MemoryBench home">
        <span>MemoryBench</span>
        <b>/ai-memory-intelligence</b>
      </a>
      <nav aria-label="primary navigation">
        <a href="#research">Research</a>
        <a href="#benchmarks" onClick={(event) => {
          event.preventDefault();
          onSelectMode("map", false, true);
        }}>Studio</a>
        <a href="#evidence" onClick={(event) => {
          event.preventDefault();
          onSelectMode("evidence", false, true);
        }}>Evidence</a>
      </nav>
      <a className="outline-link action-link action-link-outline" href="#benchmarks" onClick={(event) => {
        event.preventDefault();
        onSelectMode("map", false, true);
      }}>
        Open studio
      </a>
      <div className="reading-progress" aria-hidden="true">
        <span />
      </div>
    </header>
  );
}

function Hero({ onSelectMode }: { onSelectMode: SelectStudioMode }) {
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
          <a className="action-link action-link-primary" href="#research">
            See public research
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <a className="action-link action-link-accent" href="#benchmarks" onClick={(event) => {
            event.preventDefault();
            onSelectMode("map", false, true);
          }}>
            Explore benchmark data
          </a>
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

function EvidenceLedger({
  projects,
  selectedProject,
  onSelectProject,
}: {
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
              aria-label={`Select ${project.name} dossier`}
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
                <b>{project.cases[0]?.when ?? "Unscheduled"}</b>
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
                {hiddenSignalCount > 0 ? <span>+{hiddenSignalCount} evidence</span> : null}
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
    <aside className="dossier-panel" tabIndex={0} aria-label="selected system dossier">
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
