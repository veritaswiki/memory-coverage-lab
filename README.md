# MemoryBench

Objective third-party intelligence for AI memory products and adjacent tooling.

Live site: <https://veritaswiki.github.io/memory-coverage-lab/>

## Why It Exists

AI memory products are often compared as if they solve the same job. They do
not. MemoryBench separates memory APIs, temporal graph memory, RAG frameworks,
vector infrastructure, managed retrieval, and stateful agent runtimes.

## What It Shows

- Editorial public research modeled as an intelligence publication.
- A 16-criteria AI memory capability boundary.
- A coverage map for each evaluated system.
- A system dossier directory with research status, progress, uncertainty, and
  latest update per project.
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
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The Vite config uses `base: "./"` so the static build works from the GitHub
Pages project path.
