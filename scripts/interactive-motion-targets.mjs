import { readFileSync } from "node:fs";

export const interactiveMicroMotionTargets = JSON.parse(
  readFileSync(new URL("../src/data/interactiveMotionTargets.json", import.meta.url), "utf8"),
);

export const expectedGsapRaceTargets = interactiveMicroMotionTargets.map((target) => target.label);

export function interactiveMicroMotionTargetsExpression() {
  return `[
${interactiveMicroMotionTargets
  .map((target) => {
    const setup = target.setup ? `,\n    setup: ${target.setup}` : "";
    return `  {\n    label: ${JSON.stringify(target.label)},\n    selector: ${JSON.stringify(target.selector)}${setup}\n  }`;
  })
  .join(",\n")}
]`;
}
