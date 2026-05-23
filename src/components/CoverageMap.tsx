import { CheckCircle2, CircleDotDashed, Layers3, Target } from "lucide-react";
import { capabilityDefinitions } from "../data/capabilities";
import { getProjectImplementation } from "../data/implementation";
import type { MemoryProject } from "../data/projects";
import {
  calculateCoverageScore,
  capabilityBand,
  formatPercent,
  getCoverageGaps,
  getCapabilityGroupScores,
  getCapabilityValue,
  getStrongestCapabilities,
} from "../lib/coverage";

interface CoverageMapProps {
  projects: MemoryProject[];
  selectedProject: MemoryProject;
  selectedStackSlugs: string[];
  stackSelectionLabel: string;
  onSelectProject: (slug: string) => void;
}

const boundary = {
  cx: 420,
  cy: 330,
  r: 238,
};

const ringLevels = [0.25, 0.5, 0.75, 1];

const groupAnchors = [
  { label: "记忆认知", x: 420, y: 64, anchor: "middle" },
  { label: "检索扎根", x: 740, y: 334, anchor: "middle" },
  { label: "治理可信", x: 420, y: 622, anchor: "middle" },
  { label: "Agent 运行", x: 100, y: 334, anchor: "middle" },
] as const;

export function CoverageMap({
  projects,
  selectedProject,
  selectedStackSlugs,
  stackSelectionLabel,
  onSelectProject,
}: CoverageMapProps) {
  const selectedCoverage = calculateCoverageScore(selectedProject.scores);
  const groupScores = getCapabilityGroupScores(selectedProject.scores);
  const selectedImplementation = getProjectImplementation(selectedProject.slug);
  const selectedStrengths = getStrongestCapabilities(selectedProject.scores, 3);
  const selectedGaps = getCoverageGaps(selectedProject.scores, 0.62).slice(0, 3);
  const rankedProjects = [...projects].sort(
    (a, b) => calculateCoverageScore(b.scores) - calculateCoverageScore(a.scores),
  );
  const selectedPolygon = capabilityDefinitions
    .map((capability, index) => {
      const angle =
        (Math.PI * 2 * index) / capabilityDefinitions.length - Math.PI / 2;
      const value = getCapabilityValue(selectedProject.scores, capability.key);
      const radius = 36 + value * (boundary.r - 36);
      const x = boundary.cx + Math.cos(angle) * radius;
      const y = boundary.cy + Math.sin(angle) * radius;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="coverage-shell" aria-label="记忆覆盖圆图">
      <div className="map-stage">
        <div className="map-titlebar">
          <div>
            <p className="eyebrow">AI memory cartography</p>
            <h2>{selectedProject.name}</h2>
            <span className="map-titlebar-note">
              外圈是完整 AI memory 能力边界；填充轮廓表示当前系统在 16 个维度上的公开覆盖。
            </span>
          </div>
          <div className="map-titlebar-score">
            <span>边界覆盖</span>
            <strong>{selectedCoverage}%</strong>
          </div>
        </div>

        <svg
          className="coverage-svg"
          viewBox="0 0 840 660"
          role="img"
          aria-label="完整 AI memory 边界与各项目能力覆盖圆"
        >
          <defs>
            <radialGradient id="boundary-fill" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#fffdf6" />
              <stop offset="100%" stopColor="#edf0e2" />
            </radialGradient>
            <linearGradient id="selected-arc" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#245f4f" />
              <stop offset="52%" stopColor="#156c7a" />
              <stop offset="100%" stopColor="#d89a32" />
            </linearGradient>
          </defs>

          <circle
            cx={boundary.cx}
            cy={boundary.cy}
            r={boundary.r}
            fill="url(#boundary-fill)"
            stroke="#1b2a26"
            strokeWidth="2"
            strokeDasharray="9 9"
          />
          {ringLevels.map((level) => (
            <g key={level}>
              <circle
                cx={boundary.cx}
                cy={boundary.cy}
                r={boundary.r * level}
                fill="none"
                stroke={level === 1 ? "#1b2a26" : "#c7cdbd"}
                strokeWidth={level === 1 ? "1.5" : "1"}
                strokeDasharray={level === 1 ? "9 9" : "2 10"}
              />
              {level < 1 ? (
                <text
                  x={boundary.cx + 8}
                  y={boundary.cy - boundary.r * level - 7}
                  className="ring-label"
                >
                  {Math.round(level * 100)}%
                </text>
              ) : null}
            </g>
          ))}

          {capabilityDefinitions.map((capability, index) => {
            const angle =
              (Math.PI * 2 * index) / capabilityDefinitions.length - Math.PI / 2;
            const value = getCapabilityValue(selectedProject.scores, capability.key);
            const x2 = boundary.cx + Math.cos(angle) * boundary.r;
            const y2 = boundary.cy + Math.sin(angle) * boundary.r;
            const dotX = boundary.cx + Math.cos(angle) * (36 + value * (boundary.r - 36));
            const dotY = boundary.cy + Math.sin(angle) * (36 + value * (boundary.r - 36));
            const labelX = boundary.cx + Math.cos(angle) * (boundary.r + 34);
            const labelY = boundary.cy + Math.sin(angle) * (boundary.r + 34);

            return (
              <g key={capability.key}>
                <line
                  x1={boundary.cx}
                  y1={boundary.cy}
                  x2={x2}
                  y2={y2}
                  stroke="#c3c9bc"
                  strokeWidth="1"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  className="axis-label"
                >
                  {capability.label}
                </text>
                <circle
                  cx={dotX}
                  cy={dotY}
                  r="4.5"
                  fill={capabilityBand(value) === "low" ? "#b95b42" : "#136f79"}
                  stroke="#fffaf0"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          <polygon
            points={selectedPolygon}
            fill="rgba(19, 111, 121, 0.22)"
            stroke="url(#selected-arc)"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <circle
            cx={boundary.cx}
            cy={boundary.cy}
            r="56"
            fill="#fffdf6"
            stroke={selectedProject.accent}
            strokeWidth="3"
          />
          <text x={boundary.cx} y={boundary.cy - 8} textAnchor="middle" className="bubble-name">
            {selectedProject.shortName}
          </text>
          <text x={boundary.cx} y={boundary.cy + 23} textAnchor="middle" className="bubble-score">
            {selectedCoverage}%
          </text>
          <text x={boundary.cx} y="38" textAnchor="middle" className="boundary-title">
            AI memory capability boundary
          </text>
          <text x={boundary.cx} y="596" textAnchor="middle" className="boundary-subtitle">
            轮廓越接近外圈，表示越接近完整 AI memory 平台能力边界
          </text>
          {groupAnchors.map((anchor) => (
            <text
              key={anchor.label}
              x={anchor.x}
              y={anchor.y}
              textAnchor={anchor.anchor}
              className="boundary-group-label"
            >
              {anchor.label}
            </text>
          ))}
        </svg>
      </div>

      <aside className="map-legend">
        <div className="legend-head">
          <CircleDotDashed aria-hidden="true" size={18} />
          <span>选中项目能力画像</span>
        </div>
        <div className="legend-focus">
          <div>
            <strong>{selectedProject.shortName}</strong>
            <span>{selectedProject.layer}</span>
            <em>
              {selectedImplementation.phaseLabel} · {selectedImplementation.progress}%
            </em>
          </div>
          <b>{selectedCoverage}%</b>
        </div>
        <div className="project-rank-list" aria-label="项目覆盖选择">
          {rankedProjects.map((project) => {
            const coverage = calculateCoverageScore(project.scores);
            const isSelected = project.slug === selectedProject.slug;
            const isInStack = selectedStackSlugs.includes(project.slug);

            return (
              <button
                key={project.slug}
                type="button"
                className={isSelected ? "active" : ""}
                aria-current={isSelected ? "true" : undefined}
                aria-label={`Open ${project.shortName} coverage profile${isInStack ? ", in selected stack" : ""}`}
                onClick={() => onSelectProject(project.slug)}
              >
                <span className="rank-dot" style={{ backgroundColor: project.color }} />
                <span>
                  <strong>{project.shortName}</strong>
                  <small>{project.layer}</small>
                </span>
                <b>{coverage}%</b>
                {isInStack ? <CheckCircle2 aria-hidden="true" size={16} /> : null}
              </button>
            );
          })}
        </div>
        <div className="legend-group-grid">
          {groupScores.map((group) => (
            <article key={group.key}>
              <span>{group.label}</span>
              <strong>{formatPercent(group.value)}</strong>
            </article>
          ))}
        </div>
        <div className="coverage-signal-grid">
          <div>
            <span>强覆盖</span>
            {selectedStrengths.map((capability) => (
              <strong key={capability.key}>{capability.label}</strong>
            ))}
          </div>
          <div>
            <span>优先补齐</span>
            {selectedGaps.length > 0 ? (
              selectedGaps.map((capability) => (
                <strong key={capability.key}>{capability.label}</strong>
              ))
            ) : (
              <strong>无主要短板</strong>
            )}
          </div>
        </div>
        <div className="legend-proofline">
          <div>
            <Target aria-hidden="true" size={16} />
            <span>当前镜头</span>
            <strong>{selectedProject.fitPosition}</strong>
          </div>
          <div>
            <Layers3 aria-hidden="true" size={16} />
            <span>{stackSelectionLabel}</span>
            <strong>{selectedStackSlugs.length} 个已选</strong>
          </div>
        </div>
      </aside>
    </section>
  );
}
