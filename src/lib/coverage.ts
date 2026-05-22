import {
  capabilityGroupDefinitions,
  capabilityDefinitions,
  capabilityKeys,
  createEmptyCapabilityScores,
  type CapabilityGroupKey,
  type CapabilityKey,
  type CapabilityScores,
} from "../data/capabilities";
import type { MemoryProject } from "../data/projects";

export function calculateCoverageScore(scores: CapabilityScores): number {
  const totals = capabilityDefinitions.reduce(
    (acc, capability) => {
      const value = clampScore(scores[capability.key]);
      return {
        weighted: acc.weighted + value * capability.weight,
        possible: acc.possible + capability.weight,
      };
    },
    { weighted: 0, possible: 0 },
  );

  return Math.round((totals.weighted / totals.possible) * 100);
}

export function combineCapabilityScores(projects: MemoryProject[]): CapabilityScores {
  const combined = createEmptyCapabilityScores();

  for (const project of projects) {
    for (const key of capabilityKeys) {
      combined[key] = Math.max(combined[key], clampScore(project.scores[key]));
    }
  }

  return combined;
}

export function getCoverageGaps(scores: CapabilityScores, threshold = 0.62) {
  return capabilityDefinitions
    .map((capability) => ({
      key: capability.key,
      label: capability.label,
      value: clampScore(scores[capability.key]),
    }))
    .filter((item) => item.value < threshold)
    .sort((a, b) => a.value - b.value);
}

export function getCapabilityGroupScores(scores: CapabilityScores) {
  return capabilityGroupDefinitions.map((group) => {
    const capabilities = capabilityDefinitions.filter(
      (capability) => capability.group === group.key,
    );
    const totals = capabilities.reduce(
      (acc, capability) => {
        const value = clampScore(scores[capability.key]);
        return {
          weighted: acc.weighted + value * capability.weight,
          possible: acc.possible + capability.weight,
        };
      },
      { weighted: 0, possible: 0 },
    );

    return {
      ...group,
      value: totals.possible === 0 ? 0 : totals.weighted / totals.possible,
      capabilities,
    };
  });
}

export function getCapabilityGroupScore(
  scores: CapabilityScores,
  groupKey: CapabilityGroupKey,
): number {
  return (
    getCapabilityGroupScores(scores).find((group) => group.key === groupKey)
      ?.value ?? 0
  );
}

export function getStrongestCapabilities(scores: CapabilityScores, count = 3) {
  return capabilityDefinitions
    .map((capability) => ({
      ...capability,
      value: clampScore(scores[capability.key]),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

export function getProjectCoverage(project: MemoryProject): number {
  return calculateCoverageScore(project.scores);
}

export function getPairingProjects(
  project: MemoryProject,
  allProjects: MemoryProject[],
): MemoryProject[] {
  return project.pairsWith
    .map((slug) => allProjects.find((candidate) => candidate.slug === slug))
    .filter((candidate): candidate is MemoryProject => Boolean(candidate));
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function capabilityBand(value: number): "high" | "mid" | "low" {
  if (value >= 0.72) {
    return "high";
  }

  if (value >= 0.45) {
    return "mid";
  }

  return "low";
}

export function getCapabilityValue(
  scores: CapabilityScores,
  key: CapabilityKey,
): number {
  return clampScore(scores[key]);
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
