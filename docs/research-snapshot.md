# Research Snapshot

Date: 2026-05-21

Source report in Vault:

`/Users/lux/Luxos-Vault/system-hermes/ops/agent-memory-solutions-comparison-2026-05-21.md`

## Comparison Scope

This project visualizes the memory comparison requested for:

- VikingDB / OpenViking
- Mem0 / Supermemory
- Hindsight
- Nowledge Mem
- LLM Wiki / Luxos-Vault
- GBrain
- Zep / Graphiti
- Cognee
- Letta
- LangMem / LangGraph

## Evidence Dimensions

The UI separates four evidence types:

- Official support: official cloud product, official OSS, plugin, framework, or local system.
- Technology exchange signal: public tutorials, blogs, repository examples, or local engineering evidence.
- Project pairing case: concrete Personal AI OS use, proof writeback, LLM Wiki export, or architecture fit.
- Time: when the evidence or local integration was observed.

## Modeling Notes

The coverage score is a weighted capability model, calculated in `src/lib/coverage.ts`.
The stack planner uses max-per-capability union because memory systems usually complement each other by layer.
