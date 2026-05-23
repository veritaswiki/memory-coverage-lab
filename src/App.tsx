import { useMemo, useState } from "react";
import {
  BenchmarkControls,
  type ActiveView,
} from "./components/BenchmarkControls";
import { CapabilityMatrix } from "./components/CapabilityMatrix";
import { CoverageMap } from "./components/CoverageMap";
import { EvidenceTable } from "./components/EvidenceTable";
import { ImplementationBoard } from "./components/ImplementationBoard";
import {
  HeroSection,
  OperatingLoopSection,
  PlatformSection,
  ResearchCards,
  SubscribeSection,
  SurfaceSection,
} from "./components/LandingSections";
import { MetricRibbon } from "./components/MetricRibbon";
import { ProjectPanel } from "./components/ProjectPanel";
import { ResearchModelStrip } from "./components/ResearchModelStrip";
import { StackPlanner } from "./components/StackPlanner";
import { SystemDirectory } from "./components/SystemDirectory";
import { TopBar } from "./components/TopBar";
import { capabilityDefinitions } from "./data/capabilities";
import { getProjectImplementation } from "./data/implementation";
import { memoryProjects } from "./data/projects";
import {
  calculateCoverageScore,
  combineCapabilityScores,
  getCapabilityGroupScores,
  getCoverageGaps,
  getStrongestCapabilities,
} from "./lib/coverage";

const defaultStack = ["mem0", "zep-graphiti", "llamaindex", "vectorstack"];

function App() {
  const [activeView, setActiveView] = useState<ActiveView>("map");
  const [selectedSlug, setSelectedSlug] = useState("mem0");
  const [query, setQuery] = useState("");
  const [stackSlugs, setStackSlugs] = useState<string[]>(defaultStack);
  const stackProjects = useMemo(
    () => memoryProjects.filter((project) => stackSlugs.includes(project.slug)),
    [stackSlugs],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

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
  }, [query]);

  const selectedProject =
    memoryProjects.find((project) => project.slug === selectedSlug) ??
    memoryProjects[0]!;
  const visibleSelectedProject = filteredProjects.some(
    (project) => project.slug === selectedProject.slug,
  )
    ? selectedProject
    : (filteredProjects[0] ?? selectedProject);
  const stackScores = useMemo(
    () => combineCapabilityScores(stackProjects),
    [stackProjects],
  );
  const selectedGroupScores = getCapabilityGroupScores(visibleSelectedProject.scores);
  const selectedStrengths = getStrongestCapabilities(visibleSelectedProject.scores, 3);
  const stackCoverage = calculateCoverageScore(stackScores);
  const gapCount = getCoverageGaps(stackScores).length;

  function handleSelectProject(slug: string) {
    setSelectedSlug(slug);
  }

  function handleToggleProject(slug: string) {
    setStackSlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((currentSlug) => currentSlug !== slug);
      }

      return [...current, slug];
    });
  }

  return (
    <div className="app-shell">
      <TopBar />

      <HeroSection />
      <SurfaceSection />
      <OperatingLoopSection />
      <ResearchCards />
      <PlatformSection />

      <section className="benchmark-section" id="benchmarks">
        <div className="benchmark-head">
          <div>
            <p className="eyebrow">Benchmark explorer</p>
            <h2>Objective AI memory coverage map</h2>
          </div>
          <p>
            公开研究分数是启发式 scorecard，不是采购背书。它把 memory API、
            temporal graph、RAG framework、vector substrate 和 agent runtime
            放到同一能力边界中比较。
          </p>
        </div>

        <BenchmarkControls
          activeView={activeView}
          onViewChange={setActiveView}
          query={query}
          onQueryChange={setQuery}
        />

        <SystemDirectory
          projects={filteredProjects}
          selectedSlug={visibleSelectedProject.slug}
          onSelectProject={handleSelectProject}
        />

        <section className="overview-deck" aria-label="模型与运行概览">
          <MetricRibbon
            dimensionCount={capabilityDefinitions.length}
            projectCount={memoryProjects.length}
            stackCoverage={stackCoverage}
            gapCount={gapCount}
            focusCoverage={calculateCoverageScore(visibleSelectedProject.scores)}
          />

          <ResearchModelStrip
            groupScores={selectedGroupScores}
            strengths={selectedStrengths}
          />
        </section>

        <main className="workspace">
          <section className="workspace-main">
            {activeView === "map" ? (
              <CoverageMap
                projects={filteredProjects}
                selectedProject={visibleSelectedProject}
                selectedStackSlugs={stackSlugs}
                onSelectProject={handleSelectProject}
              />
            ) : null}

            {activeView === "matrix" ? (
              <CapabilityMatrix
                projects={filteredProjects}
                selectedSlug={visibleSelectedProject.slug}
                onSelectProject={handleSelectProject}
              />
            ) : null}

            {activeView === "stack" ? (
              <StackPlanner
                projects={memoryProjects}
                selectedSlugs={stackSlugs}
                onToggleProject={handleToggleProject}
              />
            ) : null}

            {activeView === "governance" ? (
              <EvidenceTable projects={filteredProjects} />
            ) : null}
          </section>

          <ProjectPanel project={visibleSelectedProject} allProjects={memoryProjects} />
        </main>

        {activeView === "map" ? (
          <ImplementationBoard
            projects={filteredProjects}
            selectedProject={visibleSelectedProject}
            onSelectProject={handleSelectProject}
          />
        ) : null}
      </section>

      <SubscribeSection />

      <footer className="status-strip" aria-label="site footer">
        <span>MemoryBench / ai-memory-intelligence</span>
        <span>Objective scorecards for AI memory categories</span>
        <a href="https://github.com/veritaswiki/memory-coverage-lab">GitHub</a>
      </footer>
    </div>
  );
}

export default App;
