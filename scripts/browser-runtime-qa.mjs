import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { interactiveMicroMotionTargets, interactiveMicroMotionTargetsExpression } from "./interactive-motion-targets.mjs";

const browseBin = process.env.BROWSE_BIN ?? "/Users/lux/gstack/browse/dist/browse";
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE ?? "/Users/lux/gstack/node_modules/playwright/index.js";
const targetUrl = process.env.QA_URL ?? "http://localhost:5179/";
const screenshotDir = resolve(process.env.QA_SCREENSHOT_DIR ?? "docs");
const qaReportPath = process.env.QA_REPORT_PATH ? resolve(process.env.QA_REPORT_PATH) : "";

const failures = [];
const qaReport = {
  targetUrl,
  startedAt: new Date().toISOString(),
  finishedAt: "",
  passed: false,
  viewports: viewportsForReport(),
  performance: [],
  layoutStability: [],
  motionFrameBudget: [],
  scrollMotionFrameBudget: [],
  studioInteractionMotionBudget: [],
  studioStateMutationMotionBudget: [],
  studioFrameContinuity: [],
  studioMobileDensity: [],
  pageContinuity: [],
  heroFirstPaint: [],
  interactiveMicroMotion: [],
  keyboardTargetSurface: [],
  responsiveMotionLifecycle: [],
  dynamicReducedMotionLifecycle: [],
  mountLifecycle: [],
  heroVisualContract: [],
  motionPlayback: [],
  scrollTriggerRail: [],
  scrollTriggerRailSweep: [],
  scrollTriggerRailReducedMotion: [],
  topNavigationCurrent: [],
  scrollTriggerInventory: [],
  gsapAnimationInventory: [],
  mediaReducedMotion: [],
  rootReducedMotion: [],
  reducedMotionSticky: [],
  readingProgress: [],
  readingProgressReducedMotion: [],
  consoleClean: [],
  screenshots: [],
  failures,
};
const browseLockPath = "/tmp/memory-coverage-lab-gstack-browse.lock";
const viewports = [
  { name: "desktop", size: "1440x1000", orbitWillChange: 2 },
  { name: "motion-breakpoint-1360", size: "1360x900", orbitWillChange: 2 },
  { name: "motion-breakpoint-1359", size: "1359x900", orbitWillChange: 0 },
  { name: "motion-breakpoint-901", size: "901x900", orbitWillChange: 0 },
  { name: "motion-breakpoint-900", size: "900x900", orbitWillChange: 0 },
  { name: "motion-breakpoint-721", size: "721x900", orbitWillChange: 0 },
  { name: "motion-breakpoint-720", size: "720x900", orbitWillChange: 0 },
  { name: "mobile", size: "390x844", orbitWillChange: 0 },
];
const reducedMotionCssHoverTargets = [
  { label: "hero-primary-action", selector: ".hero-actions .action-link-primary", transformMode: "none" },
  { label: "toprail-action", selector: ".top-rail .action-link-outline", transformMode: "none" },
  { label: "surface-action", selector: ".surface-grid .action-link-dark", transformMode: "none" },
  { label: "footer-accent-action", selector: ".footer-actions .action-link-accent", transformMode: "none" },
  { label: "map-node", selector: ".map-node:not(.active)", transformMode: "stable" },
];

function viewportsForReport() {
  return [
    { name: "desktop", size: "1440x1000", orbitWillChange: 2 },
    { name: "motion-breakpoint-1360", size: "1360x900", orbitWillChange: 2 },
    { name: "motion-breakpoint-1359", size: "1359x900", orbitWillChange: 0 },
    { name: "motion-breakpoint-901", size: "901x900", orbitWillChange: 0 },
    { name: "motion-breakpoint-900", size: "900x900", orbitWillChange: 0 },
    { name: "motion-breakpoint-721", size: "721x900", orbitWillChange: 0 },
    { name: "motion-breakpoint-720", size: "720x900", orbitWillChange: 0 },
    { name: "mobile", size: "390x844", orbitWillChange: 0 },
  ];
}

function runBrowse(args, options = {}) {
  return execFileSync(browseBin, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 30_000,
  }).trim();
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

function isTransientBrowseContextError(error) {
  return /Execution context was destroyed|Cannot find context with specified id|Target page, context or browser has been closed/i.test(
    browseErrorText(error),
  );
}

function summarizeBrowseFailure(args, error, attemptCount) {
  const text = browseErrorText(error)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const diagnostic = text.find((line) =>
    /Execution context was destroyed|Cannot find context with specified id|Target page, context or browser has been closed|evaluate:|error/i.test(
      line,
    ),
  );
  return `browse ${args[0]} failed after ${attemptCount} attempt(s): ${diagnostic ?? text.at(-1) ?? "unknown error"}`;
}

function runJson(args, options = {}) {
  const maxAttempts = options.retries ?? 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let output = "";

    try {
      output = runBrowse(args, options);
    } catch (error) {
      if (attempt < maxAttempts && isTransientBrowseContextError(error)) {
        sleep(350 * attempt);
        continue;
      }

      failures.push(summarizeBrowseFailure(args, error, attempt));
      return null;
    }

    try {
      return JSON.parse(output);
    } catch {
      failures.push(`Failed to parse JSON from browse ${args[0]}:\n${output}`);
      return null;
    }
  }

  failures.push(`browse ${args[0]} returned no JSON evidence after ${maxAttempts} attempt(s)`);
  return null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function parseViewportSize(size) {
  const [width, height] = size.split("x").map((value) => Number(value));

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid viewport size: ${size}`);
  }

  return { width, height };
}

function browseLockOwnerAlive() {
  let pid = 0;

  try {
    pid = Number(readFileSync(browseLockPath, "utf8").split(/\s+/)[0]);
  } catch {
    return false;
  }

  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireBrowseLock() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    try {
      const fd = openSync(browseLockPath, "wx");
      writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      closeSync(fd);
      return () => {
        try {
          rmSync(browseLockPath);
        } catch {
          // The lock may already be gone if another cleanup path won the race.
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        failures.push(`Failed to acquire gstack browse lock: ${error instanceof Error ? error.message : String(error)}`);
        return () => {};
      }

      try {
        if (!browseLockOwnerAlive() || Date.now() - statSync(browseLockPath).mtimeMs > 120_000) {
          rmSync(browseLockPath);
          continue;
        }
      } catch {
        // Retry if the lock disappeared between stat and removal.
      }

      sleep(250);
    }
  }

  failures.push(`Timed out waiting for gstack browse lock: ${browseLockPath}`);
  return () => {};
}

function runPerf(label) {
  const output = runBrowse(["perf"]);
  const metrics = Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim().match(/^(\w+)\s+(\d+)ms$/))
      .filter(Boolean)
      .map((match) => [match[1], Number(match[2])]),
  );

  if (!Number.isFinite(metrics.total) || !Number.isFinite(metrics.load)) {
    failures.push(`[${label}] failed to parse performance output:\n${output}`);
    return;
  }

  qaReport.performance.push({ label, ...metrics });

  if (metrics.total > 2500) {
    failures.push(`[${label}] total load time ${metrics.total}ms exceeds 2500ms`);
  }

  if (metrics.load > 2000) {
    failures.push(`[${label}] load event time ${metrics.load}ms exceeds 2000ms`);
  }
}

function clearNetwork(label) {
  const output = runBrowse(["network", "--clear"]);
  if (!output.includes("Network buffer cleared.")) {
    failures.push(`[${label}] failed to clear network buffer:\n${output}`);
  }
}

function checkNetwork(label) {
  const output = runBrowse(["network"]);
  const failedRequests = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (line === "(no network requests)") {
        return false;
      }

      if (/\bERR_[A-Z0-9_]+\b/i.test(line)) {
        return true;
      }

      if (/\b(failed|failure|blocked|aborted)\b/i.test(line)) {
        return true;
      }

      const statusMatch = line.match(/→\s*(\d{3})\b/);
      return statusMatch ? Number(statusMatch[1]) >= 400 : false;
    });

  if (failedRequests.length > 0) {
    failures.push(
      `[${label}] network failures:\n${failedRequests.slice(0, 12).join("\n")}`,
    );
  }
}

function checkConsoleClean(label) {
  const output = runBrowse(["console"]);
  const clean = output.includes("(no console messages)");

  qaReport.consoleClean.push({
    label,
    clean,
    output,
  });

  if (!clean) {
    failures.push(`[${label}] console messages were reported:\n${output}`);
  }
}

async function loadPlaywrightChromium(contextLabel) {
  try {
    const playwright = await import(pathToFileURL(playwrightModulePath).href);
    const chromium = playwright.chromium ?? playwright.default?.chromium;
    if (!chromium) {
      throw new Error("Playwright chromium export missing");
    }

    return chromium;
  } catch (error) {
    failures.push(
      `Failed to load Playwright for ${contextLabel} from ${playwrightModulePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

async function runMediaReducedMotionQa() {
  const chromium = await loadPlaywrightChromium("real media reduced-motion QA");
  if (!chromium) {
    return;
  }

  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: parseViewportSize(viewport.size),
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          consoleErrors.push(`${message.type()}: ${message.text()}`);
        }
      });

      try {
        await page.goto(targetUrl, { waitUntil: "load", timeout: 30_000 });
        await page.waitForTimeout(700);
        const cssHoverSamples = [];

        for (const target of reducedMotionCssHoverTargets) {
          const count = await page.locator(target.selector).count();

          if (count === 0) {
            cssHoverSamples.push({
              ...target,
              ok: false,
              reason: "missing-target",
              count,
            });
            continue;
          }

          const beforeHoverState = await page.evaluate(`(() => {
            const node = document.querySelector(${JSON.stringify(target.selector)});

            if (!(node instanceof HTMLElement)) {
              return null;
            }

            const style = getComputedStyle(node);
            return {
              computedTransform: style.transform,
              inlineTransform: node.style.transform || "",
              inlineWillChange: node.style.willChange || "",
            };
          })()`);
          await page.hover(target.selector, { timeout: 5_000 });
          await page.waitForTimeout(80);
          const hoverState = await page.evaluate(`(() => {
            const node = document.querySelector(${JSON.stringify(target.selector)});

            if (!(node instanceof HTMLElement)) {
              return null;
            }

            const style = getComputedStyle(node);
            return {
              computedTransform: style.transform,
              inlineTransform: node.style.transform || "",
              inlineWillChange: node.style.willChange || "",
            };
          })()`);
          const transformOk = target.transformMode === "stable"
            ? hoverState?.computedTransform === beforeHoverState?.computedTransform
            : hoverState?.computedTransform === "none";
          const ok = transformOk && !hoverState?.inlineTransform && !hoverState?.inlineWillChange;

          cssHoverSamples.push({
            ...target,
            ok,
            reason: ok ? "" : "reduced-media-css-hover-motion",
            count,
            beforeHoverState,
            hoverState,
          });
          await page.mouse.move(1, 1);
          await page.waitForTimeout(40);
        }

        const evidence = await page.evaluate(`
          new Promise(resolve => {
            const targets = ${interactiveMicroMotionTargetsExpression()};
            const inspect = (node) => ({
              inlineTransform: node.style.transform || "",
              inlineWillChange: node.style.willChange || "",
              computedTransform: getComputedStyle(node).transform,
              computedWillChange: getComputedStyle(node).willChange,
            });
            const visibleState = [
              ".top-rail",
              ".hero-copy h1 span",
              ".hero-visual",
              ".section-intro > *",
              ".continuity-lane article",
              ".surface-grid article",
              ".research-list article",
              ".platform-copy > *",
              ".platform-steps article",
              ".workbench-head > *",
              ".studio-controls",
              ".metric-ribbon article",
              ".footer-proof-grid article",
              ".footer-actions a",
              ".primary-lab > *",
              ".dossier-panel",
              ".meter i",
            ].map(selector => {
              const nodes = [...document.querySelectorAll(selector)];
              return {
                selector,
                count: nodes.length,
                hidden: nodes.filter(node => {
                  const style = getComputedStyle(node);
                  return style.opacity === "0" || style.visibility === "hidden";
                }).length,
                inlineResidue: nodes.filter(node =>
                  node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange
                ).length,
              };
            });
            const progress = (() => {
              const bar = document.querySelector(".reading-progress span");
              if (!bar) return { exists: false };
              const transform = getComputedStyle(bar).transform;
              const match = transform && transform !== "none" ? transform.match(/matrix\\(([^,]+)/) : null;
              return {
                exists: true,
                scaleX: match ? Number(Number(match[1]).toFixed(4)) : 1,
                inlineTransform: bar.style.transform || "",
                inlineWillChange: bar.style.willChange || "",
              };
            })();
            const debug = typeof window.__memoryBenchMotionInspect === "function"
              ? window.__memoryBenchMotionInspect()
              : window.__memoryBenchMotion || null;
            const pointerEnter = new MouseEvent("pointerenter", { bubbles: false, cancelable: false, view: window });
            const pointerLeave = new MouseEvent("pointerleave", { bubbles: false, cancelable: false, view: window });
            const samples = [];
            let index = 0;

            const runTarget = () => {
              const target = targets[index];
              index += 1;

              if (!target) {
                resolve({
                  mediaReduceMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
                  mediaNoPreferenceMatches: window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
                  urlSearch: window.location.search,
                  urlOverrideAttr: document.querySelector(".opendesign-app")?.getAttribute("data-motion-reduce") || "",
                  debug: {
                    hasDebug: !!debug,
                    mode: debug?.mode || "",
                    reducedMotionSource: debug?.reducedMotionSource || "",
                    triggerIds: Array.isArray(debug?.triggerIds) ? debug.triggerIds : [],
                    railTriggerIds: Array.isArray(debug?.railTriggerIds) ? debug.railTriggerIds : [],
                    readingProgressTriggerIds: Array.isArray(debug?.readingProgressTriggerIds)
                      ? debug.readingProgressTriggerIds
                      : [],
                    markerCount: Number(debug?.markerCount) || 0,
                    pinSpacerCount: Number(debug?.pinSpacerCount) || 0,
                    pinnedCount: Number(debug?.pinnedCount) || 0,
                    scrubbedIds: Array.isArray(debug?.scrubbedIds) ? debug.scrubbedIds : [],
                    duplicateIds: Array.isArray(debug?.duplicateIds) ? debug.duplicateIds : [],
                    animations: debug?.animations || null,
                  },
                  visibleState,
                  progress,
                  railState: {
                    railCount: document.querySelectorAll(".briefing-rail").length,
                    activeRailCount: document.querySelectorAll(".briefing-rail.is-scroll-active").length,
                    currentRailCount: document.querySelectorAll('.briefing-rail[aria-current="step"]').length,
                  },
                  samples,
                });
                return;
              }

              target.setup?.();
              setTimeout(() => {
                const node = document.querySelector(target.selector);

                if (!(node instanceof HTMLElement)) {
                  samples.push({
                    label: target.label,
                    selector: target.selector,
                    ok: false,
                    reason: "missing-target",
                    exists: false,
                  });
                  runTarget();
                  return;
                }

                node.scrollIntoView({ block: "center", inline: "nearest" });
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                setTimeout(() => {
                  const before = inspect(node);
                  node.dispatchEvent(pointerEnter);
                  node.focus({ preventScroll: true });
                  setTimeout(() => {
                    const active = inspect(node);
                    node.dispatchEvent(pointerLeave);
                    node.blur();
                    setTimeout(() => {
                      const settled = inspect(node);
                      const activeInline = Boolean(active.inlineTransform || active.inlineWillChange);
                      const settledResidue = Boolean(settled.inlineTransform || settled.inlineWillChange);
                      samples.push({
                        label: target.label,
                        selector: target.selector,
                        ok: !activeInline && !settledResidue,
                        reason: !activeInline && !settledResidue ? "" : "reduced-media-interactive-motion-state",
                        exists: true,
                        before,
                        active,
                        settled,
                        activeInline,
                        settledResidue,
                      });
                      runTarget();
                    }, 220);
                  }, 140);
                }, 80);
              }, 120);
            };

            runTarget();
          })
        `);

        const animations = evidence?.debug?.animations || {};
        const hiddenCount = (evidence?.visibleState || []).reduce(
          (total, item) => total + (Number(item.hidden) || 0),
          0,
        );
        const inlineResidueCount = (evidence?.visibleState || []).reduce(
          (total, item) => total + (Number(item.inlineResidue) || 0),
          0,
        );
        const sampleCount = Array.isArray(evidence?.samples) ? evidence.samples.length : 0;
        const samplePassCount = Array.isArray(evidence?.samples)
          ? evidence.samples.filter((sample) => sample?.ok === true).length
          : 0;
        const cssHoverPassCount = cssHoverSamples.filter((sample) => sample.ok === true).length;
        const ok =
          evidence?.mediaReduceMatches === true &&
          evidence?.mediaNoPreferenceMatches === false &&
          evidence?.urlSearch === "" &&
          evidence?.urlOverrideAttr === "" &&
          evidence?.debug?.hasDebug === true &&
          evidence?.debug?.mode === "reduced" &&
          evidence?.debug?.reducedMotionSource === "media" &&
          evidence?.debug?.triggerIds?.length === 0 &&
          evidence?.debug?.railTriggerIds?.length === 0 &&
          evidence?.debug?.readingProgressTriggerIds?.length === 0 &&
          evidence?.debug?.markerCount === 0 &&
          evidence?.debug?.pinSpacerCount === 0 &&
          evidence?.debug?.pinnedCount === 0 &&
          evidence?.debug?.scrubbedIds?.length === 0 &&
          evidence?.debug?.duplicateIds?.length === 0 &&
          Number(animations.activeCount) === 0 &&
          Number(animations.repeatCount) === 0 &&
          Number(animations.activeRepeatCount) === 0 &&
          Number(animations.orbitRepeatCount) === 0 &&
          Number(animations.nonOrbitRepeatCount) === 0 &&
          hiddenCount === 0 &&
          inlineResidueCount === 0 &&
          evidence?.railState?.railCount === 5 &&
          evidence?.railState?.activeRailCount === 0 &&
          evidence?.railState?.currentRailCount === 0 &&
          evidence?.progress?.exists === true &&
          Number(evidence?.progress?.scaleX) === 0 &&
          !evidence?.progress?.inlineTransform &&
          !evidence?.progress?.inlineWillChange &&
          sampleCount === interactiveMicroMotionTargets.length &&
          samplePassCount === interactiveMicroMotionTargets.length &&
          cssHoverSamples.length === reducedMotionCssHoverTargets.length &&
          cssHoverPassCount === reducedMotionCssHoverTargets.length &&
          consoleErrors.length === 0;

        qaReport.mediaReducedMotion.push({
          label: viewport.name,
          size: viewport.size,
          ok,
          mediaReduceMatches: evidence?.mediaReduceMatches === true,
          mediaNoPreferenceMatches: evidence?.mediaNoPreferenceMatches === true,
          urlSearch: evidence?.urlSearch ?? "",
          urlOverrideAttr: evidence?.urlOverrideAttr ?? "",
          mode: evidence?.debug?.mode ?? "",
          reducedMotionSource: evidence?.debug?.reducedMotionSource ?? "",
          triggerCount: evidence?.debug?.triggerIds?.length ?? null,
          railTriggerCount: evidence?.debug?.railTriggerIds?.length ?? null,
          readingProgressTriggerCount: evidence?.debug?.readingProgressTriggerIds?.length ?? null,
          markerCount: evidence?.debug?.markerCount ?? null,
          pinSpacerCount: evidence?.debug?.pinSpacerCount ?? null,
          pinnedCount: evidence?.debug?.pinnedCount ?? null,
          scrubbedCount: evidence?.debug?.scrubbedIds?.length ?? null,
          duplicateCount: evidence?.debug?.duplicateIds?.length ?? null,
          animationCount: Number(animations.animationCount) || 0,
          activeCount: Number(animations.activeCount) || 0,
          repeatCount: Number(animations.repeatCount) || 0,
          activeRepeatCount: Number(animations.activeRepeatCount) || 0,
          orbitRepeatCount: Number(animations.orbitRepeatCount) || 0,
          nonOrbitRepeatCount: Number(animations.nonOrbitRepeatCount) || 0,
          hiddenCount,
          inlineResidueCount,
          railState: evidence?.railState ?? null,
          readingProgress: evidence?.progress ?? null,
          interactiveMicroMotionCount: sampleCount,
          interactiveMicroMotionPassCount: samplePassCount,
          interactiveMicroMotionFailures: Array.isArray(evidence?.samples)
            ? evidence.samples.filter((sample) => sample?.ok !== true)
            : [],
          cssHoverMotionCount: cssHoverSamples.length,
          cssHoverMotionPassCount: cssHoverPassCount,
          cssHoverMotionFailures: cssHoverSamples.filter((sample) => sample.ok !== true),
          consoleErrors,
        });

        if (!ok) {
          failures.push(
            `[${viewport.name} media-reduced-motion] real media reduced-motion QA failed: mode=${
              evidence?.debug?.mode ?? "missing"
            }, source=${evidence?.debug?.reducedMotionSource ?? "missing"}, samples=${
              samplePassCount
            }/${sampleCount}, hidden=${hiddenCount}, residue=${inlineResidueCount}, consoleErrors=${
              consoleErrors.length
            }, cssHover=${cssHoverPassCount}/${cssHoverSamples.length}`,
          );
        }
      } catch (error) {
        qaReport.mediaReducedMotion.push({
          label: viewport.name,
          size: viewport.size,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          consoleErrors,
        });
        failures.push(
          `[${viewport.name} media-reduced-motion] real media reduced-motion QA threw: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    failures.push(`Real media reduced-motion QA failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close?.();
  }
}

async function runDynamicReducedMotionLifecycleQa() {
  const chromium = await loadPlaywrightChromium("dynamic reduced-motion lifecycle QA");
  if (!chromium) {
    return;
  }

  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: parseViewportSize("1360x900"),
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleErrors.push(`${message.type()}: ${message.text()}`);
      }
    });

    const capturePhase = async (label) =>
      page.evaluate(
        `(() => {
          const debug = typeof window.__memoryBenchMotionInspect === "function"
            ? window.__memoryBenchMotionInspect()
            : window.__memoryBenchMotion || null;
          const animations = debug?.animations || {};
          const orbitPlayback = debug?.orbitPlayback || {};
          const visibleState = [
            ".top-rail",
            ".hero-copy h1 span",
            ".hero-actions a",
            ".lane-strip span",
            ".hero-visual",
            ".orbit",
            ".section-intro > *",
            ".continuity-lane article",
            ".surface-grid article",
            ".research-list article",
            ".platform-copy > *",
            ".platform-steps article",
            ".workbench-head > *",
            ".studio-controls",
            ".metric-ribbon article",
            ".footer-proof-grid article",
            ".footer-actions a",
            ".primary-lab > *",
            ".dossier-panel",
            ".meter i"
          ].map(selector => {
            const nodes = [...document.querySelectorAll(selector)];
            return {
              selector,
              count: nodes.length,
              hidden: nodes.filter(node => {
                const style = getComputedStyle(node);
                return style.opacity === "0" || style.visibility === "hidden";
              }).length,
              inlineResidue: nodes.filter(node =>
                node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange
              ).length,
              stickyPosition: nodes.filter(node => {
                const position = getComputedStyle(node).position;
                return position === "sticky" || position === "fixed";
              }).length
            };
          });
          const progress = (() => {
            const bar = document.querySelector(".reading-progress span");
            if (!bar) return { exists: false };
            const transform = getComputedStyle(bar).transform;
            const match = transform && transform !== "none" ? transform.match(/matrix\\(([^,]+)/) : null;
            return {
              exists: true,
              scaleX: match ? Number(Number(match[1]).toFixed(4)) : 1,
              inlineTransform: bar.style.transform || "",
              inlineWillChange: bar.style.willChange || ""
            };
          })();
          const triggerIds = Array.isArray(debug?.triggerIds) ? debug.triggerIds : [];
          const railTriggerIds = Array.isArray(debug?.railTriggerIds) ? debug.railTriggerIds : [];
          const readingProgressTriggerIds = Array.isArray(debug?.readingProgressTriggerIds)
            ? debug.readingProgressTriggerIds
            : [];
          const hiddenCount = visibleState.reduce((total, item) => total + item.hidden, 0);
          const inlineResidueCount = visibleState
            .filter(item => item.selector !== ".orbit")
            .reduce((total, item) => total + item.inlineResidue, 0);
          const stickyResidueCount = visibleState
            .filter(item => [".top-rail", ".briefing-rail", ".platform-copy", ".dossier-panel"].includes(item.selector))
            .reduce((total, item) => total + item.stickyPosition, 0);

          return {
            label: ${JSON.stringify(label)},
            mediaReduceMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            mediaNoPreferenceMatches: window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
            hasDebug: !!debug,
            mode: debug?.mode || "",
            reducedMotionSource: debug?.reducedMotionSource || "",
            triggerCount: triggerIds.length,
            railTriggerCount: railTriggerIds.length,
            readingProgressTriggerCount: readingProgressTriggerIds.length,
            duplicateCount: Array.isArray(debug?.duplicateIds) ? debug.duplicateIds.length : null,
            markerCount: Number(debug?.markerCount) || 0,
            pinSpacerCount: Number(debug?.pinSpacerCount) || 0,
            pinnedCount: Number(debug?.pinnedCount) || 0,
            scrubbedCount: Array.isArray(debug?.scrubbedIds) ? debug.scrubbedIds.length : 0,
            refreshCount: Number(debug?.refreshCount) || 0,
            stateMutationRefreshCount: Number(debug?.stateMutationRefreshCount) || 0,
            activeCount: Number(animations.activeCount) || 0,
            repeatCount: Number(animations.repeatCount) || 0,
            activeRepeatCount: Number(animations.activeRepeatCount) || 0,
            pausedRepeatCount: Number(animations.pausedRepeatCount) || 0,
            orbitRepeatCount: Number(animations.orbitRepeatCount) || 0,
            nonOrbitRepeatCount: Number(animations.nonOrbitRepeatCount) || 0,
            orbitAvailable: orbitPlayback.available === true,
            orbitObserverAttached: orbitPlayback.observerAttached === true,
            orbitTweenCount: Number(orbitPlayback.tweenCount) || 0,
            orbitActiveTweenCount: Number(orbitPlayback.activeTweenCount) || 0,
            orbitPausedTweenCount: Number(orbitPlayback.pausedTweenCount) || 0,
            orbitShouldPlay: orbitPlayback.shouldPlay === true,
            hiddenCount,
            inlineResidueCount,
            stickyResidueCount,
            railState: {
              railCount: document.querySelectorAll(".briefing-rail").length,
              activeRailCount: document.querySelectorAll(".briefing-rail.is-scroll-active").length,
              currentRailCount: document.querySelectorAll('.briefing-rail[aria-current="step"]').length
            },
            readingProgress: progress
          };
        })()`,
      );

    try {
      await page.goto(targetUrl, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(2600);
      const normalStart = await capturePhase("normal-start");

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(`(() => {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
      })()`);
      await page.waitForTimeout(1200);
      const reducedAfterToggle = await capturePhase("reduced-after-toggle");

      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(`(() => {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("scroll"));
      })()`);
      await page.waitForTimeout(2600);
      const normalAfterRestore = await capturePhase("normal-after-restore");

      const isNormalPhaseOk = (phase) =>
        phase?.mediaReduceMatches === false &&
        phase?.mediaNoPreferenceMatches === true &&
        phase?.hasDebug === true &&
        phase?.mode === "normal" &&
        phase?.reducedMotionSource === "none" &&
        Number(phase?.triggerCount) === 6 &&
        Number(phase?.railTriggerCount) === 5 &&
        Number(phase?.readingProgressTriggerCount) === 1 &&
        Number(phase?.duplicateCount) === 0 &&
        Number(phase?.markerCount) === 0 &&
        Number(phase?.pinSpacerCount) === 0 &&
        Number(phase?.pinnedCount) === 0 &&
        Number(phase?.scrubbedCount) === 1 &&
        Number(phase?.repeatCount) === 2 &&
        Number(phase?.activeRepeatCount) === 2 &&
        Number(phase?.pausedRepeatCount) === 0 &&
        Number(phase?.orbitRepeatCount) === 2 &&
        Number(phase?.nonOrbitRepeatCount) === 0 &&
        phase?.orbitAvailable === true &&
        phase?.orbitObserverAttached === true &&
        Number(phase?.orbitTweenCount) === 2 &&
        Number(phase?.orbitActiveTweenCount) === 2 &&
        phase?.orbitShouldPlay === true &&
        Number(phase?.hiddenCount) === 0 &&
        Number(phase?.inlineResidueCount) === 0 &&
        phase?.readingProgress?.exists === true;
      const isReducedPhaseOk = (phase) =>
        phase?.mediaReduceMatches === true &&
        phase?.mediaNoPreferenceMatches === false &&
        phase?.hasDebug === true &&
        phase?.mode === "reduced" &&
        phase?.reducedMotionSource === "media" &&
        Number(phase?.triggerCount) === 0 &&
        Number(phase?.railTriggerCount) === 0 &&
        Number(phase?.readingProgressTriggerCount) === 0 &&
        Number(phase?.duplicateCount) === 0 &&
        Number(phase?.markerCount) === 0 &&
        Number(phase?.pinSpacerCount) === 0 &&
        Number(phase?.pinnedCount) === 0 &&
        Number(phase?.scrubbedCount) === 0 &&
        Number(phase?.activeCount) === 0 &&
        Number(phase?.repeatCount) === 0 &&
        Number(phase?.activeRepeatCount) === 0 &&
        Number(phase?.orbitRepeatCount) === 0 &&
        Number(phase?.nonOrbitRepeatCount) === 0 &&
        phase?.orbitAvailable === false &&
        Number(phase?.orbitTweenCount) === 0 &&
        Number(phase?.hiddenCount) === 0 &&
        Number(phase?.inlineResidueCount) === 0 &&
        Number(phase?.stickyResidueCount) === 0 &&
        phase?.railState?.railCount === 5 &&
        phase?.railState?.activeRailCount === 0 &&
        phase?.railState?.currentRailCount === 0 &&
        phase?.readingProgress?.exists === true &&
        Number(phase?.readingProgress?.scaleX) === 0 &&
        !phase?.readingProgress?.inlineTransform &&
        !phase?.readingProgress?.inlineWillChange;
      const phases = [normalStart, reducedAfterToggle, normalAfterRestore];
      const normalPhasePassCount = [normalStart, normalAfterRestore].filter(isNormalPhaseOk).length;
      const reducedPhasePassCount = [reducedAfterToggle].filter(isReducedPhaseOk).length;
      const refreshDelta = Number(normalAfterRestore?.refreshCount) - Number(normalStart?.refreshCount);
      const ok =
        normalPhasePassCount === 2 &&
        reducedPhasePassCount === 1 &&
        refreshDelta > 0 &&
        consoleErrors.length === 0;

      qaReport.dynamicReducedMotionLifecycle.push({
        label: "desktop-live-media-toggle",
        ok,
        phaseCount: phases.length,
        normalPhasePassCount,
        reducedPhasePassCount,
        refreshDelta,
        phases,
        consoleErrors,
      });

      if (!ok) {
        failures.push(
          `[desktop-live-media-toggle] dynamic reduced-motion lifecycle failed: normal=${normalPhasePassCount}/2, reduced=${reducedPhasePassCount}/1, refreshDelta=${refreshDelta}, consoleErrors=${consoleErrors.length}`,
        );
      }
    } catch (error) {
      qaReport.dynamicReducedMotionLifecycle.push({
        label: "desktop-live-media-toggle",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        consoleErrors,
      });
      failures.push(
        `[desktop-live-media-toggle] dynamic reduced-motion lifecycle threw: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await context.close();
    }
  } catch (error) {
    failures.push(`Dynamic reduced-motion lifecycle QA failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close?.();
  }
}

function checkLayoutStability(label) {
  const stability = runJson([
    "js",
    `new Promise(resolve => {
      const supported = PerformanceObserver?.supportedEntryTypes?.includes("layout-shift") ?? false;
      if (!supported) {
        resolve({ supported: false, count: 0, cls: 0, worst: 0 });
        return;
      }

      const entries = [];
      const observer = new PerformanceObserver((list) => {
        entries.push(
          ...list.getEntries()
            .filter(entry => !entry.hadRecentInput)
            .map(entry => ({
              value: Number(entry.value) || 0,
              startTime: Math.round(entry.startTime),
            })),
        );
      });

      try {
        observer.observe({ type: "layout-shift", buffered: true });
      } catch {
        resolve({ supported: false, count: 0, cls: 0, worst: 0 });
        return;
      }

      requestAnimationFrame(() => {
        setTimeout(() => {
          observer.disconnect();
          const cls = entries.reduce((total, entry) => total + entry.value, 0);
          const worst = entries.reduce((max, entry) => Math.max(max, entry.value), 0);

          resolve({
            supported: true,
            count: entries.length,
            cls: Number(cls.toFixed(4)),
            worst: Number(worst.toFixed(4)),
          });
        }, 0);
      });
    })`,
  ], { timeout: 30_000 });

  if (!stability) {
    return;
  }

  qaReport.layoutStability.push({
    label,
    ...stability,
    thresholds: {
      cls: 0.05,
      worst: 0.03,
    },
  });

  if (!stability.supported) {
    failures.push(`[${label}] layout-shift performance entries are not supported`);
    return;
  }

  if (stability.cls > 0.05) {
    failures.push(`[${label}] cumulative layout shift ${stability.cls} exceeds 0.05`);
  }

  if (stability.worst > 0.03) {
    failures.push(`[${label}] single layout shift ${stability.worst} exceeds 0.03`);
  }
}

function checkMotionFrameBudget(viewport, expectedMode) {
  const frameBudget = runJson([
    "js",
    `new Promise(resolve => {
      const durations = [];
      let last = 0;
      const sampleCount = 90;
      const timeout = setTimeout(() => {
        const avg = durations.length
          ? durations.reduce((total, duration) => total + duration, 0) / durations.length
          : 0;
        resolve({
          ok: false,
          reason: "timeout",
          sampleCount: durations.length,
          avg: Number(avg.toFixed(2)),
          p95: null,
          max: durations.length ? Number(Math.max(...durations).toFixed(2)) : null,
          longFrameCount: durations.filter(duration => duration > 50).length,
        });
      }, 5000);

      const finish = () => {
        clearTimeout(timeout);
        const sorted = [...durations].sort((a, b) => a - b);
        const avg = durations.reduce((total, duration) => total + duration, 0) / durations.length;
        const stableDurations = sorted.slice(0, Math.max(1, sorted.length - 2));
        const stableAvg = stableDurations.reduce((total, duration) => total + duration, 0) / stableDurations.length;
        const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] || 0;
        const max = Math.max(...durations);
        const longFrameCount = durations.filter(duration => duration > 50).length;

        resolve({
          ok: avg <= 28 && p95 <= 60 && max <= 160 && longFrameCount <= 5,
          reason: "",
          sampleCount: durations.length,
          avg: Number(avg.toFixed(2)),
          p95: Number(p95.toFixed(2)),
          max: Number(max.toFixed(2)),
          longFrameCount,
        });
      };

      const sample = (now) => {
        if (last > 0) {
          durations.push(now - last);
        }
        last = now;

        if (durations.length >= sampleCount) {
          finish();
          return;
        }

        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    })`,
  ], { timeout: 30_000 });

  if (!frameBudget) {
    failures.push(`[${viewport.name} ${expectedMode}] motion frame budget check did not return evidence`);
    return;
  }

  qaReport.motionFrameBudget.push({
    label: viewport.name,
    expectedMode,
    ok: frameBudget.ok === true,
    sampleCount: frameBudget.sampleCount ?? 0,
    avg: frameBudget.avg ?? null,
    p95: frameBudget.p95 ?? null,
    max: frameBudget.max ?? null,
    longFrameCount: frameBudget.longFrameCount ?? null,
    thresholds: {
      avg: 28,
      p95: 60,
      max: 160,
      longFrameCount: 5,
    },
  });

  if (frameBudget.ok !== true) {
    failures.push(
      `[${viewport.name} ${expectedMode}] motion frame budget failed: avg=${
        frameBudget.avg ?? "missing"
      }ms, p95=${frameBudget.p95 ?? "missing"}ms, max=${
        frameBudget.max ?? "missing"
      }ms, longFrames=${frameBudget.longFrameCount ?? "missing"}`,
    );
  }
}

function checkScrollMotionFrameBudget(viewport, expectedMode) {
  const frameBudget = runJson([
    "js",
    `new Promise(resolve => {
      const startNode = document.getElementById("research") || document.querySelector(".page-continuum");
      const endNode = document.getElementById("subscribe") || document.querySelector(".site-footer");

      if (!startNode || !endNode) {
        resolve({ ok: false, reason: "missing-scroll-boundary", sampleCount: 0 });
        return;
      }

      const startY = Math.max(0, Math.round(startNode.getBoundingClientRect().top + window.scrollY));
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const endY = Math.min(
        maxY,
        Math.max(
          startY,
          Math.round(endNode.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.65),
        ),
      );
      const distance = endY - startY;

      if (distance < window.innerHeight) {
        resolve({ ok: false, reason: "scroll-distance-too-short", sampleCount: 0, distance });
        return;
      }

      const durations = [];
      const sampleCount = 90;
      let frameIndex = 0;
      let last = 0;
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";

      const timeout = setTimeout(() => {
        const avg = durations.length
          ? durations.reduce((total, duration) => total + duration, 0) / durations.length
          : 0;
        resolve({
          ok: false,
          reason: "timeout",
          sampleCount: durations.length,
          distance,
          finalScrollY: Math.round(window.scrollY),
          expectedEndY: endY,
          avg: Number(avg.toFixed(2)),
          p90: null,
          p95: null,
          trimmedMax: null,
          max: durations.length ? Number(Math.max(...durations).toFixed(2)) : null,
          schedulerSpikeCount: durations.filter(duration => duration > 500).length,
          longFrameCount: durations.filter(duration => duration > 50).length,
        });
      }, 6000);

      const finish = () => {
        clearTimeout(timeout);
        const sorted = [...durations].sort((a, b) => a - b);
        const avg = durations.reduce((total, duration) => total + duration, 0) / durations.length;
        const stableDurations = sorted.slice(0, Math.max(1, sorted.length - 2));
        const stableAvg = stableDurations.reduce((total, duration) => total + duration, 0) / stableDurations.length;
        const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)] || 0;
        const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] || 0;
        const trimmedMax = Math.max(...stableDurations);
        const max = Math.max(...durations);
        const schedulerSpikeCount = durations.filter(duration => duration > 500).length;
        const longFrameCount = durations.filter(duration => duration > 50).length;
        const finalScrollY = Math.round(window.scrollY);
        const reachedEnd = Math.abs(finalScrollY - endY) <= 12;

        resolve({
          ok: reachedEnd && stableAvg <= 32 && p90 <= 70 && trimmedMax <= 220 && schedulerSpikeCount <= 2 && longFrameCount <= 8,
          reason: reachedEnd ? "" : "did-not-reach-end",
          sampleCount: durations.length,
          distance,
          finalScrollY,
          expectedEndY: endY,
          avg: Number(avg.toFixed(2)),
          stableAvg: Number(stableAvg.toFixed(2)),
          p90: Number(p90.toFixed(2)),
          p95: Number(p95.toFixed(2)),
          trimmedMax: Number(trimmedMax.toFixed(2)),
          max: Number(max.toFixed(2)),
          schedulerSpikeCount,
          longFrameCount,
        });
      };

      const sample = (now) => {
        if (last > 0) {
          durations.push(now - last);
        }
        last = now;

        const progress = Math.min(1, frameIndex / (sampleCount - 1));
        const y = Math.round(startY + distance * progress);
        window.scrollTo(0, y);
        window.dispatchEvent(new Event("scroll"));
        frameIndex += 1;

        if (frameIndex >= sampleCount) {
          requestAnimationFrame(finish);
          return;
        }

        requestAnimationFrame(sample);
      };

      window.scrollTo(0, startY);
      requestAnimationFrame(sample);
    })`,
  ], { timeout: 30_000 });

  if (!frameBudget) {
    failures.push(`[${viewport.name} ${expectedMode}] scroll motion frame budget check did not return evidence`);
    return;
  }

  qaReport.scrollMotionFrameBudget.push({
    label: viewport.name,
    expectedMode,
    ok: frameBudget.ok === true,
    reason: frameBudget.reason ?? "",
    sampleCount: frameBudget.sampleCount ?? 0,
    distance: frameBudget.distance ?? null,
    finalScrollY: frameBudget.finalScrollY ?? null,
    expectedEndY: frameBudget.expectedEndY ?? null,
    avg: frameBudget.avg ?? null,
    stableAvg: frameBudget.stableAvg ?? null,
    p90: frameBudget.p90 ?? null,
    p95: frameBudget.p95 ?? null,
    trimmedMax: frameBudget.trimmedMax ?? null,
    max: frameBudget.max ?? null,
    schedulerSpikeCount: frameBudget.schedulerSpikeCount ?? null,
    longFrameCount: frameBudget.longFrameCount ?? null,
    thresholds: {
      avg: 32,
      stableAvg: 32,
      p90: 70,
      trimmedMax: 220,
      schedulerSpikeCount: 2,
      longFrameCount: 8,
    },
  });

  if (frameBudget.ok !== true) {
    failures.push(
      `[${viewport.name} ${expectedMode}] scroll motion frame budget failed: reason=${
        frameBudget.reason || "threshold"
      }, avg=${frameBudget.avg ?? "missing"}ms, stableAvg=${
        frameBudget.stableAvg ?? "missing"
      }ms, p90=${frameBudget.p90 ?? "missing"}ms, trimmedMax=${
        frameBudget.trimmedMax ?? "missing"
      }ms, max=${frameBudget.max ?? "missing"}ms, schedulerSpikes=${
        frameBudget.schedulerSpikeCount ?? "missing"
      }, longFrames=${frameBudget.longFrameCount ?? "missing"}`,
    );
  }
}

function checkStudioInteractionMotionBudget(viewport, expectedMode) {
  const frameBudget = runJson([
    "js",
    `new Promise(resolve => {
      const tabIds = ["studio-tab-map", "studio-tab-matrix", "studio-tab-stack", "studio-tab-evidence"];
      const tabs = tabIds.map(id => document.getElementById(id));
      const workbench = document.getElementById("benchmarks") || document.querySelector(".studio-workbench");

      if (!workbench || tabs.some(tab => !tab)) {
        resolve({
          ok: false,
          reason: "missing-studio-tabs",
          sampleCount: 0,
          missingTabIds: tabIds.filter((id, index) => !tabs[index]),
        });
        return;
      }

      const durations = [];
      const sampleCount = 90;
      const clickSchedule = new Map([
        [0, tabs[0]],
        [18, tabs[1]],
        [36, tabs[2]],
        [54, tabs[3]],
        [72, tabs[3]],
      ]);
      let frameIndex = 0;
      let last = 0;

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      workbench.scrollIntoView({ block: "start", inline: "nearest" });

      const summarize = (timedOut) => {
        const sorted = [...durations].sort((a, b) => a - b);
        const avg = durations.length
          ? durations.reduce((total, duration) => total + duration, 0) / durations.length
          : 0;
        const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] || 0;
        const max = durations.length ? Math.max(...durations) : 0;
        const longFrameCount = durations.filter(duration => duration > 50).length;
        const selectedTab =
          document.querySelector('.mode-tabs button[aria-selected="true"]')?.id || "";
        const selectedLabel =
          document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim() || "";
        const panelCount = document.querySelectorAll("#studio-panel").length;
        const hiddenCount = [...document.querySelectorAll(".primary-lab > *, .dossier-panel, .meter i")]
          .filter(node => {
            const style = getComputedStyle(node);
            return style.opacity === "0" || style.visibility === "hidden";
          }).length;
        const inlineResidue = [...document.querySelectorAll(".primary-lab > *, .dossier-panel, .meter i")]
          .filter(node => node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange)
          .length;
        const motionDebug = typeof window.__memoryBenchMotionInspect === "function"
          ? window.__memoryBenchMotionInspect()
          : null;
        const animations = motionDebug?.animations ?? null;
        const stateMutationRefreshCount = Number(motionDebug?.stateMutationRefreshCount) || 0;
        const activeTargetLabels = Array.isArray(animations?.activeTargetLabels)
          ? animations.activeTargetLabels
          : [];
        const leakedActiveTargets = activeTargetLabels.filter(label =>
          label.includes("primary-lab") || label.includes("dossier-panel") || label.includes("meter")
        );
        const nonOrbitRepeatCount = Number(animations?.nonOrbitRepeatCount) || 0;
        const ok =
          !timedOut &&
          selectedTab === "studio-tab-evidence" &&
          selectedLabel === "Evidence ledger" &&
          panelCount === 1 &&
          hiddenCount === 0 &&
          inlineResidue === 0 &&
          nonOrbitRepeatCount === 0 &&
          leakedActiveTargets.length === 0 &&
          avg <= 32 &&
          p95 <= 70 &&
          max <= 180 &&
          longFrameCount <= 8;

        resolve({
          ok,
          reason: timedOut ? "timeout" : "",
          sampleCount: durations.length,
          selectedTab,
          selectedLabel,
          panelCount,
          hiddenCount,
          inlineResidue,
          nonOrbitRepeatCount,
          stateMutationRefreshCount,
          activeTargetLabels,
          leakedActiveTargets,
          avg: Number(avg.toFixed(2)),
          p95: Number(p95.toFixed(2)),
          max: Number(max.toFixed(2)),
          longFrameCount,
        });
      };

      const timeout = setTimeout(() => summarize(true), 7000);

      const finish = () => {
        clearTimeout(timeout);
        setTimeout(() => summarize(false), 450);
      };

      const sample = (now) => {
        if (last > 0) {
          durations.push(now - last);
        }
        last = now;

        const scheduledTab = clickSchedule.get(frameIndex);
        if (scheduledTab) {
          scheduledTab.click();
        }

        frameIndex += 1;

        if (frameIndex >= sampleCount) {
          requestAnimationFrame(finish);
          return;
        }

        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    })`,
  ], { timeout: 30_000 });

  if (!frameBudget) {
    failures.push(`[${viewport.name} ${expectedMode}] Studio interaction motion budget check did not return evidence`);
    return;
  }

  qaReport.studioInteractionMotionBudget.push({
    label: viewport.name,
    expectedMode,
    ok: frameBudget.ok === true,
    reason: frameBudget.reason ?? "",
    sampleCount: frameBudget.sampleCount ?? 0,
    selectedTab: frameBudget.selectedTab ?? "",
    selectedLabel: frameBudget.selectedLabel ?? "",
    panelCount: frameBudget.panelCount ?? null,
    hiddenCount: frameBudget.hiddenCount ?? null,
    inlineResidue: frameBudget.inlineResidue ?? null,
    nonOrbitRepeatCount: frameBudget.nonOrbitRepeatCount ?? null,
    stateMutationRefreshCount: frameBudget.stateMutationRefreshCount ?? null,
    activeTargetLabels: frameBudget.activeTargetLabels ?? [],
    leakedActiveTargets: frameBudget.leakedActiveTargets ?? [],
    avg: frameBudget.avg ?? null,
    p95: frameBudget.p95 ?? null,
    max: frameBudget.max ?? null,
    longFrameCount: frameBudget.longFrameCount ?? null,
    thresholds: {
      avg: 32,
      p95: 70,
      max: 180,
      longFrameCount: 8,
    },
  });

  if (frameBudget.ok !== true) {
    failures.push(
      `[${viewport.name} ${expectedMode}] Studio interaction motion budget failed: reason=${
        frameBudget.reason || "threshold"
      }, tab=${frameBudget.selectedTab || "missing"}, panels=${
        frameBudget.panelCount ?? "missing"
      }, hidden=${frameBudget.hiddenCount ?? "missing"}, residue=${
        frameBudget.inlineResidue ?? "missing"
      }, nonOrbitRepeats=${frameBudget.nonOrbitRepeatCount ?? "missing"}, stateMutationRefresh=${
        frameBudget.stateMutationRefreshCount ?? "missing"
      }, avg=${
        frameBudget.avg ?? "missing"
      }ms, p95=${frameBudget.p95 ?? "missing"}ms, max=${
        frameBudget.max ?? "missing"
      }ms, longFrames=${frameBudget.longFrameCount ?? "missing"}`,
    );
  }
}

function checkStudioStateMutationMotionBudget(viewport, expectedMode) {
  const frameBudget = runJson([
    "js",
    `new Promise(resolve => {
      const input = document.getElementById("memorybench-search");
      const mapTab = document.getElementById("studio-tab-map");
      const stackTab = document.getElementById("studio-tab-stack");
      const evidenceTab = document.getElementById("studio-tab-evidence");
      const workbench = document.getElementById("benchmarks") || document.querySelector(".studio-workbench");

      if (!(input instanceof HTMLInputElement) || !mapTab || !stackTab || !evidenceTab || !workbench) {
        resolve({
          ok: false,
          reason: "missing-studio-state-controls",
          sampleCount: 0,
          inputFound: input instanceof HTMLInputElement,
          mapTabFound: !!mapTab,
          stackTabFound: !!stackTab,
          evidenceTabFound: !!evidenceTab,
          workbenchFound: !!workbench,
        });
        return;
      }

      const setInputValue = (value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const visibleSystems = () => {
        const metric = [...document.querySelectorAll(".metric-ribbon article")]
          .find(node => node.textContent?.includes("Visible systems"));
        return Number(metric?.querySelector("strong")?.textContent?.trim()) || 0;
      };
      const clickFirst = (selector) => {
        const node = document.querySelector(selector);
        if (node instanceof HTMLElement) {
          node.click();
          return true;
        }
        return false;
      };

      const durations = [];
      const sampleCount = 130;
      let frameIndex = 0;
      let last = 0;
      let filteredCountDuringQuery = 0;
      let projectClickOk = false;
      let stackToggleClickOk = false;
      let ledgerClickOk = false;
      let emptyVisibleDuringNoMatch = false;
      let emptyPanelRoleDuringNoMatch = "";
      let emptyBrokenControlCountDuringNoMatch = 0;
      let emptyHiddenDuringNoMatch = 0;
      let emptyInlineResidueDuringNoMatch = 0;

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      workbench.scrollIntoView({ block: "start", inline: "nearest" });

      const summarize = (timedOut) => {
        const sorted = [...durations].sort((a, b) => a - b);
        const avg = durations.length
          ? durations.reduce((total, duration) => total + duration, 0) / durations.length
          : 0;
        const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] || 0;
        const max = durations.length ? Math.max(...durations) : 0;
        const longFrameCount = durations.filter(duration => duration > 50).length;
        const selectedTab =
          document.querySelector('.mode-tabs button[aria-selected="true"]')?.id || "";
        const selectedLabel =
          document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim() || "";
        const selectedDossier = document.querySelector(".dossier-panel h3")?.textContent?.trim() || "";
        const finalQuery = input.value;
        const finalVisibleSystems = visibleSystems();
        const evidenceRows = document.querySelectorAll(".evidence-row").length;
        const activeEvidenceRows = [...document.querySelectorAll('.evidence-row[aria-current="true"]')];
        const activeEvidenceTitle = activeEvidenceRows[0]?.querySelector("h4")?.textContent?.trim() || "";
        const activeEvidenceMatchesDossier = Boolean(activeEvidenceTitle) && activeEvidenceTitle === selectedDossier;
        const panelCount = document.querySelectorAll("#studio-panel").length;
        const hiddenCount = [...document.querySelectorAll(".primary-lab > *, .empty-scope, .dossier-panel, .meter i")]
          .filter(node => {
            const style = getComputedStyle(node);
            return style.opacity === "0" || style.visibility === "hidden";
          }).length;
        const inlineResidue = [...document.querySelectorAll(".primary-lab > *, .empty-scope, .dossier-panel, .meter i")]
          .filter(node => node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange)
          .length;
        const motionDebug = typeof window.__memoryBenchMotionInspect === "function"
          ? window.__memoryBenchMotionInspect()
          : null;
        const animations = motionDebug?.animations ?? null;
        const stateMutationRefreshCount = Number(motionDebug?.stateMutationRefreshCount) || 0;
        const activeTargetLabels = Array.isArray(animations?.activeTargetLabels)
          ? animations.activeTargetLabels
          : [];
        const leakedActiveTargets = activeTargetLabels.filter(label =>
          label.includes("primary-lab") || label.includes("dossier-panel") || label.includes("meter")
        );
        const nonOrbitRepeatCount = Number(animations?.nonOrbitRepeatCount) || 0;
        const ok =
          !timedOut &&
          filteredCountDuringQuery > 0 &&
          filteredCountDuringQuery < finalVisibleSystems &&
          projectClickOk &&
          stackToggleClickOk &&
          emptyVisibleDuringNoMatch &&
          emptyPanelRoleDuringNoMatch === "tabpanel" &&
          emptyBrokenControlCountDuringNoMatch === 0 &&
          emptyHiddenDuringNoMatch === 0 &&
          emptyInlineResidueDuringNoMatch === 0 &&
          finalQuery === "" &&
          finalVisibleSystems === 11 &&
          selectedTab === "studio-tab-evidence" &&
          selectedLabel === "Evidence ledger" &&
          ledgerClickOk &&
          activeEvidenceRows.length === 1 &&
          activeEvidenceMatchesDossier &&
          evidenceRows === 11 &&
          panelCount === 1 &&
          hiddenCount === 0 &&
          inlineResidue === 0 &&
          nonOrbitRepeatCount === 0 &&
          leakedActiveTargets.length === 0 &&
          ("${expectedMode}" === "reduced" || stateMutationRefreshCount > 0) &&
          avg <= 34 &&
          p95 <= 72 &&
          max <= 190 &&
          longFrameCount <= 8;

        resolve({
          ok,
          reason: timedOut ? "timeout" : "",
          sampleCount: durations.length,
          filteredCountDuringQuery,
          projectClickOk,
          stackToggleClickOk,
          ledgerClickOk,
          emptyVisibleDuringNoMatch,
          emptyPanelRoleDuringNoMatch,
          emptyBrokenControlCountDuringNoMatch,
          emptyHiddenDuringNoMatch,
          emptyInlineResidueDuringNoMatch,
          finalQuery,
          finalVisibleSystems,
          selectedTab,
          selectedLabel,
          selectedDossier,
          evidenceRows,
          activeEvidenceRowCount: activeEvidenceRows.length,
          activeEvidenceTitle,
          activeEvidenceMatchesDossier,
          panelCount,
          hiddenCount,
          inlineResidue,
          nonOrbitRepeatCount,
          stateMutationRefreshCount,
          activeTargetLabels,
          leakedActiveTargets,
          avg: Number(avg.toFixed(2)),
          p95: Number(p95.toFixed(2)),
          max: Number(max.toFixed(2)),
          longFrameCount,
        });
      };

      const timeout = setTimeout(() => summarize(true), 8000);

      const finish = () => {
        clearTimeout(timeout);
        setTimeout(() => summarize(false), 900);
      };

      const sample = (now) => {
        if (last > 0) {
          durations.push(now - last);
        }
        last = now;

        if (frameIndex === 0) {
          mapTab.click();
        } else if (frameIndex === 6) {
          setInputValue("temporal graph");
        } else if (frameIndex === 16) {
          filteredCountDuringQuery = visibleSystems();
          projectClickOk = clickFirst('button[aria-label^="Open Zep dossier"]');
        } else if (frameIndex === 28) {
          stackTab.click();
        } else if (frameIndex === 40) {
          stackToggleClickOk = clickFirst('.selector-panel button[aria-label^="Toggle "]');
        } else if (frameIndex === 50) {
          evidenceTab.click();
        } else if (frameIndex === 52) {
          setInputValue("definitely-no-memory-system-match");
        } else if (frameIndex === 108) {
          const emptyPanel = document.querySelector(".empty-scope");
          const brokenControls = [...document.querySelectorAll('[role="tab"]')]
            .map(tab => tab.getAttribute("aria-controls"))
            .filter(id => !id || !document.getElementById(id));
          emptyVisibleDuringNoMatch = !!emptyPanel;
          emptyPanelRoleDuringNoMatch = emptyPanel?.getAttribute("role") || "";
          emptyBrokenControlCountDuringNoMatch = brokenControls.length;
          if (emptyPanel) {
            const emptyStyle = getComputedStyle(emptyPanel);
            emptyHiddenDuringNoMatch = Number(emptyStyle.opacity === "0" || emptyStyle.visibility === "hidden");
            emptyInlineResidueDuringNoMatch = Number(Boolean(
              emptyPanel.style.opacity ||
              emptyPanel.style.visibility ||
              emptyPanel.style.transform ||
              emptyPanel.style.willChange
            ));
          } else {
            emptyHiddenDuringNoMatch = 1;
            emptyInlineResidueDuringNoMatch = 1;
          }
        } else if (frameIndex === 114) {
          setInputValue("");
        } else if (frameIndex === 120) {
          evidenceTab.click();
        } else if (frameIndex === 122) {
          ledgerClickOk = clickFirst('.evidence-row[aria-label="Select Mem0 dossier"]');
        }

        frameIndex += 1;

        if (frameIndex >= sampleCount) {
          requestAnimationFrame(finish);
          return;
        }

        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    })`,
  ], { timeout: 30_000 });

  if (!frameBudget) {
    failures.push(`[${viewport.name} ${expectedMode}] Studio state mutation motion budget check did not return evidence`);
    return;
  }

  qaReport.studioStateMutationMotionBudget.push({
    label: viewport.name,
    expectedMode,
    ok: frameBudget.ok === true,
    reason: frameBudget.reason ?? "",
    sampleCount: frameBudget.sampleCount ?? 0,
    filteredCountDuringQuery: frameBudget.filteredCountDuringQuery ?? null,
    projectClickOk: frameBudget.projectClickOk === true,
    stackToggleClickOk: frameBudget.stackToggleClickOk === true,
    ledgerClickOk: frameBudget.ledgerClickOk === true,
    emptyVisibleDuringNoMatch: frameBudget.emptyVisibleDuringNoMatch === true,
    emptyPanelRoleDuringNoMatch: frameBudget.emptyPanelRoleDuringNoMatch ?? "",
    emptyBrokenControlCountDuringNoMatch: frameBudget.emptyBrokenControlCountDuringNoMatch ?? null,
    emptyHiddenDuringNoMatch: frameBudget.emptyHiddenDuringNoMatch ?? null,
    emptyInlineResidueDuringNoMatch: frameBudget.emptyInlineResidueDuringNoMatch ?? null,
    finalQuery: frameBudget.finalQuery ?? null,
    finalVisibleSystems: frameBudget.finalVisibleSystems ?? null,
    selectedTab: frameBudget.selectedTab ?? "",
    selectedLabel: frameBudget.selectedLabel ?? "",
    selectedDossier: frameBudget.selectedDossier ?? "",
    evidenceRows: frameBudget.evidenceRows ?? null,
    activeEvidenceRowCount: frameBudget.activeEvidenceRowCount ?? null,
    activeEvidenceTitle: frameBudget.activeEvidenceTitle ?? "",
    activeEvidenceMatchesDossier: frameBudget.activeEvidenceMatchesDossier === true,
    panelCount: frameBudget.panelCount ?? null,
    hiddenCount: frameBudget.hiddenCount ?? null,
    inlineResidue: frameBudget.inlineResidue ?? null,
    nonOrbitRepeatCount: frameBudget.nonOrbitRepeatCount ?? null,
    stateMutationRefreshCount: frameBudget.stateMutationRefreshCount ?? null,
    activeTargetLabels: frameBudget.activeTargetLabels ?? [],
    leakedActiveTargets: frameBudget.leakedActiveTargets ?? [],
    avg: frameBudget.avg ?? null,
    p95: frameBudget.p95 ?? null,
    max: frameBudget.max ?? null,
    longFrameCount: frameBudget.longFrameCount ?? null,
    thresholds: {
      avg: 34,
      p95: 72,
      max: 190,
      longFrameCount: 8,
    },
  });

  if (frameBudget.ok !== true) {
    failures.push(
      `[${viewport.name} ${expectedMode}] Studio state mutation motion budget failed: reason=${
        frameBudget.reason || "threshold"
      }, filtered=${frameBudget.filteredCountDuringQuery ?? "missing"}, projectClick=${
        frameBudget.projectClickOk ?? "missing"
      }, stackToggle=${frameBudget.stackToggleClickOk ?? "missing"}, finalQuery=${
        frameBudget.finalQuery ?? "missing"
      }, emptyVisible=${frameBudget.emptyVisibleDuringNoMatch ?? "missing"}, emptyRole=${
        frameBudget.emptyPanelRoleDuringNoMatch ?? "missing"
      }, emptyBrokenControls=${frameBudget.emptyBrokenControlCountDuringNoMatch ?? "missing"}, emptyHidden=${
        frameBudget.emptyHiddenDuringNoMatch ?? "missing"
      }, emptyResidue=${frameBudget.emptyInlineResidueDuringNoMatch ?? "missing"
      }, visibleSystems=${frameBudget.finalVisibleSystems ?? "missing"}, tab=${
        frameBudget.selectedTab || "missing"
      }, ledgerClick=${frameBudget.ledgerClickOk ?? "missing"}, activeEvidence=${
        frameBudget.activeEvidenceTitle || "missing"
      }, activeEvidenceRows=${frameBudget.activeEvidenceRowCount ?? "missing"}, dossier=${
        frameBudget.selectedDossier || "missing"
      }, evidenceRows=${
        frameBudget.evidenceRows ?? "missing"
      }, hidden=${frameBudget.hiddenCount ?? "missing"}, residue=${
        frameBudget.inlineResidue ?? "missing"
      }, nonOrbitRepeats=${frameBudget.nonOrbitRepeatCount ?? "missing"}, stateMutationRefresh=${
        frameBudget.stateMutationRefreshCount ?? "missing"
      }, avg=${
        frameBudget.avg ?? "missing"
      }ms, p95=${frameBudget.p95 ?? "missing"}ms, max=${
        frameBudget.max ?? "missing"
      }ms, longFrames=${frameBudget.longFrameCount ?? "missing"}`,
    );
  }
}

function checkInteractiveMicroMotion(viewport, expectedMode) {
  const microMotion = runJson([
    "js",
    `new Promise(resolve => {
      const targets = ${interactiveMicroMotionTargetsExpression()};
      const makePointerEnter = () => new MouseEvent("pointerenter", { bubbles: false, cancelable: false, view: window });
      const makePointerLeave = () => new MouseEvent("pointerleave", { bubbles: false, cancelable: false, view: window });
      const inspect = (node) => ({
        inlineTransform: node.style.transform || "",
        inlineWillChange: node.style.willChange || "",
        computedTransform: getComputedStyle(node).transform,
        computedWillChange: getComputedStyle(node).willChange,
      });
      const samples = [];
      let index = 0;
      let resolved = false;
      const neutralPointerLayer = document.createElement("div");
      neutralPointerLayer.id = "qa-interactive-motion-neutral-layer";
      neutralPointerLayer.setAttribute("aria-hidden", "true");
      Object.assign(neutralPointerLayer.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        pointerEvents: "auto",
        opacity: "0",
      });
      document.body.appendChild(neutralPointerLayer);
      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        neutralPointerLayer.remove();
        clearTimeout(watchdog);
        resolve(samples);
      };
      const watchdog = setTimeout(() => {
        samples.push({
          label: "interactive-micro-motion-watchdog",
          selector: "",
          ok: false,
          reason: "timeout",
          exists: false,
        });
        finish();
      }, 26000);

      const runTarget = () => {
        const target = targets[index];
        index += 1;

        if (!target) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          window.scrollTo(0, 0);
          finish();
          return;
        }

          target.setup?.();
          setTimeout(() => {
            const activeNode = document.querySelector(target.selector);

            if (!(activeNode instanceof HTMLElement)) {
              samples.push({
                ...target,
                ok: false,
                reason: "missing-target",
                exists: false,
              });
              runTarget();
              return;
            }

            activeNode.scrollIntoView({ block: "center", inline: "nearest" });
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            setTimeout(() => {
              try {
                activeNode.dispatchEvent(makePointerLeave());
                activeNode.blur();
              } catch {
                // Continue; the before-residue sample below will catch any state that remains.
              }
              setTimeout(() => {
              const before = inspect(activeNode);
              const beforeResidue = Boolean(before.inlineTransform || before.inlineWillChange);
              try {
                activeNode.dispatchEvent(makePointerEnter());
                activeNode.focus({ preventScroll: true });
              } catch (error) {
                samples.push({
                  ...target,
                  ok: false,
                  reason: \`event-dispatch-failed: \${error?.message ?? String(error)}\`,
                  exists: true,
                  before,
                });
                runTarget();
                return;
              }
              let activeTargetLabels = [];
              let semanticActiveLabelPresent = false;
              setTimeout(() => {
                const animations = typeof window.__memoryBenchMotionInspect === "function"
                  ? window.__memoryBenchMotionInspect().animations
                  : null;
                activeTargetLabels = Array.isArray(animations?.activeTargetLabels)
                  ? animations.activeTargetLabels
                  : [];
                semanticActiveLabelPresent = activeTargetLabels.includes(\`interactive:\${target.label}\`);
              }, 90);
              setTimeout(() => {
                const active = inspect(activeNode);
                try {
                  activeNode.dispatchEvent(makePointerLeave());
                  activeNode.blur();
                } catch (error) {
                  samples.push({
                    ...target,
                    ok: false,
                    reason: \`event-dispatch-failed: \${error?.message ?? String(error)}\`,
                    exists: true,
                    before,
                    active,
                  });
                  runTarget();
                  return;
                }
                setTimeout(() => {
                  const settled = inspect(activeNode);
                  const activeInline = Boolean(active.inlineTransform || active.inlineWillChange);
                  const activeComputed = Boolean(
                    (active.computedTransform && active.computedTransform !== "none") ||
                    (active.computedWillChange && active.computedWillChange.includes("transform"))
                  );
                  const activeMotion = activeInline || activeComputed;
                  const settledResidue = Boolean(settled.inlineTransform || settled.inlineWillChange);
                  const ok = "${expectedMode}" === "reduced"
                    ? !activeInline && !settledResidue
                    : !beforeResidue && activeMotion && !settledResidue && semanticActiveLabelPresent;

                  samples.push({
                    ...target,
                    ok,
                    reason: ok ? "" : "interactive-micro-motion-state",
                    exists: true,
                    before,
                    active,
                    settled,
                    beforeResidue,
                    activeInline,
                    activeComputed,
                    activeMotion,
                    settledResidue,
                    activeTargetLabels,
                    semanticActiveLabel: \`interactive:\${target.label}\`,
                    semanticActiveLabelPresent,
                  });
                  runTarget();
                }, 520);
              }, 260);
              }, 240);
            }, 220);
          }, 420);
        };

      runTarget();
    })`,
  ], { timeout: 30_000 });

  if (!Array.isArray(microMotion)) {
    failures.push(`[${viewport.name} ${expectedMode}] interactive micro motion check did not return evidence`);
    return;
  }

  for (const sample of microMotion) {
    qaReport.interactiveMicroMotion.push({
      label: viewport.name,
      expectedMode,
      target: sample.label ?? "",
      selector: sample.selector ?? "",
      ok: sample.ok === true,
      reason: sample.reason ?? "",
      exists: sample.exists === true,
      activeInline: sample.activeInline === true,
      activeComputed: sample.activeComputed === true,
      activeMotion: sample.activeMotion === true,
      beforeResidue: sample.beforeResidue === true,
      settledResidue: sample.settledResidue === true,
      activeTargetLabels: Array.isArray(sample.activeTargetLabels) ? sample.activeTargetLabels : [],
      semanticActiveLabel: sample.semanticActiveLabel ?? "",
      semanticActiveLabelPresent: sample.semanticActiveLabelPresent === true,
      before: sample.before ?? null,
      active: sample.active ?? null,
      settled: sample.settled ?? null,
    });

    if (sample.ok !== true) {
      failures.push(
        `[${viewport.name} ${expectedMode}] interactive micro motion failed for ${
          sample.label || sample.selector || "unknown"
        }: reason=${sample.reason || "threshold"}, activeInline=${
          sample.activeInline ?? "missing"
        }, activeComputed=${
          sample.activeComputed ?? "missing"
        }, activeMotion=${
          sample.activeMotion ?? "missing"
        }, beforeResidue=${sample.beforeResidue ?? "missing"}, settledResidue=${
          sample.settledResidue ?? "missing"
        }, semanticActive=${
          sample.semanticActiveLabelPresent ?? "missing"
        }, activeTargets=${Array.isArray(sample.activeTargetLabels) ? sample.activeTargetLabels.join(", ") : "missing"}`,
      );
    }
  }
}

function captureScreenshot(label, filename) {
  const path = resolve(screenshotDir, filename);
  rmSync(path, { force: true });
  const capturedAt = new Date().toISOString();
  runBrowse(["screenshot", "--viewport", path]);

  if (!existsSync(path)) {
    failures.push(`[${label}] screenshot was not written: ${path}`);
    qaReport.screenshots.push({ label, filename, path, exists: false });
    return;
  }

  const size = statSync(path).size;
  const mtimeMs = statSync(path).mtimeMs;
  const bytes = readFileSync(path);
  const dimensions = pngDimensions(path);
  qaReport.screenshots.push({
    label,
    filename,
    path,
    exists: true,
    bytes: size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mtimeMs,
    capturedAt,
    fullPage: false,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  });
  if (size < 12_000) {
    failures.push(`[${label}] screenshot looks too small to be useful: ${size} bytes at ${path}`);
  }

  if (!dimensions) {
    failures.push(`[${label}] screenshot is not a readable PNG: ${path}`);
  }
}

function pngDimensions(path) {
  const bytes = readFileSync(path);
  const pngSignature = "89504e470d0a1a0a";

  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function captureFullPageScreenshot(label, filename) {
  const path = resolve(screenshotDir, filename);
  rmSync(path, { force: true });
  const capturedAt = new Date().toISOString();
  const pageMetrics = runJson([
    "js",
    `(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }))()`,
  ], { timeout: 30_000 });

  const expectedWidth = Math.max(
    Number(pageMetrics?.viewportWidth) || 0,
    Number(pageMetrics?.scrollWidth) || 0,
  );
  const expectedMinHeight = Math.max(
    1800,
    Number(pageMetrics?.viewportHeight) + 1 || 0,
  );

  try {
    execFileSync(process.execPath, [
      "scripts/capture-full-page-cdp.mjs",
      targetUrl,
      String(pageMetrics?.viewportWidth ?? 1440),
      String(pageMetrics?.viewportHeight ?? 1000),
      path,
    ], {
      encoding: "utf8",
      env: { ...process.env, CDP_CAPTURE_TIMEOUT_MS: "90000" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 110_000,
    });
  } catch (error) {
    failures.push(`[${label}] full-page CDP screenshot failed: ${browseErrorText(error)}`);
  }

  if (!existsSync(path)) {
    failures.push(`[${label}] full-page screenshot was not written: ${path}`);
    qaReport.screenshots.push({ label, filename, path, exists: false, fullPage: true, pageMetrics });
    return;
  }

  const size = statSync(path).size;
  const mtimeMs = statSync(path).mtimeMs;
  const bytes = readFileSync(path);
  const dimensions = pngDimensions(path);
  qaReport.screenshots.push({
    label,
    filename,
    path,
    exists: true,
    bytes: size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mtimeMs,
    capturedAt,
    fullPage: true,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    expectedWidth,
    expectedMinHeight,
    pageMetrics,
  });

  if (size < 24_000) {
    failures.push(`[${label}] full-page screenshot looks too small to be useful: ${size} bytes at ${path}`);
  }

  if (!dimensions || dimensions.height <= (pageMetrics?.viewportHeight ?? 0)) {
    failures.push(
      `[${label}] full-page screenshot does not exceed viewport height: ${
        dimensions ? `${dimensions.width}x${dimensions.height}` : "unknown dimensions"
      }`,
    );
  }

  if (dimensions && Math.abs(dimensions.width - expectedWidth) > 2) {
    failures.push(
      `[${label}] full-page screenshot width ${dimensions.width}px does not match page width ${expectedWidth}px`,
    );
  }

  if (dimensions && dimensions.height < expectedMinHeight) {
    failures.push(
      `[${label}] full-page screenshot height ${dimensions.height}px is below page height ${expectedMinHeight}px`,
    );
  }
}

function resetToTopForScreenshot(viewport) {
  const state = runJson([
    "js",
    `new Promise(resolve => {
      const forceTop = () => {
        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        window.scrollTo({ left: 0, top: 0, behavior: "instant" });
        window.scrollTo(0, 0);
        if (document.scrollingElement) {
          document.scrollingElement.scrollTop = 0;
          document.scrollingElement.scrollLeft = 0;
        }
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
        window.dispatchEvent(new Event("scroll"));
      };

      let attempts = 0;
      const settle = () => {
        forceTop();
        attempts += 1;

        if (attempts < 14 && Math.abs(window.scrollY) > 2) {
          requestAnimationFrame(settle);
          return;
        }

        setTimeout(() => {
          forceTop();
          const hero = document.querySelector(".hero-studio");
          const h1 = document.querySelector(".hero-copy h1");
          const heroCopy = document.querySelector(".hero-copy");
          const heroVisual = document.querySelector(".hero-visual");
          const heroActions = document.querySelector(".hero-actions");
          const laneStrip = document.querySelector(".lane-strip");
          const studio = document.querySelector("#benchmarks");
          const heroRect = hero?.getBoundingClientRect();
          const copyRect = heroCopy?.getBoundingClientRect();
          const visualRect = heroVisual?.getBoundingClientRect();
          const visualStyle = heroVisual ? getComputedStyle(heroVisual) : null;
          const actionsRect = heroActions?.getBoundingClientRect();
          const laneRect = laneStrip?.getBoundingClientRect();
          const studioRect = studio?.getBoundingClientRect();
          const heroCopyVisualGap = copyRect && visualRect && visualStyle?.display !== "none"
            ? Math.round(visualRect.left - copyRect.right)
            : null;

          resolve({
            hash: window.location.hash,
            scrollY: Math.round(window.scrollY),
            heroFound: !!hero,
            heroTop: heroRect ? Math.round(heroRect.top) : null,
            heroBottom: heroRect ? Math.round(heroRect.bottom) : null,
            heroCopyRight: copyRect ? Math.round(copyRect.right) : null,
            heroVisualLeft: visualRect && visualStyle?.display !== "none" ? Math.round(visualRect.left) : null,
            heroCopyVisualGap,
            actionsBottom: actionsRect ? Math.round(actionsRect.bottom) : null,
            laneBottom: laneRect ? Math.round(laneRect.bottom) : null,
            studioTop: studioRect ? Math.round(studioRect.top) : null,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            h1Text: h1?.getAttribute("aria-label") || h1?.textContent?.replace(/\\s+/g, " ").trim() || "",
          });
        }, 300);
      };

      settle();
    })`,
  ], { timeout: 30_000 });

  if (!state) {
    return;
  }

  if (state.hash !== "" || state.scrollY > 2) {
    failures.push(
      `[${viewport.name}] top screenshot did not reset to page start: hash ${state.hash || "(empty)"}, scrollY ${state.scrollY}`,
    );
  }

  if (!state.heroFound || !state.h1Text.includes("When AI agents remember")) {
    failures.push(`[${viewport.name}] top screenshot is not proving the hero H1; got "${state.h1Text}"`);
  }

  if (
    state.heroTop === null ||
    state.heroTop > Math.max(220, state.viewportHeight * 0.26) ||
    state.heroBottom < Math.min(520, state.viewportHeight * 0.58)
  ) {
    failures.push(
      `[${viewport.name}] top screenshot does not frame the hero: heroTop ${state.heroTop ?? "missing"}, heroBottom ${
        state.heroBottom ?? "missing"
      }, viewportHeight ${state.viewportHeight}`,
    );
  }

  if (state.studioTop !== null && state.studioTop < state.viewportHeight * 0.45) {
    failures.push(
      `[${viewport.name}] top screenshot is too close to the studio section: studioTop ${state.studioTop}, viewportHeight ${state.viewportHeight}`,
    );
  }

  if (state.viewportWidth >= 1180 && state.heroCopyVisualGap !== null && state.heroCopyVisualGap < 18) {
    failures.push(
      `[${viewport.name}] hero copy and visual are too tight in the top screenshot: gap ${state.heroCopyVisualGap}px`,
    );
  }

  if (state.actionsBottom === null || state.actionsBottom > state.viewportHeight - 56) {
    failures.push(
      `[${viewport.name}] top screenshot does not include the hero primary actions with enough breathing room: actionsBottom ${
        state.actionsBottom ?? "missing"
      }, viewportHeight ${state.viewportHeight}`,
    );
  }

  if (state.viewportWidth >= 700 && (state.laneBottom === null || state.laneBottom > state.viewportHeight + 2)) {
    failures.push(
      `[${viewport.name}] top screenshot does not include the hero category lane: laneBottom ${
        state.laneBottom ?? "missing"
      }, viewportHeight ${state.viewportHeight}`,
    );
  }
}

function writeQaReport() {
  if (!qaReportPath) {
    return;
  }

  qaReport.finishedAt = new Date().toISOString();
  qaReport.passed = failures.length === 0;
  mkdirSync(dirname(qaReportPath), { recursive: true });
  writeFileSync(qaReportPath, `${JSON.stringify(qaReport, null, 2)}\n`);
}

function withSearchParam(url, name, value) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set(name, value);
  return nextUrl.toString();
}

function checkFrontendQuality(viewport) {
  const qualityState = runJson([
    "js",
    `(() => {
      const isVisible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const accessibleName = (node) => {
        return (
          node.getAttribute("aria-label") ||
          node.getAttribute("title") ||
          node.textContent ||
          node.getAttribute("placeholder") ||
          ""
        ).trim();
      };
      const ids = [...document.querySelectorAll("[id]")].map(node => node.id).filter(Boolean);
      const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
      const ariaBroken = [...document.querySelectorAll("[aria-controls]")]
        .map(node => ({
          label: accessibleName(node),
          controls: node.getAttribute("aria-controls"),
        }))
        .filter(item => !item.controls || !document.getElementById(item.controls));
      const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(node => ({
        level: Number(node.tagName.slice(1)),
        text: node.textContent.trim(),
      }));
      const headingSkips = headings.filter((heading, index) => {
        if (index === 0) {
          return heading.level !== 1;
        }
        return heading.level - headings[index - 1].level > 1;
      });
      const interactive = [...document.querySelectorAll("a[href], button, input, select, textarea, [role='button'], [role='tab']")]
        .filter(isVisible)
        .map(node => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            role: node.getAttribute("role") || "",
            label: accessibleName(node),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
      const unnamedInteractive = interactive.filter(item => item.label.length === 0);
      const minTarget = window.innerWidth <= 720 ? 40 : 32;
      const smallTargets = interactive.filter(item => item.width < minTarget || item.height < minTarget);
      const selectedTabs = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')];
      const activeTab = selectedTabs[0] ?? null;
      const activePanelId = activeTab?.getAttribute("aria-controls") ?? null;
      const main = document.querySelector("main");

      return {
        duplicateIds,
        ariaBroken,
        mainCount: document.querySelectorAll("main").length,
        skipLinkTarget: document.querySelector(".skip-link")?.getAttribute("href") || "",
        mainId: main?.id || "",
        mainTabIndex: main?.getAttribute("tabindex") || "",
        mainHasHero: !!main?.querySelector(".hero-studio"),
        mainHasContinuum: !!main?.querySelector(".page-continuum"),
        mainHasStudio: !!main?.querySelector(".studio-workbench"),
        h1Count: document.querySelectorAll("h1").length,
        headingSkips,
        interactiveCount: interactive.length,
        unnamedInteractive,
        smallTargets,
        tabCount: document.querySelectorAll('[role="tab"]').length,
        selectedTabCount: selectedTabs.length,
        activePanelExists: activePanelId ? !!document.getElementById(activePanelId) : false,
      };
    })()`,
  ], { timeout: 30_000 });

  if (!qualityState) {
    return;
  }

  if (qualityState.duplicateIds?.length > 0) {
    failures.push(`[${viewport.name}] duplicate ids: ${qualityState.duplicateIds.join(", ")}`);
  }

  if (qualityState.ariaBroken?.length > 0) {
    failures.push(
      `[${viewport.name}] broken aria-controls: ${qualityState.ariaBroken
        .map((item) => `${item.label || "unlabelled"} -> ${item.controls || "missing"}`)
        .join(", ")}`,
    );
  }

  if (qualityState.mainCount !== 1) {
    failures.push(`[${viewport.name}] expected exactly one main landmark, got ${qualityState.mainCount}`);
  }

  if (
    qualityState.skipLinkTarget !== "#main-content" ||
    qualityState.mainId !== "main-content" ||
    qualityState.mainTabIndex !== "-1"
  ) {
    failures.push(`[${viewport.name}] keyboard skip link is not wired to the main content landmark`);
  }

  if (!qualityState.mainHasHero || !qualityState.mainHasContinuum || !qualityState.mainHasStudio) {
    failures.push(`[${viewport.name}] main landmark does not contain the full hero-to-studio product flow`);
  }

  if (qualityState.h1Count !== 1) {
    failures.push(`[${viewport.name}] expected exactly one h1, got ${qualityState.h1Count}`);
  }

  if (qualityState.headingSkips?.length > 0) {
    failures.push(
      `[${viewport.name}] heading hierarchy skips: ${qualityState.headingSkips
        .map((item) => `h${item.level} ${item.text}`)
        .join(", ")}`,
    );
  }

  if (qualityState.unnamedInteractive?.length > 0) {
    failures.push(
      `[${viewport.name}] unnamed interactive elements: ${qualityState.unnamedInteractive
        .map((item) => item.tag)
        .join(", ")}`,
    );
  }

  if (qualityState.smallTargets?.length > 0) {
    failures.push(
      `[${viewport.name}] small interactive targets: ${qualityState.smallTargets
        .slice(0, 12)
        .map((item) => `${item.label || item.tag} ${item.width}x${item.height}`)
        .join(", ")}`,
    );
  }

  if (qualityState.tabCount !== 4) {
    failures.push(`[${viewport.name}] expected 4 studio tabs, got ${qualityState.tabCount}`);
  }

  if (qualityState.selectedTabCount !== 1) {
    failures.push(`[${viewport.name}] expected exactly one selected studio tab, got ${qualityState.selectedTabCount}`);
  }

  if (!qualityState.activePanelExists) {
    failures.push(`[${viewport.name}] selected studio tab does not point to an existing panel`);
  }
}

function checkLanguageConsistency(viewport) {
  const languageState = runJson([
    "js",
    `(() => {
      const visible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const visibleText = [...document.querySelectorAll("body *")]
        .filter(visible)
        .map(node => node.childNodes.length === 1 ? node.textContent || "" : "")
        .join(" ");
      const cjkMatches = visibleText.match(/\\p{Script=Han}/gu) || [];

      return {
        htmlLang: document.documentElement.lang || "",
        cjkCount: cjkMatches.length,
        sample: cjkMatches.length > 0 ? visibleText.match(/[^\\s]*\\p{Script=Han}[^\\s]*/u)?.[0] || "" : "",
      };
    })()`,
  ], { timeout: 30_000 });

  if (!languageState) {
    return;
  }

  if (languageState.htmlLang !== "en") {
    failures.push(`[${viewport.name}] document language must be en, got ${languageState.htmlLang || "missing"}`);
  }

  if (languageState.cjkCount > 0) {
    failures.push(
      `[${viewport.name}] visible interface mixes CJK characters into the English publication voice: ${languageState.sample}`,
    );
  }
}

function checkKeyboardFlow(viewport) {
  runBrowse([
    "js",
    `document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    document.body.removeAttribute("tabindex");
    true`,
  ]);
  runBrowse(["press", "Tab"]);

  const focusState = runJson([
    "js",
    `new Promise(resolve => setTimeout(resolve, 220)).then(() => {
      const node = document.activeElement;
      if (!node || node === document.body) {
        return { active: false };
      }

      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const label = (
        node.getAttribute("aria-label") ||
        node.getAttribute("title") ||
        node.textContent ||
        node.getAttribute("placeholder") ||
        ""
      ).trim();

      return {
        active: true,
        tag: node.tagName.toLowerCase(),
        className: node.className || "",
        href: node.getAttribute("href") || "",
        label,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
      };
    })`,
  ], { timeout: 30_000 });

  if (!focusState?.active) {
    failures.push(`[${viewport.name}] Tab did not move focus to a visible control`);
  } else {
    if (!focusState.label) {
      failures.push(`[${viewport.name}] first keyboard-focused control has no accessible name`);
    }

    if (
      focusState.className !== "skip-link" ||
      focusState.href !== "#main-content" ||
      focusState.label !== "Skip to main content"
    ) {
      failures.push(`[${viewport.name}] first keyboard stop is not the skip link`);
    }

    if (focusState.top < 0 || focusState.left < 0 || focusState.width < 120 || focusState.height < 40) {
      failures.push(`[${viewport.name}] focused skip link is not visibly reachable`);
    }

    if (focusState.outlineStyle === "none" || focusState.outlineWidth < 2) {
      failures.push(
        `[${viewport.name}] first keyboard focus is not visibly outlined: ${focusState.label || focusState.tag}`,
      );
    }
  }

  runBrowse([
    "js",
    `const tabs = [...document.querySelectorAll(".mode-tabs button")];
    tabs[2]?.focus();
    true`,
  ]);
  runBrowse(["press", "Enter"]);

  const keyboardTabState = runJson([
    "js",
    `new Promise(resolve => setTimeout(resolve, 500)).then(() => ({
      selected: document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim(),
      panelExists: !!document.querySelector("#studio-panel"),
      stackWorkbench: !!document.querySelector(".stack-workbench"),
    }))`,
  ], { timeout: 30_000 });

  if (keyboardTabState) {
    if (keyboardTabState.selected !== "Stack design") {
      failures.push(
        `[${viewport.name}] keyboard Enter did not activate Stack design tab, got ${keyboardTabState.selected ?? "none"}`,
      );
    }

    if (!keyboardTabState.panelExists || !keyboardTabState.stackWorkbench) {
      failures.push(`[${viewport.name}] keyboard-activated Stack design panel did not render`);
    }
  }

  runBrowse(["press", "ArrowRight"]);

  const arrowTabState = runJson([
    "js",
    `new Promise(resolve => setTimeout(resolve, 300)).then(() => ({
      selected: document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim(),
      focused: document.activeElement?.id || "",
    }))`,
  ], { timeout: 30_000 });

  if (arrowTabState) {
    if (arrowTabState.selected !== "Evidence ledger") {
      failures.push(
        `[${viewport.name}] ArrowRight did not activate Evidence ledger tab, got ${arrowTabState.selected ?? "none"}`,
      );
    }

    if (arrowTabState.focused !== "studio-tab-evidence") {
      failures.push(`[${viewport.name}] ArrowRight did not move focus to Evidence ledger tab`);
    }
  }
}

function checkKeyboardTargetSurface(viewport) {
  const samples = runJson([
    "js",
    `new Promise(resolve => {
      const targets = ${interactiveMicroMotionTargetsExpression()};
      const samples = [];
      let index = 0;

      const inspect = (node, label) => {
        const debug = typeof window.__memoryBenchMotionInspect === "function"
          ? window.__memoryBenchMotionInspect()
          : window.__memoryBenchMotion || null;
        const activeTargetLabels = Array.isArray(debug?.animations?.activeTargetLabels)
          ? debug.animations.activeTargetLabels
          : [];
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const accessibleName = (
          node.getAttribute("aria-label") ||
          node.getAttribute("title") ||
          node.textContent ||
          node.getAttribute("placeholder") ||
          ""
        ).trim();

        return {
          focused: document.activeElement === node || node.contains(document.activeElement),
          accessibleName,
          inlineTransform: node.style.transform || "",
          inlineWillChange: node.style.willChange || "",
          computedTransform: style.transform,
          computedWillChange: style.willChange,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          semanticActiveLabel: "interactive:" + label,
          semanticActiveLabelPresent: activeTargetLabels.includes("interactive:" + label),
          activeTargetLabels,
        };
      };

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
          const node = document.querySelector(target.selector);

          if (!(node instanceof HTMLElement)) {
            samples.push({
              label: target.label,
              selector: target.selector,
              ok: false,
              reason: "missing-target",
              exists: false,
            });
            runTarget();
            return;
          }

          node.scrollIntoView({ block: "center", inline: "nearest" });
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }

          setTimeout(() => {
            try {
              node.focus({ preventScroll: true });
            } catch (error) {
              samples.push({
                label: target.label,
                selector: target.selector,
                ok: false,
                reason: "focus-failed: " + (error?.message ?? String(error)),
                exists: true,
              });
              runTarget();
              return;
            }

            setTimeout(() => {
              const active = inspect(node, target.label);
              node.blur();
              setTimeout(() => {
                const settled = inspect(node, target.label);
                const activeInline = Boolean(active.inlineTransform || active.inlineWillChange);
                const activeComputed = Boolean(
                  (active.computedTransform && active.computedTransform !== "none") ||
                  (active.computedWillChange && active.computedWillChange.includes("transform"))
                );
                const settledResidue = Boolean(settled.inlineTransform || settled.inlineWillChange);
                const ok =
                  active.focused === true &&
                  active.accessibleName.length > 0 &&
                  active.rect.width >= 32 &&
                  active.rect.height >= 32 &&
                  activeInline &&
                  activeComputed &&
                  active.semanticActiveLabelPresent === true &&
                  !settledResidue;

                samples.push({
                  label: target.label,
                  selector: target.selector,
                  ok,
                  reason: ok ? "" : "keyboard-target-state",
                  exists: true,
                  active,
                  settled,
                  activeInline,
                  activeComputed,
                  settledResidue,
                  semanticActiveLabelPresent: active.semanticActiveLabelPresent === true,
                });
                runTarget();
              }, 520);
            }, 90);
          }, 220);
        }, 420);
      };

      runTarget();
    })`,
  ], { timeout: 45_000 });

  if (!Array.isArray(samples)) {
    failures.push(`[${viewport.name}] keyboard target surface check did not return samples`);
    return;
  }

  for (const sample of samples) {
    qaReport.keyboardTargetSurface.push({
      label: viewport.name,
      target: sample.label ?? "",
      selector: sample.selector ?? "",
      ok: sample.ok === true,
      reason: sample.reason ?? "",
      exists: sample.exists === true,
      focused: sample.active?.focused === true,
      accessibleName: sample.active?.accessibleName ?? "",
      activeInline: sample.activeInline === true,
      activeComputed: sample.activeComputed === true,
      settledResidue: sample.settledResidue === true,
      semanticActiveLabel: sample.active?.semanticActiveLabel ?? "",
      semanticActiveLabelPresent: sample.semanticActiveLabelPresent === true,
      activeTargetLabels: Array.isArray(sample.active?.activeTargetLabels) ? sample.active.activeTargetLabels : [],
      activeRect: sample.active?.rect ?? null,
    });
  }

  const failedSamples = samples.filter((sample) => sample.ok !== true);
  if (failedSamples.length > 0) {
    failures.push(
      `[${viewport.name}] keyboard target surface failed:\n${failedSamples
        .map((sample) =>
          `  - ${sample.label ?? "unknown"}: reason=${sample.reason ?? "unknown"}, focused=${
            sample.active?.focused ? "true" : "false"
          }, name=${sample.active?.accessibleName || "missing"}, active=${sample.active?.inlineTransform || "none"}, semantic=${
            sample.semanticActiveLabelPresent ? "true" : "false"
          }, settled=${sample.settled?.inlineTransform || "none"}`,
        )
        .join("\n")}`,
    );
  }
}

function checkResponsiveMotionLifecycle() {
  const phases = [
    {
      label: "desktop-start",
      viewport: "1360x900",
      expectedMode: "desktop",
      expectedHeroVisible: true,
      expectedOrbitRepeatCount: 2,
      expectedActiveRepeatCount: 2,
      expectedOrbitAvailable: true,
      expectedOrbitTweenCount: 2,
      waitMs: 2600,
      navigate: true,
    },
    {
      label: "tablet-after-resize",
      viewport: "1359x900",
      expectedMode: "compact",
      expectedHeroVisible: false,
      expectedOrbitRepeatCount: 0,
      expectedActiveRepeatCount: 0,
      expectedOrbitAvailable: false,
      expectedOrbitTweenCount: 0,
      waitMs: 1700,
      navigate: false,
    },
    {
      label: "desktop-after-resize",
      viewport: "1360x900",
      expectedMode: "desktop",
      expectedHeroVisible: true,
      expectedOrbitRepeatCount: 2,
      expectedActiveRepeatCount: 2,
      expectedOrbitAvailable: true,
      expectedOrbitTweenCount: 2,
      waitMs: 2200,
      navigate: false,
    },
  ];
  const samples = [];

  for (const phase of phases) {
    runBrowse(["viewport", phase.viewport]);
    if (phase.navigate) {
      runBrowse(["console", "--clear"]);
      clearNetwork("responsive-motion-lifecycle");
      runBrowse(["goto", targetUrl]);
      runBrowse(["wait", "--load"]);
    }

    const sample = runJson([
      "js",
      `new Promise(resolve => {
        window.dispatchEvent(new Event("resize"));
        setTimeout(() => {
          const heroVisual = document.querySelector(".hero-visual");
          const debug = typeof window.__memoryBenchMotionInspect === "function"
            ? window.__memoryBenchMotionInspect()
            : window.__memoryBenchMotion || null;
          const style = heroVisual ? getComputedStyle(heroVisual) : null;
          const rect = heroVisual?.getBoundingClientRect();
          const animations = debug?.animations || {};
          const orbitPlayback = debug?.orbitPlayback || {};
          const triggerIds = Array.isArray(debug?.triggerIds) ? debug.triggerIds : [];
          const railTriggerIds = Array.isArray(debug?.railTriggerIds) ? debug.railTriggerIds : [];
          const readingProgressTriggerIds = Array.isArray(debug?.readingProgressTriggerIds)
            ? debug.readingProgressTriggerIds
            : [];
          const heroVisible = !!heroVisual &&
            style?.display !== "none" &&
            style?.visibility !== "hidden" &&
            Number(style?.opacity || 1) > 0 &&
            Number(rect?.width || 0) > 0 &&
            Number(rect?.height || 0) > 0;

          resolve({
            label: ${JSON.stringify(phase.label)},
            viewport: ${JSON.stringify(phase.viewport)},
            expectedMode: ${JSON.stringify(phase.expectedMode)},
            heroVisible,
            heroDisplay: style?.display || "",
            heroWidth: Math.round(rect?.width || 0),
            heroHeight: Math.round(rect?.height || 0),
            debugMode: debug?.mode || "",
            reducedMotionSource: debug?.reducedMotionSource || "",
            triggerCount: triggerIds.length,
            railTriggerCount: railTriggerIds.length,
            readingProgressTriggerCount: readingProgressTriggerIds.length,
            duplicateCount: Array.isArray(debug?.duplicateIds) ? debug.duplicateIds.length : null,
            markerCount: Number(debug?.markerCount) || 0,
            pinSpacerCount: Number(debug?.pinSpacerCount) || 0,
            pinnedCount: Number(debug?.pinnedCount) || 0,
            orbitRepeatCount: Number(animations.orbitRepeatCount) || 0,
            activeRepeatCount: Number(animations.activeRepeatCount) || 0,
            pausedRepeatCount: Number(animations.pausedRepeatCount) || 0,
            nonOrbitRepeatCount: Number(animations.nonOrbitRepeatCount) || 0,
            orbitAvailable: orbitPlayback.available === true,
            orbitObserverAttached: orbitPlayback.observerAttached === true,
            orbitTweenCount: Number(orbitPlayback.tweenCount) || 0,
            orbitActiveTweenCount: Number(orbitPlayback.activeTweenCount) || 0,
            orbitPausedTweenCount: Number(orbitPlayback.pausedTweenCount) || 0,
            orbitShouldPlay: orbitPlayback.shouldPlay === true,
          });
        }, ${phase.waitMs});
      })`,
    ], { timeout: 45_000, retries: 4 });

    const ok =
      sample?.debugMode === "normal" &&
      sample?.reducedMotionSource === "none" &&
      sample?.heroVisible === phase.expectedHeroVisible &&
      sample?.triggerCount === 6 &&
      sample?.railTriggerCount === 5 &&
      sample?.readingProgressTriggerCount === 1 &&
      sample?.duplicateCount === 0 &&
      sample?.markerCount === 0 &&
      sample?.pinSpacerCount === 0 &&
      sample?.pinnedCount === 0 &&
      sample?.orbitRepeatCount === phase.expectedOrbitRepeatCount &&
      sample?.activeRepeatCount === phase.expectedActiveRepeatCount &&
      sample?.pausedRepeatCount === 0 &&
      sample?.nonOrbitRepeatCount === 0 &&
      sample?.orbitAvailable === phase.expectedOrbitAvailable &&
      sample?.orbitTweenCount === phase.expectedOrbitTweenCount &&
      (
        phase.expectedMode === "desktop"
          ? sample?.orbitObserverAttached === true && sample?.orbitActiveTweenCount === 2 && sample?.orbitShouldPlay === true
          : sample?.orbitObserverAttached === false && sample?.orbitActiveTweenCount === 0
      );

    samples.push({
      ...phase,
      ...(sample || {}),
      ok,
      reason: ok ? "" : "responsive-motion-lifecycle",
    });
  }

  qaReport.responsiveMotionLifecycle.push(...samples);
  const failed = samples.filter((sample) => sample.ok !== true);
  if (failed.length > 0) {
    failures.push(
      `responsive GSAP matchMedia lifecycle failed:\n${failed
        .map((sample) =>
          `  - ${sample.label}: hero=${sample.heroVisible}, triggers=${sample.triggerCount}, rails=${
            sample.railTriggerCount
          }, progress=${sample.readingProgressTriggerCount}, orbit=${sample.orbitRepeatCount}/${
            sample.orbitTweenCount
          }, activeRepeats=${sample.activeRepeatCount}, observer=${sample.orbitObserverAttached}`,
        )
        .join("\n")}`,
    );
  }
}

function checkMountLifecycle() {
  runBrowse(["viewport", "1360x900"]);
  runBrowse(["console", "--clear"]);
  clearNetwork("mount-lifecycle");
  runBrowse(["goto", targetUrl]);
  runBrowse(["wait", "--load"]);

  const lifecycle = runJson([
    "js",
    `new Promise(resolve => {
      const capture = (label) => {
        const debug = typeof window.__memoryBenchMotionInspect === "function"
          ? window.__memoryBenchMotionInspect()
          : window.__memoryBenchMotion || null;
        const animations = debug?.animations || {};
        const orbitPlayback = debug?.orbitPlayback || {};
        const triggerIds = Array.isArray(debug?.triggerIds) ? debug.triggerIds : [];
        const railTriggerIds = Array.isArray(debug?.railTriggerIds) ? debug.railTriggerIds : [];
        const readingProgressTriggerIds = Array.isArray(debug?.readingProgressTriggerIds)
          ? debug.readingProgressTriggerIds
          : [];

        return {
          label,
          runtimeAvailable: !!window.__memoryBenchRuntime,
          rootChildCount: document.getElementById("root")?.children.length ?? null,
          appFound: !!document.querySelector(".opendesign-app"),
          heroFound: !!document.querySelector(".hero-studio h1"),
          hasDebug: !!debug,
          mode: debug?.mode || "",
          reducedMotionSource: debug?.reducedMotionSource || "",
          triggerCount: triggerIds.length,
          railTriggerCount: railTriggerIds.length,
          readingProgressTriggerCount: readingProgressTriggerIds.length,
          duplicateCount: Array.isArray(debug?.duplicateIds) ? debug.duplicateIds.length : null,
          markerCount: Number(debug?.markerCount) || 0,
          pinSpacerCount: Number(debug?.pinSpacerCount) || 0,
          pinnedCount: Number(debug?.pinnedCount) || 0,
          scrubbedCount: Array.isArray(debug?.scrubbedIds) ? debug.scrubbedIds.length : 0,
          animationCount: Number(animations.animationCount) || 0,
          activeCount: Number(animations.activeCount) || 0,
          repeatCount: Number(animations.repeatCount) || 0,
          activeRepeatCount: Number(animations.activeRepeatCount) || 0,
          pausedRepeatCount: Number(animations.pausedRepeatCount) || 0,
          orbitRepeatCount: Number(animations.orbitRepeatCount) || 0,
          nonOrbitRepeatCount: Number(animations.nonOrbitRepeatCount) || 0,
          orbitAvailable: orbitPlayback.available === true,
          orbitObserverAttached: orbitPlayback.observerAttached === true,
          orbitTweenCount: Number(orbitPlayback.tweenCount) || 0,
          orbitActiveTweenCount: Number(orbitPlayback.activeTweenCount) || 0,
          orbitShouldPlay: orbitPlayback.shouldPlay === true,
        };
      };

      setTimeout(() => {
        const initial = capture("initial-mounted");
        window.__memoryBenchRuntime?.unmount?.();
        setTimeout(() => {
          const unmounted = capture("unmounted");
          window.__memoryBenchRuntime?.mount?.();
          setTimeout(() => {
            const remounted = capture("remounted");
            resolve({ initial, unmounted, remounted });
          }, 2600);
        }, 700);
      }, 2600);
    })`,
  ], { timeout: 45_000 });

  if (!lifecycle) {
    failures.push("mount lifecycle check did not return evidence");
    return;
  }

  const mountedOk = (phase) =>
    phase?.runtimeAvailable === true &&
    Number(phase?.rootChildCount) > 0 &&
    phase?.appFound === true &&
    phase?.heroFound === true &&
    phase?.hasDebug === true &&
    phase?.mode === "normal" &&
    phase?.reducedMotionSource === "none" &&
    Number(phase?.triggerCount) === 6 &&
    Number(phase?.railTriggerCount) === 5 &&
    Number(phase?.readingProgressTriggerCount) === 1 &&
    Number(phase?.duplicateCount) === 0 &&
    Number(phase?.markerCount) === 0 &&
    Number(phase?.pinSpacerCount) === 0 &&
    Number(phase?.pinnedCount) === 0 &&
    Number(phase?.scrubbedCount) === 1 &&
    Number(phase?.repeatCount) === 2 &&
    Number(phase?.activeRepeatCount) === 2 &&
    Number(phase?.pausedRepeatCount) === 0 &&
    Number(phase?.orbitRepeatCount) === 2 &&
    Number(phase?.nonOrbitRepeatCount) === 0 &&
    phase?.orbitAvailable === true &&
    phase?.orbitObserverAttached === true &&
    Number(phase?.orbitTweenCount) === 2 &&
    Number(phase?.orbitActiveTweenCount) === 2 &&
    phase?.orbitShouldPlay === true;
  const unmountedOk = (phase) =>
    phase?.runtimeAvailable === true &&
    Number(phase?.rootChildCount) === 0 &&
    phase?.appFound === false &&
    phase?.heroFound === false &&
    phase?.hasDebug === true &&
    Number(phase?.triggerCount) === 0 &&
    Number(phase?.railTriggerCount) === 0 &&
    Number(phase?.readingProgressTriggerCount) === 0 &&
    Number(phase?.duplicateCount) === 0 &&
    Number(phase?.markerCount) === 0 &&
    Number(phase?.pinSpacerCount) === 0 &&
    Number(phase?.pinnedCount) === 0 &&
    Number(phase?.scrubbedCount) === 0 &&
    Number(phase?.activeCount) === 0 &&
    Number(phase?.repeatCount) === 0 &&
    Number(phase?.activeRepeatCount) === 0 &&
    Number(phase?.orbitRepeatCount) === 0 &&
    Number(phase?.nonOrbitRepeatCount) === 0 &&
    phase?.orbitAvailable === false &&
    Number(phase?.orbitTweenCount) === 0;
  const initialOk = mountedOk(lifecycle.initial);
  const unmountOk = unmountedOk(lifecycle.unmounted);
  const remountOk = mountedOk(lifecycle.remounted);
  const ok = initialOk && unmountOk && remountOk;

  qaReport.mountLifecycle.push({
    label: "desktop-unmount-remount",
    ok,
    initialOk,
    unmountOk,
    remountOk,
    phases: [lifecycle.initial, lifecycle.unmounted, lifecycle.remounted],
  });

  if (!ok) {
    failures.push(
      `desktop mount lifecycle failed: initial=${initialOk}, unmount=${unmountOk}, remount=${remountOk}, unmountedTriggers=${
        lifecycle.unmounted?.triggerCount ?? "missing"
      }, remountedTriggers=${lifecycle.remounted?.triggerCount ?? "missing"}`,
    );
  }
}

function checkAnchorNavigation(viewport) {
  const anchorState = runJson([
    "js",
    `(() => {
      const anchorIds = ["research", "published", "platform", "benchmarks", "subscribe"];
      const header = document.querySelector(".top-rail");
      const stickyBottom = header && getComputedStyle(header).position === "sticky"
        ? Math.round(header.getBoundingClientRect().bottom)
        : 0;
      const results = [];

      document.documentElement.style.scrollBehavior = "auto";

      for (const id of anchorIds) {
        const target = document.getElementById(id);
        if (!target) {
          results.push({ id, exists: false });
          continue;
        }

        target.scrollIntoView({ block: "start" });

        const rect = target.getBoundingClientRect();
        const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const atDocumentEnd = Math.abs(window.scrollY - maxScrollY) <= 2;
        results.push({
          id,
          exists: true,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          stickyBottom,
          viewportHeight: window.innerHeight,
          atDocumentEnd,
        });
      }

      window.scrollTo(0, 0);
      return results;
    })()`,
  ], { timeout: 30_000 });

  if (!Array.isArray(anchorState)) {
    failures.push(`[${viewport.name}] anchor navigation check did not return results`);
    return;
  }

  for (const item of anchorState) {
    if (!item.exists) {
      failures.push(`[${viewport.name}] anchor target #${item.id} is missing`);
      continue;
    }

    if (item.top < item.stickyBottom + 8 && !item.atDocumentEnd) {
      failures.push(
        `[${viewport.name}] anchor #${item.id} lands under sticky navigation: top ${item.top}, stickyBottom ${item.stickyBottom}`,
      );
    }

    if (item.bottom <= item.stickyBottom + 8 || item.top >= item.viewportHeight - 24) {
      failures.push(
        `[${viewport.name}] anchor #${item.id} is not visibly reachable after navigation: top ${item.top}, bottom ${item.bottom}`,
      );
    }
  }
}

function checkPrimaryNavigation(viewport) {
  function clickAndRead(selector, label, targetId) {
    try {
      runBrowse(["click", selector], { timeout: 30_000 });
    } catch (error) {
      failures.push(`[${viewport.name}] ${label} navigation click failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }

    sleep(650);
    return runJson([
      "js",
      `(() => {
      const header = document.querySelector(".top-rail");
        const stickyBottom = header && getComputedStyle(header).position === "sticky"
        ? Math.round(header.getBoundingClientRect().bottom)
        : 0;
        const target = document.getElementById("${targetId}");
        if (!target) {
          return { hash: window.location.hash, target: { id: "${targetId}", exists: false } };
        }

        const rect = target.getBoundingClientRect();
        return {
          hash: window.location.hash,
          selectedTab: document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim() || "",
          panelExists: !!document.querySelector("#studio-panel"),
          evidenceLedger: !!document.querySelector('[aria-label="evidence ledger"]'),
          evidenceRows: document.querySelectorAll(".evidence-row").length,
          currentNavHrefs: [...document.querySelectorAll('.top-rail nav a[aria-current="page"]')]
            .map((link) => link.getAttribute("href") || ""),
          target: {
            id: "${targetId}",
            exists: true,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            stickyBottom,
            viewportHeight: window.innerHeight,
          },
        };
      })()`,
    ], { timeout: 30_000 });
  }

  runBrowse(["js", `document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0); true`]);
  sleep(120);

  const research = clickAndRead('.top-rail nav a[href="#research"]', "Research", "research");
  const studio = clickAndRead('.top-rail nav a[href="#benchmarks"]', "Studio", "benchmarks");
  const evidence = clickAndRead('.top-rail nav a[href="#evidence"]', "Evidence", "benchmarks");
  const openStudio = clickAndRead('.top-rail .action-link-outline[href="#benchmarks"]', "Open studio", "benchmarks");
  const study = clickAndRead(
    '.research-list article:first-child .action-link-text[href="#evidence"]',
    "View study",
    "benchmarks",
  );
  const footerEvidence = clickAndRead(
    '.footer-actions .action-link-accent[href="#evidence"]',
    "Footer evidence ledger",
    "benchmarks",
  );
  runBrowse(["goto", `${targetUrl}#evidence`], { timeout: 30_000 });
  sleep(650);
  const evidenceDeepLink = runJson([
    "js",
    `(() => ({
      hash: window.location.hash,
      selectedTab: document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim() || "",
      evidenceLedger: !!document.querySelector('[aria-label="evidence ledger"]'),
      evidenceRows: document.querySelectorAll(".evidence-row").length,
    }))()`,
  ], { timeout: 30_000 });
  const skip = runJson([
    "js",
    `new Promise(resolve => {
      const skipLink = document.querySelector(".skip-link");
      window.scrollTo(0, 0);
      skipLink?.focus();
      skipLink?.click();
      setTimeout(() => {
        const target = document.getElementById("main-content");
        const header = document.querySelector(".top-rail");
        const stickyBottom = header && getComputedStyle(header).position === "sticky"
          ? Math.round(header.getBoundingClientRect().bottom)
          : 0;
        const rect = target?.getBoundingClientRect();
        resolve({
          found: !!skipLink,
          hash: window.location.hash,
          activeElementId: document.activeElement?.id || "",
          target: target && rect ? {
            id: "main-content",
            exists: true,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            stickyBottom,
            viewportHeight: window.innerHeight,
          } : { id: "main-content", exists: false },
        });
      }, 300);
    })`,
  ], { timeout: 30_000 });

  runBrowse(["js", `window.scrollTo(0, 0); true`]);

  if (!research || !studio || !evidence || !openStudio || !study || !footerEvidence || !evidenceDeepLink || !skip) {
    return;
  }

  const isVisibleBelowSticky = (target) =>
    target?.exists &&
    target.bottom > target.stickyBottom + 8 &&
    target.top < target.viewportHeight - 24;

  if (research.hash !== "#research") {
    failures.push(`[${viewport.name}] Research navigation did not update the hash to #research`);
  }
  if (!Array.isArray(research.currentNavHrefs) || research.currentNavHrefs.join("|") !== "#research") {
    failures.push(
      `[${viewport.name}] Research navigation did not mark the Research top nav item current; got ${
        Array.isArray(research.currentNavHrefs) ? research.currentNavHrefs.join(", ") || "none" : "missing"
      }`,
    );
  }

  if (!isVisibleBelowSticky(research.target)) {
    failures.push(`[${viewport.name}] Research navigation target is not visibly below sticky navigation`);
  }

  if (studio.hash !== "#benchmarks") {
    failures.push(`[${viewport.name}] Studio navigation did not update the hash to #benchmarks`);
  }
  if (!Array.isArray(studio.currentNavHrefs) || studio.currentNavHrefs.join("|") !== "#benchmarks") {
    failures.push(
      `[${viewport.name}] Studio navigation did not mark the Studio top nav item current; got ${
        Array.isArray(studio.currentNavHrefs) ? studio.currentNavHrefs.join(", ") || "none" : "missing"
      }`,
    );
  }

  if (studio.selectedTab !== "Research map" || !studio.panelExists) {
    failures.push(
      `[${viewport.name}] Studio navigation did not restore the Research map panel, got ${
        studio.selectedTab || "none"
      }`,
    );
  }

  if (!isVisibleBelowSticky(studio.target)) {
    failures.push(`[${viewport.name}] Studio navigation target is not visibly below sticky navigation`);
  }

  if (evidence.hash !== "#evidence") {
    failures.push(`[${viewport.name}] Evidence navigation did not update the hash to #evidence`);
  }
  if (!Array.isArray(evidence.currentNavHrefs) || evidence.currentNavHrefs.join("|") !== "#evidence") {
    failures.push(
      `[${viewport.name}] Evidence navigation did not mark the Evidence top nav item current; got ${
        Array.isArray(evidence.currentNavHrefs) ? evidence.currentNavHrefs.join(", ") || "none" : "missing"
      }`,
    );
  }

  if (evidence.selectedTab !== "Evidence ledger" || !evidence.evidenceLedger) {
    failures.push(
      `[${viewport.name}] Evidence navigation did not activate the Evidence ledger tab, got ${
        evidence.selectedTab || "none"
      }`,
    );
  }

  if (evidence.evidenceRows !== 11) {
    failures.push(`[${viewport.name}] Evidence navigation rendered ${evidence.evidenceRows ?? "no"} rows`);
  }

  if (!isVisibleBelowSticky(evidence.target)) {
    failures.push(`[${viewport.name}] Evidence navigation does not keep the studio visibly below sticky navigation`);
  }

  if (openStudio.hash !== "#benchmarks" || openStudio.selectedTab !== "Research map") {
    failures.push(
      `[${viewport.name}] Open studio action did not reset the Studio to Research map; hash=${
        openStudio.hash || "missing"
      }, tab=${openStudio.selectedTab || "missing"}`,
    );
  }

  if (!isVisibleBelowSticky(openStudio.target)) {
    failures.push(`[${viewport.name}] Open studio action target is not visibly below sticky navigation`);
  }

  if (study.hash !== "#evidence" || study.selectedTab !== "Evidence ledger" || !study.evidenceLedger) {
    failures.push(
      `[${viewport.name}] View study action did not activate the Evidence ledger; hash=${
        study.hash || "missing"
      }, tab=${study.selectedTab || "missing"}`,
    );
  }

  if (!isVisibleBelowSticky(study.target)) {
    failures.push(`[${viewport.name}] View study action target is not visibly below sticky navigation`);
  }

  if (
    footerEvidence.hash !== "#evidence" ||
    footerEvidence.selectedTab !== "Evidence ledger" ||
    !footerEvidence.evidenceLedger
  ) {
    failures.push(
      `[${viewport.name}] Footer evidence action did not continue to the Evidence ledger; hash=${
        footerEvidence.hash || "missing"
      }, tab=${footerEvidence.selectedTab || "missing"}`,
    );
  }

  if (!isVisibleBelowSticky(footerEvidence.target)) {
    failures.push(`[${viewport.name}] Footer evidence action target is not visibly below sticky navigation`);
  }

  if (
    evidenceDeepLink.hash !== "#evidence" ||
    evidenceDeepLink.selectedTab !== "Evidence ledger" ||
    evidenceDeepLink.evidenceLedger !== true ||
    evidenceDeepLink.evidenceRows !== 11
  ) {
    failures.push(
      `[${viewport.name}] Evidence deep link did not hydrate the Evidence ledger; hash=${
        evidenceDeepLink.hash || "missing"
      }, tab=${evidenceDeepLink.selectedTab || "missing"}, rows=${
        evidenceDeepLink.evidenceRows ?? "missing"
      }`,
    );
  }

  if (!skip.found || skip.hash !== "#main-content") {
    failures.push(`[${viewport.name}] skip link did not navigate to #main-content`);
  }

  if (!isVisibleBelowSticky(skip.target)) {
    failures.push(`[${viewport.name}] skip link target is not visibly reachable`);
  }
}

function checkEmptySearchState(viewport) {
  const emptyState = runJson([
    "js",
    `new Promise(resolve => {
      const input = document.querySelector("#memorybench-search");
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!input || !valueSetter) {
        resolve({ inputFound: false });
        return;
      }

      valueSetter.call(input, "definitely-no-memory-system-match");
      input.dispatchEvent(new Event("input", { bubbles: true }));

      setTimeout(() => {
        const tabs = [...document.querySelectorAll('[role="tab"]')];
        const brokenControls = tabs
          .map(tab => tab.getAttribute("aria-controls"))
          .filter(id => !id || !document.getElementById(id));
        const panel = document.getElementById("studio-panel");
        const result = {
          inputFound: true,
          panelExists: !!panel,
          panelRole: panel?.getAttribute("role") || "",
          emptyVisible: !!document.querySelector(".empty-scope"),
          brokenControls,
        };

        valueSetter.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        setTimeout(() => resolve(result), 100);
      }, 300);
    })`,
  ], { timeout: 30_000 });

  if (!emptyState?.inputFound) {
    failures.push(`[${viewport.name}] search input was not found for empty-state ARIA check`);
    return;
  }

  if (!emptyState.panelExists || emptyState.panelRole !== "tabpanel" || !emptyState.emptyVisible) {
    failures.push(`[${viewport.name}] empty search state did not preserve the studio tabpanel`);
  }

  if (emptyState.brokenControls?.length > 0) {
    failures.push(`[${viewport.name}] empty search state has broken tab aria-controls`);
  }
}

function checkContrast(viewport) {
  const contrastState = runJson([
    "js",
    `(() => {
      const selectors = [
        ".top-rail a",
        ".skip-link",
        ".top-rail nav a",
        ".outline-link",
        ".hero-copy .eyebrow",
        ".hero-copy h1",
        ".hero-copy p:not(.eyebrow)",
        ".hero-actions a",
        ".lane-strip span",
        ".surface-grid span",
        ".surface-grid h3",
        ".surface-grid p",
        ".surface-grid a",
        ".research-list time",
        ".research-list h3",
        ".research-list p",
        ".research-list span",
        ".research-list a",
        ".platform-copy h2",
        ".platform-copy p",
        ".platform-steps span",
        ".platform-steps h3",
        ".platform-steps p",
        ".workbench-head .eyebrow",
        ".workbench-head h2",
        ".workbench-head p",
        ".metric-ribbon span",
        ".metric-ribbon strong",
        ".search-control input",
        ".mode-tabs button",
        ".primary-lab h3",
        ".primary-lab p",
        ".dossier-panel h3",
        ".dossier-panel p",
        ".site-footer span",
        ".site-footer h2",
        ".site-footer p",
        ".site-footer strong",
        ".site-footer a",
      ];

      const parseColor = (value) => {
        const match = value.match(/rgba?\\(([^)]+)\\)/);
        if (!match) {
          return null;
        }
        const parts = match[1].split(",").map(part => Number.parseFloat(part.trim()));
        if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) {
          return null;
        }
        return {
          r: parts[0],
          g: parts[1],
          b: parts[2],
          a: Number.isFinite(parts[3]) ? parts[3] : 1,
        };
      };
      const composite = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      const luminance = (color) => {
        const linear = [color.r, color.g, color.b].map(value => {
          const normalized = value / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const ratio = (a, b) => {
        const light = Math.max(luminance(a), luminance(b));
        const dark = Math.min(luminance(a), luminance(b));
        return (light + 0.05) / (dark + 0.05);
      };
      const fallbackBackground = (node) => {
        if (node.closest(".hero-studio")) {
          return { r: 22, g: 18, b: 15, a: 1 };
        }
        if (node.closest(".metric-ribbon .emphasis, .mode-tabs button.active")) {
          return { r: 20, g: 32, b: 28, a: 1 };
        }
        return { r: 247, g: 240, b: 228, a: 1 };
      };
      const backgroundFor = (node) => {
        const boundary = node.closest(".hero-studio, .site-footer, .metric-ribbon .emphasis, .mode-tabs button.active");
        let color = fallbackBackground(node);
        for (let current = node; current; current = current.parentElement) {
          const parsed = parseColor(getComputedStyle(current).backgroundColor);
          if (parsed && parsed.a > 0) {
            color = parsed.a < 1 ? composite(parsed, color) : parsed;
            if (parsed.a >= 1) {
              break;
            }
          }

          if (boundary && current === boundary) {
            break;
          }
        }
        return color;
      };
      const isVisible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const failures = [];

      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          if (!isVisible(node)) {
            continue;
          }

          const style = getComputedStyle(node);
          const color = parseColor(style.color);
          const background = backgroundFor(node);
          if (!color || !background) {
            continue;
          }

          const fontSize = Number.parseFloat(style.fontSize) || 16;
          const fontWeight = Number.parseFloat(style.fontWeight) || 400;
          const threshold = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
          const contrast = ratio(color.a < 1 ? composite(color, background) : color, background);
          if (contrast < threshold) {
            failures.push({
              selector,
              text: (node.textContent || node.getAttribute("placeholder") || "").trim().slice(0, 80),
              contrast: Number(contrast.toFixed(2)),
              threshold,
            });
          }
        }
      }

      return { failures };
    })()`,
  ], { timeout: 30_000 });

  if (contrastState?.failures?.length > 0) {
    failures.push(
      `[${viewport.name}] low contrast text: ${contrastState.failures
        .slice(0, 12)
        .map((item) => `${item.selector} "${item.text}" ${item.contrast}:${item.threshold}`)
        .join(", ")}`,
    );
  }
}

function checkVisualComposition(viewport) {
  const composition = runJson([
    "js",
    `(() => {
      const selectors = [
        ".hero-copy",
        ".hero-visual",
        ".workbench-head",
        ".metric-ribbon",
        ".mode-tabs",
        ".primary-lab",
        ".dossier-panel",
        ".surface-grid",
        ".research-list",
        ".platform-steps",
        ".site-footer",
      ];
      const visible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const rectFor = (selector) => {
        const node = document.querySelector(selector);
        if (!node || !visible(node)) return null;
        const rect = node.getBoundingClientRect();
        return {
          selector,
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };
      const rects = selectors.map(rectFor).filter(Boolean);
      const viewportWidth = window.innerWidth;
      const offscreen = rects.filter(rect => rect.left < -2 || rect.right > viewportWidth + 2);
      const overlaps = [];
      const pairNames = [
        [".hero-copy", ".hero-visual"],
        [".workbench-head", ".metric-ribbon"],
        [".mode-tabs", ".primary-lab"],
      ];
      for (const [a, b] of pairNames) {
        const ra = rects.find(rect => rect.selector === a);
        const rb = rects.find(rect => rect.selector === b);
        if (!ra || !rb) continue;
        const xOverlap = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
        const yOverlap = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
        if (xOverlap > 8 && yOverlap > 8) {
          overlaps.push({ a, b, area: xOverlap * yOverlap });
        }
      }
      const clipped = [...document.querySelectorAll(".hero-copy h1, .workbench-head h2, .section-intro h2, .footer-copy h2, .panel-title h3")]
        .filter(visible)
        .filter(node => {
          const style = getComputedStyle(node);
          const clipsX = style.overflowX !== "visible";
          const clipsY = style.overflowY !== "visible";
          return (clipsX && node.scrollWidth > node.clientWidth + 2) ||
            (clipsY && node.scrollHeight > node.clientHeight + 2);
        })
        .map(node => node.textContent.trim().slice(0, 80));

      return { offscreen, overlaps, clipped };
    })()`,
  ], { timeout: 30_000 });

  if (!composition) {
    return;
  }

  if (composition.offscreen?.length > 0) {
    failures.push(
      `[${viewport.name}] key visual regions overflow viewport: ${composition.offscreen
        .map((item) => `${item.selector} ${item.left}-${item.right}`)
        .join(", ")}`,
    );
  }

  if (composition.overlaps?.length > 0) {
    failures.push(
      `[${viewport.name}] key visual regions overlap: ${composition.overlaps
        .map((item) => `${item.a}/${item.b}`)
        .join(", ")}`,
    );
  }

  if (composition.clipped?.length > 0) {
    failures.push(`[${viewport.name}] key headings are clipped: ${composition.clipped.join(", ")}`);
  }
}

function checkStudioFrameContinuity(viewport) {
  const state = runJson([
    "js",
    `new Promise(resolve => {
      const tab = document.querySelector("#studio-tab-map");
      tab?.click();

      setTimeout(() => {
        const studio = document.querySelector("#benchmarks");
        const grid = document.querySelector(".studio-grid");
        const primary = document.querySelector(".primary-lab");
        const content = primary?.firstElementChild;
        const dossier = document.querySelector(".dossier-panel");

        if (studio) {
          document.documentElement.style.scrollBehavior = "auto";
          window.scrollTo(0, studio.getBoundingClientRect().top + window.scrollY);
        }

        const primaryRect = primary?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();
        const dossierRect = dossier?.getBoundingClientRect();
        const gridStyle = grid ? getComputedStyle(grid) : null;
        const dossierStyle = dossier ? getComputedStyle(dossier) : null;
        const dossierPairList = dossier?.querySelector(".pair-list");
        const originalDossierScrollTop = dossier ? dossier.scrollTop : 0;
        if (dossier) {
          dossier.scrollTop = dossier.scrollHeight;
        }
        const pairListRectAfterScroll = dossierPairList?.getBoundingClientRect();
        if (dossier) {
          dossier.scrollTop = originalDossierScrollTop;
        }
        const blankAfterContent = primaryRect && contentRect
          ? Math.max(0, Math.round(primaryRect.bottom - contentRect.bottom))
          : null;
        const maxAllowedBlank = window.innerWidth <= 720 ? 28 : 36;
        const isStacked = gridStyle?.gridTemplateColumns?.trim() === "none" ||
          (primaryRect && dossierRect && Math.abs(Math.round(primaryRect.left - dossierRect.left)) <= 2);
        const dossierInternalScroll = dossier
          ? Math.round(dossier.scrollHeight) > Math.round(dossier.clientHeight) + 2
          : false;
        const dossierViewportBounded = window.innerWidth <= 1180 || (
          !!dossierRect &&
          dossierStyle?.position === "sticky" &&
          dossierRect.height <= window.innerHeight - 104 &&
          dossierInternalScroll
        );
        const dossierPairReachable = window.innerWidth <= 1180 || (
          !!dossierRect &&
          !!pairListRectAfterScroll &&
          pairListRectAfterScroll.bottom <= dossierRect.bottom + 2 &&
          pairListRectAfterScroll.top >= dossierRect.top - 2
        );

        resolve({
          ok: !!grid && !!primary && !!content &&
            gridStyle?.alignItems === "start" &&
            Number(blankAfterContent) <= maxAllowedBlank &&
            dossierViewportBounded &&
            dossierPairReachable,
          viewportWidth: window.innerWidth,
          gridFound: !!grid,
          primaryFound: !!primary,
          contentClassName: content?.className || "",
          alignItems: gridStyle?.alignItems || null,
          isStacked: Boolean(isStacked),
          primaryHeight: primaryRect ? Math.round(primaryRect.height) : null,
          contentHeight: contentRect ? Math.round(contentRect.height) : null,
          dossierHeight: dossierRect ? Math.round(dossierRect.height) : null,
          dossierClientHeight: dossier ? Math.round(dossier.clientHeight) : null,
          dossierScrollHeight: dossier ? Math.round(dossier.scrollHeight) : null,
          dossierOverflowY: dossierStyle?.overflowY || null,
          dossierPosition: dossierStyle?.position || null,
          dossierInternalScroll,
          dossierViewportBounded,
          dossierPairReachable,
          pairListTopAfterScroll: pairListRectAfterScroll ? Math.round(pairListRectAfterScroll.top) : null,
          pairListBottomAfterScroll: pairListRectAfterScroll ? Math.round(pairListRectAfterScroll.bottom) : null,
          blankAfterContent,
          maxAllowedBlank,
        });
      }, 450);
    })`,
  ], { timeout: 30_000 });

  if (!state) {
    return;
  }

  if (Number(state.viewportWidth) > 1180) {
    const focusState = runJson([
      "js",
      `(() => {
        const dossier = document.querySelector(".dossier-panel");
        if (!(dossier instanceof HTMLElement)) {
          return { exists: false };
        }

        dossier.scrollTop = 0;
        dossier.focus({ preventScroll: true });
        return {
          exists: true,
          tabIndex: dossier.tabIndex,
          ariaLabel: dossier.getAttribute("aria-label") || "",
          focused: document.activeElement === dossier,
          scrollTopBeforePress: Math.round(dossier.scrollTop),
        };
      })()`,
    ], { timeout: 30_000 });

    if (focusState?.focused === true) {
      runBrowse(["press", "PageDown"], { timeout: 30_000 });
      sleep(180);
    }

    const keyboardState = runJson([
      "js",
      `(() => {
        const dossier = document.querySelector(".dossier-panel");
        if (!(dossier instanceof HTMLElement)) {
          return { exists: false };
        }

        return {
          exists: true,
          focused: document.activeElement === dossier,
          scrollTopAfterPress: Math.round(dossier.scrollTop),
          scrollHeight: Math.round(dossier.scrollHeight),
          clientHeight: Math.round(dossier.clientHeight),
        };
      })()`,
    ], { timeout: 30_000 });

    Object.assign(state, {
      dossierTabIndex: focusState?.tabIndex ?? null,
      dossierAriaLabel: focusState?.ariaLabel ?? "",
      dossierKeyboardFocused: focusState?.focused === true,
      dossierKeyboardFocusRetained: keyboardState?.focused === true,
      dossierKeyboardScrollTopBeforePress: focusState?.scrollTopBeforePress ?? null,
      dossierKeyboardScrollTopAfterPress: keyboardState?.scrollTopAfterPress ?? null,
      dossierKeyboardScrolled:
        Number(keyboardState?.scrollTopAfterPress) > Number(focusState?.scrollTopBeforePress ?? 0),
    });
  } else {
    Object.assign(state, {
      dossierTabIndex: null,
      dossierAriaLabel: "",
      dossierKeyboardFocused: true,
      dossierKeyboardFocusRetained: true,
      dossierKeyboardScrollTopBeforePress: null,
      dossierKeyboardScrollTopAfterPress: null,
      dossierKeyboardScrolled: true,
    });
  }

  if (Number(state.viewportWidth) > 1180) {
    state.ok = state.ok &&
      state.dossierTabIndex === 0 &&
      state.dossierAriaLabel === "selected system dossier" &&
      state.dossierKeyboardFocused === true &&
      state.dossierKeyboardFocusRetained === true &&
      state.dossierKeyboardScrolled === true;
  }

  qaReport.studioFrameContinuity.push({
    label: viewport.name,
    ...state,
  });

  if (!state.gridFound || !state.primaryFound || !state.contentClassName) {
    failures.push(`[${viewport.name}] studio frame continuity check could not find the map workbench`);
    return;
  }

  if (state.alignItems !== "start") {
    failures.push(`[${viewport.name}] studio grid align-items is ${state.alignItems ?? "missing"}, expected start`);
  }

  if (Number(state.blankAfterContent) > Number(state.maxAllowedBlank)) {
    failures.push(
      `[${viewport.name}] studio primary panel has ${state.blankAfterContent}px blank space after content, expected <= ${state.maxAllowedBlank}px`,
    );
  }

  if (Number(state.viewportWidth) > 1180 && state.dossierViewportBounded !== true) {
    failures.push(
      `[${viewport.name}] desktop dossier panel is not viewport-bounded and internally scrollable: height=${
        state.dossierHeight ?? "missing"
      }, clientHeight=${state.dossierClientHeight ?? "missing"}, scrollHeight=${
        state.dossierScrollHeight ?? "missing"
      }, position=${state.dossierPosition ?? "missing"}, overflowY=${state.dossierOverflowY ?? "missing"}`,
    );
  }

  if (Number(state.viewportWidth) > 1180 && state.dossierPairReachable !== true) {
    failures.push(
      `[${viewport.name}] desktop dossier Pairing candidates are not reachable inside the bounded panel after internal scroll`,
    );
  }

  if (
    Number(state.viewportWidth) > 1180 &&
    (
      state.dossierTabIndex !== 0 ||
      state.dossierAriaLabel !== "selected system dossier" ||
      state.dossierKeyboardFocused !== true ||
      state.dossierKeyboardFocusRetained !== true ||
      state.dossierKeyboardScrolled !== true
    )
  ) {
    failures.push(
      `[${viewport.name}] desktop dossier scroll region is not keyboard reachable: tabIndex=${
        state.dossierTabIndex ?? "missing"
      }, label=${state.dossierAriaLabel || "missing"}, focused=${
        state.dossierKeyboardFocused ?? "missing"
      }, retained=${state.dossierKeyboardFocusRetained ?? "missing"}, before=${
        state.dossierKeyboardScrollTopBeforePress ?? "missing"
      }, after=${state.dossierKeyboardScrollTopAfterPress ?? "missing"}`,
    );
  }
}

function checkPageContinuity(viewport, expectedMode) {
  const continuityState = runJson([
    "js",
    `(() => {
      const root = document.documentElement;
      const overflowX = root.scrollWidth - root.clientWidth;
      const frameCounts = {
        pageContinuum: document.querySelectorAll(".page-continuum").length,
        sectionFrame: document.querySelectorAll(".section-frame").length,
        workbenchFrame: document.querySelectorAll(".workbench-frame").length,
      };
      const sequence = [...document.querySelectorAll(".page-continuum > section, .page-continuum > footer.site-footer")].map(node => {
        if (node.classList.contains("surface-section")) return "surface-section";
        if (node.classList.contains("published-section")) return "published-section";
        if (node.classList.contains("platform-section")) return "platform-section";
        if (node.classList.contains("studio-workbench")) return "studio-workbench";
        if (node.classList.contains("site-footer")) return "site-footer";
        return node.className;
      });
      const ordered = sequence.join("|") === "surface-section|published-section|platform-section|studio-workbench|site-footer";
      const sections = [...document.querySelectorAll(".page-continuum > section, .page-continuum > footer.site-footer")].map(node => ({
        className: node.className,
        top: Math.round(node.getBoundingClientRect().top + window.scrollY),
        bottom: Math.round(node.getBoundingClientRect().bottom + window.scrollY),
      }));
      const overlaps = sections.filter((section, index) => index > 0 && section.top < sections[index - 1].bottom - 2);
      const gaps = sections
        .map((section, index) => index > 0 ? section.top - sections[index - 1].bottom : 0)
        .slice(1);
      const frames = [...document.querySelectorAll(".page-continuum .briefing-frame")].map(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          display: style.display,
          alignItems: style.alignItems,
        };
      });
      const frameChildSignatures = [...document.querySelectorAll(".page-continuum .briefing-frame")]
        .map(node => [...node.children]
          .map(child => {
            if (!(child instanceof HTMLElement)) return "";
            return [...child.classList]
              .filter(className => className !== "is-scroll-active")
              .join(".");
          })
          .join("|"));
      const unifiedChromeTargets = [
        ".continuity-lane",
        ".surface-grid",
        ".research-list",
        ".platform-steps",
        ".metric-ribbon",
        ".footer-proof-grid",
      ].map(selector => {
        const node = document.querySelector(selector);
        const style = node ? getComputedStyle(node) : null;
        const rect = node?.getBoundingClientRect();

        return {
          selector,
          found: !!node,
          display: style?.display ?? null,
          borderTopWidth: style?.borderTopWidth ?? null,
          borderRightWidth: style?.borderRightWidth ?? null,
          borderBottomWidth: style?.borderBottomWidth ?? null,
          borderLeftWidth: style?.borderLeftWidth ?? null,
          backgroundImage: style?.backgroundImage ?? null,
          width: rect ? Math.round(rect.width) : null,
        };
      });
      const unifiedChromeMissing = unifiedChromeTargets
        .filter(item => !item.found)
        .map(item => item.selector);
      const unifiedChromeUnframed = unifiedChromeTargets
        .filter(item => item.found && (
          item.display !== "grid" ||
          item.borderTopWidth !== "1px" ||
          item.borderRightWidth !== "1px" ||
          item.borderBottomWidth !== "1px" ||
          item.borderLeftWidth !== "1px"
        ))
        .map(item => [
          item.selector,
          item.display,
          item.borderTopWidth,
          item.borderRightWidth,
          item.borderBottomWidth,
          item.borderLeftWidth,
        ].join(":"));
      const nestedPageCards = [...document.querySelectorAll(
        ".briefing-frame .briefing-frame, .section-frame .section-frame, .surface-grid article article, .research-list article article, .platform-steps article article, .footer-proof-grid article article"
      )].length;
      const studioFrame = document.querySelector(".studio-frame");
      const footerFrame = document.querySelector(".site-footer .footer-frame");
      const studioFrameRect = studioFrame?.getBoundingClientRect();
      const footerFrameRect = footerFrame?.getBoundingClientRect();
      const studioFooterHandoffGap = studioFrameRect && footerFrameRect
        ? Math.round(footerFrameRect.top + window.scrollY - (studioFrameRect.bottom + window.scrollY))
        : null;
      const maxAllowedStudioFooterHandoffGap = window.innerWidth <= 720 ? 72 : window.innerWidth <= 1180 ? 92 : 112;
      const frameLefts = frames.map(frame => frame.left);
      const frameRights = frames.map(frame => frame.right);
      const frameAlignmentMaxDelta = frames.length > 0
        ? Math.max(...frameLefts) - Math.min(...frameLefts) + Math.max(...frameRights) - Math.min(...frameRights)
        : null;
      const railLabels = [...document.querySelectorAll(".page-continuum .briefing-rail span")]
        .map(node => node.textContent.trim());
      const continuityLane = [...document.querySelectorAll(".continuity-lane article")].map(node => ({
        number: node.querySelector("span")?.textContent?.trim() || "",
        label: node.querySelector("strong")?.textContent?.trim() || "",
        body: node.querySelector("p")?.textContent?.trim() || "",
      }));
      const continuityLaneSignature = continuityLane
        .map(item => [item.number, item.label, item.body].join(":"))
        .join("|");
      const continuityLaneHiddenCount = [...document.querySelectorAll(".continuity-lane article")]
        .filter(node => {
          const style = getComputedStyle(node);
          return style.opacity === "0" || style.visibility === "hidden";
        }).length;
      const continuityLaneInlineResidue = [...document.querySelectorAll(".continuity-lane article")]
        .filter(node => node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange)
        .length;
      const surfaceCardTitles = [...document.querySelectorAll(".surface-grid h3")]
        .map(node => node.textContent.trim());
      const platformStepLabels = [...document.querySelectorAll(".platform-steps b")]
        .map(node => node.textContent.trim());
      const clippedText = [...document.querySelectorAll(".mode-tabs button, .hero-actions a, .top-rail nav a, .surface-grid a, .research-list a, .footer-actions a")]
        .filter(node => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2)
        .map(node => node.textContent.trim());
      const wrappedTabs = [...document.querySelectorAll(".mode-tabs button span")]
        .filter(node => {
          const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight) || 18;
          return node.getBoundingClientRect().height > lineHeight * 1.35;
        })
        .map(node => node.textContent.trim());
      const motionDebug = typeof window.__memoryBenchMotionInspect === "function"
        ? window.__memoryBenchMotionInspect()
        : window.__memoryBenchMotion || null;

      return {
        overflowX,
        frameCounts,
        ordered,
        sectionCount: sections.length,
        railCount: railLabels.length,
        railLabels,
        frameChildSignatures,
        unifiedChromeTargets,
        unifiedChromeMissing,
        unifiedChromeUnframed,
        nestedPageCards,
        continuityLaneCount: continuityLane.length,
        continuityLaneSignature,
        continuityLaneHiddenCount,
        continuityLaneInlineResidue,
        surfaceCardCount: surfaceCardTitles.length,
        surfaceCardTitles,
        platformStepCount: platformStepLabels.length,
        platformStepLabels,
        overlaps,
        maxSectionGap: gaps.length > 0 ? Math.max(...gaps.map(value => Math.abs(value))) : 0,
        frameAlignmentMaxDelta,
        studioFooterHandoffGap,
        maxAllowedStudioFooterHandoffGap,
        clippedText,
        wrappedTabs,
        motionBriefingSignature: motionDebug?.briefingSignature || "",
        motionBriefingSectionCount: Array.isArray(motionDebug?.briefingSections)
          ? motionDebug.briefingSections.length
          : 0,
        motionBriefingSections: Array.isArray(motionDebug?.briefingSections)
          ? motionDebug.briefingSections.map(section => ({
              index: section.index,
              sectionId: section.sectionId,
              railLabel: section.railLabel,
              railName: section.railName,
              isActive: section.isActive === true,
            }))
          : [],
        motionActiveBriefingRailLabel: motionDebug?.activeBriefingRailLabel || null,
      };
    })()`,
  ], { timeout: 30_000 });

  if (!continuityState) {
    return;
  }

  const expectedRailLabels = ["01", "02", "03", "04", "05"];
  const expectedContinuityLaneSignature =
    "01:Define:category boundary|02:Publish:public evidence|03:Operate:benchmark workflow|04:Verify:studio inspection|05:Continue:evidence trail";
  const expectedMotionBriefingSignature =
    "01:research:research sequence|02:published:published sequence|03:platform:platform sequence|04:benchmarks:studio sequence|05:subscribe:method handoff sequence";
  const expectedSurfaceCardTitles = ["Research archive", "One evidence chain", "Benchmark studio"];
  const expectedPlatformStepLabels = ["Define", "Publish", "Operate", "Verify"];
  const expectedFrameChildSignatures = [
    "briefing-rail|section-intro|continuity-lane|surface-grid",
    "briefing-rail|section-intro.compact|research-list",
    "briefing-rail|platform-copy|platform-steps",
    "briefing-rail|workbench-frame",
    "briefing-rail|footer-copy|footer-proof-grid",
  ];
  const pageCohesionOk =
    Array.isArray(continuityState.frameChildSignatures) &&
    expectedFrameChildSignatures.every((signature, index) =>
      continuityState.frameChildSignatures[index] === signature
    ) &&
    Array.isArray(continuityState.unifiedChromeMissing) &&
    continuityState.unifiedChromeMissing.length === 0 &&
    Array.isArray(continuityState.unifiedChromeUnframed) &&
    continuityState.unifiedChromeUnframed.length === 0 &&
    Number(continuityState.nestedPageCards) === 0;
  const pageContinuityOk =
    continuityState.overflowX <= 2 &&
    continuityState.frameCounts?.pageContinuum === 1 &&
    continuityState.frameCounts?.sectionFrame === 5 &&
    continuityState.frameCounts?.workbenchFrame === 1 &&
    continuityState.ordered === true &&
    continuityState.sectionCount === 5 &&
    continuityState.railCount === 5 &&
    expectedRailLabels.every((label, index) => continuityState.railLabels?.[index] === label) &&
    continuityState.continuityLaneCount === 5 &&
    continuityState.continuityLaneSignature === expectedContinuityLaneSignature &&
    Number(continuityState.continuityLaneHiddenCount) === 0 &&
    Number(continuityState.continuityLaneInlineResidue) === 0 &&
    continuityState.surfaceCardCount === 3 &&
    expectedSurfaceCardTitles.every((title, index) => continuityState.surfaceCardTitles?.[index] === title) &&
    continuityState.platformStepCount === 4 &&
    expectedPlatformStepLabels.every((step, index) => continuityState.platformStepLabels?.[index] === step) &&
    pageCohesionOk &&
    Number(continuityState.maxSectionGap) <= 2 &&
    Number(continuityState.frameAlignmentMaxDelta) <= 4 &&
    Number(continuityState.studioFooterHandoffGap) <= Number(continuityState.maxAllowedStudioFooterHandoffGap) &&
    continuityState.motionBriefingSignature === expectedMotionBriefingSignature &&
    Number(continuityState.motionBriefingSectionCount) === 5 &&
    continuityState.overlaps?.length === 0 &&
    continuityState.clippedText?.length === 0 &&
    continuityState.wrappedTabs?.length === 0;

  qaReport.pageContinuity.push({
    label: viewport.name,
    expectedMode,
    ok: pageContinuityOk,
    overflowX: continuityState.overflowX ?? null,
    frameCounts: continuityState.frameCounts ?? null,
    ordered: continuityState.ordered === true,
    sectionCount: continuityState.sectionCount ?? null,
    railCount: continuityState.railCount ?? null,
    railLabels: Array.isArray(continuityState.railLabels) ? continuityState.railLabels : [],
    frameChildSignatures: Array.isArray(continuityState.frameChildSignatures)
      ? continuityState.frameChildSignatures
      : [],
    unifiedChromeMissing: Array.isArray(continuityState.unifiedChromeMissing)
      ? continuityState.unifiedChromeMissing
      : [],
    unifiedChromeUnframed: Array.isArray(continuityState.unifiedChromeUnframed)
      ? continuityState.unifiedChromeUnframed
      : [],
    nestedPageCards: continuityState.nestedPageCards ?? null,
    pageCohesionOk,
    continuityLaneCount: continuityState.continuityLaneCount ?? null,
    continuityLaneSignature: continuityState.continuityLaneSignature ?? "",
    continuityLaneHiddenCount: continuityState.continuityLaneHiddenCount ?? null,
    continuityLaneInlineResidue: continuityState.continuityLaneInlineResidue ?? null,
    surfaceCardCount: continuityState.surfaceCardCount ?? null,
    surfaceCardTitles: Array.isArray(continuityState.surfaceCardTitles) ? continuityState.surfaceCardTitles : [],
    platformStepCount: continuityState.platformStepCount ?? null,
    platformStepLabels: Array.isArray(continuityState.platformStepLabels) ? continuityState.platformStepLabels : [],
    overlapCount: continuityState.overlaps?.length ?? 0,
    maxSectionGap: continuityState.maxSectionGap ?? null,
    frameAlignmentMaxDelta: continuityState.frameAlignmentMaxDelta ?? null,
    studioFooterHandoffGap: continuityState.studioFooterHandoffGap ?? null,
    maxAllowedStudioFooterHandoffGap: continuityState.maxAllowedStudioFooterHandoffGap ?? null,
    motionBriefingSignature: continuityState.motionBriefingSignature ?? "",
    motionBriefingSectionCount: continuityState.motionBriefingSectionCount ?? null,
    motionBriefingSections: Array.isArray(continuityState.motionBriefingSections)
      ? continuityState.motionBriefingSections
      : [],
    motionActiveBriefingRailLabel: continuityState.motionActiveBriefingRailLabel ?? null,
    clippedText: Array.isArray(continuityState.clippedText) ? continuityState.clippedText : [],
    wrappedTabs: Array.isArray(continuityState.wrappedTabs) ? continuityState.wrappedTabs : [],
  });

  const label = expectedMode === "reduced" ? `${viewport.name} reduced-motion` : viewport.name;

  if (continuityState.overflowX > 2) {
    failures.push(`[${label}] document has ${continuityState.overflowX}px horizontal overflow`);
  }

  if (continuityState.frameCounts?.pageContinuum !== 1) {
    failures.push(`[${label}] expected one page-continuum`);
  }

  if (continuityState.frameCounts?.sectionFrame !== 5) {
    failures.push(`[${label}] expected five section-frame nodes, got ${continuityState.frameCounts?.sectionFrame}`);
  }

  if (continuityState.frameCounts?.workbenchFrame !== 1) {
    failures.push(`[${label}] expected one workbench-frame`);
  }

  if (!continuityState.ordered) {
    failures.push(`[${label}] page-continuum children are not in the expected narrative order`);
  }

  if (continuityState.sectionCount !== 5 || continuityState.railCount !== 5) {
    failures.push(
      `[${label}] continuous briefing expected five sections and rails, got sections=${
        continuityState.sectionCount ?? "missing"
      }, rails=${continuityState.railCount ?? "missing"}`,
    );
  }

  if (!expectedRailLabels.every((railLabel, index) => continuityState.railLabels?.[index] === railLabel)) {
    failures.push(
      `[${label}] briefing rail labels are not sequential 01-05: ${
        continuityState.railLabels?.join(", ") || "missing"
      }`,
    );
  }

  if (!pageCohesionOk) {
    failures.push(
      `[${label}] lower-page frame cohesion mismatch: children ${
        Array.isArray(continuityState.frameChildSignatures)
          ? continuityState.frameChildSignatures.join(" / ")
          : "missing"
      }; missing chrome ${
        Array.isArray(continuityState.unifiedChromeMissing)
          ? continuityState.unifiedChromeMissing.join(", ")
          : "missing"
      }; unframed chrome ${
        Array.isArray(continuityState.unifiedChromeUnframed)
          ? continuityState.unifiedChromeUnframed.join(", ")
          : "missing"
      }; nested cards ${continuityState.nestedPageCards ?? "missing"}`,
    );
  }

  if (
    continuityState.continuityLaneCount !== 5 ||
    continuityState.continuityLaneSignature !== expectedContinuityLaneSignature ||
    continuityState.continuityLaneHiddenCount !== 0 ||
    continuityState.continuityLaneInlineResidue !== 0
  ) {
    failures.push(
      `[${label}] evidence-flow lane mismatch: count ${
        continuityState.continuityLaneCount ?? "missing"
      }, signature ${continuityState.continuityLaneSignature || "missing"}, hidden ${
        continuityState.continuityLaneHiddenCount ?? "missing"
      }, inlineResidue ${continuityState.continuityLaneInlineResidue ?? "missing"}`,
    );
  }

  if (
    continuityState.surfaceCardCount !== 3 ||
    !expectedSurfaceCardTitles.every((title, index) => continuityState.surfaceCardTitles?.[index] === title)
  ) {
    failures.push(
      `[${label}] surface card sequence mismatch: ${
        Array.isArray(continuityState.surfaceCardTitles) ? continuityState.surfaceCardTitles.join(", ") : "missing"
      }`,
    );
  }

  if (
    continuityState.platformStepCount !== 4 ||
    !expectedPlatformStepLabels.every((step, index) => continuityState.platformStepLabels?.[index] === step)
  ) {
    failures.push(
      `[${label}] platform operating step sequence mismatch: ${
        Array.isArray(continuityState.platformStepLabels) ? continuityState.platformStepLabels.join(", ") : "missing"
      }`,
    );
  }

  if (
    continuityState.motionBriefingSignature !== expectedMotionBriefingSignature ||
    Number(continuityState.motionBriefingSectionCount) !== 5
  ) {
    failures.push(
      `[${label}] GSAP motion debug lost the full-page briefing signature: ${
        continuityState.motionBriefingSignature || "missing"
      }`,
    );
  }

  if (continuityState.overlaps?.length > 0) {
    failures.push(
      `[${label}] page-continuum sections overlap: ${continuityState.overlaps
        .map((item) => item.className)
        .join(", ")}`,
    );
  }

  if (Number(continuityState.maxSectionGap) > 2) {
    failures.push(`[${label}] page-continuum has a ${continuityState.maxSectionGap}px section gap`);
  }

  if (Number(continuityState.frameAlignmentMaxDelta) > 4) {
    failures.push(
      `[${label}] briefing frames are not aligned across sections: delta ${
        continuityState.frameAlignmentMaxDelta
      }px`,
    );
  }

  if (Number(continuityState.studioFooterHandoffGap) > Number(continuityState.maxAllowedStudioFooterHandoffGap)) {
    failures.push(
      `[${label}] Studio to footer handoff gap ${
        continuityState.studioFooterHandoffGap
      }px exceeds ${continuityState.maxAllowedStudioFooterHandoffGap}px`,
    );
  }

  if (continuityState.clippedText?.length > 0) {
    failures.push(`[${label}] text is clipped in compact controls: ${continuityState.clippedText.join(", ")}`);
  }

  if (continuityState.wrappedTabs?.length > 0) {
    failures.push(`[${label}] studio tab labels wrap: ${continuityState.wrappedTabs.join(", ")}`);
  }
}

function checkHeroFirstPaint(viewport, expectedMode) {
  const state = runJson([
    "js",
    `(() => {
      const hero = document.querySelector(".hero-studio");
      const copy = document.querySelector(".hero-copy");
      const h1 = document.querySelector(".hero-copy h1");
      const spans = [...document.querySelectorAll(".hero-copy h1 span")];
      const lane = document.querySelector(".lane-strip");
      const laneChips = [...document.querySelectorAll(".lane-strip span")];
      const translateY = (node) => {
        const transform = getComputedStyle(node).transform;
        if (!transform || transform === "none") return 0;
        const match = transform.match(/matrix\\(([^)]+)\\)/);
        if (!match) return 0;
        const parts = match[1].split(",").map(value => Number.parseFloat(value.trim()));
        return Number.isFinite(parts[5]) ? parts[5] : 0;
      };
      const visibleSpans = spans.filter(node => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.visibility !== "hidden" &&
          Number(style.opacity) >= 0.95 &&
          rect.width > 0 &&
          rect.height > 0;
      });
      const h1Rect = h1?.getBoundingClientRect();
      const copyRect = copy?.getBoundingClientRect();
      const laneRect = lane?.getBoundingClientRect();
      const laneRows = new Set(
        laneChips
          .map(node => Math.round(node.getBoundingClientRect().top))
          .filter(top => Number.isFinite(top)),
      ).size;

      return {
        heroFound: !!hero,
        copyFound: !!copy,
        h1Found: !!h1,
        spanCount: spans.length,
        visibleSpanCount: visibleSpans.length,
        h1Opacity: h1 ? Number(getComputedStyle(h1).opacity) : null,
        h1Visibility: h1 ? getComputedStyle(h1).visibility : null,
        maxSpanTranslateY: spans.length > 0
          ? Math.max(...spans.map(node => Math.abs(translateY(node))))
          : null,
        h1Top: h1Rect ? Math.round(h1Rect.top) : null,
        h1Bottom: h1Rect ? Math.round(h1Rect.bottom) : null,
        h1Height: h1Rect ? Math.round(h1Rect.height) : null,
        copyTop: copyRect ? Math.round(copyRect.top) : null,
        laneFound: !!lane,
        laneChipCount: laneChips.length,
        laneHeight: laneRect ? Math.round(laneRect.height) : null,
        laneRows,
        laneBottom: laneRect ? Math.round(laneRect.bottom) : null,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    })()`,
  ], { timeout: 30_000 });

  if (!state) {
    failures.push(`[${viewport.name} ${expectedMode}] hero first-paint check did not return evidence`);
    return;
  }

  const maxAllowedTranslateY = expectedMode === "normal" ? 32 : 2;
  const maxAllowedMobileLaneHeight = 132;
  const mobileLaneOk =
    Number(state.viewportWidth) > 720 ||
    (
      state.laneFound === true &&
      Number(state.laneChipCount) === 5 &&
      Number(state.laneRows) <= 3 &&
      Number(state.laneHeight) <= maxAllowedMobileLaneHeight &&
      Number(state.laneBottom) <= Number(state.viewportHeight) + 2
    );
  const ok =
    state.heroFound === true &&
    state.copyFound === true &&
    state.h1Found === true &&
    state.spanCount === 4 &&
    state.visibleSpanCount === 4 &&
    state.h1Visibility !== "hidden" &&
    Number(state.h1Opacity) >= 0.95 &&
    Number(state.maxSpanTranslateY) <= maxAllowedTranslateY &&
    Number(state.h1Top) >= -4 &&
    Number(state.h1Top) <= Number(state.viewportHeight) * 0.72 &&
    Number(state.h1Bottom) <= Number(state.viewportHeight) + 4 &&
    Number(state.h1Height) >= 120 &&
    mobileLaneOk;

  qaReport.heroFirstPaint.push({
    label: viewport.name,
    expectedMode,
    ok,
    heroFound: state.heroFound === true,
    copyFound: state.copyFound === true,
    h1Found: state.h1Found === true,
    spanCount: state.spanCount ?? null,
    visibleSpanCount: state.visibleSpanCount ?? null,
    h1Opacity: state.h1Opacity ?? null,
    h1Visibility: state.h1Visibility ?? null,
    maxSpanTranslateY: state.maxSpanTranslateY ?? null,
    maxAllowedTranslateY,
    h1Top: state.h1Top ?? null,
    h1Bottom: state.h1Bottom ?? null,
    h1Height: state.h1Height ?? null,
    copyTop: state.copyTop ?? null,
    laneFound: state.laneFound === true,
    laneChipCount: state.laneChipCount ?? null,
    laneHeight: state.laneHeight ?? null,
    maxAllowedMobileLaneHeight,
    laneRows: state.laneRows ?? null,
    laneBottom: state.laneBottom ?? null,
    viewportHeight: state.viewportHeight ?? null,
    viewportWidth: state.viewportWidth ?? null,
  });

  if (!ok) {
    failures.push(
      `[${viewport.name} ${expectedMode}] hero critical copy is not first-paint visible: spans ${
        state.visibleSpanCount ?? "missing"
      }/${state.spanCount ?? "missing"}, opacity ${
        state.h1Opacity ?? "missing"
      }, visibility ${state.h1Visibility ?? "missing"}, maxTranslateY ${
        state.maxSpanTranslateY ?? "missing"
      }px, top ${state.h1Top ?? "missing"}, bottom ${state.h1Bottom ?? "missing"}`,
    );
  }

  if (!mobileLaneOk) {
    failures.push(
      `[${viewport.name} ${expectedMode}] mobile hero category lane is too tall or incomplete: chips ${
        state.laneChipCount ?? "missing"
      }, rows ${state.laneRows ?? "missing"}, height ${
        state.laneHeight ?? "missing"
      }px, bottom ${state.laneBottom ?? "missing"}, viewport ${state.viewportWidth ?? "missing"}x${
        state.viewportHeight ?? "missing"
      }`,
    );
  }
}

function checkStudioMobileDensity(viewport) {
  const width = Number.parseInt(viewport.size.split("x")[0] ?? "0", 10);
  if (width > 720) {
    return;
  }

  const state = runJson([
    "js",
    `new Promise(resolve => {
      const studio = document.querySelector("#benchmarks");
      const ribbon = document.querySelector(".metric-ribbon");
      const emphasis = document.querySelector(".metric-ribbon article.emphasis");
      const metrics = [...document.querySelectorAll(".metric-ribbon article")];

      if (studio) {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, studio.getBoundingClientRect().top + window.scrollY);
      }

      setTimeout(() => {
        const ribbonRect = ribbon?.getBoundingClientRect();
        const emphasisStyle = emphasis ? getComputedStyle(emphasis) : null;
        const ribbonStyle = ribbon ? getComputedStyle(ribbon) : null;
        const columnCount = ribbonStyle?.gridTemplateColumns
          ?.split(" ")
          .filter(Boolean)
          .length ?? 0;
        const metricRects = metrics.map(metric => metric.getBoundingClientRect());
        const minMetricHeight = metricRects.length
          ? Math.min(...metricRects.map(rect => rect.height))
          : 0;
        const maxMetricHeight = metricRects.length
          ? Math.max(...metricRects.map(rect => rect.height))
          : 0;
        const clippedLabels = metrics.filter(metric => {
          const label = metric.querySelector("span");
          return label && label.scrollWidth - label.clientWidth > 1;
        }).map(metric => metric.textContent?.trim() ?? "");
        const maxAllowedRibbonHeight = 260;
        const ok =
          metrics.length === 5 &&
          columnCount === 2 &&
          emphasisStyle?.gridColumnStart === "1" &&
          (emphasisStyle?.gridColumnEnd === "-1" || emphasisStyle?.gridColumnEnd === "span 2") &&
          Number(ribbonRect?.height) <= maxAllowedRibbonHeight &&
          minMetricHeight >= 66 &&
          clippedLabels.length === 0;

        resolve({
          ok,
          viewportWidth: window.innerWidth,
          metricCount: metrics.length,
          columnCount,
          ribbonHeight: ribbonRect ? Math.round(ribbonRect.height) : null,
          maxAllowedRibbonHeight,
          minMetricHeight: Math.round(minMetricHeight),
          maxMetricHeight: Math.round(maxMetricHeight),
          emphasisGridColumnStart: emphasisStyle?.gridColumnStart ?? null,
          emphasisGridColumnEnd: emphasisStyle?.gridColumnEnd ?? null,
          clippedLabels,
        });
      }, 450);
    })`,
  ], { timeout: 30_000 });

  if (!state) {
    return;
  }

  qaReport.studioMobileDensity.push({
    label: viewport.name,
    ...state,
  });

  if (!state.ok) {
    failures.push(
      `[${viewport.name}] mobile Studio metric ribbon density failed: columns=${
        state.columnCount ?? "missing"
      }, height=${state.ribbonHeight ?? "missing"}, clipped=${state.clippedLabels?.join(", ") || "none"}`,
    );
  }
}

function checkHeroVisualContract(viewport) {
  const expectedVisible = viewport.orbitWillChange > 0;
  const state = runJson([
    "js",
    `(() => {
      const copy = document.querySelector(".hero-copy");
      const visual = document.querySelector(".hero-visual");
      const copyRect = copy?.getBoundingClientRect();
      const visualRect = visual?.getBoundingClientRect();
      const visualStyle = visual ? getComputedStyle(visual) : null;
      const copyStyle = copy ? getComputedStyle(copy) : null;
      const visualVisible = !!visual && visualStyle.display !== "none" &&
        visualStyle.visibility !== "hidden" &&
        Number(visualStyle.opacity) !== 0 &&
        visualRect.width > 0 &&
        visualRect.height > 0;
      const xOverlap = copyRect && visualRect && visualVisible
        ? Math.max(0, Math.min(copyRect.right, visualRect.right) - Math.max(copyRect.left, visualRect.left))
        : 0;
      const yOverlap = copyRect && visualRect && visualVisible
        ? Math.max(0, Math.min(copyRect.bottom, visualRect.bottom) - Math.max(copyRect.top, visualRect.top))
        : 0;
      const gap = copyRect && visualRect && visualVisible
        ? Math.round(visualRect.left - copyRect.right)
        : null;

      return {
        copyFound: !!copy,
        visualFound: !!visual,
        visualDisplay: visualStyle?.display ?? null,
        visualVisibility: visualStyle?.visibility ?? null,
        visualOpacity: visualStyle?.opacity ?? null,
        visualVisible,
        copyWidth: copyRect ? Math.round(copyRect.width) : null,
        visualWidth: visualRect ? Math.round(visualRect.width) : null,
        gap,
        xOverlap: Math.round(xOverlap),
        yOverlap: Math.round(yOverlap),
        viewportWidth: window.innerWidth,
        copyPosition: copyStyle?.position ?? null,
      };
    })()`,
  ], { timeout: 30_000 });

  if (!state) {
    return;
  }

  const ok =
    state.copyFound === true &&
    state.visualFound === true &&
    (expectedVisible
      ? state.visualVisible === true && Number(state.gap) >= 18 && state.xOverlap <= 8
      : state.visualVisible === false && state.visualDisplay === "none");

  qaReport.heroVisualContract.push({
    viewport: viewport.name,
    viewportWidth: state.viewportWidth,
    expectedVisible,
    ok,
    visualVisible: state.visualVisible === true,
    visualDisplay: state.visualDisplay,
    gap: state.gap,
    xOverlap: state.xOverlap,
    yOverlap: state.yOverlap,
    copyWidth: state.copyWidth,
    visualWidth: state.visualWidth,
  });

  if (!state.copyFound || !state.visualFound) {
    failures.push(`[${viewport.name}] hero visual contract missing hero-copy or hero-visual node`);
    return;
  }

  if (expectedVisible && !state.visualVisible) {
    failures.push(`[${viewport.name}] hero visual contract expected visible hero visual`);
  }

  if (!expectedVisible && state.visualVisible) {
    failures.push(`[${viewport.name}] hero visual contract expected hidden hero visual`);
  }

  if (!expectedVisible && state.visualDisplay !== "none") {
    failures.push(
      `[${viewport.name}] hero visual contract expected display none below desktop breakpoint, got ${state.visualDisplay}`,
    );
  }

  if (expectedVisible && Number(state.gap) < 18) {
    failures.push(`[${viewport.name}] hero visual contract gap too tight: ${state.gap}px`);
  }

  if (expectedVisible && state.xOverlap > 8 && state.yOverlap > 8) {
    failures.push(
      `[${viewport.name}] hero visual contract overlaps copy: ${state.xOverlap}x${state.yOverlap}`,
    );
  }
}

function checkOrbitPausePlayback(viewport) {
  if (viewport.orbitWillChange === 0) {
    return;
  }

  const orbitState = runJson([
    "js",
    `new Promise(resolve => {
      const orbits = [...document.querySelectorAll(".orbit-outer, .orbit-mid")];
      const hero = document.querySelector(".hero-studio");

      if (orbits.length !== 2 || !hero) {
        resolve({ ok: false, reason: "missing-orbit-or-hero" });
        return;
      }

      const transforms = () => orbits.map(node => getComputedStyle(node).transform);
      const inspectMotion = () => {
        const debug = typeof window.__memoryBenchMotionInspect === "function"
          ? window.__memoryBenchMotionInspect()
          : window.__memoryBenchMotion || null;
        return debug?.orbitPlayback || null;
      };
      const sameTransforms = (a, b) =>
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((value, index) => value === b[index]);

      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);

      setTimeout(() => {
        const visibleA = transforms();
        setTimeout(() => {
          const visibleB = transforms();
          const visibleInspect = inspectMotion();
          const heroBottom = hero.getBoundingClientRect().bottom + window.scrollY;
          window.scrollTo(0, Math.max(0, Math.round(heroBottom + 240)));

          setTimeout(() => {
            const hiddenA = transforms();
            setTimeout(() => {
              const hiddenB = transforms();
              const hiddenInspect = inspectMotion();
              window.scrollTo(0, 0);

              setTimeout(() => {
                const resumedA = transforms();
                setTimeout(() => {
                  const resumedB = transforms();
                  const resumedInspect = inspectMotion();
                  const visibleInspectorPlaying =
                    visibleInspect?.available === true &&
                    visibleInspect?.observerAttached === true &&
                    visibleInspect?.heroInView === true &&
                    visibleInspect?.shouldPlay === true &&
                    Number(visibleInspect?.tweenCount) === 2 &&
                    Number(visibleInspect?.activeTweenCount) === 2 &&
                    Number(visibleInspect?.pausedTweenCount) === 0;
                  const offscreenInspectorPaused =
                    hiddenInspect?.available === true &&
                    hiddenInspect?.observerAttached === true &&
                    hiddenInspect?.heroInView === false &&
                    hiddenInspect?.shouldPlay === false &&
                    Number(hiddenInspect?.tweenCount) === 2 &&
                    Number(hiddenInspect?.pausedTweenCount) === 2;
                  const resumedInspectorPlaying =
                    resumedInspect?.available === true &&
                    resumedInspect?.observerAttached === true &&
                    resumedInspect?.heroInView === true &&
                    resumedInspect?.shouldPlay === true &&
                    Number(resumedInspect?.tweenCount) === 2 &&
                    Number(resumedInspect?.activeTweenCount) === 2 &&
                    Number(resumedInspect?.pausedTweenCount) === 0;
                  resolve({
                    ok: true,
                    orbitCount: orbits.length,
                    visibleChanged: !sameTransforms(visibleA, visibleB),
                    offscreenPaused: sameTransforms(hiddenA, hiddenB),
                    resumedChanged: !sameTransforms(resumedA, resumedB),
                    visibleInspectorPlaying,
                    offscreenInspectorPaused,
                    resumedInspectorPlaying,
                    visibleInspect,
                    hiddenInspect,
                    resumedInspect,
                    visibleA,
                    visibleB,
                    hiddenA,
                    hiddenB,
                    resumedA,
                    resumedB,
                  });
                }, 360);
              }, 650);
            }, 420);
          }, 700);
        }, 360);
      }, 700);
    })`,
  ], { timeout: 30_000 });

  if (!orbitState) {
    return;
  }

  qaReport.motionPlayback.push({
    viewport: viewport.name,
    orbitCount: orbitState.orbitCount ?? 0,
    visibleChanged: orbitState.visibleChanged === true,
    offscreenPaused: orbitState.offscreenPaused === true,
    resumedChanged: orbitState.resumedChanged === true,
    visibleInspectorPlaying: orbitState.visibleInspectorPlaying === true,
    offscreenInspectorPaused: orbitState.offscreenInspectorPaused === true,
    resumedInspectorPlaying: orbitState.resumedInspectorPlaying === true,
    visibleInspect: orbitState.visibleInspect ?? null,
    hiddenInspect: orbitState.hiddenInspect ?? null,
    resumedInspect: orbitState.resumedInspect ?? null,
    ok: orbitState.ok === true,
    reason: orbitState.reason ?? null,
  });

  if (!orbitState.ok) {
    failures.push(`[${viewport.name}] orbit playback check failed: ${orbitState.reason ?? "unknown"}`);
    return;
  }

  if (!orbitState.visibleChanged) {
    failures.push(`[${viewport.name}] desktop orbit did not animate while hero was visible`);
  }

  if (!orbitState.offscreenPaused) {
    failures.push(`[${viewport.name}] orbit playback did not pause off-screen`);
  }

  if (!orbitState.resumedChanged) {
    failures.push(`[${viewport.name}] orbit playback did not resume on hero return`);
  }

  if (!orbitState.visibleInspectorPlaying) {
    failures.push(`[${viewport.name}] orbit inspector did not report visible playback`);
  }

  if (!orbitState.offscreenInspectorPaused) {
    failures.push(`[${viewport.name}] orbit inspector did not report off-screen paused playback`);
  }

  if (!orbitState.resumedInspectorPlaying) {
    failures.push(`[${viewport.name}] orbit inspector did not report resumed playback`);
  }
}

function checkBriefingRailSequence(viewport) {
  const railSequence = runJson([
    "js",
    `new Promise(resolve => {
      const sections = [
        { id: "research", section: "research", expectedRail: "research sequence", expectedNavHref: "#research" },
        { id: "published", section: "published", expectedRail: "published sequence", expectedNavHref: "#research" },
        { id: "platform", section: "platform", expectedRail: "platform sequence", expectedNavHref: "#research" },
        { id: "benchmarks", section: "studio", expectedRail: "studio sequence", expectedNavHref: "#benchmarks" },
        { id: "subscribe", section: "footer", expectedRail: "method handoff sequence", expectedNavHref: "#evidence" },
      ];
      const samples = [];
      let index = 0;

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";

      const sampleNext = () => {
        const item = sections[index];
        const target = document.getElementById(item.id);

        if (!target) {
          samples.push({
            ...item,
            targetFound: false,
            ok: false,
            activeRailCount: 0,
            targetRailActive: false,
            activeRailLabels: [],
          });
          index += 1;
          if (index >= sections.length) {
            resolve(samples);
          } else {
            sampleNext();
          }
          return;
        }

        target.scrollIntoView({ block: "start" });
        window.dispatchEvent(new Event("scroll"));

        setTimeout(() => {
          const activeRails = [...document.querySelectorAll(".briefing-rail.is-scroll-active")];
          const currentRails = [...document.querySelectorAll('.briefing-rail[aria-current="step"]')];
          const targetRail = target.querySelector(".briefing-rail");
          const activeRailLabels = activeRails.map((rail) => rail.getAttribute("aria-label") ?? "");
          const currentRailLabels = currentRails.map((rail) => rail.getAttribute("aria-label") ?? "");
          const currentNavigationLinks = [...document.querySelectorAll('.top-rail nav a[aria-current="page"]')];
          const currentNavHrefs = currentNavigationLinks.map((link) => link.getAttribute("href") ?? "");
          const rect = target.getBoundingClientRect();
          const navOk = currentNavigationLinks.length === 1 && currentNavHrefs[0] === item.expectedNavHref;

          samples.push({
            ...item,
            targetFound: true,
            targetTop: Math.round(rect.top),
            targetBottom: Math.round(rect.bottom),
            activeRailCount: activeRails.length,
            currentRailCount: currentRails.length,
            targetRailActive: targetRail?.classList.contains("is-scroll-active") ?? false,
            targetRailCurrent: targetRail?.getAttribute("aria-current") === "step",
            activeRailLabels,
            currentRailLabels,
            currentNavCount: currentNavigationLinks.length,
            currentNavHrefs,
            navOk,
            ok:
              activeRails.length === 1 &&
              currentRails.length === 1 &&
              targetRail?.classList.contains("is-scroll-active") === true &&
              targetRail?.getAttribute("aria-current") === "step" &&
              activeRailLabels.includes(item.expectedRail) &&
              currentRailLabels.includes(item.expectedRail) &&
              navOk,
          });

          index += 1;
          if (index >= sections.length) {
            resolve(samples);
          } else {
            sampleNext();
          }
        }, 420);
      };

      sampleNext();
    })`,
  ], { timeout: 30_000 });

  if (!Array.isArray(railSequence)) {
    failures.push(`[${viewport.name}] briefing rail sequence check did not return samples`);
    return;
  }

  for (const sample of railSequence) {
    qaReport.scrollTriggerRail.push({
      label: viewport.name,
      section: sample.section,
      ok: sample.ok === true,
      activeRailCount: sample.activeRailCount ?? null,
      currentRailCount: sample.currentRailCount ?? null,
      targetRailActive: sample.targetRailActive === true,
      targetRailCurrent: sample.targetRailCurrent === true,
      expectedRail: sample.expectedRail ?? null,
      activeRailLabels: Array.isArray(sample.activeRailLabels) ? sample.activeRailLabels : [],
      currentRailLabels: Array.isArray(sample.currentRailLabels) ? sample.currentRailLabels : [],
    });
    qaReport.topNavigationCurrent.push({
      label: viewport.name,
      section: sample.section,
      ok: sample.navOk === true,
      expectedHref: sample.expectedNavHref ?? null,
      currentCount: sample.currentNavCount ?? null,
      currentHrefs: Array.isArray(sample.currentNavHrefs) ? sample.currentNavHrefs : [],
    });

    if (sample.ok !== true) {
      failures.push(
        `[${viewport.name}] ScrollTrigger did not activate the briefing rail for ${
          sample.section ?? "unknown"
        }; active rails: ${
          Array.isArray(sample.activeRailLabels) && sample.activeRailLabels.length > 0
            ? sample.activeRailLabels.join(", ")
            : "none"
        }; current nav: ${
          Array.isArray(sample.currentNavHrefs) && sample.currentNavHrefs.length > 0
            ? sample.currentNavHrefs.join(", ")
            : "none"
        }`,
      );
    }
  }
}

function checkBriefingRailSweep(viewport) {
  const sweep = runJson([
    "js",
    `new Promise(resolve => {
      const start = document.getElementById("research");
      const end = document.getElementById("subscribe");

      if (!start || !end) {
        resolve({ ok: false, reason: "missing-briefing-boundary", sampleCount: 0 });
        return;
      }

      const startY = Math.max(0, Math.round(start.getBoundingClientRect().top + window.scrollY));
      const endY = Math.max(
        startY,
        Math.round(end.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.4),
      );
      const sampleCount = 15;
      const samples = [];
      let index = 0;

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";

      const sampleNext = () => {
        const progress = sampleCount === 1 ? 0 : index / (sampleCount - 1);
        const y = Math.round(startY + (endY - startY) * progress);
        window.scrollTo(0, y);
        window.dispatchEvent(new Event("scroll"));

        setTimeout(() => {
          const activeRailLabels = [...document.querySelectorAll(".briefing-rail.is-scroll-active")]
            .map((rail) => rail.getAttribute("aria-label") ?? "");
          const currentRailLabels = [...document.querySelectorAll('.briefing-rail[aria-current="step"]')]
            .map((rail) => rail.getAttribute("aria-label") ?? "");
          const activeSet = activeRailLabels.join("|");
          const currentSet = currentRailLabels.join("|");

          samples.push({
            y: Math.round(window.scrollY),
            activeRailCount: activeRailLabels.length,
            currentRailCount: currentRailLabels.length,
            activeRailLabels,
            currentRailLabels,
            mismatch: activeSet !== currentSet,
          });

          index += 1;
          if (index >= sampleCount) {
            const maxActiveRailCount = samples.reduce((max, sample) => Math.max(max, sample.activeRailCount), 0);
            const maxCurrentRailCount = samples.reduce((max, sample) => Math.max(max, sample.currentRailCount), 0);
            const mismatchCount = samples.filter((sample) => sample.mismatch).length;
            resolve({
              ok: maxActiveRailCount <= 1 && maxCurrentRailCount <= 1 && mismatchCount === 0,
              sampleCount: samples.length,
              maxActiveRailCount,
              maxCurrentRailCount,
              mismatchCount,
              samples,
            });
          } else {
            sampleNext();
          }
        }, 90);
      };

      sampleNext();
    })`,
  ], { timeout: 30_000 });

  if (!sweep) {
    failures.push(`[${viewport.name}] briefing rail sweep check did not return evidence`);
    return;
  }

  qaReport.scrollTriggerRailSweep.push({
    label: viewport.name,
    ok: sweep.ok === true,
    sampleCount: sweep.sampleCount ?? 0,
    maxActiveRailCount: sweep.maxActiveRailCount ?? null,
    maxCurrentRailCount: sweep.maxCurrentRailCount ?? null,
    mismatchCount: sweep.mismatchCount ?? null,
  });

  if (sweep.ok !== true) {
    failures.push(
      `[${viewport.name}] briefing rail sweep found duplicate or mismatched active/current state: maxActive=${
        sweep.maxActiveRailCount ?? "missing"
      }, maxCurrent=${sweep.maxCurrentRailCount ?? "missing"}, mismatches=${sweep.mismatchCount ?? "missing"}`,
    );
  }
}

function checkReadingProgress(viewport) {
  const progress = runJson([
    "js",
    `new Promise(resolve => {
      const bar = document.querySelector(".reading-progress span");
      const continuum = document.querySelector(".page-continuum");

      if (!bar || !continuum) {
        resolve({ ok: false, reason: "missing-reading-progress", samples: [] });
        return;
      }

      const scaleX = () => {
        const transform = getComputedStyle(bar).transform;
        if (!transform || transform === "none") return 1;
        const match = transform.match(/matrix\\(([^,]+)/);
        return match ? Number(match[1]) : 0;
      };
      const startY = Math.max(0, Math.round(continuum.getBoundingClientRect().top + window.scrollY));
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const endY = Math.min(maxY, Math.max(startY, Math.round(continuum.getBoundingClientRect().bottom + window.scrollY - window.innerHeight)));
      const positions = [
        { label: "start", y: startY },
        { label: "middle", y: Math.round(startY + (endY - startY) * 0.5) },
        { label: "end", y: endY },
      ];
      const samples = [];
      let index = 0;

      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";

      const sampleNext = () => {
        const position = positions[index];
        window.scrollTo(0, position.y);
        window.dispatchEvent(new Event("scroll"));

        setTimeout(() => {
          samples.push({
            ...position,
            actualY: Math.round(window.scrollY),
            scaleX: Number(scaleX().toFixed(4)),
            inlineTransform: bar.style.transform || "",
            willChange: getComputedStyle(bar).willChange,
          });

          index += 1;
          if (index >= positions.length) {
            const start = samples[0]?.scaleX ?? 1;
            const middle = samples[1]?.scaleX ?? 0;
            const end = samples[2]?.scaleX ?? 0;
            resolve({
              ok: start <= 0.08 && middle > start + 0.2 && end > middle + 0.2 && end <= 1.02,
              start,
              middle,
              end,
              samples,
            });
          } else {
            sampleNext();
          }
        }, 260);
      };

      sampleNext();
    })`,
  ], { timeout: 30_000 });

  if (!progress) {
    failures.push(`[${viewport.name}] reading progress check did not return a result`);
    return;
  }

  qaReport.readingProgress.push({
    label: viewport.name,
    ok: progress.ok === true,
    start: progress.start ?? null,
    middle: progress.middle ?? null,
    end: progress.end ?? null,
    samples: Array.isArray(progress.samples) ? progress.samples : [],
  });

  if (progress.ok !== true) {
    failures.push(
      `[${viewport.name}] reading progress did not advance monotonically from page start to footer: start=${
        progress.start ?? "missing"
      }, middle=${progress.middle ?? "missing"}, end=${progress.end ?? "missing"}`,
    );
  }
}

function checkScrollTriggerInventory(viewport, expectedMode) {
  const inventory = runJson([
    "js",
    `(() => {
      const debug = typeof window.__memoryBenchMotionInspect === "function"
        ? window.__memoryBenchMotionInspect()
        : window.__memoryBenchMotion || null;
      const liveMarkerCount = document.querySelectorAll(
        ".gsap-marker-start, .gsap-marker-end, .gsap-marker-scroller-start, .gsap-marker-scroller-end"
      ).length;
      const livePinSpacerCount = document.querySelectorAll(".pin-spacer").length;

      if (!debug) {
        return {
          hasDebug: false,
          mode: "",
          reducedMotionSource: "",
          triggerIds: [],
          railTriggerIds: [],
          readingProgressTriggerIds: [],
          markerCount: liveMarkerCount,
          pinSpacerCount: livePinSpacerCount,
          pinnedCount: livePinSpacerCount,
          scrubbedIds: [],
          duplicateIds: [],
        };
      }

      return {
        hasDebug: true,
        mode: debug.mode,
        reducedMotionSource: debug.reducedMotionSource || "",
        triggerIds: Array.isArray(debug.triggerIds) ? debug.triggerIds : [],
        railTriggerIds: Array.isArray(debug.railTriggerIds) ? debug.railTriggerIds : [],
        readingProgressTriggerIds: Array.isArray(debug.readingProgressTriggerIds)
          ? debug.readingProgressTriggerIds
          : [],
        markerCount: Math.max(Number(debug.markerCount) || 0, liveMarkerCount),
        pinSpacerCount: Math.max(Number(debug.pinSpacerCount) || 0, livePinSpacerCount),
        pinnedCount: Math.max(Number(debug.pinnedCount) || 0, livePinSpacerCount),
        scrubbedIds: Array.isArray(debug.scrubbedIds) ? debug.scrubbedIds : [],
        duplicateIds: Array.isArray(debug.duplicateIds) ? debug.duplicateIds : [],
      };
    })()`,
  ], { timeout: 30_000 });

  if (!inventory) {
    failures.push(`[${viewport.name} ${expectedMode}] ScrollTrigger inventory check did not return evidence`);
    return;
  }

  const expectedRailIds = Array.from({ length: 5 }, (_, index) => `memorybench-rail-${index}`);
  const sortedRailIds = [...inventory.railTriggerIds].sort();
  const sortedScrubbedIds = [...inventory.scrubbedIds].sort();
  const expectedReducedMotionSource = expectedMode === "normal" ? "none" : "override";
  const normalOk =
    expectedMode === "normal" &&
    inventory.hasDebug === true &&
    inventory.mode === "normal" &&
    inventory.reducedMotionSource === expectedReducedMotionSource &&
    inventory.triggerIds.length === 6 &&
    sortedRailIds.length === 5 &&
    expectedRailIds.every((id, index) => sortedRailIds[index] === id) &&
    inventory.readingProgressTriggerIds.length === 1 &&
    inventory.readingProgressTriggerIds[0] === "memorybench-reading-progress" &&
    inventory.duplicateIds.length === 0 &&
    inventory.markerCount === 0 &&
    inventory.pinSpacerCount === 0 &&
    inventory.pinnedCount === 0 &&
    sortedScrubbedIds.length === 1 &&
    sortedScrubbedIds[0] === "memorybench-reading-progress";
  const reducedOk =
    expectedMode === "reduced" &&
    inventory.hasDebug === true &&
    inventory.mode === "reduced" &&
    inventory.reducedMotionSource === expectedReducedMotionSource &&
    inventory.triggerIds.length === 0 &&
    inventory.railTriggerIds.length === 0 &&
    inventory.readingProgressTriggerIds.length === 0 &&
    inventory.duplicateIds.length === 0 &&
    inventory.markerCount === 0 &&
    inventory.pinSpacerCount === 0 &&
    inventory.pinnedCount === 0 &&
    inventory.scrubbedIds.length === 0;
  const ok = normalOk || reducedOk;

  qaReport.scrollTriggerInventory.push({
    label: viewport.name,
    expectedMode,
    ok,
    hasDebug: inventory.hasDebug === true,
    mode: inventory.mode ?? "",
    reducedMotionSource: inventory.reducedMotionSource ?? "",
    expectedReducedMotionSource,
    triggerIds: inventory.triggerIds,
    railTriggerIds: inventory.railTriggerIds,
    readingProgressTriggerIds: inventory.readingProgressTriggerIds,
    markerCount: inventory.markerCount ?? null,
    pinSpacerCount: inventory.pinSpacerCount ?? null,
    pinnedCount: inventory.pinnedCount ?? null,
    scrubbedIds: inventory.scrubbedIds,
    duplicateIds: inventory.duplicateIds,
  });

  if (!ok) {
    failures.push(
      `[${viewport.name} ${expectedMode}] ScrollTrigger inventory is invalid: mode=${
        inventory.mode || "missing"
      }, reducedSource=${
        inventory.reducedMotionSource || "missing"
      }, triggers=${inventory.triggerIds.length}, rails=${inventory.railTriggerIds.length}, reading=${
        inventory.readingProgressTriggerIds.length
      }, markers=${inventory.markerCount}, pins=${inventory.pinnedCount}, scrubbed=${
        inventory.scrubbedIds.join(", ") || "none"
      }, duplicates=${inventory.duplicateIds.join(", ") || "none"}`,
    );
  }
}

function checkGsapAnimationInventory(viewport, expectedMode) {
  const inventory = runJson([
    "js",
    `(() => {
      const debug = typeof window.__memoryBenchMotionInspect === "function"
        ? window.__memoryBenchMotionInspect()
        : window.__memoryBenchMotion || null;
      const animations = debug?.animations || null;

      return {
        hasDebug: !!debug,
        mode: debug?.mode || "",
        reducedMotionSource: debug?.reducedMotionSource || "",
        introTimelineLabels: Array.isArray(debug?.introTimelineLabels)
          ? debug.introTimelineLabels
          : [],
        animationCount: Number(animations?.animationCount) || 0,
        activeCount: Number(animations?.activeCount) || 0,
        repeatCount: Number(animations?.repeatCount) || 0,
        activeRepeatCount: Number(animations?.activeRepeatCount) || 0,
        pausedRepeatCount: Number(animations?.pausedRepeatCount) || 0,
        orbitRepeatCount: Number(animations?.orbitRepeatCount) || 0,
        nonOrbitRepeatCount: Number(animations?.nonOrbitRepeatCount) || 0,
        activeTargetLabels: Array.isArray(animations?.activeTargetLabels)
          ? animations.activeTargetLabels
          : [],
        repeatTargetLabels: Array.isArray(animations?.repeatTargetLabels)
          ? animations.repeatTargetLabels
          : [],
      };
    })()`,
  ], { timeout: 30_000 });

  if (!inventory) {
    failures.push(`[${viewport.name} ${expectedMode}] GSAP animation inventory check did not return evidence`);
    return;
  }

  const expectedOrbitRepeats = expectedMode === "normal" ? viewport.orbitWillChange : 0;
  const expectedReducedMotionSource = expectedMode === "normal" ? "none" : "override";
  const expectedTimelineLabels =
    expectedMode === "normal"
      ? viewport.orbitWillChange > 0
        ? ["navigation", "heroCopy", "contentReveal", "heroVisual"]
        : ["navigation", "heroCopy", "contentReveal"]
      : [];
  const timelineLabelsMatch =
    inventory.introTimelineLabels.length === expectedTimelineLabels.length &&
    expectedTimelineLabels.every((label) => inventory.introTimelineLabels.includes(label));
  const ok =
    inventory.hasDebug === true &&
    inventory.mode === expectedMode &&
    inventory.reducedMotionSource === expectedReducedMotionSource &&
    timelineLabelsMatch &&
    inventory.repeatCount === expectedOrbitRepeats &&
    inventory.orbitRepeatCount === expectedOrbitRepeats &&
    inventory.nonOrbitRepeatCount === 0 &&
    inventory.activeRepeatCount === expectedOrbitRepeats &&
    inventory.pausedRepeatCount === 0 &&
    inventory.activeCount === expectedOrbitRepeats;

  qaReport.gsapAnimationInventory.push({
    label: viewport.name,
    expectedMode,
    ok,
    hasDebug: inventory.hasDebug === true,
    mode: inventory.mode,
    reducedMotionSource: inventory.reducedMotionSource,
    expectedReducedMotionSource,
    introTimelineLabels: inventory.introTimelineLabels,
    expectedTimelineLabels,
    animationCount: inventory.animationCount,
    activeCount: inventory.activeCount,
    repeatCount: inventory.repeatCount,
    activeRepeatCount: inventory.activeRepeatCount,
    pausedRepeatCount: inventory.pausedRepeatCount,
    orbitRepeatCount: inventory.orbitRepeatCount,
    nonOrbitRepeatCount: inventory.nonOrbitRepeatCount,
    activeTargetLabels: inventory.activeTargetLabels,
    repeatTargetLabels: inventory.repeatTargetLabels,
  });

  if (!ok) {
    failures.push(
      `[${viewport.name} ${expectedMode}] GSAP animation inventory is invalid: mode=${
        inventory.mode || "missing"
      }, reducedSource=${
        inventory.reducedMotionSource || "missing"
      }, active=${inventory.activeCount}, repeats=${inventory.repeatCount}, activeRepeats=${
        inventory.activeRepeatCount
      }, pausedRepeats=${inventory.pausedRepeatCount}, orbitRepeats=${
        inventory.orbitRepeatCount
      }, nonOrbitRepeats=${inventory.nonOrbitRepeatCount}, labels=${
        inventory.introTimelineLabels.join(", ") || "none"
      }, expectedLabels=${expectedTimelineLabels.join(", ") || "none"}, repeatTargets=${
        inventory.repeatTargetLabels.join(", ") || "none"
      }`,
    );
  }
}

function checkMatrixUsability(viewport) {
  runBrowse(["click", '#studio-tab-matrix'], { timeout: 30_000 });
  sleep(650);

  const matrixState = runJson([
    "js",
    `(() => {
      const scroll = document.querySelector(".matrix-scroll");
      const firstBodyHeader = document.querySelector("tbody th");
      const firstHeadHeader = document.querySelector("thead th");
      const scrollRect = scroll?.getBoundingClientRect();
      const bodyStyle = firstBodyHeader ? getComputedStyle(firstBodyHeader) : null;
      const headStyle = firstHeadHeader ? getComputedStyle(firstHeadHeader) : null;
      const activeTab = document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim() || "";

      return {
        activeTab,
        tableExists: !!document.querySelector(".matrix-workbench table"),
        rowCount: document.querySelectorAll(".matrix-workbench tbody tr").length,
        scrollFound: !!scroll,
        clientWidth: scroll ? Math.round(scroll.clientWidth) : 0,
        scrollWidth: scroll ? Math.round(scroll.scrollWidth) : 0,
        scrollLeft: scroll ? Math.round(scroll.scrollLeft) : 0,
        visibleWidth: scrollRect ? Math.round(scrollRect.width) : 0,
        firstColumnSticky: bodyStyle?.position === "sticky" && bodyStyle?.left === "0px",
        firstHeaderSticky: headStyle?.position === "sticky" && headStyle?.left === "0px",
        documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`,
  ], { timeout: 30_000 });

  if (!matrixState) {
    return;
  }

  if (matrixState.activeTab !== "Capability matrix") {
    failures.push(`[${viewport.name}] matrix usability check did not activate Capability matrix`);
  }

  if (!matrixState.tableExists || matrixState.rowCount !== 11) {
    failures.push(`[${viewport.name}] matrix table expected 11 system rows, got ${matrixState.rowCount ?? "missing"}`);
  }

  if (!matrixState.scrollFound || matrixState.scrollWidth <= matrixState.clientWidth) {
    failures.push(`[${viewport.name}] matrix table is not horizontally scrollable inside its own container`);
  }

  if (!matrixState.firstColumnSticky || !matrixState.firstHeaderSticky) {
    failures.push(`[${viewport.name}] matrix first column is not sticky for horizontal scanning`);
  }

  if (matrixState.documentOverflowX > 2) {
    failures.push(`[${viewport.name}] matrix interaction caused ${matrixState.documentOverflowX}px document overflow`);
  }

  runBrowse(["click", '#studio-tab-map'], { timeout: 30_000 });
  sleep(350);
}

if (!existsSync(browseBin)) {
  console.error(`gstack browse binary not found: ${browseBin}`);
  process.exit(1);
}

let releaseBrowseLock = () => {};
let browseLockReleased = false;

function releaseBrowseLockOnce() {
  if (browseLockReleased) {
    return;
  }

  browseLockReleased = true;
  releaseBrowseLock();
}

for (const [signal, exitCode] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
  ["SIGHUP", 129],
]) {
  process.once(signal, () => {
    releaseBrowseLockOnce();
    process.exit(exitCode);
  });
}

try {
  releaseBrowseLock = acquireBrowseLock();
  mkdirSync(screenshotDir, { recursive: true });
  const reducedMotionUrl = withSearchParam(targetUrl, "motion", "reduce");

  await runMediaReducedMotionQa();
  await runDynamicReducedMotionLifecycleQa();
  checkResponsiveMotionLifecycle();
  checkMountLifecycle();

  for (const viewport of viewports) {
    runBrowse(["viewport", viewport.size]);
    runBrowse(["console", "--clear"]);
    clearNetwork(viewport.name);
    runBrowse(["goto", targetUrl]);
    runBrowse(["wait", "--load"]);
    checkHeroFirstPaint(viewport, "normal");

    const footerRevealEarlyState = runJson([
      "js",
      `(() => {
        const selectors = [".footer-proof-grid article", ".footer-actions a"];
        return selectors.map(selector => {
          const nodes = [...document.querySelectorAll(selector)];
          return {
            selector,
            count: nodes.length,
            hidden: nodes.filter(node => {
              const style = getComputedStyle(node);
              return style.opacity === "0" || style.visibility === "hidden";
            }).length,
            willChange: nodes.filter(node => getComputedStyle(node).willChange !== "auto").length,
            inlineResidue: nodes.filter(node =>
              node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange
            ).length,
          };
        });
      })()`,
    ], { timeout: 30_000 });

    if (Array.isArray(footerRevealEarlyState) && viewport.orbitWillChange > 0) {
      for (const item of footerRevealEarlyState) {
        if (item.count === 0) {
          failures.push(`[${viewport.name}] early footer reveal target ${item.selector} matched no nodes`);
        }

        if (item.hidden === 0 && item.willChange === 0 && item.inlineResidue === 0) {
          failures.push(`[${viewport.name}] early footer reveal target ${item.selector} did not enter the GSAP reveal state`);
        }
      }
    }

    runPerf(viewport.name);

    const motionState = runJson([
      "js",
      `new Promise(resolve => setTimeout(resolve, 2500)).then(() => {
        const selectors = [
          ".top-rail",
          ".hero-copy h1 span",
          ".hero-actions a",
          ".lane-strip span",
          ".hero-visual",
          ".orbit",
          ".section-intro > *",
          ".continuity-lane article",
          ".surface-grid article",
          ".research-list article",
          ".platform-copy > *",
          ".platform-steps article",
          ".workbench-head > *",
          ".studio-controls",
          ".metric-ribbon article",
          ".footer-proof-grid article",
          ".footer-actions a",
          ".primary-lab > *",
          ".dossier-panel",
          ".meter i",
        ];

        return selectors.map(selector => {
          const nodes = [...document.querySelectorAll(selector)];
          return {
            selector,
            count: nodes.length,
            hidden: nodes.filter(node => {
              const style = getComputedStyle(node);
              return style.opacity === "0" || style.visibility === "hidden";
            }).length,
            willChange: nodes.filter(node => getComputedStyle(node).willChange !== "auto").length,
            inlineResidue: nodes.filter(node => {
              return node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange;
            }).length,
            stickyPosition: nodes.filter(node => {
              const position = getComputedStyle(node).position;
              return position === "sticky" || position === "fixed";
            }).length,
          };
        });
      })`,
    ], { timeout: 45_000 });

    if (Array.isArray(motionState)) {
      for (const item of motionState) {
        if (item.count === 0) {
          failures.push(`[${viewport.name}] ${item.selector} matched no nodes`);
        }

        if (item.hidden !== 0) {
          failures.push(
            `[${viewport.name}] ${item.selector} has ${item.hidden} hidden node(s) after animation settle`,
          );
        }

        const expectedWillChange = item.selector === ".orbit" ? viewport.orbitWillChange : 0;
        if (item.willChange !== expectedWillChange) {
          failures.push(
            `[${viewport.name}] ${item.selector} has ${item.willChange} will-change node(s), expected ${expectedWillChange}`,
          );
        }

        const expectedInlineResidue = item.selector === ".orbit" ? viewport.orbitWillChange : 0;
        if (item.inlineResidue !== expectedInlineResidue) {
          failures.push(
            `[${viewport.name}] ${item.selector} has ${item.inlineResidue} inline animation residue node(s), expected ${expectedInlineResidue}`,
          );
        }
      }
    }
    checkGsapAnimationInventory(viewport, "normal");
    checkMotionFrameBudget(viewport, "normal");
    checkScrollMotionFrameBudget(viewport, "normal");
    checkLayoutStability(viewport.name);
    checkOrbitPausePlayback(viewport);
    checkBriefingRailSequence(viewport);
    checkBriefingRailSweep(viewport);
    checkReadingProgress(viewport);
    checkScrollTriggerInventory(viewport, "normal");
    checkStudioInteractionMotionBudget(viewport, "normal");
    checkStudioStateMutationMotionBudget(viewport, "normal");
    checkInteractiveMicroMotion(viewport, "normal");

    checkPageContinuity(viewport, "normal");

    checkFrontendQuality(viewport);
    checkLanguageConsistency(viewport);
    checkKeyboardFlow(viewport);
    checkKeyboardTargetSurface(viewport);
    checkAnchorNavigation(viewport);
    checkPrimaryNavigation(viewport);
    checkVisualComposition(viewport);
    checkStudioFrameContinuity(viewport);
    checkStudioMobileDensity(viewport);
    checkHeroVisualContract(viewport);
    checkContrast(viewport);
    checkEmptySearchState(viewport);
    checkMatrixUsability(viewport);

    const tabState = runJson([
      "js",
      `const tabs = [...document.querySelectorAll(".mode-tabs button")];
      tabs[1].click();
      tabs[2].click();
      tabs[3].click();
      new Promise(resolve => setTimeout(resolve, 900)).then(() => ({
        selected: document.querySelector('.mode-tabs button[aria-selected="true"]')?.textContent?.trim(),
        evidenceLedger: !!document.querySelector('[aria-label="evidence ledger"]'),
        evidenceRows: document.querySelectorAll(".evidence-row").length,
        hiddenPanels: [...document.querySelectorAll(".primary-lab > *, .dossier-panel")].filter(node => {
          const style = getComputedStyle(node);
          return style.opacity === "0" || style.visibility === "hidden";
        }).length,
      }))`,
    ], { timeout: 30_000 });

    if (tabState) {
      if (tabState.selected !== "Evidence ledger") {
        failures.push(
          `[${viewport.name}] expected Evidence ledger tab to be selected, got ${tabState.selected ?? "none"}`,
        );
      }

      if (!tabState.evidenceLedger) {
        failures.push(`[${viewport.name}] Evidence ledger panel was not rendered after tab switch`);
      }

      if (tabState.evidenceRows !== 11) {
        failures.push(`[${viewport.name}] expected 11 evidence rows, got ${tabState.evidenceRows}`);
      }

      if (tabState.hiddenPanels !== 0) {
        failures.push(`[${viewport.name}] expected no hidden panels after tab switch, got ${tabState.hiddenPanels}`);
      }
    }

    resetToTopForScreenshot(viewport);
    captureScreenshot(viewport.name, `runtime-qa-${viewport.name}.png`);
    captureFullPageScreenshot(`${viewport.name} full-page`, `runtime-qa-${viewport.name}-full-page.png`);

    const middleScroll = runJson([
      "js",
      `new Promise(resolve => {
        const target = document.querySelector("#published");
        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        target?.scrollIntoView({ block: "start" });
        window.dispatchEvent(new Event("scroll"));
        setTimeout(() => {
          if (!target) {
            resolve({ targetFound: false });
            return;
          }

          const rect = target.getBoundingClientRect();
          const heading = target.querySelector("h2")?.textContent?.trim() ?? "";
          const list = target.querySelector(".research-list");
          const firstArticle = target.querySelector(".research-list article");
          const firstTitle = target.querySelector(".research-list h3");
          const listRect = list?.getBoundingClientRect();
          const firstArticleRect = firstArticle?.getBoundingClientRect();
          const firstTitleRect = firstTitle?.getBoundingClientRect();
          const firstTitleStyle = firstTitle ? getComputedStyle(firstTitle) : null;
          const firstTitleLineHeight = firstTitleStyle ? Number.parseFloat(firstTitleStyle.lineHeight) || 24 : 24;
          const activeRails = [...document.querySelectorAll(".briefing-rail.is-scroll-active")];
          const publishedRail = target.querySelector(".briefing-rail");
          resolve({
            targetFound: true,
            heading,
            targetTop: Math.round(rect.top),
            targetBottom: Math.round(rect.bottom),
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            researchListWidth: listRect ? Math.round(listRect.width) : null,
            firstArticleWidth: firstArticleRect ? Math.round(firstArticleRect.width) : null,
            firstTitleLines: firstTitleRect ? Number((firstTitleRect.height / firstTitleLineHeight).toFixed(2)) : null,
            activeRailCount: activeRails.length,
            publishedRailActive: publishedRail?.classList.contains("is-scroll-active") ?? false,
          });
        }, 1000);
      })`,
    ], { timeout: 30_000 });

    if (
      !middleScroll?.targetFound ||
      middleScroll.heading !== "Public research" ||
      middleScroll.targetTop < -2 ||
      middleScroll.targetTop > middleScroll.viewportHeight * 0.38
    ) {
      failures.push(
        `[${viewport.name}] failed to frame the middle published section before screenshot; heading ${
          middleScroll?.heading ?? "missing"
        }, targetTop ${middleScroll?.targetTop ?? "missing"}`,
      );
    }

    if (middleScroll?.viewportWidth >= 1180) {
      if (!Number.isFinite(middleScroll.researchListWidth) || middleScroll.researchListWidth < 880) {
        failures.push(
          `[${viewport.name}] middle published research list is too narrow: ${
            middleScroll.researchListWidth ?? "missing"
          }px`,
        );
      }

      if (!Number.isFinite(middleScroll.firstTitleLines) || middleScroll.firstTitleLines > 4.2) {
        failures.push(
          `[${viewport.name}] middle published research title wraps into too many lines: ${
            middleScroll.firstTitleLines ?? "missing"
          }`,
        );
      }
    }

    captureScreenshot(`${viewport.name} middle`, `runtime-qa-${viewport.name}-middle.png`);

    const studioScroll = runJson([
      "js",
      `new Promise(resolve => {
        const target = document.querySelector("#benchmarks");
        const top = target ? target.getBoundingClientRect().top + window.scrollY : 0;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, top);
        setTimeout(() => resolve({
          scrollY: Math.round(window.scrollY),
          targetTop: target ? Math.round(target.getBoundingClientRect().top) : null,
        }), 500);
      })`,
    ], { timeout: 30_000 });

    if (!studioScroll || studioScroll.targetTop === null || Math.abs(studioScroll.targetTop) > 2) {
      failures.push(
        `[${viewport.name}] failed to scroll to studio before screenshot; targetTop ${studioScroll?.targetTop ?? "missing"}`,
      );
    }

    captureScreenshot(`${viewport.name} studio`, `runtime-qa-${viewport.name}-studio.png`);

    const footerScroll = runJson([
      "js",
      `new Promise(resolve => {
        const target = document.querySelector("#subscribe") || document.querySelector(".site-footer");
        const top = target ? target.getBoundingClientRect().top + window.scrollY : 0;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, top);
        setTimeout(() => {
          if (!target) {
            resolve({ targetFound: false });
            return;
          }

          const rect = target.getBoundingClientRect();
          resolve({
            targetFound: true,
            scrollY: Math.round(window.scrollY),
            targetTop: Math.round(rect.top),
            targetBottom: Math.round(rect.bottom),
            viewportHeight: window.innerHeight,
          });
        }, 500);
      })`,
    ], { timeout: 30_000 });

    if (
      !footerScroll?.targetFound ||
      footerScroll.targetBottom > footerScroll.viewportHeight + 2 ||
      footerScroll.targetTop < -2
    ) {
      failures.push(
        `[${viewport.name}] failed to scroll to footer before screenshot; targetTop ${
          footerScroll?.targetTop ?? "missing"
        }, targetBottom ${footerScroll?.targetBottom ?? "missing"}`,
      );
    }

    captureScreenshot(`${viewport.name} footer`, `runtime-qa-${viewport.name}-footer.png`);

    checkConsoleClean(viewport.name);

    checkNetwork(viewport.name);
  }

  for (const viewport of viewports) {
    runBrowse(["viewport", viewport.size]);
    runBrowse(["console", "--clear"]);
    clearNetwork(`${viewport.name} reduced-motion`);
    runBrowse(["goto", reducedMotionUrl]);
    runBrowse(["wait", "--load"]);
    const rootReducedMotionState = runJson([
      "js",
      `(() => ({
        rootAttr: document.documentElement.getAttribute("data-motion-reduce") || "",
        appAttr: document.querySelector(".opendesign-app")?.getAttribute("data-motion-reduce") || "",
        search: window.location.search,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      }))()`,
    ], { timeout: 30_000 });
    const rootReducedMotionOk =
      rootReducedMotionState?.rootAttr === "true" &&
      rootReducedMotionState?.appAttr === "true" &&
      rootReducedMotionState?.search.includes("motion=reduce") &&
      rootReducedMotionState?.scrollBehavior === "auto";
    qaReport.rootReducedMotion.push({
      label: viewport.name,
      ok: rootReducedMotionOk,
      rootAttr: rootReducedMotionState?.rootAttr ?? "",
      appAttr: rootReducedMotionState?.appAttr ?? "",
      search: rootReducedMotionState?.search ?? "",
      scrollBehavior: rootReducedMotionState?.scrollBehavior ?? "",
    });

    if (!rootReducedMotionOk) {
      failures.push(
        `[${viewport.name} reduced-motion] root reduced-motion marker failed: root=${
          rootReducedMotionState?.rootAttr || "missing"
        }, app=${rootReducedMotionState?.appAttr || "missing"}, scrollBehavior=${
          rootReducedMotionState?.scrollBehavior || "missing"
        }`,
      );
    }

    checkHeroFirstPaint(viewport, "reduced");
    runPerf(`${viewport.name} reduced-motion`);

    const reducedMotionState = runJson([
      "js",
      `new Promise(resolve => setTimeout(resolve, 500)).then(() => {
        const selectors = [
          ".top-rail",
          ".briefing-rail",
          ".hero-copy h1 span",
          ".hero-visual",
          ".section-intro > *",
          ".continuity-lane article",
          ".surface-grid article",
          ".research-list article",
          ".platform-copy",
          ".platform-copy > *",
          ".platform-steps article",
          ".workbench-head > *",
          ".studio-controls",
          ".metric-ribbon article",
          ".footer-proof-grid article",
          ".footer-actions a",
          ".primary-lab > *",
          ".dossier-panel",
          ".meter i",
        ];

        return selectors.map(selector => {
          const nodes = [...document.querySelectorAll(selector)];
          return {
            selector,
            count: nodes.length,
            hidden: nodes.filter(node => {
              const style = getComputedStyle(node);
              return style.opacity === "0" || style.visibility === "hidden";
            }).length,
            inlineResidue: nodes.filter(node => {
              return node.style.opacity || node.style.visibility || node.style.transform || node.style.willChange;
            }).length,
            stickyPosition: nodes.filter(node => {
              const position = getComputedStyle(node).position;
              return position === "sticky" || position === "fixed";
            }).length,
          };
        });
      })`,
    ], { timeout: 30_000 });

    if (Array.isArray(reducedMotionState)) {
      for (const item of reducedMotionState) {
        if ([".top-rail", ".briefing-rail", ".platform-copy", ".dossier-panel"].includes(item.selector)) {
          qaReport.reducedMotionSticky.push({
            label: viewport.name,
            selector: item.selector,
            ok: item.stickyPosition === 0,
            count: item.count ?? 0,
            stickyPosition: item.stickyPosition ?? null,
          });
        }

        if (item.count === 0) {
          failures.push(`[${viewport.name} reduced-motion] ${item.selector} matched no nodes`);
        }

        if (item.hidden !== 0) {
          failures.push(
            `[${viewport.name} reduced-motion] ${item.selector} has ${item.hidden} hidden node(s)`,
          );
        }

        if (item.inlineResidue !== 0) {
          failures.push(
            `[${viewport.name} reduced-motion] ${item.selector} has ${item.inlineResidue} inline animation residue node(s)`,
          );
        }

        if ([".top-rail", ".briefing-rail", ".platform-copy", ".dossier-panel"].includes(item.selector) && item.stickyPosition !== 0) {
          failures.push(
            `[${viewport.name} reduced-motion] ${item.selector} has ${item.stickyPosition} sticky/fixed node(s)`,
          );
        }
      }
    }
    checkGsapAnimationInventory(viewport, "reduced");
    checkMotionFrameBudget(viewport, "reduced");
    checkScrollMotionFrameBudget(viewport, "reduced");
    checkLayoutStability(`${viewport.name} reduced-motion`);
    checkPageContinuity(viewport, "reduced");

    const reducedRailState = runJson([
      "js",
      `(() => {
        const activeRails = [...document.querySelectorAll(".briefing-rail.is-scroll-active")];
        const currentRails = [...document.querySelectorAll('.briefing-rail[aria-current="step"]')];
        return {
          railCount: document.querySelectorAll(".briefing-rail").length,
          activeRailCount: activeRails.length,
          currentRailCount: currentRails.length,
          activeRailLabels: activeRails.map((rail) => rail.getAttribute("aria-label") ?? ""),
          currentRailLabels: currentRails.map((rail) => rail.getAttribute("aria-label") ?? ""),
        };
      })()`,
    ], { timeout: 30_000 });

    if (reducedRailState) {
      const ok =
        reducedRailState.railCount === 5 &&
        reducedRailState.activeRailCount === 0 &&
        reducedRailState.currentRailCount === 0;
      qaReport.scrollTriggerRailReducedMotion.push({
        label: viewport.name,
        ok,
        railCount: reducedRailState.railCount ?? null,
        activeRailCount: reducedRailState.activeRailCount ?? null,
        currentRailCount: reducedRailState.currentRailCount ?? null,
        activeRailLabels: Array.isArray(reducedRailState.activeRailLabels)
          ? reducedRailState.activeRailLabels
          : [],
        currentRailLabels: Array.isArray(reducedRailState.currentRailLabels)
          ? reducedRailState.currentRailLabels
          : [],
      });

      if (!ok) {
        failures.push(
          `[${viewport.name} reduced-motion] briefing rails retain active/current state: active=${
            reducedRailState.activeRailCount ?? "missing"
          }, current=${reducedRailState.currentRailCount ?? "missing"}`,
        );
      }
    }

    const reducedProgressState = runJson([
      "js",
      `(() => {
        const bar = document.querySelector(".reading-progress span");
        if (!bar) return { exists: false };
        const transform = getComputedStyle(bar).transform;
        const match = transform && transform !== "none" ? transform.match(/matrix\\(([^,]+)/) : null;
        return {
          exists: true,
          scaleX: match ? Number(Number(match[1]).toFixed(4)) : 1,
          inlineTransform: bar.style.transform || "",
          inlineWillChange: bar.style.willChange || "",
          computedWillChange: getComputedStyle(bar).willChange,
        };
      })()`,
    ], { timeout: 30_000 });

    if (reducedProgressState) {
      const ok =
        reducedProgressState.exists === true &&
        !reducedProgressState.inlineTransform &&
        !reducedProgressState.inlineWillChange &&
        Number(reducedProgressState.scaleX) === 0;

      qaReport.readingProgressReducedMotion.push({
        label: viewport.name,
        ok,
        exists: reducedProgressState.exists === true,
        scaleX: reducedProgressState.scaleX ?? null,
        inlineTransform: reducedProgressState.inlineTransform ?? "",
        inlineWillChange: reducedProgressState.inlineWillChange ?? "",
        computedWillChange: reducedProgressState.computedWillChange ?? "",
      });

      if (!reducedProgressState.exists) {
        failures.push(`[${viewport.name} reduced-motion] reading progress bar is missing`);
      }

      if (reducedProgressState.inlineTransform || reducedProgressState.inlineWillChange) {
        failures.push(`[${viewport.name} reduced-motion] reading progress retains inline animation residue`);
      }

      if (Number(reducedProgressState.scaleX) !== 0) {
        failures.push(
          `[${viewport.name} reduced-motion] reading progress scale should stay at 0, got ${
            reducedProgressState.scaleX ?? "missing"
          }`,
        );
      }
    }

    checkScrollTriggerInventory(viewport, "reduced");
    checkStudioInteractionMotionBudget(viewport, "reduced");
    checkStudioStateMutationMotionBudget(viewport, "reduced");
    checkInteractiveMicroMotion(viewport, "reduced");

    const reducedOrbitState = runJson([
      "js",
      `(() => {
        const nodes = [...document.querySelectorAll(".orbit")];
        const visibleNodes = nodes.filter(node => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            rect.width > 0 &&
            rect.height > 0;
        });

        return {
          count: nodes.length,
          visibleWillChange: visibleNodes.filter(node => getComputedStyle(node).willChange !== "auto").length,
        };
      })()`,
    ], { timeout: 30_000 });

    if (reducedOrbitState) {
      if (reducedOrbitState.count !== 3) {
        failures.push(`[${viewport.name} reduced-motion] expected 3 orbit nodes, got ${reducedOrbitState.count}`);
      }

      if (reducedOrbitState.visibleWillChange !== 0) {
        failures.push(
          `[${viewport.name} reduced-motion] visible orbit nodes retain ${reducedOrbitState.visibleWillChange} will-change hints`,
        );
      }
    }

    checkConsoleClean(`${viewport.name} reduced-motion`);

    captureScreenshot(
      `${viewport.name} reduced-motion`,
      `runtime-qa-${viewport.name}-reduced-motion.png`,
    );

    checkNetwork(`${viewport.name} reduced-motion`);
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  releaseBrowseLockOnce();
  try {
    writeQaReport();
  } catch (error) {
    failures.push(`Failed to write QA report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error(`Browser runtime QA failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Browser runtime QA ok: ${targetUrl} (${viewports.map((viewport) => viewport.name).join(", ")}, contrast, keyboard, focus, network, reduced-motion, load budgets, layout stability)`,
);
