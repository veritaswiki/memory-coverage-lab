import { capabilityDefinitions } from "../data/capabilities";
import { getProjectImplementation } from "../data/implementation";
import type { MemoryProject } from "../data/projects";
import {
  calculateCoverageScore,
  capabilityBand,
  formatPercent,
  getCapabilityValue,
} from "../lib/coverage";

interface CapabilityMatrixProps {
  projects: MemoryProject[];
  selectedSlug: string;
  onSelectProject: (slug: string) => void;
}

export function CapabilityMatrix({
  projects,
  selectedSlug,
  onSelectProject,
}: CapabilityMatrixProps) {
  return (
    <section className="matrix-view" aria-label="项目能力矩阵">
      <div className="section-head">
        <div>
          <p className="eyebrow">Scientific capability matrix</p>
          <h2>十六项 AI memory 能力横向对照</h2>
        </div>
        <p>
          每个维度绑定研究 lens 与权重，覆盖分强调长期一致性、证据扎根、Agent 闭环和可信治理。
        </p>
      </div>

      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>项目</th>
              <th>总覆盖</th>
              <th>实施</th>
              {capabilityDefinitions.map((capability) => (
                <th key={capability.key}>
                  <span className="matrix-head-label">{capability.label}</span>
                  <span className="matrix-head-lens">{capability.lens}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const implementation = getProjectImplementation(project.slug);

              return (
                <tr
                  key={project.slug}
                  className={project.slug === selectedSlug ? "active" : ""}
                >
                  <th>
                    <button
                      type="button"
                      aria-current={project.slug === selectedSlug ? "true" : undefined}
                      onClick={() => onSelectProject(project.slug)}
                    >
                      {project.name}
                    </button>
                  </th>
                  <td>
                    <strong>{calculateCoverageScore(project.scores)}%</strong>
                  </td>
                  <td>
                    <span className="matrix-implementation">
                      <strong>{implementation.progress}%</strong>
                      <small>{implementation.phaseLabel}</small>
                    </span>
                  </td>
                  {capabilityDefinitions.map((capability) => {
                    const value = getCapabilityValue(project.scores, capability.key);
                    return (
                      <td key={capability.key}>
                        <span
                          className="matrix-cell"
                          data-band={capabilityBand(value)}
                          title={capability.description}
                        >
                          {formatPercent(value)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
