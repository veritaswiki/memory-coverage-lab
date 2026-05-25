import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  expectedGsapRaceTargets,
  interactiveMicroMotionTargets,
  interactiveMicroMotionTargetsExpression,
} from "./interactive-motion-targets.mjs";

const failures = [];
const reportPath = process.env.INTERACTIVE_MOTION_TARGET_REPORT_PATH
  ? resolve(process.env.INTERACTIVE_MOTION_TARGET_REPORT_PATH)
  : "";
const startedAt = new Date().toISOString();
const expectedLabels = [
  "hero-research-action",
  "hero-studio-action",
  "toprail-action",
  "surface-action",
  "research-action",
  "platform-action",
  "footer-action",
  "map-node",
  "matrix-system-button",
  "stack-selector-button",
  "evidence-row",
];
const expectedMotionSelectors = [
  ".hero-actions .action-link",
  ".top-rail .action-link",
  ".surface-grid .action-link",
  ".research-list .action-link",
  ".platform-copy .action-link",
  ".footer-actions .action-link",
  ".map-node",
  ".matrix-workbench button",
  ".selector-panel button",
  ".evidence-row",
];
const expectedActionLinkTargetSelectors = [
  ".hero-actions .action-link-primary",
  ".hero-actions .action-link-accent",
  ".top-rail .action-link-outline",
  ".surface-grid .action-link-dark",
  ".research-list .action-link-text",
  ".platform-copy .action-link-outline",
  ".footer-actions .action-link-accent",
];
const allowedSetupSources = new Set([
  "() => window.scrollTo(0, 0)",
  '() => document.getElementById("studio-tab-map")?.click()',
  '() => document.getElementById("studio-tab-matrix")?.click()',
  '() => document.getElementById("studio-tab-stack")?.click()',
  '() => document.getElementById("studio-tab-evidence")?.click()',
]);

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function sameValues(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function compileSetup(source, label) {
  try {
    const fn = Function(`"use strict"; return (${source});`)();
    expect(typeof fn === "function", `${label} setup must compile to a function`);
  } catch (error) {
    failures.push(`${label} setup must be valid JavaScript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const targets = interactiveMicroMotionTargets;
const labels = targets.map((target) => target.label);
const labelsFromScriptBridge = expectedGsapRaceTargets;
const motionSelectors = [
  ...new Set(
    targets.flatMap((target) =>
      Array.isArray(target.motionSelectors) && target.motionSelectors.length > 0
        ? target.motionSelectors
        : [target.selector],
    ),
  ),
];
const targetDataPath = "src/data/interactiveMotionTargets.json";
const runtimeTargetModulePath = "src/data/interactiveMotionTargets.ts";
const motionHookPath = "src/useMemoryBenchMotion.ts";
const scriptBridgePath = "scripts/interactive-motion-targets.mjs";
const targetData = readFileSync(targetDataPath, "utf8");
const runtimeTargetModule = readFileSync("src/data/interactiveMotionTargets.ts", "utf8");
const motionHook = readFileSync("src/useMemoryBenchMotion.ts", "utf8");
const scriptBridge = readFileSync("scripts/interactive-motion-targets.mjs", "utf8");

function sourceEvidence(path, source) {
  return {
    path,
    exists: existsSync(path),
    bytes: Buffer.byteLength(source),
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}

function writeReport(passed) {
  if (!reportPath) {
    return;
  }

  mkdirSync(dirname(reportPath), { recursive: true });
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    passed,
    failures,
    targetCount: targets.length,
    labels,
    expectedLabels,
    labelsMatch: sameValues(labels, expectedLabels),
    labelsUnique: new Set(labels).size === labels.length,
    scriptBridgeLabels: labelsFromScriptBridge,
    scriptBridgeLabelsMatch: sameValues(labelsFromScriptBridge, expectedLabels),
    motionSelectors,
    expectedMotionSelectors,
    motionSelectorsMatch: sameValues(motionSelectors, expectedMotionSelectors),
    setupLabels: targets.filter((target) => target.setup !== undefined).map((target) => target.label),
    allowedSetupCount: allowedSetupSources.size,
    expressionSha256: createHash("sha256").update(interactiveMicroMotionTargetsExpression()).digest("hex"),
    sourceFiles: {
      data: {
        ...sourceEvidence(targetDataPath, targetData),
      },
      runtimeModule: {
        ...sourceEvidence(runtimeTargetModulePath, runtimeTargetModule),
        containsSelectorExport: runtimeTargetModule.includes("interactiveMicroMotionSelector"),
        containsMotionSelectors: runtimeTargetModule.includes("motionSelectors"),
      },
      motionHook: {
        ...sourceEvidence(motionHookPath, motionHook),
        importsRuntimeTargetModule: motionHook.includes('from "./data/interactiveMotionTargets"'),
        usesDelegatedSelector: motionHook.includes("closest<HTMLElement>(interactiveMicroMotionSelector)"),
        hasHardcodedSelectorList: motionHook.includes("const interactiveMicroMotionSelector = ["),
      },
      scriptBridge: {
        ...sourceEvidence(scriptBridgePath, scriptBridge),
        readsRuntimeData: scriptBridge.includes("../src/data/interactiveMotionTargets.json"),
      },
    },
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

expect(Array.isArray(targets), "interactive motion target data must be an array");
expect(sameValues(labels, expectedLabels), `interactive target labels must stay in order: ${labels.join(", ")}`);
expect(
  sameValues(labelsFromScriptBridge, expectedLabels),
  `script bridge label list must match expected labels: ${labelsFromScriptBridge.join(", ")}`,
);
expect(new Set(labels).size === labels.length, "interactive target labels must be unique");
expect(sameValues(motionSelectors, expectedMotionSelectors), `runtime motion selectors drifted: ${motionSelectors.join(", ")}`);
expect(
  sameValues(targets.slice(0, expectedActionLinkTargetSelectors.length).map((target) => target.selector.split("[")[0]), expectedActionLinkTargetSelectors),
  "action-link interactive targets must stay bound to the shared action-link grammar",
);
expect(
  interactiveMicroMotionTargetsExpression().includes('label: "evidence-row"') &&
    interactiveMicroMotionTargetsExpression().includes("setup: () => document.getElementById"),
  "browser-injected target expression must preserve labels and setup functions",
);
expect(
  scriptBridge.includes("../src/data/interactiveMotionTargets.json"),
  "script-side bridge must read the runtime-owned JSON target contract",
);
expect(
  runtimeTargetModule.includes("interactiveMicroMotionSelector") &&
    runtimeTargetModule.includes("motionSelectors"),
  "runtime target module must derive the GSAP selector from motionSelectors",
);
expect(
  motionHook.includes('from "./data/interactiveMotionTargets"') &&
    motionHook.includes("closest<HTMLElement>(interactiveMicroMotionSelector)"),
  "GSAP hook must resolve delegated targets from the runtime-owned selector contract",
);
expect(
  !motionHook.includes("const interactiveMicroMotionSelector = ["),
  "GSAP hook must not keep a second hard-coded interactive selector list",
);

for (const target of targets) {
  expect(typeof target.label === "string" && target.label.length > 0, "every target must have a label");
  expect(typeof target.selector === "string" && target.selector.length > 0, `${target.label} must have a selector`);
  expect(!target.selector.includes("\n"), `${target.label} selector must be one line`);

  if (target.motionSelectors !== undefined) {
    expect(Array.isArray(target.motionSelectors), `${target.label} motionSelectors must be an array when present`);
    expect(target.motionSelectors.length > 0, `${target.label} motionSelectors must not be empty`);
    for (const selector of target.motionSelectors) {
      expect(typeof selector === "string" && selector.length > 0, `${target.label} motion selector must be non-empty`);
      expect(!selector.includes("\n"), `${target.label} motion selector must be one line`);
    }
  }

  if (target.setup !== undefined) {
    expect(allowedSetupSources.has(target.setup), `${target.label} setup is outside the audited allowlist`);
    compileSetup(target.setup, target.label);
  }
}

if (failures.length > 0) {
  writeReport(false);
  console.error(`Interactive motion target contract failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

writeReport(true);
console.log("Interactive motion target contract ok: runtime, QA, and focused race selectors share one audited source");
