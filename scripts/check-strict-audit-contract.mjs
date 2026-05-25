import {
  assertRunnableOfficialBrowserProbePreflight,
  validateEvidenceManifest,
} from "./run-strict-audit.mjs";
import { expectedGsapRaceTargets, interactiveMicroMotionTargets } from "./interactive-motion-targets.mjs";

const failures = [];
const targetUrl = "http://127.0.0.1:4173/";
const screenshotGroups = [
  "desktop",
  "motion-breakpoint-1360",
  "motion-breakpoint-1359",
  "motion-breakpoint-901",
  "motion-breakpoint-900",
  "motion-breakpoint-721",
  "motion-breakpoint-720",
  "mobile",
];
const screenshotWidths = {
  desktop: 1440,
  "motion-breakpoint-1360": 1360,
  "motion-breakpoint-1359": 1359,
  "motion-breakpoint-901": 901,
  "motion-breakpoint-900": 900,
  "motion-breakpoint-721": 721,
  "motion-breakpoint-720": 720,
  mobile: 390,
};
const screenshotHeights = {
  desktop: 1000,
  "motion-breakpoint-1360": 900,
  "motion-breakpoint-1359": 900,
  "motion-breakpoint-901": 900,
  "motion-breakpoint-900": 900,
  "motion-breakpoint-721": 900,
  "motion-breakpoint-720": 900,
  mobile: 844,
};
const expectedInteractiveMotionSelectors = [
  ...new Set(
    interactiveMicroMotionTargets.flatMap((target) =>
      Array.isArray(target.motionSelectors) && target.motionSelectors.length > 0
        ? target.motionSelectors
        : [target.selector],
    ),
  ),
];
function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function makeScreenshots() {
  let index = 0;
  return screenshotGroups.flatMap((group) => {
    const prefix = `runtime-qa-${group}`;
    const names = [
      `${prefix}.png`,
      `${prefix}-full-page.png`,
      `${prefix}-middle.png`,
      `${prefix}-studio.png`,
      `${prefix}-footer.png`,
      `${prefix}-reduced-motion.png`,
    ];

    return names.map((name) => {
      index += 1;
      const expectedWidth = screenshotWidths[group];
      const expectedHeight = screenshotHeights[group];

      return {
        name,
        exists: true,
        bytes: 24_000,
        width: expectedWidth,
        height: name.endsWith("-full-page.png") ? 2400 : expectedHeight,
        expectedWidth,
        expectedHeight,
        fullPage: name.endsWith("-full-page.png"),
        minHeight: name.endsWith("-full-page.png") ? 1800 : null,
        matchesExpectedViewport: true,
        visualStats: {
          ok: true,
          sampleCount: 4096,
          uniqueColorCount: 96,
          lumaStdDev: 32,
          lumaRange: 180,
          opaqueRatio: 1,
        },
        hasUsefulPixels: true,
        sha256: `contract-screenshot-${String(index).padStart(2, "0")}`,
      };
    });
  });
}

function makeRuntimeQaReport() {
  const screenshots = makeScreenshots();
  const topNavigationCurrent = screenshotGroups.flatMap((group) => [
    {
      label: group,
      section: "research",
      ok: true,
      expectedHref: "#research",
      currentCount: 1,
      currentHrefs: ["#research"],
    },
    {
      label: group,
      section: "published",
      ok: true,
      expectedHref: "#research",
      currentCount: 1,
      currentHrefs: ["#research"],
    },
    {
      label: group,
      section: "platform",
      ok: true,
      expectedHref: "#research",
      currentCount: 1,
      currentHrefs: ["#research"],
    },
    {
      label: group,
      section: "studio",
      ok: true,
      expectedHref: "#benchmarks",
      currentCount: 1,
      currentHrefs: ["#benchmarks"],
    },
    {
      label: group,
      section: "footer",
      ok: true,
      expectedHref: "#evidence",
      currentCount: 1,
      currentHrefs: ["#evidence"],
    },
  ]);

  return {
    exists: true,
    targetUrl,
    startedAt: "2026-05-23T20:00:30.000Z",
    finishedAt: "2026-05-23T20:01:00.000Z",
    passed: true,
    performanceCount: 16,
    motionFrameBudgetCount: 16,
    motionFrameBudgetPassCount: 16,
    scrollMotionFrameBudgetCount: 16,
    scrollMotionFrameBudgetPassCount: 16,
    studioInteractionMotionBudgetCount: 16,
    studioInteractionMotionBudgetPassCount: 16,
    studioStateMutationMotionBudgetCount: 16,
    studioStateMutationMotionBudgetPassCount: 16,
    studioStateMutationRefreshCount: 8,
    studioStateMutationRefreshPassCount: 8,
    studioFrameContinuityCount: 8,
    studioFrameContinuityPassCount: 8,
    desktopDossierReachabilityCount: 3,
    desktopDossierReachabilityPassCount: 3,
    pageContinuityCount: 16,
    pageContinuityPassCount: 16,
    pageContinuityNormalPassCount: 8,
    pageContinuityReducedPassCount: 8,
    pageContinuityFlowCount: 16,
    pageContinuityFlowPassCount: 16,
    pageContinuityNormalFlowPassCount: 8,
    pageContinuityReducedFlowPassCount: 8,
    pageContinuityCohesionCount: 16,
    pageContinuityCohesionPassCount: 16,
    pageContinuityNormalCohesionPassCount: 8,
    pageContinuityReducedCohesionPassCount: 8,
    pageContinuityMotionDebugCount: 16,
    pageContinuityMotionDebugPassCount: 16,
    pageContinuityNormalMotionDebugPassCount: 8,
    pageContinuityReducedMotionDebugPassCount: 8,
    maxPageContinuityGap: 0,
    maxPageContinuityFrameAlignmentDelta: 0,
    maxStudioFooterHandoffGap: 88,
    heroFirstPaintCount: 16,
    heroFirstPaintPassCount: 16,
    heroFirstPaintNormalPassCount: 8,
    heroFirstPaintReducedPassCount: 8,
    maxHeroFirstPaintTranslateY: 24,
    heroMobileLaneCount: 4,
    heroMobileLanePassCount: 4,
    maxHeroMobileLaneHeight: 118,
    interactiveMicroMotionCount: 176,
    interactiveMicroMotionPassCount: 176,
    interactiveMicroMotionSemanticLabelPassCount: 88,
    keyboardTargetSurfaceCount: 88,
    keyboardTargetSurfacePassCount: 88,
    keyboardTargetSurfaceSemanticLabelPassCount: 88,
    responsiveMotionLifecycleCount: 3,
    responsiveMotionLifecyclePassCount: 3,
    responsiveMotionLifecycleDesktopPassCount: 2,
    responsiveMotionLifecycleCompactPassCount: 1,
    dynamicReducedMotionLifecycleCount: 1,
    dynamicReducedMotionLifecyclePassCount: 1,
    dynamicReducedMotionNormalPhasePassCount: 2,
    dynamicReducedMotionReducedPhasePassCount: 1,
    dynamicReducedMotionRefreshPassCount: 1,
    mountLifecycleCount: 1,
    mountLifecyclePassCount: 1,
    mountLifecycleUnmountPassCount: 1,
    mountLifecycleRemountPassCount: 1,
    heroVisualContractCount: 8,
    heroVisualContractPassCount: 8,
    heroVisualContractActiveCount: 2,
    heroVisualContractInactiveCount: 6,
    screenshotCount: 48,
    screenshotDimensionCount: 48,
    screenshotHashCount: 48,
    fullPageScreenshotCount: 8,
    fullPageScreenshotWidthPassCount: 8,
    layoutStabilityCount: 16,
    motionPlaybackCount: 2,
    motionPlaybackPassCount: 2,
    motionPlaybackInspectorPassCount: 2,
    scrollTriggerRailCount: 40,
    scrollTriggerRailPassCount: 40,
    scrollTriggerRailSweepCount: 8,
    scrollTriggerRailSweepPassCount: 8,
    scrollTriggerRailReducedMotionCount: 8,
    scrollTriggerRailReducedMotionPassCount: 8,
    topNavigationCurrentCount: topNavigationCurrent.length,
    topNavigationCurrentPassCount: topNavigationCurrent.length,
    scrollTriggerInventoryCount: 16,
    scrollTriggerInventoryPassCount: 16,
    scrollTriggerReducedMotionSourceCount: 16,
    scrollTriggerReducedMotionSourcePassCount: 16,
    gsapAnimationInventoryCount: 16,
    gsapAnimationInventoryPassCount: 16,
    gsapReducedMotionSourceCount: 16,
    gsapReducedMotionSourcePassCount: 16,
    mediaReducedMotionCount: 8,
    mediaReducedMotionPassCount: 8,
    mediaReducedMotionSourcePassCount: 8,
    mediaReducedMotionInteractivePassCount: 88,
    mediaReducedMotionCssHoverPassCount: 40,
    rootReducedMotionCount: 8,
    rootReducedMotionPassCount: 8,
    reducedMotionStickyCount: 32,
    reducedMotionStickyPassCount: 32,
    studioMobileDensityCount: 2,
    studioMobileDensityPassCount: 2,
    maxStudioMobileMetricRibbonHeight: 220,
    readingProgressCount: 8,
    readingProgressPassCount: 8,
    readingProgressReducedMotionCount: 8,
    readingProgressReducedMotionPassCount: 8,
    consoleCleanCount: 16,
    consoleCleanPassCount: 16,
    screenshots: screenshots.map((screenshot) => ({
      filename: screenshot.name,
      path: `/tmp/${screenshot.name}`,
      exists: true,
      bytes: screenshot.bytes,
      sha256: screenshot.sha256,
      mtimeMs: Date.parse("2026-05-23T20:00:45.000Z"),
      capturedAt: "2026-05-23T20:00:45.000Z",
      fullPage: screenshot.fullPage,
      width: screenshot.width,
      height: screenshot.height,
      expectedWidth: screenshot.expectedWidth,
      expectedMinHeight: screenshot.fullPage ? screenshot.minHeight : null,
    })),
    topNavigationCurrent,
    maxCls: 0,
    maxWorstShift: 0,
    unsupportedLayoutStability: [],
  };
}

function makeGsapRaceReport() {
  const viewports = [
    { name: "motion-breakpoint-901", size: "901x900" },
    { name: "motion-breakpoint-900", size: "900x900" },
    { name: "motion-breakpoint-721", size: "721x900" },
  ];

  return {
    exists: true,
    path: "/tmp/gsap-race-contract.json",
    bytes: 42_000,
    sha256: "contract-gsap-race",
    targetUrl,
    startedAt: "2026-05-23T20:00:02.000Z",
    finishedAt: "2026-05-23T20:00:29.000Z",
    passed: true,
    viewportCount: 3,
    viewportPassCount: 3,
    viewports: viewports.map((viewport) => ({
      ...viewport,
      ok: true,
      sampleCount: 11,
      passCount: 11,
      evidenceRowPassCount: 1,
      realHoverSampleCount: 4,
      realHoverPassCount: 4,
      targetLabels: expectedGsapRaceTargets,
      realHoverTargetLabels: ["toprail-action", "surface-action", "map-node", "footer-action"],
      selectedTab: "Evidence ledger",
      activeEvidenceTitle: "Mem0",
      selectedDossier: "Mem0",
    })),
    sampleCount: 33,
    passCount: 33,
    evidenceRowSampleCount: 3,
    evidenceRowPassCount: 3,
    realHoverSampleCount: 12,
    realHoverPassCount: 12,
    failures: [],
  };
}

function makeInteractiveMotionTargetReport() {
  return {
    exists: true,
    path: "/tmp/interactive-motion-targets-contract.json",
    bytes: 16_000,
    sha256: "contract-interactive-motion-targets",
    startedAt: "2026-05-23T20:00:00.000Z",
    finishedAt: "2026-05-23T20:00:01.000Z",
    passed: true,
    targetCount: expectedGsapRaceTargets.length,
    labels: expectedGsapRaceTargets,
    expectedLabels: expectedGsapRaceTargets,
    labelsMatch: true,
    labelsUnique: true,
    scriptBridgeLabels: expectedGsapRaceTargets,
    scriptBridgeLabelsMatch: true,
    motionSelectors: expectedInteractiveMotionSelectors,
    expectedMotionSelectors: expectedInteractiveMotionSelectors,
    motionSelectorsMatch: true,
    setupLabels: [
      "hero-research-action",
      "hero-studio-action",
      "toprail-action",
      "map-node",
      "matrix-system-button",
      "stack-selector-button",
      "evidence-row",
    ],
    allowedSetupCount: 5,
    expressionSha256: "contract-expression",
    sourceFiles: {
      data: {
        exists: true,
        bytes: 2048,
        sha256: "a".repeat(64),
      },
      runtimeModule: {
        exists: true,
        bytes: 2048,
        sha256: "b".repeat(64),
      },
      motionHook: {
        exists: true,
        bytes: 2048,
        sha256: "c".repeat(64),
        hasHardcodedSelectorList: false,
      },
      scriptBridge: {
        exists: true,
        bytes: 2048,
        sha256: "d".repeat(64),
        readsRuntimeData: true,
      },
    },
    failures: [],
  };
}

function makeBrowserDiagnostic({
  classification = "stale-codex-browser-sockets-iab-unverified",
  socketFreshness = "all-stale-over-1h",
} = {}) {
  return {
    status: "fallback-ok-iab-unverified",
    diagnosis: {
      classification,
    },
    findings: [
      { label: "browserClientIabSessionFilter", value: "present" },
      { label: "browserClientRequiresSessionParams", value: "present" },
      {
        label: "browserClientDiscoveryFailureReasons",
        value: "missing-session-metadata,no-iab-backends,no-session-match",
      },
      { label: "codexBrowserSocketFingerprintSha256", value: "contract-fingerprint" },
      { label: "codexBrowserSocketAgeBuckets", value: "freshUnder5m=0, warmUnder1h=0, staleOver1h=11" },
      { label: "codexBrowserSocketFreshness", value: socketFreshness },
      {
        label: "fallbackTargetSmoke",
        value: JSON.stringify({
          ok: true,
          finalUrl: targetUrl,
          title: "MemoryBench — AI Memory Intelligence",
          h1: "When AI agents remember, what survives and why?",
          mainCount: 1,
        }),
      },
    ],
  };
}

function makeUnavailableProbe() {
  return {
    exists: true,
    name: "codex-browser-iab-probe-2026-05-23T20-00-00-000Z-11111111-2222-4333-8444-555555555555.json",
    path: "/tmp/codex-browser-iab-probe-contract.json",
    bytes: 1200,
    sha256: "contract-browser-probe",
    createdAt: "2026-05-23T20:00:00.000Z",
    probeRunId: "11111111-2222-4333-8444-555555555555",
    probeSource: "scripts/probe-official-browser-iab.mjs",
    runtimeSurface: "codex-browser-node-repl",
    operationTimeoutMs: 12000,
    smokeTimeoutMs: 15000,
    operationTimingsMs: {
      "agent.browsers.list": 3,
      "agent.browsers.get.iab": 4,
    },
    probeAgeSeconds: 0,
    requestMetaKeys: ["threadId"],
    requestMetadataDiagnostic: {
      requestMetaKeys: ["progressToken", "threadId", "x-codex-turn-metadata"],
      turnMetadataType: "object",
      turnMetadataParseOk: true,
      turnMetadataKeys: ["model", "session_id", "thread_id", "turn_id"],
      hasSessionId: true,
      hasTurnId: true,
      parseError: null,
    },
    listOk: true,
    list: [],
    listCount: 0,
    getIabOk: false,
    iabBrowserId: null,
    getIabError: "Browser is not available: iab",
    availabilitySmoke: null,
    conclusion: "official-iab-unavailable-current-thread",
    diagnosis: {
      classification: "session-metadata-present-no-iab-backends",
      summary: "Browser request metadata includes session_id and turn_id, but the official Browser runtime lists zero IAB backends for this thread.",
      evidence: {
        listOk: true,
        listCount: 0,
        getIabOk: false,
        getIabError: "Browser is not available: iab",
        hasSessionId: true,
        hasTurnId: true,
        turnMetadataKeys: ["model", "session_id", "thread_id", "turn_id"],
      },
      nextAction: "Repair or restart the Browser backend registration path so an IAB backend is registered for the current Codex session; then rerun this probe and require getIabOk=true plus smoke evidence.",
    },
  };
}

function makeAvailableProbe() {
  return {
    ...makeUnavailableProbe(),
    list: [{ id: "iab", name: "Codex Browser", type: "iab" }],
    listCount: 1,
    getIabOk: true,
    iabBrowserId: "contract-iab-browser",
    getIabError: null,
    availabilitySmoke: {
      attempted: true,
      ok: true,
      finalUrl: targetUrl,
      h1: "When AI agents remember, what survives and why?",
      mainCount: 1,
    },
    conclusion: "official-iab-available-current-thread",
    diagnosis: {
      classification: "official-iab-available-and-smoke-tested",
      summary: "The official Codex in-app Browser backend is registered for this thread and can drive the MemoryBench smoke page.",
      evidence: {
        listOk: true,
        listCount: 1,
        getIabOk: true,
        hasSessionId: true,
        hasTurnId: true,
        smokeAttempted: true,
        smokeOk: true,
      },
      nextAction: "Use the official Browser runtime for local UI verification.",
    },
  };
}

function makeValidManifest({
  officialBrowserProbe = makeUnavailableProbe(),
  browserDiagnostic = makeBrowserDiagnostic(),
} = {}) {
  const screenshots = makeScreenshots();
  return {
    runId: "strict-contract",
    targetUrl,
    createdAt: "2026-05-23T20:00:00.000Z",
    commands: [
      {
        command: "pnpm verify",
        startedAt: "2026-05-23T19:59:00.000Z",
        finishedAt: "2026-05-23T19:59:59.000Z",
      },
      {
        command: "pnpm check:interactive-motion-targets",
        startedAt: "2026-05-23T20:00:00.000Z",
        finishedAt: "2026-05-23T20:00:01.000Z",
      },
      {
        command: "pnpm check:codex-runtime",
        startedAt: "2026-05-23T20:00:01.000Z",
        finishedAt: "2026-05-23T20:00:02.000Z",
      },
      {
        command: "pnpm check:gsap-race",
        startedAt: "2026-05-23T20:00:02.000Z",
        finishedAt: "2026-05-23T20:00:29.000Z",
      },
      {
        command: "pnpm qa:runtime",
        startedAt: "2026-05-23T20:00:30.000Z",
        finishedAt: "2026-05-23T20:01:01.000Z",
      },
      {
        command: "pnpm check:codex-browser",
        startedAt: "2026-05-23T20:01:01.000Z",
        finishedAt: "2026-05-23T20:01:04.000Z",
      },
    ],
    browserDiagnostic,
    officialBrowserProbe,
    interactiveMotionTargetReport: makeInteractiveMotionTargetReport(),
    gsapRaceReport: makeGsapRaceReport(),
    runtimeQaReport: makeRuntimeQaReport(),
    screenshots,
    screenshotEvidence: {
      expectedCount: 48,
      actualCount: 48,
      presentCount: 48,
      usefulPixelCount: 48,
      uniqueSha256Count: 48,
      minBytes: 24_000,
      minUniqueColorCount: 96,
      minLumaStdDev: 32,
      minLumaRange: 180,
      totalBytes: 48 * 24_000,
    },
    distAssets: [
      { name: "index-contract.js", bytes: 50_000, sha256: "contract-js" },
      { name: "index-contract.css", bytes: 24_000, sha256: "contract-css" },
    ],
  };
}

function assertPass(label, manifest) {
  try {
    validateEvidenceManifest(manifest);
  } catch (error) {
    failures.push(`${label} should pass: ${error?.message ?? error}`);
  }
}

function assertFail(label, manifest, expectedMessage) {
  try {
    validateEvidenceManifest(manifest);
    failures.push(`${label} should fail`);
  } catch (error) {
    expect(
      String(error?.message ?? error).includes(expectedMessage),
      `${label} should fail with "${expectedMessage}", got: ${error?.message ?? error}`,
    );
  }
}

function assertThrows(label, action, expectedMessage) {
  try {
    action();
    failures.push(`${label} should throw`);
  } catch (error) {
    expect(
      String(error?.message ?? error).includes(expectedMessage),
      `${label} should throw with "${expectedMessage}", got: ${error?.message ?? error}`,
    );
  }
}

assertPass("current unavailable official Browser state", makeValidManifest());
assertPass("repaired available official Browser state", makeValidManifest({ officialBrowserProbe: makeAvailableProbe() }));
assertPass(
  "fresh Codex-owned socket diagnostic state",
  makeValidManifest({
    browserDiagnostic: makeBrowserDiagnostic({
      classification: "codex-owned-sockets-but-iab-unverified",
      socketFreshness: "fresh-under-5m-present",
    }),
  }),
);

{
  const manifest = makeValidManifest({ officialBrowserProbe: makeAvailableProbe() });
  manifest.officialBrowserProbe.availabilitySmoke.ok = false;
  assertFail("available official Browser without smoke success", manifest, "did not prove smoke-page navigation");
}

{
  const manifest = makeValidManifest({ officialBrowserProbe: makeAvailableProbe() });
  manifest.officialBrowserProbe.availabilitySmoke.finalUrl = "https://example.test/";
  assertFail("available official Browser with non-local smoke URL", manifest, "final URL must stay on a local 127.0.0.1 preview");
}

{
  const manifest = makeValidManifest({ officialBrowserProbe: makeAvailableProbe() });
  manifest.officialBrowserProbe.availabilitySmoke.h1 = "Wrong product";
  assertFail("available official Browser with wrong smoke H1", manifest, "must prove the MemoryBench hero h1");
}

{
  const manifest = makeValidManifest({ officialBrowserProbe: makeAvailableProbe() });
  manifest.officialBrowserProbe.availabilitySmoke.mainCount = 2;
  assertFail("available official Browser with duplicate main landmarks", manifest, "must prove one main landmark");
}

{
  const manifest = makeValidManifest({ officialBrowserProbe: makeAvailableProbe() });
  manifest.officialBrowserProbe.iabBrowserId = null;
  assertFail("available official Browser without browser id", manifest, "did not record iabBrowserId");
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.getIabError = "different error";
  assertFail("unavailable official Browser with loose error", manifest, "unexpected official Browser probe state");
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.listOk = false;
  assertFail(
    "unavailable official Browser without successful list proof",
    manifest,
    "official Browser unavailable probe must prove browser list() succeeded before get('iab') failed",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.iabBrowserId = "unexpected-iab";
  assertFail(
    "unavailable official Browser with browser id",
    manifest,
    "official Browser unavailable probe must not record an iabBrowserId",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.availabilitySmoke = { attempted: true, ok: false };
  assertFail(
    "unavailable official Browser with smoke evidence",
    manifest,
    "official Browser unavailable probe must not contain smoke navigation evidence",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.diagnosis.classification = "official-iab-unavailable-unclassified";
  assertFail(
    "unavailable official Browser without zero-backend diagnosis",
    manifest,
    "must classify as session-metadata-present-no-iab-backends",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.diagnosis.evidence.hasSessionId = false;
  assertFail(
    "unavailable official Browser diagnosis without session metadata evidence",
    manifest,
    "must preserve session metadata and zero-backend evidence",
  );
}

{
  const manifest = makeValidManifest({ officialBrowserProbe: makeAvailableProbe() });
  manifest.officialBrowserProbe.diagnosis.classification = "official-iab-available-smoke-unverified";
  assertFail(
    "available official Browser without smoke-tested diagnosis",
    manifest,
    "must classify as official-iab-available-and-smoke-tested",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.probeAgeSeconds = 1801;
  assertFail("stale official Browser probe", manifest, "official Browser probe is stale");
}

assertThrows(
  "official Browser preflight without long-run freshness buffer",
  () => assertRunnableOfficialBrowserProbePreflight({
    ...makeValidManifest().officialBrowserProbe,
    probeAgeSeconds: 121,
  }),
  "exceeds 120s",
);

{
  const manifest = makeValidManifest();
  manifest.browserDiagnostic.findings = manifest.browserDiagnostic.findings.filter(
    (finding) => finding.label !== "fallbackTargetSmoke",
  );
  assertFail(
    "Browser diagnostic without fallback MemoryBench smoke",
    manifest,
    "missing fallback MemoryBench smoke evidence",
  );
}

{
  const manifest = makeValidManifest();
  const smoke = manifest.browserDiagnostic.findings.find((finding) => finding.label === "fallbackTargetSmoke");
  smoke.value = JSON.stringify({
    ok: false,
    finalUrl: targetUrl,
    title: "Unexpected",
    h1: "Unexpected page",
    mainCount: 2,
  });
  assertFail(
    "Browser diagnostic with broken fallback MemoryBench smoke",
    manifest,
    "fallback smoke did not prove MemoryBench page identity",
  );
}

{
  const manifest = makeValidManifest();
  const smoke = manifest.browserDiagnostic.findings.find((finding) => finding.label === "fallbackTargetSmoke");
  smoke.value = JSON.stringify({
    ok: true,
    finalUrl: targetUrl,
    title: "Unexpected",
    h1: "When AI agents remember, what survives and why?",
    mainCount: 1,
  });
  assertFail(
    "Browser diagnostic with wrong fallback MemoryBench document title",
    manifest,
    "document title",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.requestMetaKeys = [];
  assertFail("official Browser probe without thread metadata", manifest, "missing threadId request metadata evidence");
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.requestMetadataDiagnostic.hasSessionId = false;
  assertFail(
    "official Browser probe without Browser session metadata diagnostic",
    manifest,
    "session_id request metadata is present",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.requestMetadataDiagnostic.hasTurnId = false;
  assertFail(
    "official Browser probe without Browser turn metadata diagnostic",
    manifest,
    "turn_id request metadata is present",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.requestMetadataDiagnostic.turnMetadataKeys = ["session_id"];
  assertFail(
    "official Browser probe without redacted turn metadata key evidence",
    manifest,
    "redacted Browser turn metadata key evidence",
  );
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.probeRunId = null;
  assertFail("official Browser probe without run id", manifest, "must persist a UUID probeRunId");
}

{
  const manifest = makeValidManifest();
  manifest.officialBrowserProbe.name = "codex-browser-iab-probe-contract-without-run-id.json";
  assertFail(
    "official Browser probe filename without run id",
    manifest,
    "filename must include the persisted probeRunId",
  );
}

{
  const manifest = makeValidManifest();
  delete manifest.officialBrowserProbe.operationTimeoutMs;
  assertFail(
    "official Browser probe without operation timeout",
    manifest,
    "operation timeout configuration",
  );
}

{
  const manifest = makeValidManifest();
  delete manifest.officialBrowserProbe.operationTimingsMs["agent.browsers.list"];
  assertFail(
    "official Browser probe without list timing",
    manifest,
    "browser list timing evidence",
  );
}

{
  const manifest = makeValidManifest();
  manifest.browserDiagnostic.findings = manifest.browserDiagnostic.findings.filter(
    (finding) => finding.label !== "codexBrowserSocketFreshness",
  );
  assertFail("Browser diagnostic without socket freshness evidence", manifest, "missing socket freshness evidence");
}

{
  const manifest = makeValidManifest({
    browserDiagnostic: makeBrowserDiagnostic({
      classification: "stale-codex-browser-sockets-iab-unverified",
      socketFreshness: "fresh-under-5m-present",
    }),
  });
  assertFail("stale Browser diagnostic without stale socket evidence", manifest, "requires all-stale socket evidence");
}

{
  const manifest = makeValidManifest({
    browserDiagnostic: makeBrowserDiagnostic({
      classification: "codex-owned-sockets-but-iab-unverified",
      socketFreshness: "all-stale-over-1h",
    }),
  });
  assertFail("fresh Browser diagnostic with all stale sockets", manifest, "must not be used when every Codex Browser socket is stale");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityPassCount = 7;
  assertFail("runtime QA with incomplete page-continuity coverage", manifest, "expected 16 passing page-continuity samples");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityFlowPassCount = 15;
  assertFail(
    "runtime QA with incomplete page evidence-flow continuity coverage",
    manifest,
    "expected 16 passing page continuity evidence-flow samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityReducedFlowPassCount = 7;
  assertFail(
    "runtime QA with incomplete reduced-motion evidence-flow continuity coverage",
    manifest,
    "expected 8 reduced-motion page continuity evidence-flow samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityCohesionPassCount = 15;
  assertFail(
    "runtime QA with incomplete page frame-cohesion coverage",
    manifest,
    "expected 16 passing page continuity frame-cohesion samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityReducedCohesionPassCount = 7;
  assertFail(
    "runtime QA with incomplete reduced-motion frame-cohesion coverage",
    manifest,
    "expected 8 reduced-motion page continuity frame-cohesion samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityMotionDebugPassCount = 15;
  assertFail(
    "runtime QA with incomplete GSAP briefing debug coverage",
    manifest,
    "expected 16 passing page continuity GSAP briefing debug samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityReducedMotionDebugPassCount = 7;
  assertFail(
    "runtime QA with incomplete reduced-motion GSAP briefing debug coverage",
    manifest,
    "expected 8 reduced-motion page continuity GSAP briefing debug samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.maxStudioFooterHandoffGap = 140;
  assertFail(
    "runtime QA with loose Studio-to-footer handoff",
    manifest,
    "Studio to footer handoff gap 140px exceeds 112px",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.interactiveMicroMotionSemanticLabelPassCount = 87;
  assertFail(
    "runtime QA with incomplete semantic interactive labels",
    manifest,
    "expected 88 passing semantic interactive micro motion labels",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.keyboardTargetSurfacePassCount = 87;
  assertFail(
    "runtime QA with incomplete keyboard target surface evidence",
    manifest,
    "expected 88 passing keyboard target surface samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.keyboardTargetSurfaceSemanticLabelPassCount = 87;
  assertFail(
    "runtime QA with incomplete keyboard target semantic labels",
    manifest,
    "expected 88 passing keyboard target semantic labels",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.responsiveMotionLifecyclePassCount = 2;
  assertFail(
    "runtime QA with incomplete responsive GSAP lifecycle coverage",
    manifest,
    "expected 3 passing responsive GSAP matchMedia lifecycle samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.responsiveMotionLifecycleDesktopPassCount = 1;
  assertFail(
    "runtime QA with incomplete desktop responsive GSAP lifecycle coverage",
    manifest,
    "expected 2 passing desktop responsive GSAP lifecycle samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.responsiveMotionLifecycleCompactPassCount = 0;
  assertFail(
    "runtime QA with incomplete compact responsive GSAP lifecycle coverage",
    manifest,
    "expected 1 passing compact responsive GSAP lifecycle sample",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.dynamicReducedMotionLifecyclePassCount = 0;
  assertFail(
    "runtime QA with incomplete dynamic reduced-motion lifecycle coverage",
    manifest,
    "expected 1 passing dynamic reduced-motion lifecycle sample",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.dynamicReducedMotionNormalPhasePassCount = 1;
  assertFail(
    "runtime QA with incomplete dynamic reduced-motion normal rebuild coverage",
    manifest,
    "expected 2 passing dynamic reduced-motion normal phases",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.dynamicReducedMotionReducedPhasePassCount = 0;
  assertFail(
    "runtime QA with incomplete dynamic reduced-motion cleanup coverage",
    manifest,
    "expected 1 passing dynamic reduced-motion cleanup phase",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.dynamicReducedMotionRefreshPassCount = 0;
  assertFail(
    "runtime QA with missing dynamic reduced-motion refresh rebuild evidence",
    manifest,
    "expected 1 dynamic reduced-motion refresh rebuild sample",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mountLifecyclePassCount = 0;
  assertFail(
    "runtime QA with incomplete GSAP mount lifecycle evidence",
    manifest,
    "expected 1 passing GSAP mount lifecycle sample",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mountLifecycleUnmountPassCount = 0;
  assertFail(
    "runtime QA with incomplete GSAP unmount cleanup evidence",
    manifest,
    "expected 1 passing GSAP unmount cleanup sample",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mountLifecycleRemountPassCount = 0;
  assertFail(
    "runtime QA with incomplete GSAP remount rebuild evidence",
    manifest,
    "expected 1 passing GSAP remount rebuild sample",
  );
}

{
  const manifest = makeValidManifest();
  manifest.commands = manifest.commands.filter((step) => step.command !== "pnpm check:interactive-motion-targets");
  assertFail(
    "manifest without interactive target contract gate",
    manifest,
    "missing command evidence: pnpm check:interactive-motion-targets",
  );
}

{
  const manifest = makeValidManifest();
  const targetIndex = manifest.commands.findIndex((step) => step.command === "pnpm check:interactive-motion-targets");
  const raceIndex = manifest.commands.findIndex((step) => step.command === "pnpm check:gsap-race");
  [manifest.commands[targetIndex], manifest.commands[raceIndex]] = [
    manifest.commands[raceIndex],
    manifest.commands[targetIndex],
  ];
  assertFail(
    "manifest with interactive target contract after focused race",
    manifest,
    "interactive motion target contract must run before focused GSAP race gate",
  );
}

{
  const manifest = makeValidManifest();
  manifest.interactiveMotionTargetReport.startedAt = "2026-05-23T19:59:58.000Z";
  assertFail(
    "interactive target report outside command window",
    manifest,
    "interactive motion target report timestamp outside command window for pnpm check:interactive-motion-targets",
  );
}

{
  const manifest = makeValidManifest();
  manifest.commands = manifest.commands.filter((step) => step.command !== "pnpm check:gsap-race");
  assertFail("manifest without focused GSAP race gate", manifest, "missing command evidence: pnpm check:gsap-race");
}

{
  const manifest = makeValidManifest();
  const raceIndex = manifest.commands.findIndex((step) => step.command === "pnpm check:gsap-race");
  const runtimeIndex = manifest.commands.findIndex((step) => step.command === "pnpm qa:runtime");
  [manifest.commands[raceIndex], manifest.commands[runtimeIndex]] = [
    manifest.commands[runtimeIndex],
    manifest.commands[raceIndex],
  ];
  assertFail("manifest with focused GSAP race gate after runtime QA", manifest, "focused GSAP race gate must run before full runtime QA");
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.finishedAt = "2026-05-23T20:00:31.000Z";
  assertFail(
    "focused GSAP race report outside command window",
    manifest,
    "focused GSAP race report timestamp outside command window for pnpm check:gsap-race",
  );
}

{
  const manifest = makeValidManifest();
  manifest.interactiveMotionTargetReport.exists = false;
  assertFail(
    "manifest without interactive target contract report",
    manifest,
    "missing interactive motion target report",
  );
}

{
  const manifest = makeValidManifest();
  const footerMotionSelector = ".footer-actions .action-link";
  manifest.interactiveMotionTargetReport.motionSelectors = manifest.interactiveMotionTargetReport.motionSelectors.filter(
    (selector) => selector !== footerMotionSelector,
  );
  assertFail(
    "interactive target report without footer motion selector",
    manifest,
    `interactive motion target report missing motion selector ${footerMotionSelector}`,
  );
}

{
  const manifest = makeValidManifest();
  manifest.interactiveMotionTargetReport.sourceFiles.motionHook.hasHardcodedSelectorList = true;
  assertFail(
    "interactive target report with hard-coded hook selector list",
    manifest,
    "interactive motion target report found a hard-coded selector list in the GSAP hook",
  );
}

{
  const manifest = makeValidManifest();
  delete manifest.interactiveMotionTargetReport.sourceFiles.data.sha256;
  assertFail(
    "interactive target report without source hash",
    manifest,
    "interactive motion target report source file missing sha256 evidence: data",
  );
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.exists = false;
  assertFail("manifest without focused GSAP race report", manifest, "missing focused GSAP race report");
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.sampleCount = 32;
  assertFail("focused GSAP race report with incomplete samples", manifest, "expected 33 passing focused GSAP race samples");
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.evidenceRowPassCount = 2;
  assertFail("focused GSAP race report with missing Evidence row pass", manifest, "expected 3 passing focused Evidence row race samples");
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.realHoverPassCount = 11;
  assertFail(
    "focused GSAP race report with incomplete real hover samples",
    manifest,
    "expected 12 passing focused real hover GSAP samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.viewports = manifest.gsapRaceReport.viewports.filter(
    (viewport) => viewport.name !== "motion-breakpoint-721",
  );
  assertFail("focused GSAP race report without 721px viewport", manifest, "focused GSAP race report missing viewport motion-breakpoint-721");
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.viewports[0].realHoverTargetLabels = manifest.gsapRaceReport.viewports[0].realHoverTargetLabels.filter(
    (target) => target !== "map-node",
  );
  assertFail(
    "focused GSAP race report without real hover map-node coverage",
    manifest,
    "focused GSAP real hover report missing target map-node",
  );
}

{
  const manifest = makeValidManifest();
  manifest.gsapRaceReport.viewports[0].targetLabels = manifest.gsapRaceReport.viewports[0].targetLabels.filter(
    (target) => target !== "footer-action",
  );
  assertFail("focused GSAP race report without footer target coverage", manifest, "focused GSAP race report missing target footer-action");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.pageContinuityReducedPassCount = 7;
  assertFail("runtime QA with incomplete reduced-motion page-continuity coverage", manifest, "expected 8 reduced-motion page-continuity samples");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.maxPageContinuityFrameAlignmentDelta = 12;
  assertFail("runtime QA with misaligned briefing frames", manifest, "briefing frame alignment delta");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.heroFirstPaintPassCount = 15;
  assertFail("runtime QA with hidden hero first paint", manifest, "expected 16 passing hero first-paint samples");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.maxHeroFirstPaintTranslateY = 70;
  assertFail("runtime QA with displaced hero first paint", manifest, "hero first-paint translateY");
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.heroMobileLanePassCount = 3;
  assertFail(
    "runtime QA with incomplete mobile hero category lane coverage",
    manifest,
    "expected 4 passing mobile hero category lane samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.maxHeroMobileLaneHeight = 150;
  assertFail(
    "runtime QA with oversized mobile hero category lane",
    manifest,
    "mobile hero category lane height 150px exceeds 132px",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.fullPageScreenshotWidthPassCount = 7;
  assertFail("runtime QA with narrow full-page screenshot", manifest, "expected 8 full-width full-page screenshot records");
}

{
  const manifest = makeValidManifest();
  const fullPage = manifest.screenshots.find((screenshot) => screenshot.name.endsWith("-full-page.png"));
  fullPage.width = 56;
  fullPage.matchesExpectedViewport = false;
  assertFail("manifest with narrow full-page screenshot evidence", manifest, "full-page screenshot mismatch");
}

{
  const manifest = makeValidManifest();
  const screenshot = manifest.runtimeQaReport.screenshots.find((item) => item.filename === "runtime-qa-desktop.png");
  screenshot.sha256 = "runtime-report-mismatch";
  assertFail(
    "manifest with stale screenshot file evidence",
    manifest,
    "runtime QA screenshot hash mismatch for runtime-qa-desktop.png",
  );
}

{
  const manifest = makeValidManifest();
  const screenshot = manifest.runtimeQaReport.screenshots.find((item) => item.filename === "runtime-qa-desktop.png");
  screenshot.capturedAt = "2026-05-23T20:00:29.000Z";
  assertFail(
    "manifest with stale screenshot capture timestamp",
    manifest,
    "runtime QA screenshot capturedAt outside run window for runtime-qa-desktop.png",
  );
}

{
  const manifest = makeValidManifest();
  const screenshot = manifest.runtimeQaReport.screenshots.find((item) => item.filename === "runtime-qa-desktop.png");
  screenshot.mtimeMs = Date.parse("2026-05-23T20:01:03.000Z");
  assertFail(
    "manifest with stale screenshot mtime",
    manifest,
    "runtime QA screenshot mtime outside run window for runtime-qa-desktop.png",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.finishedAt = "2026-05-23T20:01:03.000Z";
  assertFail(
    "runtime QA report outside command window",
    manifest,
    "runtime QA report timestamp outside command window for pnpm qa:runtime",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.motionPlaybackInspectorPassCount = 1;
  assertFail(
    "runtime QA with incomplete orbit playback inspector evidence",
    manifest,
    "expected 2 passing desktop orbit playback inspector samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.scrollTriggerReducedMotionSourcePassCount = 15;
  assertFail(
    "runtime QA with incomplete ScrollTrigger reduced-motion source evidence",
    manifest,
    "expected 16 passing ScrollTrigger reduced-motion source samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.topNavigationCurrentPassCount = 39;
  assertFail(
    "runtime QA with incomplete top navigation current-state evidence",
    manifest,
    "expected 40 passing top navigation current-state samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.gsapReducedMotionSourcePassCount = 15;
  assertFail(
    "runtime QA with incomplete GSAP reduced-motion source evidence",
    manifest,
    "expected 16 passing GSAP reduced-motion source samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mediaReducedMotionPassCount = 7;
  assertFail(
    "runtime QA with incomplete real media reduced-motion evidence",
    manifest,
    "expected 8 passing real media reduced-motion runtime samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mediaReducedMotionSourcePassCount = 7;
  assertFail(
    "runtime QA with incomplete real media reduced-motion source evidence",
    manifest,
    "expected 8 passing real media reduced-motion source samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mediaReducedMotionInteractivePassCount = 87;
  assertFail(
    "runtime QA with incomplete real media reduced-motion interaction evidence",
    manifest,
    "expected 88 passing real media reduced-motion interactive samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.mediaReducedMotionCssHoverPassCount = 39;
  assertFail(
    "runtime QA with incomplete real media reduced-motion CSS hover evidence",
    manifest,
    "expected 40 passing real media reduced-motion CSS hover samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.rootReducedMotionPassCount = 7;
  assertFail(
    "runtime QA with incomplete root reduced-motion marker evidence",
    manifest,
    "expected 8 passing root reduced-motion marker samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.reducedMotionStickyPassCount = 31;
  assertFail(
    "runtime QA with incomplete reduced-motion sticky positioning evidence",
    manifest,
    "expected 32 passing reduced-motion sticky positioning samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.studioMobileDensityPassCount = 1;
  assertFail(
    "runtime QA with incomplete mobile Studio metric density evidence",
    manifest,
    "expected 2 passing mobile Studio metric density samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.desktopDossierReachabilityPassCount = 2;
  assertFail(
    "runtime QA with incomplete desktop dossier reachability evidence",
    manifest,
    "expected 3 passing desktop dossier reachability samples",
  );
}

{
  const manifest = makeValidManifest();
  manifest.runtimeQaReport.studioStateMutationRefreshPassCount = 7;
  assertFail(
    "runtime QA with incomplete Studio state mutation refresh evidence",
    manifest,
    "expected 8 passing normal Studio state mutation refresh samples",
  );
}

if (failures.length > 0) {
  console.error(`Strict audit contract failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Strict audit contract ok: official Browser unavailable, repaired, broken-smoke, stale-socket diagnosis, page-continuity, hero first-paint, URL and real media reduced-motion sources, provenance, and freshness branches checked");
