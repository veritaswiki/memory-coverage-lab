import { useMemo, useState } from "react";
import { CapabilityMatrix } from "./components/CapabilityMatrix";
import { CoverageMap } from "./components/CoverageMap";
import { EvidenceTable } from "./components/EvidenceTable";
import { ImplementationBoard } from "./components/ImplementationBoard";
import { MetricRibbon } from "./components/MetricRibbon";
import { ProjectPanel } from "./components/ProjectPanel";
import { ResearchModelStrip } from "./components/ResearchModelStrip";
import { StackPlanner } from "./components/StackPlanner";
import { type ActiveView, TopBar } from "./components/TopBar";
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

const defaultStack = ["llm-wiki", "gbrain", "hindsight", "nowledge-mem"];

function App() {
  const [activeView, setActiveView] = useState<ActiveView>("map");
  const [selectedSlug, setSelectedSlug] = useState("gbrain");
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
      <TopBar
        activeView={activeView}
        onViewChange={setActiveView}
        query={query}
        onQueryChange={setQuery}
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

      <footer className="status-strip" aria-label="局域网访问状态">
        <span>Dev host: :::5179</span>
        <span>LAN: 192.168.31.22:5179</span>
        <span>Tailnet host: luxmac-mini.tail3aaf3f.ts.net:5179</span>
        <span>Tailscale: 100.119.246.9:5179</span>
      </footer>
    </div>
  );
}

export default App;
