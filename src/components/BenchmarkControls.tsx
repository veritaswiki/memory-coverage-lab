import {
  CircleDot,
  GitMerge,
  Grid3X3,
  Search,
  ShieldCheck,
} from "lucide-react";

export type ActiveView = "map" | "matrix" | "stack" | "governance";

interface BenchmarkControlsProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

const views = [
  { id: "map", label: "Coverage map", icon: CircleDot },
  { id: "matrix", label: "Score matrix", icon: Grid3X3 },
  { id: "stack", label: "Stack planner", icon: GitMerge },
  { id: "governance", label: "Evidence table", icon: ShieldCheck },
] satisfies Array<{
  id: ActiveView;
  label: string;
  icon: typeof CircleDot;
}>;

export function BenchmarkControls({
  activeView,
  onViewChange,
  query,
  onQueryChange,
}: BenchmarkControlsProps) {
  return (
    <div className="benchmark-controls">
      <label className="searchbox" htmlFor="project-search">
        <Search aria-hidden="true" size={18} />
        <input
          id="project-search"
          type="search"
          aria-label="搜索项目、层级或能力"
          placeholder="Search vendors, layers, risks, evidence"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <nav className="view-tabs" aria-label="Benchmark view switcher">
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
  );
}
