import { describe, expect, it } from "vitest";
import { capabilityKeys } from "../data/capabilities";
import { memoryProjects } from "../data/projects";
import {
  calculateCoverageScore,
  combineCapabilityScores,
  getCapabilityGroupScores,
  getCoverageGaps,
} from "./coverage";

describe("coverage calculations", () => {
  it("keeps project coverage inside a percent range", () => {
    const scores = memoryProjects.map((project) =>
      calculateCoverageScore(project.scores),
    );

    expect(Math.min(...scores)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...scores)).toBeLessThanOrEqual(100);
  });

  it("combines a stack by taking the strongest capability from each project", () => {
    const stack = memoryProjects.filter((project) =>
      ["mem0", "zep-graphiti", "vectorstack"].includes(project.slug),
    );

    const combined = combineCapabilityScores(stack);

    for (const key of capabilityKeys) {
      const expected = Math.max(...stack.map((project) => project.scores[key]));
      expect(combined[key]).toBe(expected);
    }
  });

  it("finds capability gaps under a threshold", () => {
    const vectorstack = memoryProjects.find((project) => project.slug === "vectorstack");

    expect(vectorstack).toBeDefined();

    const gaps = getCoverageGaps(vectorstack!.scores, 0.5);

    expect(gaps.map((gap) => gap.key)).toContain("episodic");
    expect(gaps.map((gap) => gap.key)).toContain("timelineProof");
  });

  it("summarizes the expanded model into research groups", () => {
    const mem0 = memoryProjects.find((project) => project.slug === "mem0");

    expect(mem0).toBeDefined();

    const groups = getCapabilityGroupScores(mem0!.scores);

    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.value >= 0 && group.value <= 1)).toBe(true);
    expect(groups.flatMap((group) => group.capabilities)).toHaveLength(
      capabilityKeys.length,
    );
  });
});
