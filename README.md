# MemoryBench

Objective third-party intelligence for AI memory products and adjacent tooling.

Live site: <https://memory.veritas.wiki/>

Fallback GitHub Pages URL: <https://veritaswiki.github.io/memory-coverage-lab/>

## Why It Exists

AI memory products are often compared as if they solve the same job. They do
not. MemoryBench separates memory APIs, temporal graph memory, RAG frameworks,
vector infrastructure, managed retrieval, and stateful agent runtimes.

## What It Shows

- Editorial public research modeled as an intelligence publication.
- A 16-criteria AI memory capability boundary.
- A Plan / Review / QA / Ship / Learn operating loop for every scorecard.
- A coverage map for each evaluated system.
- A system dossier directory with research status, progress, uncertainty, and
  workflow status, latest update, and next milestone per project.
- A matrix view for comparing criteria across products.
- A stack planner that calculates combined coverage across selected categories.
- An evidence table that separates public product surface, technology signal,
  benchmark status, risk, and strongest capabilities.

## Systems Included

Mem0, Zep / Graphiti, Supermemory, Letta, LangMem / LangGraph, LlamaIndex
Memory, Cognee, Vector Database Stack, OpenMemory-style local stores, Ragie /
Managed RAG, and Haystack.

## Tech Stack

- React 19
- TypeScript
- Vite
- Vitest
- ESLint
- GitHub Pages

## Design Source

The production interface is tied to the local OpenDesign corpus rather than
freehand styling. The source files are:

- `opendesign/manifest.json`
- `opendesign/design-systems/memory-os/SKILL.md`
- `opendesign/design-systems/memory-os/tokens/colors_and_type.css`
- `opendesign/mockups/memorybench-ai-studio/index.html`
- `opendesign/mockups/memory-coverage-lab/index.html`

`pnpm check:opendesign` verifies the manifest, shared token mirrors, active
mockup pointer, design-system vocabulary, and production React/CSS usage.

## Development

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Scoring Model

Coverage numbers are heuristic research scores, not vendor endorsements. They
compare each system across four layers:

1. Memory cognition: event memory, reflection/planning, and category clarity.
2. Retrieval and grounding: semantic retrieval, relational graph, temporal
   provenance, corpus grounding, and multimodal grounding.
3. Agentic runtime: hooks, runtime boundary, product surface, and ecosystem
   signal.
4. Assurance and governance: benchmarks, contradiction repair, policy control,
   and deployment control.

## Deployment

The project deploys to GitHub Pages through `.github/workflows/pages.yml`.

The workflow runs:

```bash
pnpm verify
```

That command covers linting, type checking, unit tests, OpenDesign manifest
validation, design and motion contracts, Browser probe contracts, production
build, and bundle budget.

For full local acceptance, refresh the official Codex Browser probe from the
Codex Browser runtime, then run:

```bash
pnpm verify:full
```

`verify:full` runs `pnpm qa:strict`, which adds Codex runtime audit, focused
GSAP interaction race coverage, owned-preview browser runtime QA, reduced-motion
evidence, screenshot evidence, and Codex Browser diagnostics.

The Vite config uses `base: "./"` so the static build works from the GitHub
Pages project path.

## Operating Model

MemoryBench follows a gstack-style evidence loop:

1. Plan the category boundary and sample scope.
2. Review public claims against docs, demos, and counterexamples.
3. QA hard memory cases such as updates, deletion, provenance, and governance.
4. Ship scorecards with uncertainty instead of hidden confidence.
5. Learn from regressions, vendor changes, and the next open questions.
