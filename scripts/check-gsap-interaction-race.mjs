import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { interactiveMicroMotionTargetsExpression } from "./interactive-motion-targets.mjs";

const browseBin = process.env.BROWSE_BIN ?? "/Users/lux/gstack/browse/dist/browse";
const targetUrl = process.env.QA_URL ?? "http://127.0.0.1:5179/";
const reportPath = process.env.QA_GSAP_RACE_REPORT_PATH ? resolve(process.env.QA_GSAP_RACE_REPORT_PATH) : "";
const viewports = [
  { name: "motion-breakpoint-901", size: "901x900" },
  { name: "motion-breakpoint-900", size: "900x900" },
  { name: "motion-breakpoint-721", size: "721x900" },
];
const realHoverTargets = [
  {
    label: "toprail-action",
    selector: '.top-rail .action-link-outline[href="#benchmarks"]',
    setup: "window.scrollTo(0, 0)",
  },
  {
    label: "surface-action",
    selector: '.surface-grid .action-link-dark[href="#benchmarks"]',
    setup: 'document.querySelector(".surface-grid")?.scrollIntoView({ block: "center", inline: "nearest" })',
  },
  {
    label: "map-node",
    selector: '.map-node[aria-current="true"]',
    setup: [
      'document.getElementById("benchmarks")?.scrollIntoView({ block: "start", inline: "nearest" })',
      'document.getElementById("studio-tab-map")?.click()',
    ].join(";"),
  },
  {
    label: "footer-action",
    selector: '.footer-actions .action-link-accent[href="#evidence"]',
    setup: 'document.getElementById("subscribe")?.scrollIntoView({ block: "center", inline: "nearest" })',
  },
];

const failures = [];
const report = {
  targetUrl,
  startedAt: new Date().toISOString(),
  finishedAt: "",
  passed: false,
  viewports: viewports.map((viewport) => ({ name: viewport.name, size: viewport.size })),
  results: [],
  failures,
};

function runBrowse(args, timeout = 60_000) {
  return execFileSync(browseBin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  }).trim();
}

function runJson(args, timeout = 60_000) {
  const output = runBrowse(args, timeout);

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to parse browse JSON output: ${error instanceof Error ? error.message : String(error)}\n${output}`);
  }
}

function browseErrorText(error) {
  return [
    error?.stdout?.toString?.() ?? "",
    error?.stderr?.toString?.() ?? "",
    error instanceof Error ? error.message : String(error),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function prepareStudioRacePath() {
  return runJson([
    "js",
    `new Promise(resolve => {
      const startedAt = performance.now();
      const findControls = () => ({
        input: document.getElementById("memorybench-search"),
        mapTab: document.getElementById("studio-tab-map"),
        stackTab: document.getElementById("studio-tab-stack"),
        evidenceTab: document.getElementById("studio-tab-evidence"),
        workbench: document.getElementById("benchmarks") || document.querySelector(".studio-workbench"),
      });

      const setInputValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const clickFirst = (selector) => {
        const node = document.querySelector(selector);

        if (node instanceof HTMLElement) {
          node.click();
          return true;
        }

        return false;
      };

      const prepare = () => {
        const { input, mapTab, stackTab, evidenceTab, workbench } = findControls();

        if (!(input instanceof HTMLInputElement) || !mapTab || !stackTab || !evidenceTab || !workbench) {
          if (performance.now() - startedAt < 6000) {
            requestAnimationFrame(prepare);
            return;
          }

          resolve({
            ok: false,
            reason: "missing-studio-controls",
            inputFound: input instanceof HTMLInputElement,
            mapTabFound: !!mapTab,
            stackTabFound: !!stackTab,
            evidenceTabFound: !!evidenceTab,
            workbenchFound: !!workbench,
            rootLength: document.getElementById("root")?.innerHTML?.length ?? null,
            readyState: document.readyState,
          });
          return;
        }

        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        workbench.scrollIntoView({ block: "start", inline: "nearest" });

        setTimeout(() => mapTab.click(), 0);
        setTimeout(() => setInputValue(input, "temporal graph"), 120);
        setTimeout(() => clickFirst('button[aria-label^="Open Zep dossier"]'), 360);
        setTimeout(() => stackTab.click(), 560);
        setTimeout(() => clickFirst('.selector-panel button[aria-label^="Toggle "]'), 780);
        setTimeout(() => evidenceTab.click(), 980);
        setTimeout(() => setInputValue(input, "definitely-no-memory-system-match"), 1120);
        setTimeout(() => setInputValue(input, ""), 1800);
        setTimeout(() => evidenceTab.click(), 1960);
        setTimeout(() => clickFirst('.evidence-row[aria-label="Select Mem0 dossier"]'), 2140);
        setTimeout(() => {
          const selectedTab = document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim() || "";
          const activeEvidenceTitle = document.querySelector('.evidence-row[aria-current="true"] h4')?.textContent?.trim() || "";
          const selectedDossier = document.querySelector(".dossier-panel h3")?.textContent?.trim() || "";

          resolve({
            ok: selectedTab === "Evidence ledger" && activeEvidenceTitle === "Mem0" && selectedDossier === "Mem0",
            selectedTab,
            activeEvidenceTitle,
            selectedDossier,
            evidenceRows: document.querySelectorAll(".evidence-row").length,
          });
        }, 3100);
      };

      prepare();
    })`,
  ]);
}

function checkInteractiveRace() {
  return runJson([
    "js",
    `new Promise(resolve => {
      const targets = ${interactiveMicroMotionTargetsExpression()};
      const pointerEnter = new MouseEvent("pointerenter", { bubbles: false, cancelable: false, view: window });
      const pointerLeave = new MouseEvent("pointerleave", { bubbles: false, cancelable: false, view: window });
      const inspect = (node) => ({
        inlineTransform: node.style.transform || "",
        inlineWillChange: node.style.willChange || "",
        computedTransform: getComputedStyle(node).transform,
        computedWillChange: getComputedStyle(node).willChange,
        activeElementClass: document.activeElement instanceof HTMLElement ? document.activeElement.className : "",
      });
      const samples = [];
      let index = 0;

      const runTarget = () => {
        const target = targets[index];
        index += 1;

        if (!target) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          window.scrollTo(0, 0);
          resolve(samples);
          return;
        }

        target.setup?.();
        setTimeout(() => {
          const activeNode = document.querySelector(target.selector);

          if (!(activeNode instanceof HTMLElement)) {
            samples.push({ ...target, ok: false, reason: "missing-target", exists: false });
            runTarget();
            return;
          }

          activeNode.scrollIntoView({ block: "center", inline: "nearest" });

          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }

          setTimeout(() => {
            const before = inspect(activeNode);
            activeNode.dispatchEvent(pointerEnter);
            activeNode.focus({ preventScroll: true });
            setTimeout(() => {
              const active = inspect(activeNode);
              activeNode.dispatchEvent(pointerLeave);
              activeNode.blur();
              setTimeout(() => {
                const settled = inspect(activeNode);
                const activeInline = Boolean(active.inlineTransform || active.inlineWillChange);
                const settledResidue = Boolean(settled.inlineTransform || settled.inlineWillChange);

                samples.push({
                  ...target,
                  ok: activeInline && !settledResidue,
                  reason: activeInline && !settledResidue ? "" : "interactive-race-state",
                  exists: true,
                  before,
                  active,
                  settled,
                  activeInline,
                  settledResidue,
                });
                runTarget();
              }, 520);
            }, 260);
          }, 220);
        }, 420);
      };

      runTarget();
    })`,
  ]);
}

function waitForBrowser(ms) {
  runJson(["js", `new Promise(resolve => setTimeout(() => resolve(true), ${ms}))`], ms + 5_000);
}

function prepareRealHoverTarget(target) {
  return runJson([
    "js",
    `new Promise(resolve => {
      let neutral = document.getElementById("qa-hover-neutral");
      if (!neutral) {
        neutral = document.createElement("div");
        neutral.id = "qa-hover-neutral";
        neutral.setAttribute("aria-hidden", "true");
        Object.assign(neutral.style, {
          position: "fixed",
          left: "0px",
          top: "0px",
          width: "28px",
          height: "28px",
          zIndex: "2147483647",
          pointerEvents: "auto",
          opacity: "0",
        });
        document.body.appendChild(neutral);
      }

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      ${target.setup};
      setTimeout(() => {
        const node = document.querySelector(${JSON.stringify(target.selector)});
        if (!(node instanceof HTMLElement)) {
          resolve({ ok: false, reason: "missing-target" });
          return;
        }

        node.scrollIntoView({ block: "center", inline: "nearest" });
        setTimeout(() => {
          const header = document.querySelector(".top-rail");
          const stickyBottom = header && getComputedStyle(header).position === "sticky"
            ? Math.ceil(header.getBoundingClientRect().bottom)
            : 0;
          const safeTop = stickyBottom + 16;
          const safeBottom = window.innerHeight - 24;
          let rect = node.getBoundingClientRect();
          if (rect.top < safeTop) {
            window.scrollBy(0, rect.top - safeTop);
          } else if (rect.bottom > safeBottom) {
            window.scrollBy(0, rect.bottom - safeBottom);
          }

          setTimeout(() => {
            rect = node.getBoundingClientRect();
            const centerX = Math.round(rect.left + rect.width / 2);
            const centerY = Math.round(rect.top + rect.height / 2);
            const hit = centerX >= 0 && centerY >= 0 && centerX <= window.innerWidth && centerY <= window.innerHeight
              ? document.elementFromPoint(centerX, centerY)
              : null;

            resolve({
              ok: hit === node || node.contains(hit),
              reason: hit === node || node.contains(hit) ? "" : "target-covered-after-safe-scroll",
              text: node.textContent?.trim().slice(0, 80) ?? "",
              stickyBottom,
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              centerX,
              centerY,
              hitTag: hit?.tagName?.toLowerCase() ?? "",
              hitClass: hit instanceof HTMLElement ? hit.className : "",
              hitText: hit instanceof HTMLElement ? hit.textContent?.trim().slice(0, 80) ?? "" : "",
            });
          }, 120);
        }, 120);
      }, 360);
    })`,
  ]);
}

function inspectRealHoverTarget(target) {
  return runJson([
    "js",
    `(() => {
      const node = document.querySelector(${JSON.stringify(target.selector)});
      if (!(node instanceof HTMLElement)) {
        return { exists: false };
      }

      const debug = typeof window.__memoryBenchMotionInspect === "function"
        ? window.__memoryBenchMotionInspect()
        : window.__memoryBenchMotion || null;
      const activeTargetLabels = Array.isArray(debug?.animations?.activeTargetLabels)
        ? debug.animations.activeTargetLabels
        : [];
      const rect = node.getBoundingClientRect();
      const centerX = Math.round(rect.left + rect.width / 2);
      const centerY = Math.round(rect.top + rect.height / 2);
      const hit =
        centerX >= 0 &&
        centerY >= 0 &&
        centerX <= window.innerWidth &&
        centerY <= window.innerHeight
          ? document.elementFromPoint(centerX, centerY)
          : null;
      const hitTestOk = hit === node || node.contains(hit);

      return {
        exists: true,
        hitTestOk,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        centerX,
        centerY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hitTag: hit?.tagName?.toLowerCase() ?? "",
        hitClass: hit instanceof HTMLElement ? hit.className : "",
        hitText: hit instanceof HTMLElement ? hit.textContent?.trim().slice(0, 80) ?? "" : "",
        inlineTransform: node.style.transform || "",
        inlineWillChange: node.style.willChange || "",
        computedTransform: getComputedStyle(node).transform,
        computedWillChange: getComputedStyle(node).willChange,
        activeTargetLabels,
        semanticActiveLabel: "interactive:${target.label}",
        semanticActiveLabelPresent: activeTargetLabels.includes("interactive:${target.label}"),
      };
    })()`,
  ]);
}

function checkRealHoverHitTests() {
  const samples = [];

  for (const target of realHoverTargets) {
    const prepared = prepareRealHoverTarget(target);

    if (prepared.ok !== true) {
      samples.push({
        ...target,
        ok: false,
        reason: prepared.reason || "prepare-failed",
        prepared,
        active: null,
        settled: null,
      });
      continue;
    }

    runBrowse(["hover", target.selector], 30_000);
    waitForBrowser(80);
    const active = inspectRealHoverTarget(target);
    runBrowse(["hover", "#qa-hover-neutral"], 30_000);
    waitForBrowser(560);
    const settled = inspectRealHoverTarget(target);

    const activeInline = Boolean(active.inlineTransform || active.inlineWillChange);
    const activeComputed = Boolean(
      (active.computedTransform && active.computedTransform !== "none") ||
      (active.computedWillChange && active.computedWillChange.includes("transform"))
    );
    const settledResidue = Boolean(settled.inlineTransform || settled.inlineWillChange);
    const ok =
      active.exists === true &&
      settled.exists === true &&
      active.hitTestOk === true &&
      activeInline &&
      activeComputed &&
      !settledResidue;

    samples.push({
      ...target,
      ok,
      reason: ok ? "" : "real-hover-state",
      prepared,
      active,
      settled,
      activeInline,
      activeComputed,
      settledResidue,
      semanticActiveLabelPresent: active.semanticActiveLabelPresent === true,
    });
  }

  return samples;
}

if (!existsSync(browseBin)) {
  console.error(`GSAP interaction race check failed: gstack browse binary not found: ${browseBin}`);
  process.exit(1);
}

for (const viewport of viewports) {
  try {
    runBrowse(["viewport", viewport.size]);
    runBrowse(["goto", targetUrl]);
    runBrowse(["wait", "--load"]);
    const prepared = prepareStudioRacePath();
    const viewportResult = {
      viewport: viewport.name,
      size: viewport.size,
      ok: false,
      prepared,
      sampleCount: 0,
      passCount: 0,
      evidenceRowPassCount: 0,
      realHoverSampleCount: 0,
      realHoverPassCount: 0,
      samples: [],
      realHoverSamples: [],
    };

    if (prepared.ok !== true) {
      failures.push(
        `[${viewport.name}] Studio race setup failed: tab=${prepared.selectedTab ?? "missing"}, active=${
          prepared.activeEvidenceTitle ?? "missing"
        }, dossier=${prepared.selectedDossier ?? "missing"}, rows=${prepared.evidenceRows ?? "missing"}`,
      );
      report.results.push(viewportResult);
      continue;
    }

    const samples = checkInteractiveRace();
    const realHoverSamples = checkRealHoverHitTests();
    const failedSamples = samples.filter((sample) => sample.ok !== true);
    const failedRealHoverSamples = realHoverSamples.filter((sample) => sample.ok !== true);
    viewportResult.samples = samples.map((sample) => ({
      label: sample.label ?? "",
      selector: sample.selector ?? "",
      ok: sample.ok === true,
      reason: sample.reason ?? "",
      exists: sample.exists === true,
      activeInline: sample.activeInline === true,
      settledResidue: sample.settledResidue === true,
      before: sample.before ?? null,
      active: sample.active ?? null,
      settled: sample.settled ?? null,
    }));
    viewportResult.realHoverSamples = realHoverSamples.map((sample) => ({
      label: sample.label ?? "",
      selector: sample.selector ?? "",
      ok: sample.ok === true,
      reason: sample.reason ?? "",
      hitTestOk: sample.active?.hitTestOk === true,
      activeInline: sample.activeInline === true,
      activeComputed: sample.activeComputed === true,
      settledResidue: sample.settledResidue === true,
      semanticActiveLabelPresent: sample.semanticActiveLabelPresent === true,
      prepared: sample.prepared ?? null,
      active: sample.active ?? null,
      settled: sample.settled ?? null,
    }));
    viewportResult.sampleCount = viewportResult.samples.length;
    viewportResult.passCount = viewportResult.samples.filter((sample) => sample.ok).length;
    viewportResult.evidenceRowPassCount = viewportResult.samples.filter(
      (sample) => sample.label === "evidence-row" && sample.ok,
    ).length;
    viewportResult.realHoverSampleCount = viewportResult.realHoverSamples.length;
    viewportResult.realHoverPassCount = viewportResult.realHoverSamples.filter((sample) => sample.ok).length;
    viewportResult.ok =
      failedSamples.length === 0 &&
      failedRealHoverSamples.length === 0 &&
      viewportResult.sampleCount === 11 &&
      viewportResult.realHoverSampleCount === realHoverTargets.length;
    report.results.push(viewportResult);

    if (failedSamples.length > 0) {
      failures.push(
        `[${viewport.name}] interaction race failed:\n${failedSamples
          .map((sample) =>
            `  - ${sample.label}: reason=${sample.reason}, before=${sample.before?.inlineTransform || "none"}, active=${
              sample.active?.inlineTransform || "none"
            }, settled=${sample.settled?.inlineTransform || "none"}`,
          )
          .join("\n")}`,
      );
    }

    if (failedRealHoverSamples.length > 0) {
      failures.push(
        `[${viewport.name}] real hover hit-test failed:\n${failedRealHoverSamples
          .map((sample) =>
            `  - ${sample.label}: reason=${sample.reason}, hit=${sample.active?.hitTag || sample.prepared?.hitTag || "none"}, active=${
              sample.active?.inlineTransform || "none"
            }, settled=${sample.settled?.inlineTransform || "none"}, semantic=${
              sample.semanticActiveLabelPresent ? "true" : "false"
            }`,
          )
          .join("\n")}`,
      );
    }
  } catch (error) {
    failures.push(`[${viewport.name}] ${browseErrorText(error)}`);
    report.results.push({
      viewport: viewport.name,
      size: viewport.size,
      ok: false,
      error: browseErrorText(error),
      prepared: null,
      sampleCount: 0,
      passCount: 0,
      evidenceRowPassCount: 0,
      realHoverSampleCount: 0,
      realHoverPassCount: 0,
      samples: [],
      realHoverSamples: [],
    });
  }
}

report.finishedAt = new Date().toISOString();
report.sampleCount = report.results.reduce((total, result) => total + result.sampleCount, 0);
report.passCount = report.results.reduce((total, result) => total + result.passCount, 0);
report.evidenceRowPassCount = report.results.reduce((total, result) => total + result.evidenceRowPassCount, 0);
report.realHoverSampleCount = report.results.reduce((total, result) => total + result.realHoverSampleCount, 0);
report.realHoverPassCount = report.results.reduce((total, result) => total + result.realHoverPassCount, 0);
report.passed =
  failures.length === 0 &&
  report.results.length === viewports.length &&
  report.sampleCount === 33 &&
  report.passCount === 33 &&
  report.evidenceRowPassCount === 3 &&
  report.realHoverSampleCount === 12 &&
  report.realHoverPassCount === 12;

if (reportPath) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (failures.length > 0) {
  console.error(`GSAP interaction race check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `GSAP interaction race check ok: ${targetUrl} (${viewports.map((viewport) => viewport.name).join(", ")})`,
);
