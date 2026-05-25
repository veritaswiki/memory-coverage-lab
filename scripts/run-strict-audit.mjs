import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { expectedGsapRaceTargets, interactiveMicroMotionTargets } from "./interactive-motion-targets.mjs";

const evidenceDir = resolve("docs/evidence");
const screenshotDir = resolve("docs");
const runId = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const runtimeQaReportPath = join(evidenceDir, `runtime-qa-${runId}.json`);
const gsapRaceReportPath = join(evidenceDir, `gsap-race-${runId}.json`);
const interactiveMotionTargetReportPath = join(evidenceDir, `interactive-motion-targets-${runId}.json`);
const steps = [];
const maxOfficialBrowserProbeAgeSeconds = 1800;
const maxOfficialBrowserProbePreflightAgeSeconds = 120;
const expectedInteractiveMotionSelectors = [
  ...new Set(
    interactiveMicroMotionTargets.flatMap((target) =>
      Array.isArray(target.motionSelectors) && target.motionSelectors.length > 0
        ? target.motionSelectors
        : [target.selector],
    ),
  ),
];

function runStep({ command, args, label, env = {}, capture = false, timeout = 180_000 }) {
  const startedAt = new Date().toISOString();
  console.log(`[strict-audit ${steps.length + 1}] ${label}`);

  if (capture) {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
    });
    process.stdout.write(output);
    steps.push({ label, command, args, startedAt, finishedAt: new Date().toISOString(), output });
    return output;
  }

  execFileSync(command, args, {
    env: { ...process.env, ...env },
    stdio: "inherit",
    timeout,
  });
  steps.push({ label, command, args, startedAt, finishedAt: new Date().toISOString() });
  return "";
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) {
          resolvePort(address.port);
        } else {
          reject(new Error("Could not allocate a local preview port"));
        }
      });
    });
  });
}

function waitForUrl(url, timeoutMs = 20_000) {
  const startedAt = Date.now();

  return new Promise((resolveReady, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          resolveReady();
          return;
        }
      } catch {
        // Preview may still be starting.
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for preview server: ${url}`));
        return;
      }

      setTimeout(attempt, 250);
    };

    attempt();
  });
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pngDimensions(bytes) {
  const pngSignature = "89504e470d0a1a0a";

  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  if (upDistance <= upperLeftDistance) {
    return up;
  }

  return upperLeft;
}

function pngVisualStats(bytes) {
  const dimensions = pngDimensions(bytes);

  if (!dimensions) {
    return { ok: false, error: "not-a-png" };
  }

  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28];
  const channelsByColorType = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]);
  const channels = channelsByColorType.get(colorType);

  if (bitDepth !== 8 || !channels || compression !== 0 || filter !== 0 || interlace !== 0) {
    return {
      ok: false,
      error: "unsupported-png-format",
      bitDepth,
      colorType,
      compression,
      filter,
      interlace,
    };
  }

  const idatChunks = [];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > bytes.length) {
      return { ok: false, error: "truncated-png-chunk" };
    }

    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (idatChunks.length === 0) {
    return { ok: false, error: "missing-idat" };
  }

  const { width, height } = dimensions;
  const bytesPerPixel = channels;
  const rowLength = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const expectedInflatedLength = (rowLength + 1) * height;

  if (inflated.length < expectedInflatedLength) {
    return {
      ok: false,
      error: "truncated-pixel-data",
      inflatedLength: inflated.length,
      expectedInflatedLength,
    };
  }

  const currentRow = Buffer.alloc(rowLength);
  let previousRow = Buffer.alloc(rowLength);
  let inputOffset = 0;
  const stepX = Math.max(1, Math.floor(width / 64));
  const stepY = Math.max(1, Math.floor(height / 64));
  const quantizedColors = new Set();
  let sampleCount = 0;
  let opaqueCount = 0;
  let lumaSum = 0;
  let lumaSquareSum = 0;
  let minLuma = 255;
  let maxLuma = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;

    for (let index = 0; index < rowLength; index += 1) {
      const raw = inflated[inputOffset + index];
      const left = index >= bytesPerPixel ? currentRow[index - bytesPerPixel] : 0;
      const up = previousRow[index] ?? 0;
      const upperLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;
      let value = raw;

      if (filterType === 1) {
        value = raw + left;
      } else if (filterType === 2) {
        value = raw + up;
      } else if (filterType === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filterType === 4) {
        value = raw + paethPredictor(left, up, upperLeft);
      } else if (filterType !== 0) {
        return { ok: false, error: "unknown-filter", filterType };
      }

      currentRow[index] = value & 255;
    }

    if (y % stepY === 0) {
      for (let x = 0; x < width; x += stepX) {
        const pixelOffset = x * channels;
        const r = currentRow[pixelOffset];
        const g = channels === 1 ? r : currentRow[pixelOffset + 1];
        const b = channels === 1 ? r : currentRow[pixelOffset + 2];
        const alpha = channels === 4 ? currentRow[pixelOffset + 3] : 255;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        sampleCount += 1;
        opaqueCount += alpha > 250 ? 1 : 0;
        lumaSum += luma;
        lumaSquareSum += luma * luma;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
        quantizedColors.add(`${r >> 4},${g >> 4},${b >> 4},${alpha >> 4}`);
      }
    }

    inputOffset += rowLength;
    previousRow = Buffer.from(currentRow);
  }

  const lumaMean = lumaSum / sampleCount;
  const lumaVariance = Math.max(0, lumaSquareSum / sampleCount - lumaMean * lumaMean);
  const lumaStdDev = Math.sqrt(lumaVariance);
  const lumaRange = maxLuma - minLuma;
  const opaqueRatio = sampleCount > 0 ? opaqueCount / sampleCount : 0;

  return {
    ok: sampleCount >= 256 &&
      quantizedColors.size >= 24 &&
      lumaStdDev >= 8 &&
      lumaRange >= 40 &&
      opaqueRatio >= 0.98,
    sampleCount,
    uniqueColorCount: quantizedColors.size,
    lumaMean: Number(lumaMean.toFixed(2)),
    lumaStdDev: Number(lumaStdDev.toFixed(2)),
    lumaRange: Number(lumaRange.toFixed(2)),
    opaqueRatio: Number(opaqueRatio.toFixed(4)),
    thresholds: {
      sampleCount: 256,
      uniqueColorCount: 24,
      lumaStdDev: 8,
      lumaRange: 40,
      opaqueRatio: 0.98,
    },
  };
}

function listEvidenceScreenshots() {
  const screenshots = [
    { name: "runtime-qa-desktop.png", width: 1440, height: 1000 },
    { name: "runtime-qa-desktop-full-page.png", width: 1440, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-desktop-middle.png", width: 1440, height: 1000 },
    { name: "runtime-qa-desktop-studio.png", width: 1440, height: 1000 },
    { name: "runtime-qa-desktop-footer.png", width: 1440, height: 1000 },
    { name: "runtime-qa-desktop-reduced-motion.png", width: 1440, height: 1000 },
    { name: "runtime-qa-motion-breakpoint-1360.png", width: 1360, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1360-full-page.png", width: 1360, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-motion-breakpoint-1360-middle.png", width: 1360, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1360-studio.png", width: 1360, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1360-footer.png", width: 1360, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1360-reduced-motion.png", width: 1360, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1359.png", width: 1359, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1359-full-page.png", width: 1359, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-motion-breakpoint-1359-middle.png", width: 1359, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1359-studio.png", width: 1359, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1359-footer.png", width: 1359, height: 900 },
    { name: "runtime-qa-motion-breakpoint-1359-reduced-motion.png", width: 1359, height: 900 },
    { name: "runtime-qa-motion-breakpoint-901.png", width: 901, height: 900 },
    { name: "runtime-qa-motion-breakpoint-901-full-page.png", width: 901, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-motion-breakpoint-901-middle.png", width: 901, height: 900 },
    { name: "runtime-qa-motion-breakpoint-901-studio.png", width: 901, height: 900 },
    { name: "runtime-qa-motion-breakpoint-901-footer.png", width: 901, height: 900 },
    { name: "runtime-qa-motion-breakpoint-901-reduced-motion.png", width: 901, height: 900 },
    { name: "runtime-qa-motion-breakpoint-900.png", width: 900, height: 900 },
    { name: "runtime-qa-motion-breakpoint-900-full-page.png", width: 900, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-motion-breakpoint-900-middle.png", width: 900, height: 900 },
    { name: "runtime-qa-motion-breakpoint-900-studio.png", width: 900, height: 900 },
    { name: "runtime-qa-motion-breakpoint-900-footer.png", width: 900, height: 900 },
    { name: "runtime-qa-motion-breakpoint-900-reduced-motion.png", width: 900, height: 900 },
    { name: "runtime-qa-motion-breakpoint-721.png", width: 721, height: 900 },
    { name: "runtime-qa-motion-breakpoint-721-full-page.png", width: 721, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-motion-breakpoint-721-middle.png", width: 721, height: 900 },
    { name: "runtime-qa-motion-breakpoint-721-studio.png", width: 721, height: 900 },
    { name: "runtime-qa-motion-breakpoint-721-footer.png", width: 721, height: 900 },
    { name: "runtime-qa-motion-breakpoint-721-reduced-motion.png", width: 721, height: 900 },
    { name: "runtime-qa-motion-breakpoint-720.png", width: 720, height: 900 },
    { name: "runtime-qa-motion-breakpoint-720-full-page.png", width: 720, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-motion-breakpoint-720-middle.png", width: 720, height: 900 },
    { name: "runtime-qa-motion-breakpoint-720-studio.png", width: 720, height: 900 },
    { name: "runtime-qa-motion-breakpoint-720-footer.png", width: 720, height: 900 },
    { name: "runtime-qa-motion-breakpoint-720-reduced-motion.png", width: 720, height: 900 },
    { name: "runtime-qa-mobile.png", width: 390, height: 844 },
    { name: "runtime-qa-mobile-full-page.png", width: 390, fullPage: true, minHeight: 1800 },
    { name: "runtime-qa-mobile-middle.png", width: 390, height: 844 },
    { name: "runtime-qa-mobile-studio.png", width: 390, height: 844 },
    { name: "runtime-qa-mobile-footer.png", width: 390, height: 844 },
    { name: "runtime-qa-mobile-reduced-motion.png", width: 390, height: 844 },
  ];

  return screenshots
    .map(({ name, width: expectedWidth, height: expectedHeight, fullPage = false, minHeight = null }) => {
      const path = join(screenshotDir, name);
      if (!existsSync(path)) {
        return { name, exists: false, expectedWidth, expectedHeight, fullPage, minHeight };
      }

      const bytes = readFileSync(path);
      const dimensions = pngDimensions(bytes);
      const visualStats = pngVisualStats(bytes);
      const width = dimensions?.width ?? null;
      const height = dimensions?.height ?? null;
      return {
        name,
        exists: true,
        bytes: bytes.length,
        width,
        height,
        expectedWidth,
        expectedHeight,
        fullPage,
        minHeight,
        matchesExpectedViewport: fullPage
          ? width === expectedWidth && height >= minHeight
          : width === expectedWidth && height === expectedHeight,
        visualStats,
        hasUsefulPixels: visualStats.ok === true,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
}

function summarizeScreenshotEvidence(screenshots) {
  const presentScreenshots = screenshots.filter((screenshot) => screenshot.exists);
  const hashes = presentScreenshots.map((screenshot) => screenshot.sha256).filter(Boolean);
  const visualStats = presentScreenshots
    .map((screenshot) => screenshot.visualStats)
    .filter((stats) => stats?.ok === true);

  return {
    expectedCount: 48,
    actualCount: screenshots.length,
    presentCount: presentScreenshots.length,
    usefulPixelCount: presentScreenshots.filter((screenshot) => screenshot.hasUsefulPixels).length,
    uniqueSha256Count: new Set(hashes).size,
    minBytes: Math.min(...presentScreenshots.map((screenshot) => screenshot.bytes ?? 0)),
    minUniqueColorCount: Math.min(...visualStats.map((stats) => stats.uniqueColorCount)),
    minLumaStdDev: Math.min(...visualStats.map((stats) => stats.lumaStdDev)),
    minLumaRange: Math.min(...visualStats.map((stats) => stats.lumaRange)),
    totalBytes: presentScreenshots.reduce((total, screenshot) => total + (screenshot.bytes ?? 0), 0),
  };
}

function screenshotGroupName(name) {
  return name
    .replace(/^runtime-qa-/, "")
    .replace(/-full-page\.png$/, "")
    .replace(/-middle\.png$/, "")
    .replace(/-studio\.png$/, "")
    .replace(/-footer\.png$/, "")
    .replace(/-reduced-motion\.png$/, "")
    .replace(/\.png$/, "");
}

function gitValue(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function readRuntimeQaReport(path) {
  if (!existsSync(path)) {
    return { exists: false, path };
  }

  const bytes = readFileSync(path);
  const report = JSON.parse(bytes.toString("utf8"));
  const layoutStability = Array.isArray(report.layoutStability) ? report.layoutStability : [];
  const screenshots = Array.isArray(report.screenshots) ? report.screenshots : [];
  const motionFrameBudget = Array.isArray(report.motionFrameBudget) ? report.motionFrameBudget : [];
  const scrollMotionFrameBudget = Array.isArray(report.scrollMotionFrameBudget)
    ? report.scrollMotionFrameBudget
    : [];
  const studioInteractionMotionBudget = Array.isArray(report.studioInteractionMotionBudget)
    ? report.studioInteractionMotionBudget
    : [];
  const studioStateMutationMotionBudget = Array.isArray(report.studioStateMutationMotionBudget)
    ? report.studioStateMutationMotionBudget
    : [];
  const normalStudioStateMutationMotionBudget = studioStateMutationMotionBudget.filter(
    (item) => item?.expectedMode === "normal",
  );
  const studioFrameContinuity = Array.isArray(report.studioFrameContinuity)
    ? report.studioFrameContinuity
    : [];
  const studioMobileDensity = Array.isArray(report.studioMobileDensity)
    ? report.studioMobileDensity
    : [];
  const pageContinuity = Array.isArray(report.pageContinuity) ? report.pageContinuity : [];
  const heroFirstPaint = Array.isArray(report.heroFirstPaint) ? report.heroFirstPaint : [];
  const interactiveMicroMotion = Array.isArray(report.interactiveMicroMotion)
    ? report.interactiveMicroMotion
    : [];
  const keyboardTargetSurface = Array.isArray(report.keyboardTargetSurface)
    ? report.keyboardTargetSurface
    : [];
  const responsiveMotionLifecycle = Array.isArray(report.responsiveMotionLifecycle)
    ? report.responsiveMotionLifecycle
    : [];
  const dynamicReducedMotionLifecycle = Array.isArray(report.dynamicReducedMotionLifecycle)
    ? report.dynamicReducedMotionLifecycle
    : [];
  const mountLifecycle = Array.isArray(report.mountLifecycle) ? report.mountLifecycle : [];
  const heroVisualContract = Array.isArray(report.heroVisualContract) ? report.heroVisualContract : [];
  const scrollTriggerRail = Array.isArray(report.scrollTriggerRail) ? report.scrollTriggerRail : [];
  const scrollTriggerRailSweep = Array.isArray(report.scrollTriggerRailSweep) ? report.scrollTriggerRailSweep : [];
  const scrollTriggerRailReducedMotion = Array.isArray(report.scrollTriggerRailReducedMotion)
    ? report.scrollTriggerRailReducedMotion
    : [];
  const topNavigationCurrent = Array.isArray(report.topNavigationCurrent) ? report.topNavigationCurrent : [];
  const scrollTriggerInventory = Array.isArray(report.scrollTriggerInventory) ? report.scrollTriggerInventory : [];
  const gsapAnimationInventory = Array.isArray(report.gsapAnimationInventory)
    ? report.gsapAnimationInventory
    : [];
  const mediaReducedMotion = Array.isArray(report.mediaReducedMotion) ? report.mediaReducedMotion : [];
  const rootReducedMotion = Array.isArray(report.rootReducedMotion) ? report.rootReducedMotion : [];
  const reducedMotionSticky = Array.isArray(report.reducedMotionSticky) ? report.reducedMotionSticky : [];
  const readingProgress = Array.isArray(report.readingProgress) ? report.readingProgress : [];
  const readingProgressReducedMotion = Array.isArray(report.readingProgressReducedMotion)
    ? report.readingProgressReducedMotion
    : [];
  const consoleClean = Array.isArray(report.consoleClean) ? report.consoleClean : [];
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
  const pageContinuityFlowPasses = (item) =>
    Number(item?.continuityLaneCount) === 5 &&
    item?.continuityLaneSignature === expectedContinuityLaneSignature &&
    Number(item?.continuityLaneHiddenCount) === 0 &&
    Number(item?.continuityLaneInlineResidue) === 0 &&
    Number(item?.surfaceCardCount) === 3 &&
    Array.isArray(item?.surfaceCardTitles) &&
    expectedSurfaceCardTitles.every((title, index) => item.surfaceCardTitles[index] === title) &&
    Number(item?.platformStepCount) === 4 &&
    Array.isArray(item?.platformStepLabels) &&
    expectedPlatformStepLabels.every((step, index) => item.platformStepLabels[index] === step);
  const pageContinuityCohesionPasses = (item) =>
    item?.pageCohesionOk === true &&
    Array.isArray(item?.frameChildSignatures) &&
    expectedFrameChildSignatures.every((signature, index) => item.frameChildSignatures[index] === signature) &&
    Array.isArray(item?.unifiedChromeMissing) &&
    item.unifiedChromeMissing.length === 0 &&
    Array.isArray(item?.unifiedChromeUnframed) &&
    item.unifiedChromeUnframed.length === 0 &&
    Number(item?.nestedPageCards) === 0;
  const pageContinuityMotionDebugPasses = (item) =>
    item?.motionBriefingSignature === expectedMotionBriefingSignature &&
    Number(item?.motionBriefingSectionCount) === 5 &&
    Array.isArray(item?.motionBriefingSections) &&
    item.motionBriefingSections.length === 5;
  const pageContinuityPasses = (item) =>
    item?.ok === true &&
    Number(item?.overflowX) <= 2 &&
    item?.ordered === true &&
    Number(item?.sectionCount) === 5 &&
    Number(item?.railCount) === 5 &&
    Array.isArray(item?.railLabels) &&
    item.railLabels.join("|") === "01|02|03|04|05" &&
    pageContinuityFlowPasses(item) &&
    pageContinuityCohesionPasses(item) &&
    pageContinuityMotionDebugPasses(item) &&
    Number(item?.overlapCount) === 0 &&
    Number(item?.maxSectionGap) <= 2 &&
    Number(item?.frameAlignmentMaxDelta) <= 4 &&
    Number(item?.studioFooterHandoffGap) <= Number(item?.maxAllowedStudioFooterHandoffGap) &&
    Array.isArray(item?.clippedText) &&
    item.clippedText.length === 0 &&
    Array.isArray(item?.wrappedTabs) &&
    item.wrappedTabs.length === 0;
  const reducedMotionSourcePasses = (item) =>
    (
      item?.expectedMode === "normal" &&
      item?.reducedMotionSource === "none" &&
      item?.expectedReducedMotionSource === "none"
    ) ||
    (
      item?.expectedMode === "reduced" &&
      item?.reducedMotionSource === "override" &&
      item?.expectedReducedMotionSource === "override"
    );

  return {
    exists: true,
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    passed: report.passed === true,
    targetUrl: report.targetUrl,
    startedAt: report.startedAt ?? "",
    finishedAt: report.finishedAt ?? "",
    performanceCount: Array.isArray(report.performance) ? report.performance.length : 0,
    motionFrameBudgetCount: motionFrameBudget.length,
    motionFrameBudgetPassCount: motionFrameBudget.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.sampleCount) >= 90 &&
        Number(item?.avg) <= 28 &&
        Number(item?.p95) <= 60 &&
        Number(item?.max) <= 160 &&
        Number(item?.longFrameCount) <= 5,
    ).length,
    maxMotionFrameAvg: motionFrameBudget.reduce((max, item) => Math.max(max, Number(item.avg) || 0), 0),
    maxMotionFrameP95: motionFrameBudget.reduce((max, item) => Math.max(max, Number(item.p95) || 0), 0),
    maxMotionFrame: motionFrameBudget.reduce((max, item) => Math.max(max, Number(item.max) || 0), 0),
    maxLongFrameCount: motionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.longFrameCount) || 0),
      0,
    ),
    scrollMotionFrameBudgetCount: scrollMotionFrameBudget.length,
    scrollMotionFrameBudgetPassCount: scrollMotionFrameBudget.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.sampleCount) >= 89 &&
        Number(item?.distance) > 0 &&
        Number(item?.stableAvg ?? item?.avg) <= 32 &&
        Number(item?.p90) <= 70 &&
        Number(item?.trimmedMax) <= 220 &&
        Number(item?.schedulerSpikeCount) <= 2 &&
        Number(item?.longFrameCount) <= 8,
    ).length,
    maxScrollMotionFrameAvg: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.avg) || 0),
      0,
    ),
    maxScrollMotionFrameP95: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.p95) || 0),
      0,
    ),
    maxScrollMotionFrameP90: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.p90) || 0),
      0,
    ),
    maxScrollMotionTrimmedFrame: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.trimmedMax) || 0),
      0,
    ),
    maxScrollMotionFrame: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.max) || 0),
      0,
    ),
    maxScrollMotionSchedulerSpikeCount: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.schedulerSpikeCount) || 0),
      0,
    ),
    maxScrollLongFrameCount: scrollMotionFrameBudget.reduce(
      (max, item) => Math.max(max, Number(item.longFrameCount) || 0),
      0,
    ),
    studioInteractionMotionBudgetCount: studioInteractionMotionBudget.length,
    studioInteractionMotionBudgetPassCount: studioInteractionMotionBudget.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.sampleCount) >= 89 &&
        item?.selectedTab === "studio-tab-evidence" &&
        item?.selectedLabel === "Evidence ledger" &&
        Number(item?.panelCount) === 1 &&
        Number(item?.hiddenCount) === 0 &&
        Number(item?.inlineResidue) === 0 &&
        Number(item?.nonOrbitRepeatCount) === 0 &&
        Array.isArray(item?.leakedActiveTargets) &&
        item.leakedActiveTargets.length === 0 &&
        Number(item?.avg) <= 32 &&
        Number(item?.p95) <= 70 &&
        Number(item?.max) <= 180 &&
        Number(item?.longFrameCount) <= 8,
    ).length,
    maxStudioInteractionFrameAvg: studioInteractionMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.avg) || 0),
      0,
    ),
    maxStudioInteractionFrameP95: studioInteractionMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.p95) || 0),
      0,
    ),
    maxStudioInteractionFrame: studioInteractionMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.max) || 0),
      0,
    ),
    maxStudioInteractionLongFrameCount: studioInteractionMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.longFrameCount) || 0),
      0,
    ),
    studioStateMutationMotionBudgetCount: studioStateMutationMotionBudget.length,
    studioStateMutationMotionBudgetPassCount: studioStateMutationMotionBudget.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.sampleCount) >= 123 &&
        Number(item?.filteredCountDuringQuery) > 0 &&
        Number(item?.filteredCountDuringQuery) < Number(item?.finalVisibleSystems) &&
        item?.projectClickOk === true &&
        item?.stackToggleClickOk === true &&
        item?.emptyVisibleDuringNoMatch === true &&
        item?.emptyPanelRoleDuringNoMatch === "tabpanel" &&
        Number(item?.emptyBrokenControlCountDuringNoMatch) === 0 &&
        Number(item?.emptyHiddenDuringNoMatch) === 0 &&
        Number(item?.emptyInlineResidueDuringNoMatch) === 0 &&
        item?.finalQuery === "" &&
        Number(item?.finalVisibleSystems) === 11 &&
        item?.selectedTab === "studio-tab-evidence" &&
        item?.selectedLabel === "Evidence ledger" &&
        typeof item?.selectedDossier === "string" &&
        item?.ledgerClickOk === true &&
        Number(item?.activeEvidenceRowCount) === 1 &&
        item?.activeEvidenceMatchesDossier === true &&
        item?.activeEvidenceTitle === item?.selectedDossier &&
        Number(item?.evidenceRows) === 11 &&
        Number(item?.panelCount) === 1 &&
        Number(item?.hiddenCount) === 0 &&
        Number(item?.inlineResidue) === 0 &&
        Number(item?.nonOrbitRepeatCount) === 0 &&
        Array.isArray(item?.leakedActiveTargets) &&
        item.leakedActiveTargets.length === 0 &&
        (item?.expectedMode === "reduced" || Number(item?.stateMutationRefreshCount) > 0) &&
        Number(item?.avg) <= 34 &&
        Number(item?.p95) <= 72 &&
        Number(item?.max) <= 190 &&
        Number(item?.longFrameCount) <= 8,
    ).length,
    studioStateMutationRefreshCount: normalStudioStateMutationMotionBudget.length,
    studioStateMutationRefreshPassCount: normalStudioStateMutationMotionBudget.filter(
      (item) => Number(item?.stateMutationRefreshCount) > 0,
    ).length,
    maxStudioStateMutationFrameAvg: studioStateMutationMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.avg) || 0),
      0,
    ),
    maxStudioStateMutationFrameP95: studioStateMutationMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.p95) || 0),
      0,
    ),
    maxStudioStateMutationFrame: studioStateMutationMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.max) || 0),
      0,
    ),
    maxStudioStateMutationLongFrameCount: studioStateMutationMotionBudget.reduce(
      (max, item) => Math.max(max, Number(item.longFrameCount) || 0),
      0,
    ),
    studioFrameContinuityCount: studioFrameContinuity.length,
    studioFrameContinuityPassCount: studioFrameContinuity.filter(
      (item) =>
        item?.ok === true &&
        item?.gridFound === true &&
        item?.primaryFound === true &&
        typeof item?.contentClassName === "string" &&
        item.contentClassName.length > 0 &&
        item?.alignItems === "start" &&
        Number(item?.blankAfterContent) <= Number(item?.maxAllowedBlank) &&
        (
          Number(item?.viewportWidth) <= 1180 ||
          (
            item?.dossierViewportBounded === true &&
            item?.dossierPairReachable === true &&
            item?.dossierTabIndex === 0 &&
            item?.dossierAriaLabel === "selected system dossier" &&
            item?.dossierKeyboardFocused === true &&
            item?.dossierKeyboardFocusRetained === true &&
            item?.dossierKeyboardScrolled === true &&
            Number(item?.dossierScrollHeight) > Number(item?.dossierClientHeight)
          )
        ),
    ).length,
    maxStudioFrameBlankAfterContent: studioFrameContinuity.reduce(
      (max, item) => Math.max(max, Number(item.blankAfterContent) || 0),
      0,
    ),
    desktopDossierReachabilityCount: studioFrameContinuity.filter(
      (item) => Number(item?.viewportWidth) > 1180,
    ).length,
    desktopDossierReachabilityPassCount: studioFrameContinuity.filter(
      (item) =>
        Number(item?.viewportWidth) > 1180 &&
        item?.dossierViewportBounded === true &&
        item?.dossierPairReachable === true &&
        item?.dossierTabIndex === 0 &&
        item?.dossierAriaLabel === "selected system dossier" &&
        item?.dossierKeyboardFocused === true &&
        item?.dossierKeyboardFocusRetained === true &&
        item?.dossierKeyboardScrolled === true &&
        Number(item?.dossierScrollHeight) > Number(item?.dossierClientHeight),
    ).length,
    studioMobileDensityCount: studioMobileDensity.length,
    studioMobileDensityPassCount: studioMobileDensity.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.metricCount) === 5 &&
        Number(item?.columnCount) === 2 &&
        Number(item?.ribbonHeight) <= Number(item?.maxAllowedRibbonHeight) &&
        Number(item?.minMetricHeight) >= 66 &&
        Array.isArray(item?.clippedLabels) &&
        item.clippedLabels.length === 0,
    ).length,
    maxStudioMobileMetricRibbonHeight: studioMobileDensity.reduce(
      (max, item) => Math.max(max, Number(item.ribbonHeight) || 0),
      0,
    ),
    pageContinuityCount: pageContinuity.length,
    pageContinuityPassCount: pageContinuity.filter(pageContinuityPasses).length,
    pageContinuityNormalPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "normal" && pageContinuityPasses(item),
    ).length,
    pageContinuityReducedPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "reduced" && pageContinuityPasses(item),
    ).length,
    pageContinuityFlowCount: pageContinuity.length,
    pageContinuityFlowPassCount: pageContinuity.filter(pageContinuityFlowPasses).length,
    pageContinuityNormalFlowPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "normal" && pageContinuityFlowPasses(item),
    ).length,
    pageContinuityReducedFlowPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "reduced" && pageContinuityFlowPasses(item),
    ).length,
    pageContinuityCohesionCount: pageContinuity.length,
    pageContinuityCohesionPassCount: pageContinuity.filter(pageContinuityCohesionPasses).length,
    pageContinuityNormalCohesionPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "normal" && pageContinuityCohesionPasses(item),
    ).length,
    pageContinuityReducedCohesionPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "reduced" && pageContinuityCohesionPasses(item),
    ).length,
    pageContinuityMotionDebugCount: pageContinuity.length,
    pageContinuityMotionDebugPassCount: pageContinuity.filter(pageContinuityMotionDebugPasses).length,
    pageContinuityNormalMotionDebugPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "normal" && pageContinuityMotionDebugPasses(item),
    ).length,
    pageContinuityReducedMotionDebugPassCount: pageContinuity.filter(
      (item) => item?.expectedMode === "reduced" && pageContinuityMotionDebugPasses(item),
    ).length,
    maxPageContinuityGap: pageContinuity.reduce(
      (max, item) => Math.max(max, Number(item.maxSectionGap) || 0),
      0,
    ),
    maxPageContinuityFrameAlignmentDelta: pageContinuity.reduce(
      (max, item) => Math.max(max, Number(item.frameAlignmentMaxDelta) || 0),
      0,
    ),
    maxStudioFooterHandoffGap: pageContinuity.reduce(
      (max, item) => Math.max(max, Number(item.studioFooterHandoffGap) || 0),
      0,
    ),
    heroFirstPaintCount: heroFirstPaint.length,
    heroFirstPaintPassCount: heroFirstPaint.filter(
      (item) =>
        item?.ok === true &&
        item?.heroFound === true &&
        item?.copyFound === true &&
        item?.h1Found === true &&
        Number(item?.spanCount) === 4 &&
        Number(item?.visibleSpanCount) === 4 &&
        item?.h1Visibility !== "hidden" &&
        Number(item?.h1Opacity) >= 0.95 &&
        Number(item?.maxSpanTranslateY) <= Number(item?.maxAllowedTranslateY) &&
        Number(item?.h1Top) >= -4 &&
        Number(item?.h1Top) <= Number(item?.viewportHeight) * 0.72 &&
        Number(item?.h1Bottom) <= Number(item?.viewportHeight) + 4 &&
        Number(item?.h1Height) >= 120 &&
        (
          Number(item?.viewportWidth) > 720 ||
          (
            item?.laneFound === true &&
            Number(item?.laneChipCount) === 5 &&
            Number(item?.laneRows) <= 3 &&
            Number(item?.laneHeight) <= Number(item?.maxAllowedMobileLaneHeight)
          )
        ),
    ).length,
    heroFirstPaintNormalPassCount: heroFirstPaint.filter(
      (item) => item?.expectedMode === "normal" && item?.ok === true,
    ).length,
    heroFirstPaintReducedPassCount: heroFirstPaint.filter(
      (item) => item?.expectedMode === "reduced" && item?.ok === true,
    ).length,
    maxHeroFirstPaintTranslateY: heroFirstPaint.reduce(
      (max, item) => Math.max(max, Number(item.maxSpanTranslateY) || 0),
      0,
    ),
    heroMobileLaneCount: heroFirstPaint.filter((item) => Number(item?.viewportWidth) <= 720).length,
    heroMobileLanePassCount: heroFirstPaint.filter(
      (item) =>
        Number(item?.viewportWidth) <= 720 &&
        item?.laneFound === true &&
        Number(item?.laneChipCount) === 5 &&
        Number(item?.laneRows) <= 3 &&
        Number(item?.laneHeight) <= Number(item?.maxAllowedMobileLaneHeight),
    ).length,
    maxHeroMobileLaneHeight: heroFirstPaint.reduce(
      (max, item) =>
        Number(item?.viewportWidth) <= 720
          ? Math.max(max, Number(item.laneHeight) || 0)
          : max,
      0,
    ),
    interactiveMicroMotionCount: interactiveMicroMotion.length,
    interactiveMicroMotionPassCount: interactiveMicroMotion.filter(
      (item) =>
        item?.ok === true &&
        item?.exists === true &&
        item?.settledResidue === false &&
        (
          (item?.expectedMode === "normal" && item?.activeInline === true && item?.beforeResidue === false) ||
          (item?.expectedMode === "reduced" && item?.activeInline === false)
        ),
    ).length,
    interactiveMicroMotionSemanticLabelPassCount: interactiveMicroMotion.filter(
      (item) =>
        item?.expectedMode === "normal" &&
        item?.ok === true &&
        item?.semanticActiveLabelPresent === true &&
        typeof item?.semanticActiveLabel === "string" &&
        item.semanticActiveLabel.startsWith("interactive:"),
    ).length,
    keyboardTargetSurfaceCount: keyboardTargetSurface.length,
    keyboardTargetSurfacePassCount: keyboardTargetSurface.filter(
      (item) =>
        item?.ok === true &&
        item?.exists === true &&
        item?.focused === true &&
        typeof item?.accessibleName === "string" &&
        item.accessibleName.length > 0 &&
        item?.activeInline === true &&
        item?.activeComputed === true &&
        item?.settledResidue === false &&
        item?.semanticActiveLabelPresent === true,
    ).length,
    keyboardTargetSurfaceSemanticLabelPassCount: keyboardTargetSurface.filter(
      (item) =>
        item?.ok === true &&
        item?.semanticActiveLabelPresent === true &&
        typeof item?.semanticActiveLabel === "string" &&
        item.semanticActiveLabel.startsWith("interactive:"),
    ).length,
    responsiveMotionLifecycleCount: responsiveMotionLifecycle.length,
    responsiveMotionLifecyclePassCount: responsiveMotionLifecycle.filter(
      (item) =>
        item?.ok === true &&
        item?.debugMode === "normal" &&
        item?.reducedMotionSource === "none" &&
        Number(item?.triggerCount) === 6 &&
        Number(item?.railTriggerCount) === 5 &&
        Number(item?.readingProgressTriggerCount) === 1 &&
        Number(item?.duplicateCount) === 0 &&
        Number(item?.markerCount) === 0 &&
        Number(item?.pinSpacerCount) === 0 &&
        Number(item?.pinnedCount) === 0 &&
        Number(item?.pausedRepeatCount) === 0 &&
        Number(item?.nonOrbitRepeatCount) === 0,
    ).length,
    responsiveMotionLifecycleDesktopPassCount: responsiveMotionLifecycle.filter(
      (item) =>
        item?.ok === true &&
        item?.expectedMode === "desktop" &&
        item?.heroVisible === true &&
        Number(item?.orbitRepeatCount) === 2 &&
        Number(item?.activeRepeatCount) === 2 &&
        item?.orbitAvailable === true &&
        item?.orbitObserverAttached === true &&
        Number(item?.orbitTweenCount) === 2 &&
        Number(item?.orbitActiveTweenCount) === 2 &&
        item?.orbitShouldPlay === true,
    ).length,
    responsiveMotionLifecycleCompactPassCount: responsiveMotionLifecycle.filter(
      (item) =>
        item?.ok === true &&
        item?.expectedMode === "compact" &&
        item?.heroVisible === false &&
        Number(item?.orbitRepeatCount) === 0 &&
        Number(item?.activeRepeatCount) === 0 &&
        item?.orbitAvailable === false &&
        item?.orbitObserverAttached === false &&
        Number(item?.orbitTweenCount) === 0 &&
        Number(item?.orbitActiveTweenCount) === 0,
    ).length,
    dynamicReducedMotionLifecycleCount: dynamicReducedMotionLifecycle.length,
    dynamicReducedMotionLifecyclePassCount: dynamicReducedMotionLifecycle.filter(
      (item) =>
        item?.ok === true &&
        item?.label === "desktop-live-media-toggle" &&
        Number(item?.phaseCount) === 3 &&
        Number(item?.normalPhasePassCount) === 2 &&
        Number(item?.reducedPhasePassCount) === 1 &&
        Number(item?.refreshDelta) > 0 &&
        Array.isArray(item?.consoleErrors) &&
        item.consoleErrors.length === 0,
    ).length,
    dynamicReducedMotionNormalPhasePassCount: dynamicReducedMotionLifecycle.reduce(
      (total, item) => total + (Number(item?.normalPhasePassCount) || 0),
      0,
    ),
    dynamicReducedMotionReducedPhasePassCount: dynamicReducedMotionLifecycle.reduce(
      (total, item) => total + (Number(item?.reducedPhasePassCount) || 0),
      0,
    ),
    dynamicReducedMotionRefreshPassCount: dynamicReducedMotionLifecycle.filter(
      (item) => Number(item?.refreshDelta) > 0,
    ).length,
    mountLifecycleCount: mountLifecycle.length,
    mountLifecyclePassCount: mountLifecycle.filter(
      (item) =>
        item?.ok === true &&
        item?.label === "desktop-unmount-remount" &&
        item?.initialOk === true &&
        item?.unmountOk === true &&
        item?.remountOk === true &&
        Array.isArray(item?.phases) &&
        item.phases.length === 3,
    ).length,
    mountLifecycleUnmountPassCount: mountLifecycle.filter((item) => item?.unmountOk === true).length,
    mountLifecycleRemountPassCount: mountLifecycle.filter((item) => item?.remountOk === true).length,
    heroVisualContractCount: heroVisualContract.length,
    heroVisualContractPassCount: heroVisualContract.filter((item) => item?.ok === true).length,
    heroVisualContractActiveCount: heroVisualContract.filter((item) => item?.expectedVisible === true).length,
    heroVisualContractInactiveCount: heroVisualContract.filter((item) => item?.expectedVisible === false).length,
    motionPlaybackCount: Array.isArray(report.motionPlayback) ? report.motionPlayback.length : 0,
    motionPlaybackPassCount: Array.isArray(report.motionPlayback)
      ? report.motionPlayback.filter(
          (item) =>
            item?.ok === true &&
            item?.orbitCount === 2 &&
            item?.visibleChanged === true &&
            item?.offscreenPaused === true &&
            item?.resumedChanged === true &&
            item?.visibleInspectorPlaying === true &&
            item?.offscreenInspectorPaused === true &&
            item?.resumedInspectorPlaying === true,
        ).length
      : 0,
    motionPlaybackInspectorPassCount: Array.isArray(report.motionPlayback)
      ? report.motionPlayback.filter(
          (item) =>
            item?.ok === true &&
            item?.orbitCount === 2 &&
            item?.visibleInspectorPlaying === true &&
            item?.offscreenInspectorPaused === true &&
            item?.resumedInspectorPlaying === true,
        ).length
      : 0,
    scrollTriggerRailCount: scrollTriggerRail.length,
    scrollTriggerRailPassCount: scrollTriggerRail.filter(
      (item) =>
        item?.ok === true &&
        ["research", "published", "platform", "studio", "footer"].includes(item?.section) &&
        item?.targetRailActive === true &&
        item?.targetRailCurrent === true &&
        Number(item?.activeRailCount) === 1 &&
        Number(item?.currentRailCount) === 1,
    ).length,
    scrollTriggerRailSweepCount: scrollTriggerRailSweep.length,
    scrollTriggerRailSweepPassCount: scrollTriggerRailSweep.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.sampleCount) >= 12 &&
        Number(item?.maxActiveRailCount) <= 1 &&
        Number(item?.maxCurrentRailCount) <= 1 &&
        Number(item?.mismatchCount) === 0,
    ).length,
    scrollTriggerRailReducedMotionCount: scrollTriggerRailReducedMotion.length,
    scrollTriggerRailReducedMotionPassCount: scrollTriggerRailReducedMotion.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.railCount) === 5 &&
        Number(item?.activeRailCount) === 0 &&
        Number(item?.currentRailCount) === 0,
    ).length,
    topNavigationCurrentCount: topNavigationCurrent.length,
    topNavigationCurrentPassCount: topNavigationCurrent.filter((item) => {
      if (item?.ok !== true) {
        return false;
      }

      const currentHrefs = Array.isArray(item?.currentHrefs) ? item.currentHrefs : [];
      return (
        ["research", "published", "platform", "studio", "footer"].includes(item?.section) &&
        typeof item.expectedHref === "string" &&
        Number(item?.currentCount) === 1 &&
        currentHrefs.length === 1 &&
        currentHrefs[0] === item.expectedHref
      );
    }).length,
    scrollTriggerInventoryCount: scrollTriggerInventory.length,
    scrollTriggerInventoryPassCount: scrollTriggerInventory.filter((item) => {
      const railIds = Array.isArray(item?.railTriggerIds) ? [...item.railTriggerIds].sort() : [];
      const scrubbedIds = Array.isArray(item?.scrubbedIds) ? [...item.scrubbedIds].sort() : [];
      const duplicateIds = Array.isArray(item?.duplicateIds) ? item.duplicateIds : [];
      const triggerIds = Array.isArray(item?.triggerIds) ? item.triggerIds : [];
      const readingProgressTriggerIds = Array.isArray(item?.readingProgressTriggerIds)
        ? item.readingProgressTriggerIds
        : [];
      const expectedRailIds = Array.from({ length: 5 }, (_, index) => `memorybench-rail-${index}`);

      if (item?.expectedMode === "normal") {
        return (
          item?.ok === true &&
          item?.hasDebug === true &&
          item?.mode === "normal" &&
          item?.reducedMotionSource === "none" &&
          item?.expectedReducedMotionSource === "none" &&
          triggerIds.length === 6 &&
          expectedRailIds.every((id, index) => railIds[index] === id) &&
          readingProgressTriggerIds.length === 1 &&
          readingProgressTriggerIds[0] === "memorybench-reading-progress" &&
          duplicateIds.length === 0 &&
          Number(item?.markerCount) === 0 &&
          Number(item?.pinSpacerCount) === 0 &&
          Number(item?.pinnedCount) === 0 &&
          scrubbedIds.length === 1 &&
          scrubbedIds[0] === "memorybench-reading-progress"
        );
      }

      return (
        item?.ok === true &&
        item?.hasDebug === true &&
        item?.expectedMode === "reduced" &&
        item?.mode === "reduced" &&
        item?.reducedMotionSource === "override" &&
        item?.expectedReducedMotionSource === "override" &&
        triggerIds.length === 0 &&
        railIds.length === 0 &&
        readingProgressTriggerIds.length === 0 &&
        duplicateIds.length === 0 &&
        Number(item?.markerCount) === 0 &&
        Number(item?.pinSpacerCount) === 0 &&
        Number(item?.pinnedCount) === 0 &&
        scrubbedIds.length === 0
      );
    }).length,
    scrollTriggerReducedMotionSourceCount: scrollTriggerInventory.length,
    scrollTriggerReducedMotionSourcePassCount: scrollTriggerInventory.filter(reducedMotionSourcePasses).length,
    gsapAnimationInventoryCount: gsapAnimationInventory.length,
    gsapAnimationInventoryPassCount: gsapAnimationInventory.filter((item) => {
      const expectedOrbitRepeats =
        item?.expectedMode === "normal" && ["desktop", "motion-breakpoint-1360"].includes(item?.label)
          ? 2
          : 0;

      return (
        item?.ok === true &&
        item?.hasDebug === true &&
        item?.mode === item?.expectedMode &&
        item?.reducedMotionSource === item?.expectedReducedMotionSource &&
        (
          (item?.expectedMode === "normal" && item?.reducedMotionSource === "none") ||
          (item?.expectedMode === "reduced" && item?.reducedMotionSource === "override")
        ) &&
        Array.isArray(item?.introTimelineLabels) &&
        Array.isArray(item?.expectedTimelineLabels) &&
        item.introTimelineLabels.length === item.expectedTimelineLabels.length &&
        item.expectedTimelineLabels.every((label) => item.introTimelineLabels.includes(label)) &&
        Number(item?.repeatCount) === expectedOrbitRepeats &&
        Number(item?.orbitRepeatCount) === expectedOrbitRepeats &&
        Number(item?.nonOrbitRepeatCount) === 0 &&
        Number(item?.activeRepeatCount) === expectedOrbitRepeats &&
        Number(item?.pausedRepeatCount) === 0 &&
        Number(item?.activeCount) === expectedOrbitRepeats
      );
    }).length,
    gsapReducedMotionSourceCount: gsapAnimationInventory.length,
    gsapReducedMotionSourcePassCount: gsapAnimationInventory.filter(reducedMotionSourcePasses).length,
    mediaReducedMotionCount: mediaReducedMotion.length,
    mediaReducedMotionPassCount: mediaReducedMotion.filter(
      (item) =>
        item?.ok === true &&
        item?.mediaReduceMatches === true &&
        item?.mediaNoPreferenceMatches === false &&
        item?.urlSearch === "" &&
        item?.urlOverrideAttr === "" &&
        item?.mode === "reduced" &&
        item?.reducedMotionSource === "media" &&
        Number(item?.triggerCount) === 0 &&
        Number(item?.railTriggerCount) === 0 &&
        Number(item?.readingProgressTriggerCount) === 0 &&
        Number(item?.markerCount) === 0 &&
        Number(item?.pinSpacerCount) === 0 &&
        Number(item?.pinnedCount) === 0 &&
        Number(item?.scrubbedCount) === 0 &&
        Number(item?.duplicateCount) === 0 &&
        Number(item?.activeCount) === 0 &&
        Number(item?.repeatCount) === 0 &&
        Number(item?.activeRepeatCount) === 0 &&
        Number(item?.orbitRepeatCount) === 0 &&
        Number(item?.nonOrbitRepeatCount) === 0 &&
          Number(item?.hiddenCount) === 0 &&
          Number(item?.inlineResidueCount) === 0 &&
          Number(item?.interactiveMicroMotionCount) === expectedGsapRaceTargets.length &&
          Number(item?.interactiveMicroMotionPassCount) === expectedGsapRaceTargets.length &&
          Number(item?.cssHoverMotionCount) === 5 &&
          Number(item?.cssHoverMotionPassCount) === 5 &&
          Array.isArray(item?.cssHoverMotionFailures) &&
          item.cssHoverMotionFailures.length === 0 &&
          Array.isArray(item?.consoleErrors) &&
          item.consoleErrors.length === 0,
      ).length,
    mediaReducedMotionSourcePassCount: mediaReducedMotion.filter(
      (item) =>
        item?.mediaReduceMatches === true &&
        item?.mediaNoPreferenceMatches === false &&
        item?.urlSearch === "" &&
        item?.urlOverrideAttr === "" &&
        item?.mode === "reduced" &&
        item?.reducedMotionSource === "media",
    ).length,
      mediaReducedMotionInteractivePassCount: mediaReducedMotion.reduce(
        (total, item) => total + (Number(item?.interactiveMicroMotionPassCount) || 0),
        0,
      ),
    mediaReducedMotionCssHoverPassCount: mediaReducedMotion.reduce(
      (total, item) => total + (Number(item?.cssHoverMotionPassCount) || 0),
      0,
    ),
    rootReducedMotionCount: rootReducedMotion.length,
    rootReducedMotionPassCount: rootReducedMotion.filter(
      (item) =>
        item?.ok === true &&
        item?.rootAttr === "true" &&
        item?.appAttr === "true" &&
        typeof item?.search === "string" &&
        item.search.includes("motion=reduce") &&
        item?.scrollBehavior === "auto",
    ).length,
    reducedMotionStickyCount: reducedMotionSticky.length,
    reducedMotionStickyPassCount: reducedMotionSticky.filter(
      (item) =>
        item?.ok === true &&
        [".top-rail", ".briefing-rail", ".platform-copy", ".dossier-panel"].includes(item?.selector) &&
        Number(item?.count) > 0 &&
        Number(item?.stickyPosition) === 0,
    ).length,
    readingProgressCount: readingProgress.length,
    readingProgressPassCount: readingProgress.filter(
      (item) =>
        item?.ok === true &&
        Number(item?.start) <= 0.08 &&
        Number(item?.middle) > Number(item?.start) + 0.2 &&
        Number(item?.end) > Number(item?.middle) + 0.2 &&
        Number(item?.end) <= 1.02,
    ).length,
    readingProgressReducedMotionCount: readingProgressReducedMotion.length,
    readingProgressReducedMotionPassCount: readingProgressReducedMotion.filter(
      (item) =>
        item?.ok === true &&
        item?.exists === true &&
        Number(item?.scaleX) === 0 &&
        !item?.inlineTransform &&
        !item?.inlineWillChange,
    ).length,
    consoleCleanCount: consoleClean.length,
    consoleCleanPassCount: consoleClean.filter((item) => item?.clean === true).length,
    screenshots: screenshots.map((screenshot) => ({
      filename: screenshot?.filename ?? screenshot?.name ?? null,
      path: screenshot?.path ?? null,
      exists: screenshot?.exists === true,
      bytes: Number.isFinite(screenshot?.bytes) ? Number(screenshot.bytes) : null,
      sha256: typeof screenshot?.sha256 === "string" ? screenshot.sha256 : null,
      mtimeMs: Number.isFinite(screenshot?.mtimeMs) ? Number(screenshot.mtimeMs) : null,
      capturedAt: screenshot?.capturedAt ?? null,
      fullPage: screenshot?.fullPage === true,
      width: Number.isFinite(screenshot?.width) ? Number(screenshot.width) : null,
      height: Number.isFinite(screenshot?.height) ? Number(screenshot.height) : null,
      expectedWidth: Number.isFinite(screenshot?.expectedWidth) ? Number(screenshot.expectedWidth) : null,
      expectedMinHeight: Number.isFinite(screenshot?.expectedMinHeight)
        ? Number(screenshot.expectedMinHeight)
        : null,
    })),
    screenshotCount: screenshots.length,
    screenshotDimensionCount: screenshots.filter((screenshot) =>
      Number.isFinite(screenshot.width) && Number.isFinite(screenshot.height),
    ).length,
    screenshotHashCount: screenshots.filter((screenshot) => typeof screenshot.sha256 === "string").length,
    fullPageScreenshotCount: screenshots.filter((screenshot) => screenshot.fullPage === true).length,
    fullPageScreenshotWidthPassCount: screenshots.filter((screenshot) => {
      if (screenshot.fullPage !== true) {
        return false;
      }

      return (
        Number.isFinite(screenshot.width) &&
        Number.isFinite(screenshot.expectedWidth) &&
        Math.abs(Number(screenshot.width) - Number(screenshot.expectedWidth)) <= 2 &&
        Number.isFinite(screenshot.height) &&
        Number.isFinite(screenshot.expectedMinHeight) &&
        Number(screenshot.height) >= Number(screenshot.expectedMinHeight)
      );
    }).length,
    layoutStabilityCount: layoutStability.length,
    maxCls: layoutStability.reduce((max, item) => Math.max(max, Number(item.cls) || 0), 0),
    maxWorstShift: layoutStability.reduce((max, item) => Math.max(max, Number(item.worst) || 0), 0),
    unsupportedLayoutStability: layoutStability
      .filter((item) => item.supported !== true)
      .map((item) => item.label ?? "unknown"),
  };
}

function readGsapRaceReport(path) {
  if (!existsSync(path)) {
    return { exists: false, path };
  }

  const bytes = readFileSync(path);
  const report = JSON.parse(bytes.toString("utf8"));
  const results = Array.isArray(report.results) ? report.results : [];
  const samples = results.flatMap((result) => (Array.isArray(result.samples) ? result.samples : []));
  const realHoverSamples = results.flatMap((result) =>
    Array.isArray(result.realHoverSamples) ? result.realHoverSamples : [],
  );
  const evidenceRowSamples = samples.filter((sample) => sample.label === "evidence-row");

  return {
    exists: true,
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    targetUrl: report.targetUrl ?? "",
    startedAt: report.startedAt ?? "",
    finishedAt: report.finishedAt ?? "",
    passed: report.passed === true,
    viewportCount: results.length,
    viewportPassCount: results.filter((result) => result.ok === true).length,
    viewports: results.map((result) => ({
      name: result.viewport ?? "",
      size: result.size ?? "",
      ok: result.ok === true,
      sampleCount: Number(result.sampleCount) || 0,
      passCount: Number(result.passCount) || 0,
      evidenceRowPassCount: Number(result.evidenceRowPassCount) || 0,
      realHoverSampleCount: Number(result.realHoverSampleCount) || 0,
      realHoverPassCount: Number(result.realHoverPassCount) || 0,
      targetLabels: Array.isArray(result.samples)
        ? result.samples.map((sample) => sample.label ?? "").filter(Boolean)
        : [],
      realHoverTargetLabels: Array.isArray(result.realHoverSamples)
        ? result.realHoverSamples.map((sample) => sample.label ?? "").filter(Boolean)
        : [],
      selectedTab: result.prepared?.selectedTab ?? "",
      activeEvidenceTitle: result.prepared?.activeEvidenceTitle ?? "",
      selectedDossier: result.prepared?.selectedDossier ?? "",
    })),
    sampleCount: Number(report.sampleCount) || samples.length,
    passCount: Number(report.passCount) || samples.filter((sample) => sample.ok === true).length,
    evidenceRowSampleCount: evidenceRowSamples.length,
    evidenceRowPassCount:
      Number(report.evidenceRowPassCount) ||
      evidenceRowSamples.filter((sample) => sample.ok === true).length,
    realHoverSampleCount: Number(report.realHoverSampleCount) || realHoverSamples.length,
    realHoverPassCount:
      Number(report.realHoverPassCount) ||
      realHoverSamples.filter((sample) => sample.ok === true).length,
    failures: Array.isArray(report.failures) ? report.failures : [],
    expectedTargetLabels: expectedGsapRaceTargets,
  };
}

function readInteractiveMotionTargetReport(path) {
  if (!existsSync(path)) {
    return { exists: false, path };
  }

  const bytes = readFileSync(path);
  const report = JSON.parse(bytes.toString("utf8"));

  return {
    exists: true,
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    startedAt: report.startedAt ?? "",
    finishedAt: report.finishedAt ?? "",
    passed: report.passed === true,
    targetCount: Number(report.targetCount) || 0,
    labels: Array.isArray(report.labels) ? report.labels : [],
    expectedLabels: Array.isArray(report.expectedLabels) ? report.expectedLabels : [],
    labelsMatch: report.labelsMatch === true,
    labelsUnique: report.labelsUnique === true,
    scriptBridgeLabels: Array.isArray(report.scriptBridgeLabels) ? report.scriptBridgeLabels : [],
    scriptBridgeLabelsMatch: report.scriptBridgeLabelsMatch === true,
    motionSelectors: Array.isArray(report.motionSelectors) ? report.motionSelectors : [],
    expectedMotionSelectors: Array.isArray(report.expectedMotionSelectors) ? report.expectedMotionSelectors : [],
    motionSelectorsMatch: report.motionSelectorsMatch === true,
    setupLabels: Array.isArray(report.setupLabels) ? report.setupLabels : [],
    allowedSetupCount: Number(report.allowedSetupCount) || 0,
    expressionSha256: typeof report.expressionSha256 === "string" ? report.expressionSha256 : "",
    sourceFiles: report.sourceFiles ?? {},
    failures: Array.isArray(report.failures) ? report.failures : [],
  };
}

function readLatestOfficialBrowserProbe() {
  if (!existsSync(evidenceDir)) {
    return { exists: false, reason: "evidence-dir-missing" };
  }

  const candidates = readdirSync(evidenceDir)
    .filter((name) => /^codex-browser-iab-probe-.*\.json$/.test(name))
    .map((name) => {
      const path = join(evidenceDir, name);
      try {
        const bytes = readFileSync(path);
        const parsed = JSON.parse(bytes.toString("utf8"));
        const createdAtMs = parsed.createdAt ? Date.parse(parsed.createdAt) : NaN;
        return {
          name,
          path,
          bytes,
          parsed,
          createdAtMs,
          mtimeMs: statSync(path).mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((candidate) => candidate && Number.isFinite(candidate.createdAtMs))
    .sort((a, b) => b.createdAtMs - a.createdAtMs || b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    return { exists: false, reason: "probe-missing" };
  }

  const latest = candidates[0];
  const { bytes, parsed, createdAtMs } = latest;
  const probeAgeSeconds = Math.max(0, Math.round((Date.now() - createdAtMs) / 1000));

  return {
    exists: true,
    name: latest.name,
    path: latest.path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    createdAt: parsed.createdAt ?? null,
    probeRunId: parsed.probeRunId ?? null,
    probeSource: parsed.probeSource ?? null,
    runtimeSurface: parsed.runtimeSurface ?? null,
    operationTimeoutMs: Number.isFinite(parsed.operationTimeoutMs) ? parsed.operationTimeoutMs : null,
    smokeTimeoutMs: Number.isFinite(parsed.smokeTimeoutMs) ? parsed.smokeTimeoutMs : null,
    operationTimingsMs:
      parsed.operationTimingsMs && typeof parsed.operationTimingsMs === "object"
        ? Object.fromEntries(
            Object.entries(parsed.operationTimingsMs).filter(([, value]) => Number.isFinite(value)),
          )
        : {},
    probeAgeSeconds,
    requestMetaKeys: Array.isArray(parsed.requestMetaKeys) ? parsed.requestMetaKeys : [],
    requestMetadataDiagnostic:
      parsed.requestMetadataDiagnostic && typeof parsed.requestMetadataDiagnostic === "object"
        ? {
            requestMetaKeys: Array.isArray(parsed.requestMetadataDiagnostic.requestMetaKeys)
              ? parsed.requestMetadataDiagnostic.requestMetaKeys
              : [],
            turnMetadataType: parsed.requestMetadataDiagnostic.turnMetadataType ?? null,
            turnMetadataParseOk: parsed.requestMetadataDiagnostic.turnMetadataParseOk === true,
            turnMetadataKeys: Array.isArray(parsed.requestMetadataDiagnostic.turnMetadataKeys)
              ? parsed.requestMetadataDiagnostic.turnMetadataKeys
              : [],
            hasSessionId: parsed.requestMetadataDiagnostic.hasSessionId === true,
            hasTurnId: parsed.requestMetadataDiagnostic.hasTurnId === true,
            parseError: parsed.requestMetadataDiagnostic.parseError ?? null,
          }
        : null,
    diagnosis:
      parsed.diagnosis && typeof parsed.diagnosis === "object"
        ? {
            classification: parsed.diagnosis.classification ?? null,
            summary: parsed.diagnosis.summary ?? null,
            evidence:
              parsed.diagnosis.evidence && typeof parsed.diagnosis.evidence === "object"
                ? parsed.diagnosis.evidence
                : {},
            nextAction: parsed.diagnosis.nextAction ?? null,
          }
        : null,
    listOk: parsed.listOk === true,
    list: Array.isArray(parsed.list)
      ? parsed.list.map((item) => ({
          id: item?.id ?? null,
          name: item?.name ?? null,
          type: item?.type ?? null,
        }))
      : [],
    listCount: Array.isArray(parsed.list) ? parsed.list.length : null,
    getIabOk: parsed.getIab?.ok === true || parsed.getIabOk === true,
    iabBrowserId: parsed.iabBrowserId ?? parsed.getIab?.browserId ?? null,
    getIabError: parsed.getIab?.error ?? parsed.getIabError ?? null,
    availabilitySmoke: parsed.availabilitySmoke ?? null,
    conclusion: parsed.conclusion ?? null,
  };
}

export function assertFreshOfficialBrowserProbe(
  probe,
  context = "official Browser probe",
  maxAgeSeconds = maxOfficialBrowserProbeAgeSeconds,
) {
  if (!probe?.exists) {
    throw new Error(`${context} missing: ${probe?.reason ?? "unknown"}`);
  }

  if (
    !Number.isFinite(probe.probeAgeSeconds) ||
    probe.probeAgeSeconds > maxAgeSeconds
  ) {
    throw new Error(
      `${context} is stale: age ${probe.probeAgeSeconds ?? "missing"}s exceeds ${maxAgeSeconds}s; refresh it with scripts/probe-official-browser-iab.mjs from the Browser Node REPL before running strict QA`,
    );
  }
}

export function assertRunnableOfficialBrowserProbePreflight(probe) {
  assertFreshOfficialBrowserProbe(
    probe,
    "official Browser probe preflight",
    maxOfficialBrowserProbePreflightAgeSeconds,
  );
}

export function validateEvidenceManifest(manifest) {
  const failures = [];
  const commandList = Array.isArray(manifest.commands)
    ? manifest.commands.map((step) => step.command).filter(Boolean)
    : [];
  const commands = new Set(commandList);
  const browserFindings = new Map(
    (manifest.browserDiagnostic?.findings ?? []).map((finding) => [finding.label, finding.value]),
  );

  for (const command of [
    "pnpm verify",
    "pnpm check:interactive-motion-targets",
    "pnpm check:codex-runtime",
    "pnpm check:gsap-race",
    "pnpm qa:runtime",
    "pnpm check:codex-browser",
  ]) {
    if (!commands.has(command)) {
      failures.push(`missing command evidence: ${command}`);
    }
  }

  const interactiveTargetCommandIndex = commandList.indexOf("pnpm check:interactive-motion-targets");
  const gsapRaceCommandIndex = commandList.indexOf("pnpm check:gsap-race");
  const runtimeQaCommandIndex = commandList.indexOf("pnpm qa:runtime");
  if (
    interactiveTargetCommandIndex === -1 ||
    gsapRaceCommandIndex === -1 ||
    interactiveTargetCommandIndex > gsapRaceCommandIndex
  ) {
    failures.push("interactive motion target contract must run before focused GSAP race gate");
  }

  if (
    gsapRaceCommandIndex === -1 ||
    runtimeQaCommandIndex === -1 ||
    gsapRaceCommandIndex > runtimeQaCommandIndex
  ) {
    failures.push("focused GSAP race gate must run before full runtime QA");
  }

  const validateReportCommandWindow = ({ report, reportLabel, command }) => {
    const commandStep = Array.isArray(manifest.commands)
      ? manifest.commands.find((step) => step.command === command)
      : null;

    if (!commandStep) {
      return;
    }

    const commandStartedAtMs = Date.parse(commandStep.startedAt ?? "");
    const commandFinishedAtMs = Date.parse(commandStep.finishedAt ?? "");
    const reportStartedAtMs = Date.parse(report?.startedAt ?? "");
    const reportFinishedAtMs = Date.parse(report?.finishedAt ?? "");

    if (!Number.isFinite(commandStartedAtMs) || !Number.isFinite(commandFinishedAtMs)) {
      failures.push(`${command} command evidence must include parseable startedAt and finishedAt timestamps`);
      return;
    }

    if (commandFinishedAtMs < commandStartedAtMs) {
      failures.push(`${command} command evidence finishedAt must not be earlier than startedAt`);
      return;
    }

    if (!Number.isFinite(reportStartedAtMs) || !Number.isFinite(reportFinishedAtMs)) {
      failures.push(`${reportLabel} must include parseable startedAt and finishedAt timestamps`);
      return;
    }

    if (reportFinishedAtMs < reportStartedAtMs) {
      failures.push(`${reportLabel} finishedAt must not be earlier than startedAt`);
      return;
    }

    const toleranceMs = 1000;
    if (reportStartedAtMs < commandStartedAtMs - toleranceMs || reportFinishedAtMs > commandFinishedAtMs + toleranceMs) {
      failures.push(`${reportLabel} timestamp outside command window for ${command}`);
    }
  };

  validateReportCommandWindow({
    report: manifest.interactiveMotionTargetReport,
    reportLabel: "interactive motion target report",
    command: "pnpm check:interactive-motion-targets",
  });
  validateReportCommandWindow({
    report: manifest.gsapRaceReport,
    reportLabel: "focused GSAP race report",
    command: "pnpm check:gsap-race",
  });
  validateReportCommandWindow({
    report: manifest.runtimeQaReport,
    reportLabel: "runtime QA report",
    command: "pnpm qa:runtime",
  });

  if (!manifest.targetUrl.startsWith("http://127.0.0.1:")) {
    failures.push(`targetUrl must be an owned 127.0.0.1 preview URL, got ${manifest.targetUrl}`);
  }

  if (!manifest.gsapRaceReport?.exists) {
    failures.push(`missing focused GSAP race report: ${manifest.gsapRaceReport?.path ?? "missing"}`);
  } else {
    const expectedRaceViewports = new Set([
      "motion-breakpoint-901",
      "motion-breakpoint-900",
      "motion-breakpoint-721",
    ]);
    const raceViewportNames = new Set((manifest.gsapRaceReport.viewports ?? []).map((viewport) => viewport.name));

    if (manifest.gsapRaceReport.targetUrl !== manifest.targetUrl) {
      failures.push(
        `focused GSAP race report target URL mismatch: ${manifest.gsapRaceReport.targetUrl ?? "missing"} vs ${manifest.targetUrl}`,
      );
    }

    if (manifest.gsapRaceReport.passed !== true) {
      failures.push("focused GSAP race report did not pass");
    }

    if (manifest.gsapRaceReport.viewportCount !== 3 || manifest.gsapRaceReport.viewportPassCount !== 3) {
      failures.push(
        `expected 3 passing focused GSAP race viewports, got ${manifest.gsapRaceReport.viewportPassCount ?? "missing"}/${
          manifest.gsapRaceReport.viewportCount ?? "missing"
        }`,
      );
    }

    for (const expectedViewport of expectedRaceViewports) {
      if (!raceViewportNames.has(expectedViewport)) {
        failures.push(`focused GSAP race report missing viewport ${expectedViewport}`);
      }
    }

    for (const viewport of manifest.gsapRaceReport.viewports ?? []) {
      const targetLabels = new Set(Array.isArray(viewport.targetLabels) ? viewport.targetLabels : []);
      const realHoverTargetLabels = new Set(
        Array.isArray(viewport.realHoverTargetLabels) ? viewport.realHoverTargetLabels : [],
      );

      for (const expectedTarget of expectedGsapRaceTargets) {
        if (!targetLabels.has(expectedTarget)) {
          failures.push(
            `focused GSAP race report missing target ${expectedTarget} in viewport ${viewport.name ?? "missing"}`,
          );
        }
      }

      for (const expectedHoverTarget of ["toprail-action", "surface-action", "map-node", "footer-action"]) {
        if (!realHoverTargetLabels.has(expectedHoverTarget)) {
          failures.push(
            `focused GSAP real hover report missing target ${expectedHoverTarget} in viewport ${
              viewport.name ?? "missing"
            }`,
          );
        }
      }
    }

    if (manifest.gsapRaceReport.sampleCount !== 33 || manifest.gsapRaceReport.passCount !== 33) {
      failures.push(
        `expected 33 passing focused GSAP race samples, got ${manifest.gsapRaceReport.passCount ?? "missing"}/${
          manifest.gsapRaceReport.sampleCount ?? "missing"
        }`,
      );
    }

    if (
      manifest.gsapRaceReport.evidenceRowSampleCount !== 3 ||
      manifest.gsapRaceReport.evidenceRowPassCount !== 3
    ) {
      failures.push(
        `expected 3 passing focused Evidence row race samples, got ${
          manifest.gsapRaceReport.evidenceRowPassCount ?? "missing"
        }/${manifest.gsapRaceReport.evidenceRowSampleCount ?? "missing"}`,
      );
    }

    if (manifest.gsapRaceReport.realHoverSampleCount !== 12 || manifest.gsapRaceReport.realHoverPassCount !== 12) {
      failures.push(
        `expected 12 passing focused real hover GSAP samples, got ${
          manifest.gsapRaceReport.realHoverPassCount ?? "missing"
        }/${manifest.gsapRaceReport.realHoverSampleCount ?? "missing"}`,
      );
    }

    if ((manifest.gsapRaceReport.failures ?? []).length > 0) {
      failures.push(`focused GSAP race report contains failures: ${manifest.gsapRaceReport.failures.join("; ")}`);
    }
  }

  if (!manifest.interactiveMotionTargetReport?.exists) {
    failures.push(`missing interactive motion target report: ${manifest.interactiveMotionTargetReport?.path ?? "missing"}`);
  } else {
    if (manifest.interactiveMotionTargetReport.passed !== true) {
      failures.push("interactive motion target report did not pass");
    }

    if (manifest.interactiveMotionTargetReport.targetCount !== expectedGsapRaceTargets.length) {
      failures.push(
        `expected ${expectedGsapRaceTargets.length} interactive motion targets, got ${
          manifest.interactiveMotionTargetReport.targetCount ?? "missing"
        }`,
      );
    }

    for (const expectedLabel of expectedGsapRaceTargets) {
      if (!manifest.interactiveMotionTargetReport.labels?.includes(expectedLabel)) {
        failures.push(`interactive motion target report missing label ${expectedLabel}`);
      }
    }

    for (const expectedSelector of expectedInteractiveMotionSelectors) {
      if (!manifest.interactiveMotionTargetReport.motionSelectors?.includes(expectedSelector)) {
        failures.push(`interactive motion target report missing motion selector ${expectedSelector}`);
      }
    }

    if (manifest.interactiveMotionTargetReport.labelsMatch !== true) {
      failures.push("interactive motion target labels do not match expected order");
    }

    if (manifest.interactiveMotionTargetReport.labelsUnique !== true) {
      failures.push("interactive motion target labels are not unique");
    }

    if (manifest.interactiveMotionTargetReport.scriptBridgeLabelsMatch !== true) {
      failures.push("interactive motion target script bridge labels do not match expected order");
    }

    if (manifest.interactiveMotionTargetReport.motionSelectorsMatch !== true) {
      failures.push("interactive motion selectors do not match expected order");
    }

    if (manifest.interactiveMotionTargetReport.allowedSetupCount !== 5) {
      failures.push(
        `expected 5 audited setup sources, got ${manifest.interactiveMotionTargetReport.allowedSetupCount ?? "missing"}`,
      );
    }

    if (!manifest.interactiveMotionTargetReport.expressionSha256) {
      failures.push("interactive motion target report missing injected expression hash");
    }

    if (manifest.interactiveMotionTargetReport.sourceFiles?.motionHook?.hasHardcodedSelectorList !== false) {
      failures.push("interactive motion target report found a hard-coded selector list in the GSAP hook");
    }

    if (manifest.interactiveMotionTargetReport.sourceFiles?.scriptBridge?.readsRuntimeData !== true) {
      failures.push("interactive motion target report did not prove the script bridge reads runtime data");
    }

    for (const [sourceLabel, source] of Object.entries(manifest.interactiveMotionTargetReport.sourceFiles ?? {})) {
      if (source?.exists !== true) {
        failures.push(`interactive motion target report source file missing: ${sourceLabel}`);
      }

      if (!Number.isFinite(source?.bytes) || source.bytes <= 0) {
        failures.push(`interactive motion target report source file has no byte evidence: ${sourceLabel}`);
      }

      if (typeof source?.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) {
        failures.push(`interactive motion target report source file missing sha256 evidence: ${sourceLabel}`);
      }
    }

    if ((manifest.interactiveMotionTargetReport.failures ?? []).length > 0) {
      failures.push(
        `interactive motion target report contains failures: ${manifest.interactiveMotionTargetReport.failures.join("; ")}`,
      );
    }
  }

  const acceptedBrowserClassifications = new Set([
    "codex-owned-sockets-but-iab-unverified",
    "stale-codex-browser-sockets-iab-unverified",
    "fallback-only-iab-unverified",
  ]);
  if (!acceptedBrowserClassifications.has(manifest.browserDiagnostic?.diagnosis?.classification)) {
    failures.push(
      `unexpected Browser diagnosis classification: ${
        manifest.browserDiagnostic?.diagnosis?.classification ?? "missing"
      }`,
    );
  }

  if (manifest.browserDiagnostic?.status !== "fallback-ok-iab-unverified") {
    failures.push(`unexpected Browser diagnostic status: ${manifest.browserDiagnostic?.status ?? "missing"}`);
  }

  if (!manifest.officialBrowserProbe?.exists) {
    failures.push(`missing latest direct official Browser IAB probe: ${manifest.officialBrowserProbe?.reason ?? "unknown"}`);
  } else {
    const officialBrowserAvailable =
      manifest.officialBrowserProbe.conclusion === "official-iab-available-current-thread" &&
      manifest.officialBrowserProbe.getIabOk === true;
    const officialBrowserUnavailable =
      manifest.officialBrowserProbe.conclusion === "official-iab-unavailable-current-thread" &&
      manifest.officialBrowserProbe.getIabOk === false &&
      manifest.officialBrowserProbe.getIabError === "Browser is not available: iab";

    if (!officialBrowserAvailable && !officialBrowserUnavailable) {
      failures.push(
        `unexpected official Browser probe state: conclusion=${
          manifest.officialBrowserProbe.conclusion ?? "missing"
        }, getIabOk=${String(manifest.officialBrowserProbe.getIabOk)}, getIabError=${
          manifest.officialBrowserProbe.getIabError ?? "missing"
        }`,
      );
    }

    if (manifest.officialBrowserProbe.probeSource !== "scripts/probe-official-browser-iab.mjs") {
      failures.push(
        `official Browser probe must come from the reusable helper, got ${
          manifest.officialBrowserProbe.probeSource ?? "missing"
        }`,
      );
    }

    if (manifest.officialBrowserProbe.runtimeSurface !== "codex-browser-node-repl") {
      failures.push(
        `official Browser probe must run in the Browser Node REPL runtime, got ${
          manifest.officialBrowserProbe.runtimeSurface ?? "missing"
        }`,
      );
    }

    if (
      typeof manifest.officialBrowserProbe.probeRunId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        manifest.officialBrowserProbe.probeRunId,
      )
    ) {
      failures.push("official Browser probe must persist a UUID probeRunId");
    }

    if (
      manifest.officialBrowserProbe.probeRunId &&
      !String(manifest.officialBrowserProbe.name ?? "").includes(manifest.officialBrowserProbe.probeRunId)
    ) {
      failures.push("official Browser probe filename must include the persisted probeRunId");
    }

    if (!Number.isFinite(manifest.officialBrowserProbe.operationTimeoutMs)) {
      failures.push("official Browser probe must persist operation timeout configuration");
    }

    if (
      !manifest.officialBrowserProbe.operationTimingsMs ||
      !Number.isFinite(manifest.officialBrowserProbe.operationTimingsMs["agent.browsers.list"])
    ) {
      failures.push("official Browser probe must persist browser list timing evidence");
    }

    if (officialBrowserAvailable && !manifest.officialBrowserProbe.iabBrowserId) {
      failures.push("official Browser probe reports get('iab') success but did not record iabBrowserId");
    }

    if (officialBrowserUnavailable) {
      if (manifest.officialBrowserProbe.listOk !== true) {
        failures.push("official Browser unavailable probe must prove browser list() succeeded before get('iab') failed");
      }

      if (manifest.officialBrowserProbe.iabBrowserId) {
        failures.push("official Browser unavailable probe must not record an iabBrowserId");
      }

      if (manifest.officialBrowserProbe.availabilitySmoke !== null) {
        failures.push("official Browser unavailable probe must not contain smoke navigation evidence");
      }

      if (
        manifest.officialBrowserProbe.diagnosis?.classification !==
        "session-metadata-present-no-iab-backends"
      ) {
        failures.push(
          `official Browser unavailable state must classify as session-metadata-present-no-iab-backends, got ${
            manifest.officialBrowserProbe.diagnosis?.classification ?? "missing"
          }`,
        );
      }

      if (
        manifest.officialBrowserProbe.diagnosis?.evidence?.hasSessionId !== true ||
        manifest.officialBrowserProbe.diagnosis?.evidence?.hasTurnId !== true ||
        manifest.officialBrowserProbe.diagnosis?.evidence?.listCount !== 0
      ) {
        failures.push("official Browser unavailable diagnosis must preserve session metadata and zero-backend evidence");
      }

      if (
        !String(manifest.officialBrowserProbe.diagnosis?.nextAction ?? "").includes(
          "registered for the current Codex session",
        )
      ) {
        failures.push("official Browser unavailable diagnosis must include current-session registration repair guidance");
      }
    }

    if (officialBrowserAvailable) {
      if (
        manifest.officialBrowserProbe.diagnosis?.classification !==
        "official-iab-available-and-smoke-tested"
      ) {
        failures.push(
          `official Browser available state must classify as official-iab-available-and-smoke-tested, got ${
            manifest.officialBrowserProbe.diagnosis?.classification ?? "missing"
          }`,
        );
      }

      const smoke = manifest.officialBrowserProbe.availabilitySmoke;

      if (!smoke?.attempted || !smoke.ok) {
        failures.push("official Browser probe reports get('iab') success but did not prove smoke-page navigation");
      }

      if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(String(smoke?.finalUrl ?? ""))) {
        failures.push(
          `official Browser smoke final URL must stay on a local 127.0.0.1 preview, got ${
            smoke?.finalUrl ?? "missing"
          }`,
        );
      }

      if (!String(smoke?.h1 ?? "").includes("When AI agents")) {
        failures.push(`official Browser smoke must prove the MemoryBench hero h1, got ${smoke?.h1 ?? "missing"}`);
      }

      if (smoke?.mainCount !== 1) {
        failures.push(`official Browser smoke must prove one main landmark, got ${smoke?.mainCount ?? "missing"}`);
      }
    }

    if (!Number.isFinite(manifest.officialBrowserProbe.listCount) || manifest.officialBrowserProbe.listCount < 0) {
      failures.push(
        `official Browser probe must record listed browser count, got ${
          manifest.officialBrowserProbe.listCount ?? "missing"
        }`,
      );
    }

    if (!manifest.officialBrowserProbe.requestMetaKeys?.includes("threadId")) {
      failures.push("official Browser probe missing threadId request metadata evidence");
    }

    if (manifest.officialBrowserProbe.requestMetadataDiagnostic?.hasSessionId !== true) {
      failures.push("official Browser probe must prove Browser session_id request metadata is present");
    }

    if (manifest.officialBrowserProbe.requestMetadataDiagnostic?.hasTurnId !== true) {
      failures.push("official Browser probe must prove Browser turn_id request metadata is present");
    }

    if (
      !manifest.officialBrowserProbe.requestMetadataDiagnostic?.turnMetadataKeys?.includes("session_id") ||
      !manifest.officialBrowserProbe.requestMetadataDiagnostic?.turnMetadataKeys?.includes("turn_id")
    ) {
      failures.push("official Browser probe must persist redacted Browser turn metadata key evidence");
    }

    try {
      assertFreshOfficialBrowserProbe(manifest.officialBrowserProbe, "official Browser probe");
    } catch (error) {
      failures.push(error?.message ?? String(error));
    }
  }

  if (browserFindings.get("browserClientIabSessionFilter") !== "present") {
    failures.push("Browser diagnostic must prove the bundled client filters IAB backends by session metadata");
  }

  if (browserFindings.get("browserClientRequiresSessionParams") !== "present") {
    failures.push("Browser diagnostic must prove the bundled client requires browser session and turn params");
  }

  const discoveryReasons = browserFindings.get("browserClientDiscoveryFailureReasons") ?? "";
  for (const reason of ["missing-session-metadata", "no-iab-backends", "no-session-match"]) {
    if (!discoveryReasons.includes(reason)) {
      failures.push(`Browser diagnostic missing discovery failure reason: ${reason}`);
    }
  }

  if (!browserFindings.get("codexBrowserSocketFingerprintSha256")) {
    failures.push("Browser diagnostic missing socket fingerprint evidence");
  }

  if (!browserFindings.get("codexBrowserSocketAgeBuckets")) {
    failures.push("Browser diagnostic missing socket age bucket evidence");
  }

  const fallbackSmokeText = browserFindings.get("fallbackTargetSmoke");
  if (!fallbackSmokeText) {
    failures.push("Browser diagnostic missing fallback MemoryBench smoke evidence");
  } else {
    try {
      const fallbackSmoke = JSON.parse(fallbackSmokeText);
      if (fallbackSmoke.ok !== true) {
        failures.push("Browser fallback smoke did not prove MemoryBench page identity");
      }

      if (!String(fallbackSmoke.finalUrl ?? "").startsWith(String(manifest.targetUrl ?? ""))) {
        failures.push(
          `Browser fallback smoke final URL must stay on the owned preview, got ${
            fallbackSmoke.finalUrl ?? "missing"
          }`,
        );
      }

      if (!String(fallbackSmoke.h1 ?? "").includes("When AI agents remember")) {
        failures.push(`Browser fallback smoke must prove the MemoryBench hero h1, got ${fallbackSmoke.h1 ?? "missing"}`);
      }

      if (fallbackSmoke.title !== "MemoryBench — AI Memory Intelligence") {
        failures.push(`Browser fallback smoke must prove the MemoryBench document title, got ${fallbackSmoke.title ?? "missing"}`);
      }

      if (fallbackSmoke.mainCount !== 1) {
        failures.push(`Browser fallback smoke must prove one main landmark, got ${fallbackSmoke.mainCount ?? "missing"}`);
      }
    } catch (error) {
      failures.push(
        `Browser diagnostic fallback smoke evidence is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const socketFreshness = browserFindings.get("codexBrowserSocketFreshness");
  if (!socketFreshness) {
    failures.push("Browser diagnostic missing socket freshness evidence");
  }

  if (
    manifest.browserDiagnostic?.diagnosis?.classification === "stale-codex-browser-sockets-iab-unverified" &&
    socketFreshness !== "all-stale-over-1h"
  ) {
    failures.push(`stale Browser diagnosis requires all-stale socket evidence, got ${socketFreshness}`);
  }

  if (
    manifest.browserDiagnostic?.diagnosis?.classification === "codex-owned-sockets-but-iab-unverified" &&
    socketFreshness === "all-stale-over-1h"
  ) {
    failures.push("fresh Browser diagnosis must not be used when every Codex Browser socket is stale");
  }

  if (!manifest.runtimeQaReport?.exists) {
    failures.push("missing runtime QA structured report");
  } else {
    if (manifest.runtimeQaReport.targetUrl !== manifest.targetUrl) {
      failures.push(
        `runtime QA report target URL mismatch: ${manifest.runtimeQaReport.targetUrl ?? "missing"} vs ${manifest.targetUrl}`,
      );
    }

    if (manifest.runtimeQaReport.passed !== true) {
      failures.push("runtime QA structured report did not record a passing run");
    }

    if (manifest.runtimeQaReport.performanceCount !== 16) {
      failures.push(
        `expected 16 runtime QA performance samples, got ${manifest.runtimeQaReport.performanceCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.motionFrameBudgetCount !== 16) {
      failures.push(
        `expected 16 motion frame budget samples, got ${
          manifest.runtimeQaReport.motionFrameBudgetCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.motionFrameBudgetPassCount !== 16) {
      failures.push(
        `expected 16 passing motion frame budget samples, got ${
          manifest.runtimeQaReport.motionFrameBudgetPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollMotionFrameBudgetCount !== 16) {
      failures.push(
        `expected 16 scroll motion frame budget samples, got ${
          manifest.runtimeQaReport.scrollMotionFrameBudgetCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollMotionFrameBudgetPassCount !== 16) {
      failures.push(
        `expected 16 passing scroll motion frame budget samples, got ${
          manifest.runtimeQaReport.scrollMotionFrameBudgetPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioInteractionMotionBudgetCount !== 16) {
      failures.push(
        `expected 16 Studio interaction motion budget samples, got ${
          manifest.runtimeQaReport.studioInteractionMotionBudgetCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioInteractionMotionBudgetPassCount !== 16) {
      failures.push(
        `expected 16 passing Studio interaction motion budget samples, got ${
          manifest.runtimeQaReport.studioInteractionMotionBudgetPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioStateMutationMotionBudgetCount !== 16) {
      failures.push(
        `expected 16 Studio state mutation motion budget samples, got ${
          manifest.runtimeQaReport.studioStateMutationMotionBudgetCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioStateMutationMotionBudgetPassCount !== 16) {
      failures.push(
        `expected 16 passing Studio state mutation motion budget samples, got ${
          manifest.runtimeQaReport.studioStateMutationMotionBudgetPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioStateMutationRefreshCount !== 8) {
      failures.push(
        `expected 8 normal Studio state mutation refresh samples, got ${
          manifest.runtimeQaReport.studioStateMutationRefreshCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioStateMutationRefreshPassCount !== 8) {
      failures.push(
        `expected 8 passing normal Studio state mutation refresh samples, got ${
          manifest.runtimeQaReport.studioStateMutationRefreshPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioFrameContinuityCount !== 8) {
      failures.push(
        `expected 8 Studio frame continuity samples, got ${
          manifest.runtimeQaReport.studioFrameContinuityCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioFrameContinuityPassCount !== 8) {
      failures.push(
        `expected 8 passing Studio frame continuity samples, got ${
          manifest.runtimeQaReport.studioFrameContinuityPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.desktopDossierReachabilityCount !== 3) {
      failures.push(
        `expected 3 desktop dossier reachability samples, got ${
          manifest.runtimeQaReport.desktopDossierReachabilityCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.desktopDossierReachabilityPassCount !== 3) {
      failures.push(
        `expected 3 passing desktop dossier reachability samples, got ${
          manifest.runtimeQaReport.desktopDossierReachabilityPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioMobileDensityCount !== 2) {
      failures.push(
        `expected 2 mobile Studio metric density samples, got ${
          manifest.runtimeQaReport.studioMobileDensityCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.studioMobileDensityPassCount !== 2) {
      failures.push(
        `expected 2 passing mobile Studio metric density samples, got ${
          manifest.runtimeQaReport.studioMobileDensityPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityCount !== 16) {
      failures.push(
        `expected 16 page-continuity samples, got ${
          manifest.runtimeQaReport.pageContinuityCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityPassCount !== 16) {
      failures.push(
        `expected 16 passing page-continuity samples, got ${
          manifest.runtimeQaReport.pageContinuityPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityNormalPassCount !== 8) {
      failures.push(
        `expected 8 normal-motion page-continuity samples, got ${
          manifest.runtimeQaReport.pageContinuityNormalPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityReducedPassCount !== 8) {
      failures.push(
        `expected 8 reduced-motion page-continuity samples, got ${
          manifest.runtimeQaReport.pageContinuityReducedPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityFlowCount !== 16) {
      failures.push(
        `expected 16 page continuity evidence-flow samples, got ${
          manifest.runtimeQaReport.pageContinuityFlowCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityFlowPassCount !== 16) {
      failures.push(
        `expected 16 passing page continuity evidence-flow samples, got ${
          manifest.runtimeQaReport.pageContinuityFlowPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityNormalFlowPassCount !== 8) {
      failures.push(
        `expected 8 normal-motion page continuity evidence-flow samples, got ${
          manifest.runtimeQaReport.pageContinuityNormalFlowPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityReducedFlowPassCount !== 8) {
      failures.push(
        `expected 8 reduced-motion page continuity evidence-flow samples, got ${
          manifest.runtimeQaReport.pageContinuityReducedFlowPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityCohesionCount !== 16) {
      failures.push(
        `expected 16 page continuity frame-cohesion samples, got ${
          manifest.runtimeQaReport.pageContinuityCohesionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityCohesionPassCount !== 16) {
      failures.push(
        `expected 16 passing page continuity frame-cohesion samples, got ${
          manifest.runtimeQaReport.pageContinuityCohesionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityNormalCohesionPassCount !== 8) {
      failures.push(
        `expected 8 normal-motion page continuity frame-cohesion samples, got ${
          manifest.runtimeQaReport.pageContinuityNormalCohesionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityReducedCohesionPassCount !== 8) {
      failures.push(
        `expected 8 reduced-motion page continuity frame-cohesion samples, got ${
          manifest.runtimeQaReport.pageContinuityReducedCohesionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityMotionDebugCount !== 16) {
      failures.push(
        `expected 16 page continuity GSAP briefing debug samples, got ${
          manifest.runtimeQaReport.pageContinuityMotionDebugCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityMotionDebugPassCount !== 16) {
      failures.push(
        `expected 16 passing page continuity GSAP briefing debug samples, got ${
          manifest.runtimeQaReport.pageContinuityMotionDebugPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityNormalMotionDebugPassCount !== 8) {
      failures.push(
        `expected 8 normal-motion page continuity GSAP briefing debug samples, got ${
          manifest.runtimeQaReport.pageContinuityNormalMotionDebugPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.pageContinuityReducedMotionDebugPassCount !== 8) {
      failures.push(
        `expected 8 reduced-motion page continuity GSAP briefing debug samples, got ${
          manifest.runtimeQaReport.pageContinuityReducedMotionDebugPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.maxPageContinuityGap > 2) {
      failures.push(
        `page-continuum section gap ${manifest.runtimeQaReport.maxPageContinuityGap}px exceeds 2px`,
      );
    }

    if (manifest.runtimeQaReport.maxPageContinuityFrameAlignmentDelta > 4) {
      failures.push(
        `briefing frame alignment delta ${
          manifest.runtimeQaReport.maxPageContinuityFrameAlignmentDelta
        }px exceeds 4px`,
      );
    }

    if (manifest.runtimeQaReport.maxStudioFooterHandoffGap > 112) {
      failures.push(
        `Studio to footer handoff gap ${
          manifest.runtimeQaReport.maxStudioFooterHandoffGap
        }px exceeds 112px`,
      );
    }

    if (manifest.runtimeQaReport.heroFirstPaintCount !== 16) {
      failures.push(
        `expected 16 hero first-paint samples, got ${
          manifest.runtimeQaReport.heroFirstPaintCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroFirstPaintPassCount !== 16) {
      failures.push(
        `expected 16 passing hero first-paint samples, got ${
          manifest.runtimeQaReport.heroFirstPaintPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroFirstPaintNormalPassCount !== 8) {
      failures.push(
        `expected 8 normal-motion hero first-paint samples, got ${
          manifest.runtimeQaReport.heroFirstPaintNormalPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroFirstPaintReducedPassCount !== 8) {
      failures.push(
        `expected 8 reduced-motion hero first-paint samples, got ${
          manifest.runtimeQaReport.heroFirstPaintReducedPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.maxHeroFirstPaintTranslateY > 32) {
      failures.push(
        `hero first-paint translateY ${
          manifest.runtimeQaReport.maxHeroFirstPaintTranslateY
        }px exceeds 32px`,
      );
    }

    if (manifest.runtimeQaReport.heroMobileLaneCount !== 4) {
      failures.push(
        `expected 4 mobile hero category lane samples, got ${
          manifest.runtimeQaReport.heroMobileLaneCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroMobileLanePassCount !== 4) {
      failures.push(
        `expected 4 passing mobile hero category lane samples, got ${
          manifest.runtimeQaReport.heroMobileLanePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.maxHeroMobileLaneHeight > 132) {
      failures.push(
        `mobile hero category lane height ${
          manifest.runtimeQaReport.maxHeroMobileLaneHeight
        }px exceeds 132px`,
      );
    }

    if (manifest.runtimeQaReport.interactiveMicroMotionCount !== 176) {
      failures.push(
        `expected 176 interactive micro motion samples, got ${
          manifest.runtimeQaReport.interactiveMicroMotionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.interactiveMicroMotionPassCount !== 176) {
      failures.push(
        `expected 176 passing interactive micro motion samples, got ${
          manifest.runtimeQaReport.interactiveMicroMotionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.interactiveMicroMotionSemanticLabelPassCount !== 88) {
      failures.push(
        `expected 88 passing semantic interactive micro motion labels, got ${
          manifest.runtimeQaReport.interactiveMicroMotionSemanticLabelPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.keyboardTargetSurfaceCount !== 88) {
      failures.push(
        `expected 88 keyboard target surface samples, got ${
          manifest.runtimeQaReport.keyboardTargetSurfaceCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.keyboardTargetSurfacePassCount !== 88) {
      failures.push(
        `expected 88 passing keyboard target surface samples, got ${
          manifest.runtimeQaReport.keyboardTargetSurfacePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.keyboardTargetSurfaceSemanticLabelPassCount !== 88) {
      failures.push(
        `expected 88 passing keyboard target semantic labels, got ${
          manifest.runtimeQaReport.keyboardTargetSurfaceSemanticLabelPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.responsiveMotionLifecycleCount !== 3) {
      failures.push(
        `expected 3 responsive GSAP matchMedia lifecycle samples, got ${
          manifest.runtimeQaReport.responsiveMotionLifecycleCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.responsiveMotionLifecyclePassCount !== 3) {
      failures.push(
        `expected 3 passing responsive GSAP matchMedia lifecycle samples, got ${
          manifest.runtimeQaReport.responsiveMotionLifecyclePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.responsiveMotionLifecycleDesktopPassCount !== 2) {
      failures.push(
        `expected 2 passing desktop responsive GSAP lifecycle samples, got ${
          manifest.runtimeQaReport.responsiveMotionLifecycleDesktopPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.responsiveMotionLifecycleCompactPassCount !== 1) {
      failures.push(
        `expected 1 passing compact responsive GSAP lifecycle sample, got ${
          manifest.runtimeQaReport.responsiveMotionLifecycleCompactPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.dynamicReducedMotionLifecycleCount !== 1) {
      failures.push(
        `expected 1 dynamic reduced-motion lifecycle sample, got ${
          manifest.runtimeQaReport.dynamicReducedMotionLifecycleCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.dynamicReducedMotionLifecyclePassCount !== 1) {
      failures.push(
        `expected 1 passing dynamic reduced-motion lifecycle sample, got ${
          manifest.runtimeQaReport.dynamicReducedMotionLifecyclePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.dynamicReducedMotionNormalPhasePassCount !== 2) {
      failures.push(
        `expected 2 passing dynamic reduced-motion normal phases, got ${
          manifest.runtimeQaReport.dynamicReducedMotionNormalPhasePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.dynamicReducedMotionReducedPhasePassCount !== 1) {
      failures.push(
        `expected 1 passing dynamic reduced-motion cleanup phase, got ${
          manifest.runtimeQaReport.dynamicReducedMotionReducedPhasePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.dynamicReducedMotionRefreshPassCount !== 1) {
      failures.push(
        `expected 1 dynamic reduced-motion refresh rebuild sample, got ${
          manifest.runtimeQaReport.dynamicReducedMotionRefreshPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mountLifecycleCount !== 1) {
      failures.push(
        `expected 1 GSAP mount lifecycle sample, got ${
          manifest.runtimeQaReport.mountLifecycleCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mountLifecyclePassCount !== 1) {
      failures.push(
        `expected 1 passing GSAP mount lifecycle sample, got ${
          manifest.runtimeQaReport.mountLifecyclePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mountLifecycleUnmountPassCount !== 1) {
      failures.push(
        `expected 1 passing GSAP unmount cleanup sample, got ${
          manifest.runtimeQaReport.mountLifecycleUnmountPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mountLifecycleRemountPassCount !== 1) {
      failures.push(
        `expected 1 passing GSAP remount rebuild sample, got ${
          manifest.runtimeQaReport.mountLifecycleRemountPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroVisualContractCount !== 8) {
      failures.push(
        `expected 8 hero visual contract samples, got ${
          manifest.runtimeQaReport.heroVisualContractCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroVisualContractPassCount !== 8) {
      failures.push(
        `expected 8 passing hero visual contract samples, got ${
          manifest.runtimeQaReport.heroVisualContractPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroVisualContractActiveCount !== 2) {
      failures.push(
        `expected 2 active hero visual contract samples, got ${
          manifest.runtimeQaReport.heroVisualContractActiveCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.heroVisualContractInactiveCount !== 6) {
      failures.push(
        `expected 6 inactive hero visual contract samples, got ${
          manifest.runtimeQaReport.heroVisualContractInactiveCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.screenshotCount !== 48) {
      failures.push(
        `expected 48 runtime QA screenshot records, got ${manifest.runtimeQaReport.screenshotCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.screenshotDimensionCount !== 48) {
      failures.push(
        `expected runtime QA report to include dimensions for 48 screenshots, got ${
          manifest.runtimeQaReport.screenshotDimensionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.screenshotHashCount !== 48) {
      failures.push(
        `expected runtime QA report to include hashes for 48 screenshots, got ${
          manifest.runtimeQaReport.screenshotHashCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.fullPageScreenshotCount !== 8) {
      failures.push(
        `expected 8 full-page screenshot records, got ${manifest.runtimeQaReport.fullPageScreenshotCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.fullPageScreenshotWidthPassCount !== 8) {
      failures.push(
        `expected 8 full-width full-page screenshot records, got ${
          manifest.runtimeQaReport.fullPageScreenshotWidthPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.layoutStabilityCount !== 16) {
      failures.push(
        `expected 16 layout stability samples, got ${manifest.runtimeQaReport.layoutStabilityCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.motionPlaybackCount !== 2) {
      failures.push(
        `expected 2 desktop orbit playback samples, got ${manifest.runtimeQaReport.motionPlaybackCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.motionPlaybackPassCount !== 2) {
      failures.push(
        `expected 2 passing desktop orbit playback samples, got ${
          manifest.runtimeQaReport.motionPlaybackPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.motionPlaybackInspectorPassCount !== 2) {
      failures.push(
        `expected 2 passing desktop orbit playback inspector samples, got ${
          manifest.runtimeQaReport.motionPlaybackInspectorPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerRailCount !== 40) {
      failures.push(
        `expected 40 ScrollTrigger rail samples, got ${manifest.runtimeQaReport.scrollTriggerRailCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerRailPassCount !== 40) {
      failures.push(
        `expected 40 passing ScrollTrigger rail samples, got ${
          manifest.runtimeQaReport.scrollTriggerRailPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.topNavigationCurrentCount !== 40) {
      failures.push(
        `expected 40 top navigation current-state samples, got ${
          manifest.runtimeQaReport.topNavigationCurrentCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.topNavigationCurrentPassCount !== 40) {
      failures.push(
        `expected 40 passing top navigation current-state samples, got ${
          manifest.runtimeQaReport.topNavigationCurrentPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerRailSweepCount !== 8) {
      failures.push(
        `expected 8 ScrollTrigger rail sweep samples, got ${
          manifest.runtimeQaReport.scrollTriggerRailSweepCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerRailSweepPassCount !== 8) {
      failures.push(
        `expected 8 passing ScrollTrigger rail sweep samples, got ${
          manifest.runtimeQaReport.scrollTriggerRailSweepPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerRailReducedMotionCount !== 8) {
      failures.push(
        `expected 8 reduced-motion ScrollTrigger rail cleanup samples, got ${
          manifest.runtimeQaReport.scrollTriggerRailReducedMotionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerRailReducedMotionPassCount !== 8) {
      failures.push(
        `expected 8 passing reduced-motion ScrollTrigger rail cleanup samples, got ${
          manifest.runtimeQaReport.scrollTriggerRailReducedMotionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerInventoryCount !== 16) {
      failures.push(
        `expected 16 ScrollTrigger inventory lifecycle samples, got ${
          manifest.runtimeQaReport.scrollTriggerInventoryCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerInventoryPassCount !== 16) {
      failures.push(
        `expected 16 passing ScrollTrigger inventory lifecycle samples, got ${
          manifest.runtimeQaReport.scrollTriggerInventoryPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.scrollTriggerReducedMotionSourcePassCount !== 16) {
      failures.push(
        `expected 16 passing ScrollTrigger reduced-motion source samples, got ${
          manifest.runtimeQaReport.scrollTriggerReducedMotionSourcePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.gsapAnimationInventoryCount !== 16) {
      failures.push(
        `expected 16 GSAP animation inventory lifecycle samples, got ${
          manifest.runtimeQaReport.gsapAnimationInventoryCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.gsapAnimationInventoryPassCount !== 16) {
      failures.push(
        `expected 16 passing GSAP animation inventory lifecycle samples, got ${
          manifest.runtimeQaReport.gsapAnimationInventoryPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.gsapReducedMotionSourcePassCount !== 16) {
      failures.push(
        `expected 16 passing GSAP reduced-motion source samples, got ${
          manifest.runtimeQaReport.gsapReducedMotionSourcePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mediaReducedMotionCount !== 8) {
      failures.push(
        `expected 8 real media reduced-motion runtime samples, got ${
          manifest.runtimeQaReport.mediaReducedMotionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mediaReducedMotionPassCount !== 8) {
      failures.push(
        `expected 8 passing real media reduced-motion runtime samples, got ${
          manifest.runtimeQaReport.mediaReducedMotionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mediaReducedMotionSourcePassCount !== 8) {
      failures.push(
        `expected 8 passing real media reduced-motion source samples, got ${
          manifest.runtimeQaReport.mediaReducedMotionSourcePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mediaReducedMotionInteractivePassCount !== 88) {
      failures.push(
        `expected 88 passing real media reduced-motion interactive samples, got ${
          manifest.runtimeQaReport.mediaReducedMotionInteractivePassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.mediaReducedMotionCssHoverPassCount !== 40) {
      failures.push(
        `expected 40 passing real media reduced-motion CSS hover samples, got ${
          manifest.runtimeQaReport.mediaReducedMotionCssHoverPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.rootReducedMotionCount !== 8) {
      failures.push(
        `expected 8 root reduced-motion marker samples, got ${
          manifest.runtimeQaReport.rootReducedMotionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.rootReducedMotionPassCount !== 8) {
      failures.push(
        `expected 8 passing root reduced-motion marker samples, got ${
          manifest.runtimeQaReport.rootReducedMotionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.reducedMotionStickyCount !== 32) {
      failures.push(
        `expected 32 reduced-motion sticky positioning samples, got ${
          manifest.runtimeQaReport.reducedMotionStickyCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.reducedMotionStickyPassCount !== 32) {
      failures.push(
        `expected 32 passing reduced-motion sticky positioning samples, got ${
          manifest.runtimeQaReport.reducedMotionStickyPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.readingProgressCount !== 8) {
      failures.push(
        `expected 8 reading progress samples, got ${manifest.runtimeQaReport.readingProgressCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.readingProgressPassCount !== 8) {
      failures.push(
        `expected 8 passing reading progress samples, got ${
          manifest.runtimeQaReport.readingProgressPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.readingProgressReducedMotionCount !== 8) {
      failures.push(
        `expected 8 reduced-motion reading progress cleanup samples, got ${
          manifest.runtimeQaReport.readingProgressReducedMotionCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.readingProgressReducedMotionPassCount !== 8) {
      failures.push(
        `expected 8 passing reduced-motion reading progress cleanup samples, got ${
          manifest.runtimeQaReport.readingProgressReducedMotionPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.consoleCleanCount !== 16) {
      failures.push(
        `expected 16 console cleanliness samples, got ${manifest.runtimeQaReport.consoleCleanCount ?? "missing"}`,
      );
    }

    if (manifest.runtimeQaReport.consoleCleanPassCount !== 16) {
      failures.push(
        `expected 16 passing console cleanliness samples, got ${
          manifest.runtimeQaReport.consoleCleanPassCount ?? "missing"
        }`,
      );
    }

    if (manifest.runtimeQaReport.maxCls > 0.05) {
      failures.push(`runtime QA max CLS ${manifest.runtimeQaReport.maxCls} exceeds 0.05`);
    }

    if (manifest.runtimeQaReport.maxWorstShift > 0.03) {
      failures.push(`runtime QA max single layout shift ${manifest.runtimeQaReport.maxWorstShift} exceeds 0.03`);
    }

    if (manifest.runtimeQaReport.unsupportedLayoutStability?.length > 0) {
      failures.push(
        `layout stability unsupported for: ${manifest.runtimeQaReport.unsupportedLayoutStability.join(", ")}`,
      );
    }
  }

  if (manifest.screenshots.length !== 48) {
    failures.push(`expected 48 screenshot evidence entries, got ${manifest.screenshots.length}`);
  }

  const runtimeScreenshotRecords = new Map(
    (Array.isArray(manifest.runtimeQaReport?.screenshots) ? manifest.runtimeQaReport.screenshots : [])
      .filter((screenshot) => typeof screenshot?.filename === "string")
      .map((screenshot) => [screenshot.filename, screenshot]),
  );
  const runtimeQaStartedAtMs = Date.parse(manifest.runtimeQaReport?.startedAt ?? "");
  const runtimeQaFinishedAtMs = Date.parse(manifest.runtimeQaReport?.finishedAt ?? "");

  if (!Number.isFinite(runtimeQaStartedAtMs) || !Number.isFinite(runtimeQaFinishedAtMs)) {
    failures.push("runtime QA report must include parseable startedAt and finishedAt timestamps");
  } else if (runtimeQaFinishedAtMs < runtimeQaStartedAtMs) {
    failures.push("runtime QA report finishedAt must not be earlier than startedAt");
  }

  for (const screenshot of manifest.screenshots) {
    if (!screenshot.exists) {
      failures.push(`screenshot missing: ${screenshot.name}`);
    } else if (!screenshot.matchesExpectedViewport) {
      failures.push(
        screenshot.fullPage
          ? `full-page screenshot mismatch: ${screenshot.name} expected ${screenshot.expectedWidth}px wide and height >= ${screenshot.minHeight}, got ${screenshot.width}x${screenshot.height}`
          : `screenshot viewport mismatch: ${screenshot.name} expected ${screenshot.expectedWidth}x${screenshot.expectedHeight}, got ${screenshot.width}x${screenshot.height}`,
      );
    }

    if (!screenshot.sha256 || !screenshot.bytes || screenshot.bytes < 12_000) {
      failures.push(`screenshot evidence too weak: ${screenshot.name}`);
    }

    if (screenshot.exists && screenshot.hasUsefulPixels !== true) {
      failures.push(
        `screenshot pixel evidence too weak: ${screenshot.name} ${JSON.stringify(screenshot.visualStats ?? {})}`,
      );
    }

    const runtimeScreenshot = runtimeScreenshotRecords.get(screenshot.name);
    if (!runtimeScreenshot) {
      failures.push(`runtime QA screenshot record missing for manifest screenshot: ${screenshot.name}`);
    } else {
      if (runtimeScreenshot.sha256 !== screenshot.sha256) {
        failures.push(
          `runtime QA screenshot hash mismatch for ${screenshot.name}: manifest ${screenshot.sha256 ?? "missing"} vs runtime ${runtimeScreenshot.sha256 ?? "missing"}`,
        );
      }

      if (Number(runtimeScreenshot.bytes) !== Number(screenshot.bytes)) {
        failures.push(
          `runtime QA screenshot byte mismatch for ${screenshot.name}: manifest ${screenshot.bytes ?? "missing"} vs runtime ${runtimeScreenshot.bytes ?? "missing"}`,
        );
      }

      if (Number(runtimeScreenshot.width) !== Number(screenshot.width) || Number(runtimeScreenshot.height) !== Number(screenshot.height)) {
        failures.push(
          `runtime QA screenshot dimension mismatch for ${screenshot.name}: manifest ${screenshot.width}x${screenshot.height} vs runtime ${runtimeScreenshot.width}x${runtimeScreenshot.height}`,
        );
      }

      const capturedAtMs = Date.parse(runtimeScreenshot.capturedAt ?? "");
      if (
        Number.isFinite(runtimeQaStartedAtMs) &&
        Number.isFinite(runtimeQaFinishedAtMs) &&
        (!Number.isFinite(capturedAtMs) ||
          capturedAtMs < runtimeQaStartedAtMs ||
          capturedAtMs > runtimeQaFinishedAtMs)
      ) {
        failures.push(
          `runtime QA screenshot capturedAt outside run window for ${screenshot.name}: ${runtimeScreenshot.capturedAt ?? "missing"}`,
        );
      }

      if (
        Number.isFinite(runtimeQaStartedAtMs) &&
        Number.isFinite(runtimeQaFinishedAtMs) &&
        (!Number.isFinite(runtimeScreenshot.mtimeMs) ||
          Number(runtimeScreenshot.mtimeMs) < runtimeQaStartedAtMs ||
          Number(runtimeScreenshot.mtimeMs) > runtimeQaFinishedAtMs + 1000)
      ) {
        failures.push(
          `runtime QA screenshot mtime outside run window for ${screenshot.name}: ${runtimeScreenshot.mtimeMs ?? "missing"}`,
        );
      }
    }
  }

  const screenshotSummary = manifest.screenshotEvidence;
  if (screenshotSummary?.usefulPixelCount !== 48) {
    failures.push(
      `expected 48 screenshot pixel-quality samples, got ${screenshotSummary?.usefulPixelCount ?? "missing"}`,
    );
  }

  const screenshotGroupCount = new Set(
    manifest.screenshots.map((screenshot) => screenshotGroupName(screenshot.name)),
  ).size;
  if (screenshotSummary?.uniqueSha256Count < manifest.screenshots.length - screenshotGroupCount) {
    failures.push(
      `screenshots must provide mostly unique evidence frames, got ${screenshotSummary?.uniqueSha256Count ?? "missing"} unique hash(es) for ${manifest.screenshots.length} screenshot(s)`,
    );
  }

  for (const viewportName of new Set(manifest.screenshots.map((screenshot) => screenshotGroupName(screenshot.name)))) {
    const group = manifest.screenshots.filter((screenshot) => screenshotGroupName(screenshot.name) === viewportName);
    const requiredUniqueFrames = group.filter((screenshot) =>
      !screenshot.name.endsWith("-reduced-motion.png") && !screenshot.fullPage,
    );
    const uniqueRequiredHashes = new Set(
      requiredUniqueFrames.map((screenshot) => screenshot.sha256).filter(Boolean),
    );

    if (group.length !== 6) {
      failures.push(
        `expected top, full-page, middle, studio, footer, and reduced-motion screenshots for ${viewportName}, got ${group.length}`,
      );
    }

    if (!group.some((screenshot) => screenshot.fullPage)) {
      failures.push(`screenshot group ${viewportName} is missing full-page evidence`);
    }

    if (!group.some((screenshot) => screenshot.name.endsWith("-middle.png"))) {
      failures.push(`screenshot group ${viewportName} is missing middle-section evidence`);
    }

    if (uniqueRequiredHashes.size !== requiredUniqueFrames.length) {
      failures.push(`screenshot group ${viewportName} contains duplicate top, studio, or footer visual evidence`);
    }
  }

  if (!manifest.distAssets.some((asset) => asset.name.endsWith(".js") && asset.bytes > 0 && asset.sha256)) {
    failures.push("missing hashed production JS asset evidence");
  }

  if (!manifest.distAssets.some((asset) => asset.name.endsWith(".css") && asset.bytes > 0 && asset.sha256)) {
    failures.push("missing hashed production CSS asset evidence");
  }

  if (failures.length > 0) {
    throw new Error(`Strict evidence manifest validation failed:\n- ${failures.join("\n- ")}`);
  }
}

function writeEvidenceManifest({ targetUrl, browserDiagnostic }) {
  mkdirSync(evidenceDir, { recursive: true });
  const manifestPath = join(evidenceDir, `strict-audit-${runId}.json`);
  const screenshots = listEvidenceScreenshots();
  const invalidScreenshots = screenshots.filter(
    (screenshot) => !screenshot.exists || !screenshot.matchesExpectedViewport,
  );

  if (invalidScreenshots.length > 0) {
    throw new Error(
      `Strict screenshot evidence mismatch: ${invalidScreenshots
        .map((screenshot) =>
          screenshot.fullPage
            ? `${screenshot.name} expected ${screenshot.expectedWidth}px wide and height >= ${screenshot.minHeight}, got ${
                screenshot.exists ? `${screenshot.width}x${screenshot.height}` : "missing"
              }`
            : `${screenshot.name} expected ${screenshot.expectedWidth}x${screenshot.expectedHeight}, got ${
                screenshot.exists ? `${screenshot.width}x${screenshot.height}` : "missing"
              }`,
        )
        .join("; ")}`,
    );
  }

  const manifest = {
    runId,
    targetUrl,
    createdAt: new Date().toISOString(),
    git: {
      head: gitValue(["rev-parse", "HEAD"]),
      branch: gitValue(["branch", "--show-current"]),
      dirtyShort: gitValue(["status", "--short"])?.split("\n").filter(Boolean) ?? [],
    },
    commands: steps.map((step) => ({
      label: step.label,
      command: [step.command, ...step.args].join(" "),
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      outputSha256: step.output ? createHash("sha256").update(step.output).digest("hex") : undefined,
    })),
    browserDiagnostic,
    officialBrowserProbe: readLatestOfficialBrowserProbe(),
    interactiveMotionTargetReport: readInteractiveMotionTargetReport(interactiveMotionTargetReportPath),
    gsapRaceReport: readGsapRaceReport(gsapRaceReportPath),
    runtimeQaReport: readRuntimeQaReport(runtimeQaReportPath),
    screenshots,
    screenshotEvidence: summarizeScreenshotEvidence(screenshots),
    distAssets: existsSync("dist/assets")
      ? readdirSync("dist/assets").map((name) => {
          const path = join("dist/assets", name);
          return { name, sha256: sha256(path), bytes: readFileSync(path).length };
        })
      : [],
  };

  validateEvidenceManifest(manifest);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Strict audit evidence written: ${manifestPath}`);
  return manifest;
}

async function main() {
  let previewProcess;

  try {
    mkdirSync(evidenceDir, { recursive: true });
    const preflightProbe = readLatestOfficialBrowserProbe();
    assertRunnableOfficialBrowserProbePreflight(preflightProbe);
    console.log(
      `[strict-audit preflight] official Browser probe fresh: ${preflightProbe.name}, age=${preflightProbe.probeAgeSeconds}s`,
    );

    runStep({
      command: "pnpm",
      args: ["verify"],
      label: "static, unit, OpenDesign, motion, and production build verification",
    });

    runStep({
      command: "pnpm",
      args: ["check:interactive-motion-targets"],
      label: "interactive GSAP target contract replay",
      env: { INTERACTIVE_MOTION_TARGET_REPORT_PATH: interactiveMotionTargetReportPath },
    });

    runStep({
      command: "pnpm",
      args: ["check:codex-runtime"],
      label: "Codex runtime audit for config, hooks, and goal schema",
      capture: true,
    });

    const port = await getFreePort();
    const targetUrl = `http://127.0.0.1:${port}/`;
    console.log(`[strict-audit preview] starting owned Vite preview at ${targetUrl}`);
    previewProcess = spawn(
      "pnpm",
      ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
      {
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    previewProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
    previewProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(targetUrl);

    runStep({
      command: "pnpm",
      args: ["check:gsap-race"],
      label: "owned-preview focused GSAP interaction race regression",
      env: { QA_URL: targetUrl, QA_GSAP_RACE_REPORT_PATH: gsapRaceReportPath },
      timeout: 180_000,
    });

    runStep({
      command: "pnpm",
      args: ["qa:runtime"],
      env: { QA_URL: targetUrl, QA_REPORT_PATH: runtimeQaReportPath },
      label: "owned-preview gstack browser runtime QA for desktop, mobile, reduced motion, and load budgets",
      timeout: 900_000,
    });

    const browserOutput = runStep({
      command: "pnpm",
      args: ["check:codex-browser"],
      env: { QA_URL: targetUrl },
      label: "Codex Browser shell-verifiable runtime diagnostic against owned preview",
      capture: true,
      timeout: 180_000,
    });
    const browserDiagnostic = JSON.parse(browserOutput.slice(browserOutput.indexOf("{")));

    const manifest = writeEvidenceManifest({ targetUrl, browserDiagnostic });
    const officialBrowserStatus = manifest.officialBrowserProbe?.getIabOk === true
      ? "official-browser-available"
      : "official-browser-unavailable";
    console.log(
      `Strict audit ok: frontend verify, owned-preview runtime QA, focused GSAP race, and shell Browser diagnostics passed serially; ${officialBrowserStatus}: ${
        manifest.officialBrowserProbe?.getIabError ?? manifest.officialBrowserProbe?.conclusion ?? "no error"
      }`,
    );
  } finally {
    if (previewProcess && !previewProcess.killed) {
      previewProcess.kill("SIGTERM");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
