import targets from "./interactiveMotionTargets.json";

type InteractiveMotionTarget = {
  label: string;
  selector: string;
  motionSelectors?: string[];
  setup?: string;
};

export const interactiveMotionTargets = targets as InteractiveMotionTarget[];

export const interactiveMotionTargetLabels = interactiveMotionTargets.map((target) => target.label);

export const interactiveMicroMotionSelector = [
  ...new Set(
    interactiveMotionTargets.flatMap((target) =>
      target.motionSelectors && target.motionSelectors.length > 0
        ? target.motionSelectors
        : [target.selector],
    ),
  ),
].join(",");
