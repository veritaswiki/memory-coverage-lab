import { Activity, AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import {
  getImplementationStats,
  getProjectImplementation,
  riskLabels,
} from "../data/implementation";
import type { MemoryProject } from "../data/projects";

interface ImplementationBoardProps {
  projects: MemoryProject[];
  selectedProject: MemoryProject;
  onSelectProject: (slug: string) => void;
}

export function ImplementationBoard({
  projects,
  selectedProject,
  onSelectProject,
}: ImplementationBoardProps) {
  const stats = getImplementationStats(projects);
  const selectedImplementation = getProjectImplementation(selectedProject.slug);
  const latestUpdate = selectedImplementation.updates[0];

  return (
    <section className="implementation-board" aria-label="项目研究进展">
      <div className="implementation-head">
        <div>
          <p className="eyebrow">Research ledger</p>
          <h2>复测进展、缺口与下一里程碑</h2>
        </div>
        <p>
          覆盖分回答“公开能力覆盖什么”，研究账本回答“复测到哪、风险在哪、下一步是什么”。
        </p>
      </div>

      <div className="implementation-stats" aria-label="实施概览">
        <article>
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>已发布</span>
          <strong>{stats.production}</strong>
        </article>
        <article>
          <Activity aria-hidden="true" size={16} />
          <span>复测中</span>
          <strong>{stats.active}</strong>
        </article>
        <article>
          <FlaskConical aria-hidden="true" size={16} />
          <span>评估中</span>
          <strong>{stats.evaluating}</strong>
        </article>
        <article>
          <AlertTriangle aria-hidden="true" size={16} />
          <span>高不确定</span>
          <strong>{stats.highRisk}</strong>
        </article>
      </div>

      <div className="implementation-selected">
        <div className="implementation-selected-head">
          <div>
            <span>{selectedImplementation.lane}</span>
            <h3>{selectedProject.name}</h3>
          </div>
          <b data-phase={selectedImplementation.phase}>
            {selectedImplementation.phaseLabel}
          </b>
        </div>

        <div className="implementation-progress">
          <div>
            <span>实施进度</span>
            <strong>{selectedImplementation.progress}%</strong>
          </div>
          <div className="meter" data-risk={selectedImplementation.riskLevel}>
            <span style={{ width: `${selectedImplementation.progress}%` }} />
          </div>
        </div>

        <dl className="implementation-facts">
          <div>
            <dt>研究台</dt>
            <dd>{selectedImplementation.owner}</dd>
          </div>
          <div>
            <dt>最近更新</dt>
            <dd>{selectedImplementation.lastUpdated}</dd>
          </div>
          <div>
            <dt>下一里程碑</dt>
            <dd>{selectedImplementation.nextMilestone}</dd>
          </div>
          <div>
            <dt>{riskLabels[selectedImplementation.riskLevel]}</dt>
            <dd>{selectedImplementation.risk}</dd>
          </div>
        </dl>

        {latestUpdate ? (
          <article className="latest-update">
            <time>{latestUpdate.date}</time>
            <strong>{latestUpdate.title}</strong>
            <p>{latestUpdate.detail}</p>
          </article>
        ) : null}
      </div>

      <div className="implementation-rail" aria-label="项目实施列表">
        {projects.map((project) => {
          const implementation = getProjectImplementation(project.slug);
          const active = project.slug === selectedProject.slug;

          return (
            <button
              key={project.slug}
              type="button"
              className={active ? "active" : ""}
              onClick={() => onSelectProject(project.slug)}
            >
              <span className="rail-dot" style={{ backgroundColor: project.color }} />
              <span>
                <strong>{project.shortName}</strong>
                <small>{implementation.phaseLabel}</small>
              </span>
              <b>{implementation.progress}%</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}
