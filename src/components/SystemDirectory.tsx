import type { CSSProperties } from "react";
import {
  getProjectImplementation,
  getProjectWorkflow,
  riskLabels,
} from "../data/implementation";
import type { MemoryProject } from "../data/projects";
import { calculateCoverageScore } from "../lib/coverage";

interface SystemDirectoryProps {
  projects: MemoryProject[];
  selectedSlug: string;
  onSelectProject: (slug: string) => void;
}

export function SystemDirectory({
  projects,
  selectedSlug,
  onSelectProject,
}: SystemDirectoryProps) {
  const rankedProjects = [...projects].sort(
    (a, b) => calculateCoverageScore(b.scores) - calculateCoverageScore(a.scores),
  );

  return (
    <section className="system-directory" aria-label="System dossier directory">
      <div className="directory-head">
        <div>
          <p className="eyebrow">System dossier directory</p>
          <h3>每个项目的当前复测状态、进度与下一步</h3>
        </div>
        <div className="directory-count" aria-label="tracked system count">
          <strong>{projects.length}</strong>
          <span>tracked systems</span>
        </div>
      </div>

      <div className="directory-grid">
        {rankedProjects.map((project) => {
          const implementation = getProjectImplementation(project.slug);
          const workflow = getProjectWorkflow(project.slug);
          const latestUpdate = implementation.updates[0];
          const active = project.slug === selectedSlug;
          const coverage = calculateCoverageScore(project.scores);
          const style = {
            "--project-color": project.color,
            "--project-accent": project.accent,
          } as CSSProperties;

          return (
            <button
              key={project.slug}
              type="button"
              aria-label={`Open ${project.shortName} dossier`}
              className={active ? "active" : ""}
              style={style}
              onClick={() => onSelectProject(project.slug)}
            >
              <span className="directory-status">{implementation.phaseLabel}</span>
              <strong>{project.shortName}</strong>
              <em>{project.layer}</em>
              <p>{latestUpdate?.title ?? implementation.nextMilestone}</p>
              <div className="directory-workflow" aria-label={`${project.shortName} workflow status`}>
                {workflow.map((stage) => (
                  <span key={stage.key} data-state={stage.state}>
                    {stage.label}
                  </span>
                ))}
              </div>
              <div className="directory-progress" aria-label={`${project.shortName} research progress`}>
                <span style={{ width: `${implementation.progress}%` }} />
              </div>
              <footer>
                <span>{coverage}% coverage</span>
                <span>{riskLabels[implementation.riskLevel]}</span>
              </footer>
            </button>
          );
        })}
      </div>
    </section>
  );
}
