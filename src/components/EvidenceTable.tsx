import { ShieldCheck } from "lucide-react";
import { getProjectImplementation, riskLabels } from "../data/implementation";
import type { MemoryProject } from "../data/projects";
import { calculateCoverageScore, getStrongestCapabilities } from "../lib/coverage";

interface EvidenceTableProps {
  projects: MemoryProject[];
}

export function EvidenceTable({ projects }: EvidenceTableProps) {
  return (
    <section className="evidence-view" aria-label="治理证据表">
      <div className="section-head">
        <div>
          <p className="eyebrow">Support, signal, cases, validity</p>
          <h2>官方支持、技术交流、案例与可信证据</h2>
        </div>
        <p>
          把产品成熟度、研究传播、真实接入案例和能力强项拆开，避免把数据库、框架、记忆 API 与完整 Memory OS 混为一类。
        </p>
      </div>

      <div className="evidence-list">
        {projects.map((project) => (
          <article className="evidence-item" key={project.slug}>
            {(() => {
              const implementation = getProjectImplementation(project.slug);

              return (
                <>
                  <div className="evidence-title">
                    <ShieldCheck aria-hidden="true" size={18} />
                    <div>
                      <h3>{project.name}</h3>
                      <span>
                        {project.layer} · {calculateCoverageScore(project.scores)}% ·{" "}
                        {implementation.phaseLabel}
                      </span>
                    </div>
                  </div>

                  <div className="evidence-columns">
                    <div>
                      <h4>实施进展</h4>
                      <p>
                        <strong>{implementation.progress}%</strong>{" "}
                        {implementation.lane}
                      </p>
                      <p>{implementation.nextMilestone}</p>
                    </div>
                    <div>
                      <h4>官方支持</h4>
                      <p>{project.officialSupport}</p>
                    </div>
                    <div>
                      <h4>技术交流</h4>
                      <p>{project.technologySignal}</p>
                    </div>
                    <div>
                      <h4>项目配合案例</h4>
                      {project.cases.map((caseNote) => (
                        <p key={`${project.slug}-${caseNote.when}`}>
                          <time>{caseNote.when}</time> {caseNote.title}
                        </p>
                      ))}
                    </div>
                    <div>
                      <h4>风险与强项</h4>
                      <p>
                        <strong>{riskLabels[implementation.riskLevel]}</strong>{" "}
                        {implementation.risk}
                      </p>
                      {getStrongestCapabilities(project.scores, 2).map((capability) => (
                        <p key={capability.key}>
                          <strong>{capability.label}</strong> {capability.lens}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="signal-row">
                    {project.evidence.map((signal) => (
                      <span key={signal.label} data-strength={signal.strength}>
                        {signal.label}: {signal.strength}
                      </span>
                    ))}
                  </div>
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </section>
  );
}
