import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Database,
  GitPullRequestArrow,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

const heroTags = ["Mem0", "Zep", "Letta", "LangGraph", "LlamaIndex"];

const researchCards = [
  {
    month: "may-2026",
    title: "AI memory products are not one category",
    body: "Memory APIs, temporal graphs, RAG frameworks and vector stores solve different parts of the agent memory problem.",
    meta: "10 systems / 16 criteria / 4 capability layers",
  },
  {
    month: "may-2026",
    title: "Vector retrieval is mature, but not memory",
    body: "Retrieval infrastructure scores high on read paths while leaving preference updates, contradiction repair and policy control elsewhere.",
    meta: "Infrastructure baseline / category boundary",
  },
  {
    month: "may-2026",
    title: "Temporal graphs are the strongest fact-dynamics bet",
    body: "Entity updates and relationship drift separate graph memory systems from simpler session recall or document search layers.",
    meta: "Temporal KG / conflict repair / source tracing",
  },
];

const platformSteps = [
  {
    number: "01",
    label: "Dataset",
    title: "Memory benchmark dataset",
    body: "Structured vendor runs across user preference, entity updates, retrieval grounding, deletion, and multi-session continuity prompts.",
    icon: Database,
  },
  {
    number: "02",
    label: "Dashboard",
    title: "Capability boundary explorer",
    body: "Coverage map, project matrix, stack planner and evidence table for comparing adjacent products without collapsing categories.",
    icon: BarChart3,
  },
  {
    number: "03",
    label: "Signal",
    title: "Continuous re-runs",
    body: "Scorecards are designed to refresh as vendors ship new APIs, frameworks change, and model memory patterns drift.",
    icon: RefreshCcw,
  },
  {
    number: "04",
    label: "Playbooks",
    title: "Neutral adoption briefs",
    body: "Evidence-led notes on where each memory layer fits, what it does not cover, and which claims need validation.",
    icon: ShieldCheck,
  },
];

const operatingLoop = [
  {
    label: "Plan",
    title: "Define the boundary",
    body: "Separate product category, evaluation job, sample scope and known exclusions before any score is shown.",
    icon: ClipboardCheck,
  },
  {
    label: "Review",
    title: "Challenge the evidence",
    body: "Compare public claims against docs, demos and counterexamples so adjacent systems are not collapsed into one bucket.",
    icon: SearchCheck,
  },
  {
    label: "QA",
    title: "Replay the hard cases",
    body: "Track preference updates, entity drift, deletion, provenance and governance scenarios as repeatable checks.",
    icon: ShieldCheck,
  },
  {
    label: "Ship",
    title: "Publish with uncertainty",
    body: "Expose scores, caveats, progress and risk together so readers can see what is validated and what is still open.",
    icon: GitPullRequestArrow,
  },
  {
    label: "Learn",
    title: "Keep the ledger alive",
    body: "Record regressions, vendor changes and next milestones so each project has an auditable update history.",
    icon: RefreshCcw,
  },
];

export function HeroSection() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="hero-kicker">AI memory intelligence</p>
        <h1 aria-label="When AI agents remember, what survives and why?">
          <span>When AI agents</span>
          <span>remember, what</span>
          <span>survives</span>
          <span>and why?</span>
        </h1>
        <p>
          MemoryBench runs independent evaluations across memory APIs, temporal
          graphs, RAG frameworks, vector infrastructure and stateful agent
          runtimes. The goal is not to sell a stack. It is to measure what each
          category really covers.
        </p>
        <div className="hero-actions">
          <a className="primary-cta" href="#research">
            See public research
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <a className="secondary-cta" href="#benchmarks">
            Explore benchmark data
          </a>
        </div>
        <div className="agent-strip" aria-label="systems included">
          {heroTags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SurfaceSection() {
  return (
    <section className="surface-section" id="research">
      <div className="section-intro">
        <p className="eyebrow">memorybench / surfaces</p>
        <h2>Read the research. Inspect the benchmark.</h2>
      </div>

      <div className="surface-grid">
        <article>
          <span>Research / Public</span>
          <h3>Public research</h3>
          <p>
            Open reports on what AI memory systems claim, what their public
            surface supports, and which capabilities remain unproven.
          </p>
          <a href="#research-cards">Read studies</a>
        </article>
        <article>
          <span>Platform / Objective</span>
          <h3>Memory intelligence platform</h3>
          <p>
            A neutral explorer for vendors, builders and investors who need to
            compare adjacent AI memory products without internal architecture bias.
          </p>
          <a href="#benchmarks">Run the explorer</a>
        </article>
      </div>
    </section>
  );
}

export function OperatingLoopSection() {
  return (
    <section className="operating-loop-section" id="method">
      <div className="section-intro">
        <p className="eyebrow">Operating model</p>
        <h2>Every scorecard moves through the same evidence loop.</h2>
      </div>

      <div className="loop-grid" aria-label="Plan Review QA Ship Learn workflow">
        {operatingLoop.map((step, index) => {
          const Icon = step.icon;

          return (
            <article key={step.label}>
              <div className="loop-marker">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon aria-hidden="true" size={18} />
              </div>
              <p>{step.label}</p>
              <h3>{step.title}</h3>
              <small>{step.body}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ResearchCards() {
  return (
    <section className="research-section" id="research-cards">
      <div className="section-intro compact">
        <p className="eyebrow">Published</p>
        <h2>Public research</h2>
      </div>

      <div className="research-card-grid">
        {researchCards.map((card) => (
          <article key={card.title}>
            <time>{card.month}</time>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            <span>{card.meta}</span>
            <a href="#benchmarks">View study</a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PlatformSection() {
  return (
    <section className="platform-section" id="platform">
      <div className="platform-copy">
        <p className="eyebrow">Platform / for AI memory decisions</p>
        <h2>An intelligence and optimization platform for AI memory categories.</h2>
        <p>
          Per-category benchmarks for the systems that decide what agents retain,
          retrieve, update and forget.
        </p>
        <a className="primary-cta" href="#benchmarks">
          See the benchmark
          <ArrowRight aria-hidden="true" size={18} />
        </a>
      </div>

      <div className="platform-steps">
        {platformSteps.map((step) => {
          const Icon = step.icon;

          return (
            <article key={step.number}>
              <div>
                <span>{step.number} / {step.label}</span>
                <Icon aria-hidden="true" size={18} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function SubscribeSection() {
  return (
    <section className="subscribe-section" id="subscribe">
      <p>Subscribe to memory benchmark updates.</p>
      <a href="https://github.com/veritaswiki/memory-coverage-lab">GitHub</a>
    </section>
  );
}
