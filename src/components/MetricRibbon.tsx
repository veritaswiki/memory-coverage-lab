import type { LucideIcon } from "lucide-react";
import { Boxes, Crosshair, Layers3, Radar, TriangleAlert } from "lucide-react";

interface MetricRibbonProps {
  dimensionCount: number;
  projectCount: number;
  stackCoverage: number;
  gapCount: number;
  focusCoverage: number;
}

interface RibbonMetric {
  label: string;
  value: string;
  Icon: LucideIcon;
  emphasis?: boolean;
}

export function MetricRibbon({
  dimensionCount,
  projectCount,
  stackCoverage,
  gapCount,
  focusCoverage,
}: MetricRibbonProps) {
  const metrics: RibbonMetric[] = [
    { label: "AIGC 维度", value: String(dimensionCount), Icon: Radar },
    { label: "评估对象", value: String(projectCount), Icon: Boxes },
    { label: "组合覆盖", value: `${stackCoverage}%`, Icon: Layers3 },
    { label: "待补能力", value: String(gapCount), Icon: TriangleAlert },
    { label: "当前焦点", value: `${focusCoverage}%`, Icon: Crosshair, emphasis: true },
  ];

  return (
    <section className="context-ribbon" aria-label="当前覆盖上下文">
      {metrics.map(({ label, value, Icon, emphasis }) => (
        <div key={label} className={emphasis ? "ribbon-route" : undefined}>
          <span>
            <Icon aria-hidden="true" size={14} />
            {label}
          </span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}
