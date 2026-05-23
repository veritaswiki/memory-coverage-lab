import { BadgeCheck, Link2, Network, Server } from "lucide-react";
import { getProjectImplementation, riskLabels } from "../data/implementation";
import type { MemoryProject } from "../data/projects";
import {
  calculateCoverageScore,
  formatPercent,
  getCapabilityGroupScores,
  getPairingProjects,
  getStrongestCapabilities,
} from "../lib/coverage";

interface ProjectPanelProps {
  project: MemoryProject;
  allProjects: MemoryProject[];
}

export function ProjectPanel({ project, allProjects }: ProjectPanelProps) {
  const pairings = getPairingProjects(project, allProjects);
  const groupScores = getCapabilityGroupScores(project.scores);
  const strongestCapabilities = getStrongestCapabilities(project.scores, 4);
  const implementation = getProjectImplementation(project.slug);

  return (
    <aside className="project-panel" aria-label="项目详情">
      <div className="project-panel-head">
        <div>
          <p className="eyebrow">{project.layer}</p>
          <h2>{project.name}</h2>
        </div>
        <div className="coverage-badge" style={{ borderColor: project.accent }}>
          {calculateCoverageScore(project.scores)}%
        </div>
      </div>

      <p className="summary-copy">{project.summary}</p>

      <div className="panel-section implementation-panel">
        <div className="panel-section-title">
          <h3>研究更新进展</h3>
          <span data-phase={implementation.phase}>{implementation.phaseLabel}</span>
        </div>
        <div className="implementation-progress">
          <div>
            <span>{implementation.lane}</span>
            <strong>{implementation.progress}%</strong>
          </div>
          <div
            className="meter"
            data-risk={implementation.riskLevel}
            role="progressbar"
            aria-label={`${project.shortName} research progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={implementation.progress}
          >
            <span style={{ width: `${implementation.progress}%` }} />
          </div>
        </div>
        <dl className="implementation-facts compact">
          <div>
            <dt>下一步</dt>
            <dd>{implementation.nextMilestone}</dd>
          </div>
          <div>
            <dt>{riskLabels[implementation.riskLevel]}</dt>
            <dd>{implementation.risk}</dd>
          </div>
        </dl>
        <div className="update-list">
          {implementation.updates.map((update) => (
            <article key={`${update.date}-${update.title}`}>
              <time dateTime={update.date}>{update.date}</time>
              <strong>{update.title}</strong>
              <p>{update.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="panel-evidence-strip" aria-label="证据摘要">
        {project.evidence.slice(0, 3).map((signal) => (
          <div key={signal.label} data-strength={signal.strength}>
            <span>{signal.strength}</span>
            <strong>{signal.label}</strong>
          </div>
        ))}
      </div>

      <div className="panel-section group-score-panel">
        <h3>研究分组画像</h3>
        <div className="panel-group-grid">
          {groupScores.map((group) => (
            <article key={group.key}>
              <span>{group.label}</span>
              <strong>{formatPercent(group.value)}</strong>
            </article>
          ))}
        </div>
      </div>

      <dl className="fact-list">
        <div>
          <dt>
            <Server aria-hidden="true" size={16} />
            角色
          </dt>
          <dd>{project.role}</dd>
        </div>
        <div>
          <dt>
            <BadgeCheck aria-hidden="true" size={16} />
            公开产品面
          </dt>
          <dd>{project.officialSupport}</dd>
        </div>
        <div>
          <dt>
            <Link2 aria-hidden="true" size={16} />
            技术交流信号
          </dt>
          <dd>{project.technologySignal}</dd>
        </div>
        <div>
          <dt>
            <Network aria-hidden="true" size={16} />
            类别边界
          </dt>
          <dd>{project.fitPosition}</dd>
        </div>
      </dl>

      <div className="panel-section">
        <h3>前沿能力强项</h3>
        <div className="strength-list">
          {strongestCapabilities.map((capability) => (
            <article key={capability.key}>
              <div>
                <strong>{capability.label}</strong>
                <span>{capability.lens}</span>
              </div>
              <b>{formatPercent(capability.value)}</b>
            </article>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>推荐配合</h3>
        <div className="pairing-list">
          {pairings.map((pairing) => (
            <span key={pairing.slug} style={{ borderColor: pairing.accent }}>
              {pairing.shortName}
            </span>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>证据强度</h3>
        <div className="evidence-stack">
          {project.evidence.map((signal) => (
            <article key={signal.label}>
              <span>{signal.strength}</span>
              <strong>{signal.label}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>研究样例时间</h3>
        <div className="case-list">
          {project.cases.map((caseNote) => (
            <article key={`${caseNote.when}-${caseNote.title}`}>
              <time dateTime={caseNote.when.replace("-Q2", "-04")}>
                {caseNote.when}
              </time>
              <strong>{caseNote.title}</strong>
              <p>{caseNote.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}
