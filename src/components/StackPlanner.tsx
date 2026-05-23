import { GitMerge } from "lucide-react";
import { capabilityDefinitions } from "../data/capabilities";
import { getProjectImplementation } from "../data/implementation";
import type { MemoryProject } from "../data/projects";
import {
  calculateCoverageScore,
  combineCapabilityScores,
  formatPercent,
  getCapabilityGroupScores,
  getCoverageGaps,
  getProjectCoverage,
} from "../lib/coverage";

interface StackPlannerProps {
  projects: MemoryProject[];
  selectedSlugs: string[];
  onToggleProject: (slug: string) => void;
}

export function StackPlanner({
  projects,
  selectedSlugs,
  onToggleProject,
}: StackPlannerProps) {
  const selectedProjects = projects.filter((project) =>
    selectedSlugs.includes(project.slug),
  );
  const combinedScores = combineCapabilityScores(selectedProjects);
  const combinedCoverage = calculateCoverageScore(combinedScores);
  const gaps = getCoverageGaps(combinedScores);
  const groupScores = getCapabilityGroupScores(combinedScores);
  const hasSelectedProjects = selectedProjects.length > 0;

  return (
    <section className="stack-view" aria-label="组合覆盖规划">
      <div className="section-head">
        <div>
          <p className="eyebrow">Portfolio research design</p>
          <h2>组合路线覆盖计算</h2>
        </div>
        <div className="stack-score">
          <GitMerge aria-hidden="true" size={20} />
          <span>组合覆盖</span>
          <strong>{hasSelectedProjects ? `${combinedCoverage}%` : "待选择"}</strong>
        </div>
      </div>

      <div className="planner-grid">
        <div className="selector-panel">
          <h3>选择项目</h3>
          <div className="project-toggle-list">
            {projects.map((project) => {
              const active = selectedSlugs.includes(project.slug);
              const implementation = getProjectImplementation(project.slug);
              return (
                <button
                  key={project.slug}
                  type="button"
                  aria-label={`Toggle ${project.shortName} in stack`}
                  aria-pressed={active}
                  className={active ? "active" : ""}
                  onClick={() => onToggleProject(project.slug)}
                >
                  <span
                    className="toggle-dot"
                    style={{ backgroundColor: project.color }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{project.shortName}</strong>
                    <small>
                      {implementation.phaseLabel} · {implementation.progress}%
                    </small>
                  </span>
                  <strong>{getProjectCoverage(project)}%</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div className="combined-panel">
          {hasSelectedProjects ? (
            <>
              <h3>研究分组</h3>
              <div className="planner-group-grid">
                {groupScores.map((group) => (
                  <article key={group.key}>
                    <span>{group.label}</span>
                    <strong>{formatPercent(group.value)}</strong>
                  </article>
                ))}
              </div>
              <h3>十六项能力</h3>
              <div className="combined-bars">
                {capabilityDefinitions.map((capability) => {
                  const value = combinedScores[capability.key];
                  return (
                    <div className="combined-row" key={capability.key}>
                      <div>
                        <span title={capability.description}>{capability.label}</span>
                        <strong>{formatPercent(value)}</strong>
                      </div>
                      <div
                        className="meter"
                        role="progressbar"
                        aria-label={`${capability.label} combined coverage`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(value * 100)}
                      >
                        <span style={{ width: `${value * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-stack-state" aria-live="polite">
              <h3>当前没有选择项目</h3>
              <p>
                选择至少一个系统后，这里才会计算组合覆盖。空栈不是 benchmark
                结论，只代表当前没有可比较的能力来源。
              </p>
            </div>
          )}
        </div>

        <div className="gap-panel">
          <h3>优先补齐</h3>
          {!hasSelectedProjects ? (
            <p className="empty-state">先选择项目，才能生成优先补齐列表。</p>
          ) : gaps.length > 0 ? (
            <div className="gap-list">
              {gaps.slice(0, 6).map((gap) => (
                <article key={gap.key}>
                  <strong>{gap.label}</strong>
                  <span>{formatPercent(gap.value)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">当前组合已覆盖主要记忆能力边界。</p>
          )}
        </div>
      </div>
    </section>
  );
}
