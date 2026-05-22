import type { LucideIcon } from "lucide-react";
import { BrainCircuit, DatabaseZap, Route, ShieldCheck } from "lucide-react";
import type { CapabilityGroupKey } from "../data/capabilities";
import type { getCapabilityGroupScores, getStrongestCapabilities } from "../lib/coverage";

type GroupScore = ReturnType<typeof getCapabilityGroupScores>[number];
type StrongCapability = ReturnType<typeof getStrongestCapabilities>[number];

interface ResearchModelStripProps {
  groupScores: GroupScore[];
  strengths: StrongCapability[];
}

const groupIcons: Record<CapabilityGroupKey, LucideIcon> = {
  cognitive: BrainCircuit,
  grounding: DatabaseZap,
  agentic: Route,
  assurance: ShieldCheck,
};

export function ResearchModelStrip({
  groupScores,
  strengths,
}: ResearchModelStripProps) {
  return (
    <section className="research-brief" aria-label="AIGC 研究维度摘要">
      <article className="research-thesis">
        <p className="eyebrow">AIGC memory science model</p>
        <h2>从记忆认知、检索扎根、Agent 运行和治理可信四层评估</h2>
        <p>
          先看研究层，再进入项目地图，避免把数据库、记忆 API 和完整 Memory OS 混成一类。
        </p>
      </article>

      <div className="group-score-grid">
        {groupScores.map((group) => {
          const Icon = groupIcons[group.key];

          return (
            <article key={group.key}>
              <div className="group-score-head">
                <span>
                  <Icon aria-hidden="true" size={16} />
                  {group.label}
                </span>
                <strong>{Math.round(group.value * 100)}%</strong>
              </div>
              <p>{group.summary}</p>
            </article>
          );
        })}
      </div>

      <aside className="strength-docket" aria-label="当前项目强项">
        <span>当前强项</span>
        {strengths.map((capability) => (
          <strong key={capability.key}>{capability.label}</strong>
        ))}
      </aside>
    </section>
  );
}
