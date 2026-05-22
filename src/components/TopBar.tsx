import {
  CircleDot,
  GitMerge,
  Grid3X3,
  Search,
  ShieldCheck,
} from "lucide-react";

export type ActiveView = "map" | "matrix" | "stack" | "governance";

interface TopBarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

const views = [
  { id: "map", label: "研究地图", icon: CircleDot },
  { id: "matrix", label: "维度矩阵", icon: Grid3X3 },
  { id: "stack", label: "组合设计", icon: GitMerge },
  { id: "governance", label: "证据治理", icon: ShieldCheck },
] satisfies Array<{
  id: ActiveView;
  label: string;
  icon: typeof CircleDot;
}>;

export function TopBar({
  activeView,
  onViewChange,
  query,
  onQueryChange,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          MC
        </div>
        <div>
          <p className="eyebrow">Personal AI OS memory architecture</p>
          <h1>Memory Coverage Lab</h1>
          <div className="brand-meta" aria-label="设计与运行状态">
            <span>OpenDesign system</span>
            <span>16-axis AIGC model</span>
            <span>Evidence-first</span>
          </div>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="searchbox" htmlFor="project-search">
          <Search aria-hidden="true" size={18} />
          <input
            id="project-search"
            type="search"
            aria-label="搜索项目、层级或能力"
            placeholder="搜索项目、层级、证据或能力"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <nav className="view-tabs" aria-label="视图切换">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                type="button"
                className={activeView === view.id ? "active" : ""}
                aria-pressed={activeView === view.id}
                onClick={() => onViewChange(view.id)}
              >
                <Icon aria-hidden="true" size={17} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </header>
  );
}
