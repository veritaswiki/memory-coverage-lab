import { readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf8");
const html = readFileSync("index.html", "utf8");
const motion = readFileSync("src/useMemoryBenchMotion.ts", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const setup = readFileSync("src/test/setup.ts", "utf8");
const runtimeQa = readFileSync("scripts/browser-runtime-qa.mjs", "utf8");
const designAudit = readFileSync("scripts/check-design-integrity.mjs", "utf8");
const browserProbeContract = readFileSync("scripts/check-codex-browser-probe-contract.mjs", "utf8");
const strictAuditContract = readFileSync("scripts/check-strict-audit-contract.mjs", "utf8");
const gsapRaceCheck = readFileSync("scripts/check-gsap-interaction-race.mjs", "utf8");
const interactiveTargets = readFileSync("scripts/interactive-motion-targets.mjs", "utf8");
const interactiveTargetData = readFileSync("src/data/interactiveMotionTargets.json", "utf8");
const interactiveTargetModule = readFileSync("src/data/interactiveMotionTargets.ts", "utf8");
const runStrict = readFileSync("scripts/run-strict-audit.mjs", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const failures = [];

function expectIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    failures.push(label);
  }
}

function expectExcludes(source, needle, label) {
  if (source.includes(needle)) {
    failures.push(label);
  }
}

function expectMinCount(source, needle, minCount, label) {
  const count = source.split(needle).length - 1;

  if (count < minCount) {
    failures.push(`${label}; found ${count}, expected at least ${minCount}`);
  }
}

function expectNoGsapLayoutProps(source) {
  const sourceWithoutStrings = source.replace(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g, "");
  const forbiddenProps = [
    "width",
    "height",
    "top",
    "right",
    "bottom",
    "left",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ];

  for (const prop of forbiddenProps) {
    const pattern = new RegExp(`\\b${prop}\\s*:`);
    if (pattern.test(sourceWithoutStrings)) {
      failures.push(`GSAP motion must not animate layout property "${prop}"`);
    }
  }
}

expectExcludes(app, 'from "gsap"', "App must not import GSAP directly; use the motion hook");
expectExcludes(app, 'from "@gsap/react"', "App must not import @gsap/react directly; use the motion hook");
expectExcludes(app, "useGSAP", "App must not call useGSAP directly; use useMemoryBenchMotion");
expectIncludes(app, "const appRef = useRef<HTMLDivElement>(null);", "App animations must be scoped to a root ref");
expectIncludes(app, "useMemoryBenchMotion(appRef", "App must delegate motion to the scoped motion hook");
expectIncludes(app, 'data-motion-reduce={hasMotionReduceOverride ? "true" : undefined}', "App must expose deterministic reduced-motion CSS override");
expectIncludes(app, 'document.documentElement.dataset.motionReduce = "true"', "URL reduced-motion override must mark the root scroller");
expectIncludes(app, "delete document.documentElement.dataset.motionReduce", "URL reduced-motion override must clean up the root scroller marker");
expectIncludes(html, 'document.documentElement.dataset.motionReduce = "true"', "HTML preboot script must mark URL reduced-motion before React starts");
expectIncludes(html, 'new URLSearchParams(window.location.search).get("motion") === "reduce"', "HTML preboot script must use the same deterministic reduced-motion URL override");
{
  const prebootIndex = html.indexOf('document.documentElement.dataset.motionReduce = "true"');
  const moduleIndex = html.indexOf('src="/src/main.tsx"');
  if (!(prebootIndex !== -1 && moduleIndex !== -1 && prebootIndex < moduleIndex)) {
    failures.push("HTML reduced-motion preboot script must run before the React module");
  }
}
expectIncludes(app, "tabIndex={mode === item.id ? 0 : -1}", "Studio tabs must use roving tabIndex");
expectIncludes(app, "handleModeKeyDown", "Studio tabs must support arrow-key navigation");
expectIncludes(app, '<main className="site-main" id="main-content" tabIndex={-1}>', "Hero, research, platform, and studio must live inside one main landmark");
expectIncludes(app, 'className="skip-link"', "App must provide a keyboard skip link before sticky navigation");
expectIncludes(app, 'href="#main-content"', "Skip link must target the main content landmark");
expectIncludes(app, 'id="main-content"', "Main landmark must expose a stable skip-link target");
expectIncludes(app, '<div className="page-continuum">', "Below-hero sections must use one continuous page system");
expectIncludes(app, '<div className="workbench-frame">', "Studio must share the page frame system");
expectIncludes(app, 'className="studio-workbench briefing-section"', "Studio workbench must be part of the unified briefing sequence");
expectIncludes(app, "aria-label={t.studio.railLabel}", "Studio must have its own briefing rail");
expectIncludes(app, '<SiteFooter ', "Footer must be part of the page continuum");
expectIncludes(app, 'className="site-footer briefing-section"', "Footer must use the unified briefing section grammar");
expectExcludes(app, '</main>\n\n      <footer', "Footer must not sit outside the continuous main page flow");
expectExcludes(app, '<main className="studio-workbench"', "Studio must not be a second or partial main landmark");
expectIncludes(app, 'className="surface-section briefing-section"', "Research surface must use the unified briefing section grammar");
expectIncludes(app, 'className="published-section briefing-section"', "Published research must use the unified briefing section grammar");
expectIncludes(app, 'className="platform-section briefing-section"', "Platform section must use the unified briefing section grammar");
expectIncludes(app, "<span>05</span>", "Footer handoff must follow the studio as the fifth briefing step");
expectIncludes(html, '<html lang="en">', "The public MemoryBench interface must declare English as its document language");
expectIncludes(motion, 'import gsap from "gsap";', "Motion hook must import GSAP directly");
expectIncludes(motion, 'import { useGSAP } from "@gsap/react";', "Motion hook must import @gsap/react useGSAP");
expectIncludes(motion, 'import { ScrollTrigger } from "gsap/ScrollTrigger";', "Motion hook must import ScrollTrigger for section scroll state");
expectIncludes(motion, "gsap.registerPlugin(useGSAP, ScrollTrigger);", "GSAP React and ScrollTrigger plugins must be registered");
expectIncludes(motion, "export function useMemoryBenchMotion", "Motion hook must export useMemoryBenchMotion");
expectIncludes(motion, 'scope: appRef', "useGSAP calls must be scoped to appRef");
expectIncludes(motion, "revertOnUpdate: true", "State-driven studio animations must revert on update");
expectIncludes(motion, 'gsap.matchMedia();', "Animations must use gsap.matchMedia()");
expectIncludes(motion, '"(prefers-reduced-motion: reduce)"', "Animations must handle reduced motion");
expectIncludes(motion, '"(prefers-reduced-motion: no-preference)"', "Studio animations must target no-preference motion");
expectIncludes(motion, 'get("motion") === "reduce"', "Motion hook must expose a deterministic reduced-motion QA override");
expectIncludes(motion, 'clearProps: "transform,opacity,visibility,willChange"', "Reveal animations must clear transform/opacity/visibility/willChange");
expectIncludes(motion, '.addLabel("navigation"', "Intro timeline must use labels for readable GSAP sequencing");
expectIncludes(motion, '.addLabel("heroCopy"', "Hero copy animation must be timeline-labelled");
expectIncludes(motion, '.addLabel("heroVisual"', "Desktop hero visual animation must be timeline-labelled");
expectIncludes(motion, '.addLabel("contentReveal"', "Below-hero reveal must be sequenced inside the intro timeline");
expectIncludes(motion, "introTimelineLabels", "Motion hook must publish intro timeline labels for runtime QA");
expectIncludes(motion, "reducedMotionSource", "Motion hook must publish whether reduced motion came from media preference or URL override");
expectIncludes(motion, 'currentReducedMotionSource = reducedMotionOverride ? "override" : "media"', "Motion hook must let the deterministic URL override win over media reduced motion");
expectIncludes(motion, 'currentReducedMotionSource = "none"', "Motion hook must reset reduced-motion source during normal animation setup and cleanup");
expectIncludes(motion, "currentIntroTimelineLabels = Object.keys(intro.labels)", "Motion hook debug evidence must derive timeline labels from the GSAP timeline");
expectIncludes(motion, ".to(\n            revealTargets,", "Below-hero reveal must be part of the intro timeline");
expectIncludes(motion, ".section-intro > *", "Section intros must participate in the unified below-hero reveal choreography");
expectIncludes(motion, ".continuity-lane article", "Continuity lane cells must participate in the unified below-hero reveal choreography");
expectIncludes(motion, ".footer-proof-grid article", "Footer proof cells must participate in the unified reveal choreography");
expectIncludes(motion, ".footer-actions a", "Footer actions must participate in the unified reveal choreography");
expectIncludes(motion, ".platform-copy > *", "Platform copy must participate in the unified reveal choreography");
expectIncludes(motion, ".workbench-head > *", "Studio heading must participate in the unified reveal choreography");
expectIncludes(motion, ".studio-controls", "Studio controls must participate in the unified reveal choreography");
expectExcludes(motion, "gsap.to(revealTargets", "Below-hero reveal must not be a detached delayed tween");
expectIncludes(motion, "tl.set([...panelTargets, ...dossierTargets, ...meterTargets]", "Studio state-update timeline must finish with an explicit residue cleanup set");
expectIncludes(motion, "IntersectionObserver", "Infinite orbit motion must pause when the hero is off-screen");
expectIncludes(motion, '"visibilitychange"', "Infinite orbit motion must pause while the document is hidden");
expectIncludes(motion, "cleanupOrbitPlayback", "Infinite orbit motion must have explicit cleanup");
expectIncludes(motion, "function killMemoryBenchRailTriggers", "ScrollTrigger rail state must have explicit lifecycle cleanup");
expectIncludes(motion, "clearBriefingRailState", "ScrollTrigger rail cleanup must remove active rail state");
expectIncludes(motion, "function activateBriefingRail", "ScrollTrigger rail activation must centralize exclusive state");
expectIncludes(motion, "function deactivateBriefingRail", "ScrollTrigger rail deactivation must centralize cleanup");
expectIncludes(motion, "function syncBriefingRail", "ScrollTrigger rail DOM state must resync when trigger state is already active");
expectIncludes(motion, "let currentBriefingRail", "ScrollTrigger rail sync must track current state to avoid repeated DOM writes");
expectIncludes(motion, "currentBriefingRail === rail", "ScrollTrigger rail activation must be idempotent during scroll updates");
expectIncludes(motion, "__memoryBenchMotion", "Motion hook must expose a safe runtime ScrollTrigger inventory snapshot for QA");
expectIncludes(motion, "__memoryBenchMotionInspect", "Motion hook must expose a safe live GSAP inventory inspector for QA");
expectIncludes(motion, "function writeMotionDebug", "Motion hook must publish ScrollTrigger lifecycle inventory evidence");
expectIncludes(motion, "function inspectAnimationInventory", "Motion hook must publish GSAP tween/timeline lifecycle inventory evidence");
expectIncludes(motion, "interactiveMotionTargets.find", "Motion hook animation inventory labels must derive semantic interactive labels from the shared target contract");
expectIncludes(motion, "`interactive:${exactInteractiveTarget.label}`", "Motion hook must expose semantic exact interactive target labels in debug inventory");
expectIncludes(motion, "`interactive:${motionInteractiveTarget.label}`", "Motion hook must expose semantic broad interactive target labels in debug inventory");
expectIncludes(motion, "gsap.globalTimeline.getChildren", "Motion hook debug evidence must inspect GSAP's global timeline");
expectIncludes(motion, "activeRepeatCount", "Motion hook debug evidence must report active repeating tweens");
expectIncludes(motion, "nonOrbitRepeatCount", "Motion hook debug evidence must report non-orbit repeating tween residue");
expectIncludes(motion, "function killMemoryBenchProjectTriggers", "Motion hook must be able to kill all project ScrollTriggers during reduced motion");
expectIncludes(motion, "getMemoryBenchTriggers", "Motion hook must isolate MemoryBench-owned ScrollTrigger instances");
expectIncludes(motion, "duplicateIds", "Motion hook debug evidence must report duplicate project ScrollTrigger ids");
expectIncludes(motion, "pinSpacerCount", "Motion hook debug evidence must report production pin-spacer residue");
expectIncludes(motion, "topNavigationCurrent", "Motion hook debug evidence must report the current top navigation anchor");
expectIncludes(motion, "function inspectBriefingSequence", "Motion hook debug evidence must inspect the full 01-05 briefing sequence");
expectIncludes(motion, "briefingSignature", "Motion hook debug evidence must publish one full-page briefing signature");
expectIncludes(motion, "activeBriefingRailLabel", "Motion hook debug evidence must publish the active briefing rail label");
expectIncludes(motion, "briefingSections", "Motion hook debug evidence must publish structured briefing section metadata");
expectIncludes(motion, "function syncTopNavigationFromActiveRail", "Motion hook must sync top navigation from the active briefing rail");
expectIncludes(motion, "currentStudioMode === \"evidence\" ? \"#evidence\" : \"#benchmarks\"", "Motion hook must preserve the Evidence top-nav state when the studio evidence tab is active");
expectIncludes(motion, 'label === "method handoff sequence"', "Footer method handoff must remain in the top-navigation evidence trail");
expectIncludes(runtimeQa, 'section: "footer", expectedRail: "method handoff sequence", expectedNavHref: "#evidence"', "Runtime QA must require the footer method handoff to keep Evidence current in top navigation");
expectIncludes(motion, "onRefresh: (self) => syncBriefingRail", "ScrollTrigger rail state must sync after refresh");
expectIncludes(motion, "onToggle: (self) =>", "ScrollTrigger rail state must sync on section boundary changes");
expectExcludes(motion, "onUpdate: (self) => syncBriefingRail", "ScrollTrigger rail state must not resync on every scroll tick");
expectIncludes(motion, 'setAttribute("aria-current", "step")', "Active ScrollTrigger rails must expose aria-current step state");
expectIncludes(motion, 'removeAttribute("aria-current")', "ScrollTrigger rail cleanup must remove aria-current step state");
expectIncludes(motion, "ScrollTrigger.create", "Briefing rail scroll state must be driven by ScrollTrigger");
expectIncludes(motion, "memorybench-reading-progress", "Reading progress must be driven by a project-specific ScrollTrigger");
expectIncludes(motion, "scaleX: 1", "Reading progress must animate with transform scaleX instead of layout width");
expectIncludes(motion, 'activeMotionScope: "(min-width: 0px)"', "GSAP matchMedia must initialize scroll state below the desktop breakpoint");
expectIncludes(motion, "memorybench-rail-", "ScrollTrigger instances must have a project-specific id prefix");
expectExcludes(motion, "toggleClass", "ScrollTrigger rail state must avoid duplicate class toggles and use centralized aria/class sync");
expectIncludes(motion, "refreshPriority: index", "ScrollTriggers must refresh in page order");
expectIncludes(motion, "ScrollTrigger.refresh()", "ScrollTrigger must refresh after section triggers are created");
expectIncludes(motion, "cancelAnimationFrame(refreshFrame)", "ScrollTrigger refresh frame must be cancelled during cleanup");
expectIncludes(motion, "currentStateMutationRefreshCount", "State-driven Studio animations must publish ScrollTrigger refresh evidence");
expectIncludes(motion, "stateMutationRefreshFrame", "State-driven Studio animations must schedule a post-animation ScrollTrigger refresh frame");
expectIncludes(motion, "isStateMutationMotionLive", "State-driven Studio animation completion callbacks must guard against stale lifecycle execution");
expectIncludes(motion, 'tl.eventCallback("onComplete", refreshAfterStateMutation)', "State-driven Studio refresh must run through the guarded completion callback");
expectIncludes(motion, "railTriggers.forEach((trigger) => trigger.kill())", "Created rail triggers must be killed during cleanup");
expectIncludes(motion, "contextSafe", "Interactive GSAP callbacks must be wrapped in useGSAP contextSafe");
expectIncludes(motion, '"pointerenter"', "Interactive controls must use GSAP pointerenter micro motion");
expectIncludes(motion, '"pointerleave"', "Interactive controls must return to rest on pointerleave");
expectIncludes(motion, 'pointerMotion: "(min-width: 721px)"', "Pointer hover micro motion must stay out of the mobile interaction model");
expectExcludes(motion, 'window.matchMedia("(min-width: 721px)")', "Pointer hover micro motion breakpoint must be managed by GSAP matchMedia lifecycle");
expectExcludes(motion, "new MutationObserver", "Interactive GSAP micro motion must use delegated root listeners instead of mutation rescans");
expectExcludes(motion, "pointerBoundTargets", "Interactive GSAP micro motion must not bind duplicate per-node pointer listeners");
expectIncludes(motion, 'clearProps: "transform,willChange"', "Interactive GSAP micro motion must clear transform/willChange residue");
expectNoGsapLayoutProps(motion);

expectIncludes(styles, ".page-continuum", "Styles must define the continuous below-hero page system");
expectIncludes(styles, ".skip-link", "Styles must define the keyboard skip link");
expectIncludes(styles, ".skip-link:focus-visible", "Skip link must become visible on keyboard focus");
expectIncludes(styles, "scroll-margin-top: 96px;", "Primary anchor targets must account for sticky navigation");
expectIncludes(styles, "scroll-margin-top: 112px;", "Tablet anchor targets must account for the compact sticky navigation height");
expectIncludes(styles, "scroll-margin-top: 24px;", "Mobile anchor targets should reset after navigation becomes static");
expectIncludes(styles, "#evidence", "Evidence navigation anchor must share the primary scroll-margin system");
expectIncludes(styles, ".briefing-frame", "Styles must define the unified briefing frame");
expectIncludes(styles, ".briefing-rail", "Styles must define the continuous briefing rail");
expectIncludes(styles, ".reading-progress", "Styles must define the top-rail reading progress indicator");
expectIncludes(styles, "transform: scaleX(0);", "Reading progress must use transform instead of width animation");
expectIncludes(styles, ".footer-frame", "Styles must define the footer as part of the unified briefing frame");
expectIncludes(styles, ".footer-proof-grid", "Styles must define the footer proof grid");
expectIncludes(styles, ".mode-tabs button span", "Studio tab labels must have a stable text container");
expectIncludes(styles, "white-space: nowrap;", "Compact studio tab labels must not wrap awkwardly");
expectIncludes(styles, "thead th:first-child", "Matrix table must keep the first column sticky for horizontal scanning");
expectIncludes(styles, "tbody th", "Matrix body headers must stay sticky for horizontal scanning");
expectIncludes(styles, ".section-frame", "Styles must define shared section frames");
expectIncludes(styles, ".workbench-frame", "Styles must define shared workbench frame");
expectIncludes(styles, "@media (prefers-reduced-motion: reduce)", "Styles must include reduced-motion fallback");
expectIncludes(styles, 'html[data-motion-reduce="true"]', "URL reduced-motion override must disable global smooth scrolling");
expectIncludes(styles, '.opendesign-app[data-motion-reduce="true"]', "Styles must support deterministic reduced-motion QA override");
expectIncludes(designAudit, "font sizing must not use viewport units", "Design audit must forbid viewport-scaled font sizing");
expectIncludes(designAudit, "accent palette must span at least 5 hue families", "Design audit must guard against one-note palettes");
expectIncludes(designAudit, "footer must remain inside the continuous main flow", "Design audit must guard the whole-page continuity contract");
expectIncludes(designAudit, ".page-continuum::after", "Design audit must forbid full-page continuum overlay repaint layers");
expectIncludes(designAudit, "briefing frame pseudo-element must not paint a section-wide background layer", "Design audit must keep briefing pseudo-elements repaint-safe");
expectIncludes(designAudit, "must keep the shared ruled top line", "Design audit must guard shared lower-page ruled copy structure");
expectIncludes(pkg.scripts?.verify ?? "", "pnpm check:design", "Verify must include the design integrity audit");
if (pkg.scripts?.["verify:full"] !== "pnpm qa:strict") {
  failures.push("Package scripts must expose verify:full as the strict runtime, GSAP race, Codex runtime, and Browser diagnostic gate");
}
if (pkg.scripts?.["verify:runtime"] !== "pnpm qa:strict") {
  failures.push("Package scripts must keep verify:runtime aligned with the strict runtime QA gate");
}
expectIncludes(pkg.scripts?.["check:gsap-race"] ?? "", "check-gsap-interaction-race.mjs", "Package scripts must expose the focused GSAP interaction race check");
expectIncludes(
  pkg.scripts?.["check:interactive-motion-targets"] ?? "",
  "check-interactive-motion-targets.mjs",
  "Package scripts must expose the interactive motion target contract check",
);
expectIncludes(
  pkg.scripts?.verify ?? "",
  "pnpm check:interactive-motion-targets",
  "Verify must include the interactive motion target contract check",
);
expectIncludes(setup, 'Object.defineProperty(window, "matchMedia"', "Tests must polyfill window.matchMedia");
expectIncludes(setup, "matches: false", "Default test matchMedia should prefer full motion unless a test overrides it");
expectIncludes(setup, 'Object.defineProperty(window, "scrollTo"', "Tests must polyfill window.scrollTo for ScrollTrigger");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), "?motion=reduce", "Tests must cover the deterministic reduced-motion URL override");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), 'document.documentElement).toHaveAttribute("data-motion-reduce", "true")', "Tests must prove URL reduced-motion marks the root scroller");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), 'motionDebugForTest()?.mode).toBe("reduced")', "Tests must prove the real prefers-reduced-motion media branch writes reduced GSAP debug state");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), 'motionDebugForTest()?.reducedMotionSource).toBe("media")', "Tests must prove real media reduced-motion source is recorded");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), 'motionDebugForTest()?.reducedMotionSource).toBe("override")', "Tests must prove URL override reduced-motion source is recorded separately");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), "when media also reduces motion", "Tests must prove URL override source wins when media and URL reduced-motion signals overlap");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), "motionDebugForTest()?.introTimelineLabels).toEqual([]", "Tests must prove media reduced-motion creates no intro timeline labels");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), "motionDebugForTest()?.triggerIds).toEqual([]", "Tests must prove media reduced-motion creates no project ScrollTriggers");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), "disconnects desktop orbit playback listeners on unmount", "Tests must cover orbit cleanup behavior");
expectIncludes(motion, 'isDesktop: "(min-width: 1360px)"', "Desktop GSAP orbit must align with the CSS hero visual breakpoint");
expectIncludes(readFileSync("src/App.test.tsx", "utf8"), 'query.includes("min-width: 1360px")', "Desktop orbit cleanup test must use the same 1360px breakpoint as GSAP");
expectIncludes(styles, "@media (max-width: 1359px)", "CSS must hide the hero visual immediately below the GSAP desktop breakpoint");
expectIncludes(styles, ".hero-visual {\n    display: none;\n  }\n}", "CSS hero visual breakpoint must remove the visual layer below 1360px");
const reducedMotionRuntimeSection = runtimeQa.slice(runtimeQa.indexOf("const reducedMotionState"));
const normalMotionRuntimeSection = runtimeQa.slice(runtimeQa.indexOf("const motionState"), runtimeQa.indexOf("checkLayoutStability(viewport.name);"));
expectIncludes(normalMotionRuntimeSection, "inlineResidue", "Runtime normal-motion QA must check settled inline animation residue");
expectIncludes(normalMotionRuntimeSection, '".section-intro > *"', "Runtime normal-motion QA must verify section intro reveal cleanup");
expectIncludes(normalMotionRuntimeSection, '".continuity-lane article"', "Runtime normal-motion QA must verify continuity lane reveal cleanup");
expectIncludes(normalMotionRuntimeSection, '".platform-copy > *"', "Runtime normal-motion QA must verify platform copy reveal cleanup");
expectIncludes(reducedMotionRuntimeSection, '".section-intro > *"', "Runtime reduced-motion QA must verify section intro cleanup");
expectIncludes(reducedMotionRuntimeSection, '".continuity-lane article"', "Runtime reduced-motion QA must verify continuity lane cleanup");
expectIncludes(reducedMotionRuntimeSection, '".platform-copy > *"', "Runtime reduced-motion QA must verify platform copy cleanup");
expectIncludes(runtimeQa, "continuityLaneSignature", "Runtime page-continuity QA must persist the evidence-flow lane order");
expectIncludes(runtimeQa, "surfaceCardTitles", "Runtime page-continuity QA must persist the unified research-entry card order");
expectIncludes(runtimeQa, "platformStepLabels", "Runtime page-continuity QA must persist platform operating step order");
expectIncludes(runtimeQa, 'typeof window.__memoryBenchMotionInspect === "function"', "Runtime ScrollTrigger inventory must read the live GSAP motion inspector instead of stale debug state");
expectIncludes(runtimeQa, "frameChildSignatures", "Runtime page-continuity QA must persist lower-page frame child signatures");
expectIncludes(runtimeQa, "unifiedChromeUnframed", "Runtime page-continuity QA must reject lower-page blocks that leave the shared grid/list chrome");
expectIncludes(runtimeQa, "nestedPageCards", "Runtime page-continuity QA must reject nested card islands inside the unified page frame");
expectIncludes(runStrict, "pageContinuityFlowPassCount", "Strict audit must validate page evidence-flow continuity coverage");
expectIncludes(runStrict, "expected 16 passing page continuity evidence-flow samples", "Strict audit must require all evidence-flow continuity samples to pass");
expectIncludes(runStrict, "pageContinuityCohesionPassCount", "Strict audit must validate lower-page frame cohesion coverage");
expectIncludes(runStrict, "expected 16 passing page continuity frame-cohesion samples", "Strict audit must require all frame-cohesion samples to pass");
expectIncludes(reducedMotionRuntimeSection, ".footer-proof-grid article", "Runtime reduced-motion QA must check footer proof cells");
expectIncludes(reducedMotionRuntimeSection, ".footer-actions a", "Runtime reduced-motion QA must check footer actions");
expectIncludes(reducedMotionRuntimeSection, "stickyPosition", "Runtime reduced-motion QA must fail sticky or fixed reduced-motion residue");
expectIncludes(reducedMotionRuntimeSection, "reducedMotionSticky", "Runtime reduced-motion QA must persist sticky positioning evidence");
expectIncludes(reducedMotionRuntimeSection, '".dossier-panel"', "Runtime reduced-motion QA must check the real dossier panel class");
expectExcludes(styles, "dossier-sidebar", "Reduced-motion CSS must not reference stale dossier-sidebar selectors");
expectIncludes(styles, "max-height: calc(100vh - 120px)", "Desktop dossier panel must be viewport-bounded for efficient evidence scanning");
expectIncludes(styles, "overscroll-behavior: contain", "Desktop dossier panel must contain internal scroll overshoot");
expectIncludes(styles, '.opendesign-app[data-motion-reduce="true"] .dossier-panel', "URL reduced-motion CSS must disable sticky dossier panel positioning");
expectIncludes(styles, "scrollbar-gutter: auto", "Reduced-motion and stacked dossier layouts must remove internal scrollbar reservation");
expectIncludes(runStrict, "reducedMotionStickyPassCount", "Strict audit must validate reduced-motion sticky positioning evidence");
expectIncludes(runStrict, "expected 32 passing reduced-motion sticky positioning samples", "Strict audit must require every reduced-motion sticky sample to pass");
expectIncludes(reducedMotionRuntimeSection, "scrollTriggerRailReducedMotion", "Runtime reduced-motion QA must write rail cleanup evidence");
expectIncludes(runtimeQa, 'reducedMotion: "reduce"', "Runtime QA must emulate real prefers-reduced-motion media in a browser context");
expectIncludes(runtimeQa, 'reducedMotionSource === "media"', "Runtime QA must prove real media reduced motion is recorded separately from URL override");
expectIncludes(runtimeQa, "mediaReducedMotion", "Runtime QA must persist real media reduced-motion evidence");
expectIncludes(runtimeQa, "rootReducedMotion", "Runtime QA must persist root reduced-motion marker evidence");
expectIncludes(runtimeQa, "document.documentElement.getAttribute(\"data-motion-reduce\")", "Runtime QA must verify the root scroller reduced-motion marker");
expectIncludes(runtimeQa, "reducedMotionCssHoverTargets", "Runtime QA must sample real CSS hover behavior under media reduced motion");
expectIncludes(runtimeQa, ".map-node:not(.active)", "Runtime QA must sample reduced-motion CSS hover inertness for map nodes");
expectIncludes(runtimeQa, 'transformMode: "stable"', "Runtime QA must allow positioned nodes to prove hover transform stability instead of transform absence");
expectIncludes(runtimeQa, "cssHoverMotionPassCount", "Runtime QA must write reduced-motion CSS hover inertness evidence");
expectIncludes(runStrict, "mediaReducedMotionPassCount", "Strict audit must summarize real media reduced-motion runtime evidence");
expectIncludes(runStrict, "mediaReducedMotionCssHoverPassCount", "Strict audit must summarize reduced-motion CSS hover inertness evidence");
expectIncludes(runStrict, "expected 40 passing real media reduced-motion CSS hover samples", "Strict audit must require action-link plus map-node reduced-motion CSS hover evidence");
expectIncludes(runStrict, "rootReducedMotionPassCount", "Strict audit must validate root reduced-motion marker evidence");
expectIncludes(reducedMotionRuntimeSection, "briefing rails retain active/current state", "Runtime reduced-motion QA must fail stale rail state");
expectIncludes(runtimeQa, "function captureFullPageScreenshot", "Runtime QA must capture full-page continuity screenshots");
expectIncludes(runtimeQa, "scripts/capture-full-page-cdp.mjs", "Runtime QA full-page screenshots must use the CDP full-width capture helper");
expectIncludes(runtimeQa, "CDP_CAPTURE_TIMEOUT_MS", "Runtime QA must pass a hard timeout to the full-page CDP helper");
expectIncludes(readFileSync("scripts/capture-full-page-cdp.mjs", "utf8"), "Full-page CDP screenshot timed out", "Full-page CDP helper must fail fast instead of hanging strict QA");
expectIncludes(runtimeQa, "expectedWidth", "Runtime QA full-page screenshot evidence must record expected page width");
expectIncludes(runtimeQa, "sha256", "Runtime QA screenshot evidence must record hashes to avoid stale file reuse");
expectIncludes(runtimeQa, "-full-page.png", "Runtime QA must write full-page screenshot evidence");
expectIncludes(runtimeQa, "-middle.png", "Runtime QA must write middle-section screenshot evidence");
expectIncludes(runtimeQa, 'heading !== "Public research"', "Runtime QA must prove middle screenshots frame the published research section");
expectIncludes(runtimeQa, "middle published research list is too narrow", "Runtime QA must fail if the published research list falls into the rail column");
expectIncludes(runtimeQa, "middle published research title wraps into too many lines", "Runtime QA must fail if published research cards collapse into stacked words");
expectIncludes(runtimeQa, "width: dimensions?.width", "Runtime QA report must record viewport screenshot dimensions");
expectIncludes(runStrict, "screenshotDimensionCount", "Strict audit must validate runtime QA screenshot dimensions");
expectIncludes(runStrict, "fullPageScreenshotWidthPassCount", "Strict audit must validate full-page screenshot width from runtime QA evidence");
expectIncludes(runStrict, "runtime QA screenshot hash mismatch", "Strict audit must cross-check manifest screenshots against runtime QA screenshot hashes");
expectIncludes(runStrict, "runtime QA screenshot dimension mismatch", "Strict audit must cross-check manifest screenshot dimensions against runtime QA records");
expectIncludes(runStrict, "runtime QA screenshot capturedAt outside run window", "Strict audit must reject screenshot captures outside the runtime QA run window");
expectIncludes(runStrict, "runtime QA screenshot mtime outside run window", "Strict audit must reject screenshot files whose mtimes fall outside the runtime QA run window");
expectIncludes(runStrict, "validateReportCommandWindow", "Strict audit must validate that structured subreports were generated inside their command windows");
expectIncludes(runStrict, "timestamp outside command window", "Strict audit must reject stale subreports generated outside their command windows");
expectIncludes(runStrict, "function pngVisualStats", "Strict audit must validate screenshot pixel quality");
expectIncludes(runStrict, "expected 48 screenshot pixel-quality samples", "Strict audit must require useful pixels in every screenshot evidence file");
expectIncludes(runStrict, "middle-section evidence", "Strict audit must require middle-section screenshot evidence");
expectIncludes(runStrict, "expected 48 runtime QA screenshot records", "Strict audit must require the 48-screenshot evidence set");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "motionFrameBudgetPassCount", "Strict audit must validate motion frame budget samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing motion frame budget samples", "Strict audit must require normal and reduced-motion frame budget evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "scrollMotionFrameBudgetPassCount", "Strict audit must validate scroll motion frame budget samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing scroll motion frame budget samples", "Strict audit must require normal and reduced-motion scroll frame budget evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "studioInteractionMotionBudgetPassCount", "Strict audit must validate Studio interaction motion frame budget samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing Studio interaction motion budget samples", "Strict audit must require normal and reduced-motion Studio interaction frame budget evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "studioStateMutationMotionBudgetPassCount", "Strict audit must validate Studio state mutation motion frame budget samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing Studio state mutation motion budget samples", "Strict audit must require search, project, stack, and tab animation evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "studioStateMutationRefreshPassCount", "Strict audit must validate normal-motion Studio state mutation ScrollTrigger refresh evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 passing normal Studio state mutation refresh samples", "Strict audit must require post-state-mutation ScrollTrigger refresh evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "activeEvidenceMatchesDossier", "Strict audit must validate Evidence ledger and dossier focus alignment");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "motionPlaybackPassCount", "Strict audit must validate real browser orbit playback samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "heroVisualContractPassCount", "Strict audit must validate hero visual breakpoint contract samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "screenshotGroupCount", "Strict audit must allow only per-viewport reduced-motion duplicate screenshots");
expectIncludes(runtimeQa, "motion-breakpoint-1360", "Runtime QA must cover the active 1360px GSAP/CSS breakpoint");
expectIncludes(runtimeQa, "motion-breakpoint-1359", "Runtime QA must cover the inactive 1359px GSAP/CSS breakpoint");
expectIncludes(runtimeQa, "motion-breakpoint-901", "Runtime QA must keep covering the formerly broken 901px compact breakpoint");
expectIncludes(runtimeQa, "motion-breakpoint-900", "Runtime QA must cover the inactive 900px compact breakpoint");
expectIncludes(runtimeQa, "function checkMotionFrameBudget", "Runtime QA must verify real browser motion frame budget");
expectIncludes(runtimeQa, "isTransientBrowseContextError", "Runtime QA must retry transient browser execution-context loss");
expectIncludes(runtimeQa, "Execution context was destroyed", "Runtime QA retry must classify Playwright context-destroyed failures");
expectIncludes(runtimeQa, "failed after", "Runtime QA must summarize browser command failures without dumping full scripts");
expectIncludes(runtimeQa, "motionFrameBudget", "Runtime QA must write structured motion frame budget evidence");
expectIncludes(runtimeQa, "motion frame budget failed", "Runtime QA must fail slow animation frame cadence");
expectIncludes(runtimeQa, "function checkScrollMotionFrameBudget", "Runtime QA must verify scroll-driven motion frame budget");
expectIncludes(runtimeQa, "scrollMotionFrameBudget", "Runtime QA must write structured scroll motion frame budget evidence");
expectIncludes(runtimeQa, "scroll motion frame budget failed", "Runtime QA must fail slow scroll-driven animation cadence");
expectIncludes(runtimeQa, "stableAvg", "Runtime QA scroll frame budget must record a stable average that ignores isolated scheduler spikes");
expectIncludes(runtimeQa, "trimmedMax", "Runtime QA scroll frame budget must record trimmed max frame time for sustained jank");
expectIncludes(runtimeQa, "schedulerSpikeCount", "Runtime QA scroll frame budget must count isolated scheduler stalls separately");
expectIncludes(runtimeQa, "stableDurations", "Runtime QA scroll frame budget must define the stable-average sample set before resolving evidence");
expectIncludes(runtimeQa, "function checkStudioInteractionMotionBudget", "Runtime QA must verify Studio tab interaction motion frame budget");
expectIncludes(runtimeQa, "studioInteractionMotionBudget", "Runtime QA must write structured Studio interaction motion evidence");
expectIncludes(runtimeQa, "Studio interaction motion budget failed", "Runtime QA must fail slow or leaky Studio tab interaction animation");
expectIncludes(runtimeQa, "function checkStudioFrameContinuity", "Runtime QA must verify Studio frame continuity after the map panel renders");
expectIncludes(runtimeQa, "studioFrameContinuity", "Runtime QA must write structured Studio frame continuity evidence");
expectIncludes(runtimeQa, "blank space after content", "Runtime QA must fail if the Studio primary panel stretches into a blank area");
expectIncludes(runtimeQa, "dossierPairReachable", "Runtime QA must prove desktop dossier bottom content is reachable inside its bounded panel");
expectIncludes(runtimeQa, "desktop dossier Pairing candidates are not reachable", "Runtime QA must fail if the desktop dossier bottom content cannot be reached");
expectIncludes(runtimeQa, "function checkStudioMobileDensity", "Runtime QA must verify compact mobile Studio metric density");
expectIncludes(runtimeQa, "studioMobileDensity", "Runtime QA must write structured mobile Studio metric density evidence");
expectIncludes(runtimeQa, "mobile Studio metric ribbon density failed", "Runtime QA must fail mobile Studio metric density regressions");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "studioFrameContinuityPassCount", "Strict audit must validate Studio frame continuity samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 passing Studio frame continuity samples", "Strict audit must require Studio frame continuity evidence for every viewport");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "desktopDossierReachabilityPassCount", "Strict audit must validate desktop dossier reachability evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 3 passing desktop dossier reachability samples", "Strict audit must require every desktop dossier reachability sample to pass");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "studioMobileDensityPassCount", "Strict audit must validate mobile Studio metric density samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 2 passing mobile Studio metric density samples", "Strict audit must require compact mobile Studio metric density evidence");
expectIncludes(runtimeQa, "studio-tab-evidence", "Runtime QA must settle Studio interaction checks on the evidence tab");
expectIncludes(runtimeQa, "pageContinuity", "Runtime QA must write structured whole-page continuity evidence");
expectIncludes(runtimeQa, "function checkPageContinuity", "Runtime QA must share one page-continuity checker across motion modes");
expectIncludes(runtimeQa, 'checkPageContinuity(viewport, "normal")', "Runtime QA must run page continuity through the shared checker in normal motion");
expectIncludes(runtimeQa, 'checkPageContinuity(viewport, "reduced")', "Runtime QA must run page continuity through the shared checker in reduced motion");
expectIncludes(runtimeQa, "function checkHeroFirstPaint", "Runtime QA must verify hero copy is visible immediately after page load");
expectIncludes(runtimeQa, 'checkHeroFirstPaint(viewport, "normal")', "Runtime QA must run hero first-paint checks in normal motion");
expectIncludes(runtimeQa, 'checkHeroFirstPaint(viewport, "reduced")', "Runtime QA must run hero first-paint checks in reduced motion");
expectIncludes(runtimeQa, "frameAlignmentMaxDelta", "Runtime QA must measure briefing frame alignment across the continuous page");
expectIncludes(runtimeQa, "studioFooterHandoffGap", "Runtime QA must measure the visual handoff gap from Studio to footer");
expectIncludes(runtimeQa, "briefing rail labels are not sequential 01-05", "Runtime QA must fail if briefing rail labels break sequence");
expectIncludes(runtimeQa, "page-continuum has a", "Runtime QA must fail if continuous briefing sections develop visible gaps");
expectIncludes(runtimeQa, "Studio to footer handoff gap", "Runtime QA must fail if the lower-page Studio-to-footer handoff opens a blank field");
expectIncludes(runtimeQa, "topNavigationCurrent", "Runtime QA must persist top navigation current-state evidence");
expectIncludes(runtimeQa, "Evidence navigation did not mark the Evidence top nav item current", "Runtime QA must fail if the Evidence top nav item is not current after navigation");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "pageContinuityPassCount", "Strict audit must validate whole-page continuity samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "maxStudioFooterHandoffGap", "Strict audit must summarize the Studio-to-footer visual handoff gap");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing page-continuity samples", "Strict audit must require page-continuity evidence for every viewport and motion mode");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 reduced-motion page-continuity samples", "Strict audit must require reduced-motion page-continuity evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "heroFirstPaintPassCount", "Strict audit must validate hero first-paint evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing hero first-paint samples", "Strict audit must require immediate hero copy visibility in every viewport and motion mode");
expectIncludes(strictAuditContract, "runtime QA with hidden hero first paint", "Strict audit contract must reject hidden hero first-paint evidence");
expectIncludes(strictAuditContract, "manifest with narrow full-page screenshot evidence", "Strict audit contract must reject narrow full-page screenshot evidence");
expectIncludes(strictAuditContract, "manifest with stale screenshot file evidence", "Strict audit contract must reject stale or mismatched screenshot file evidence");
expectIncludes(strictAuditContract, "manifest with stale screenshot capture timestamp", "Strict audit contract must reject stale screenshot capture timestamps");
expectIncludes(strictAuditContract, "manifest with stale screenshot mtime", "Strict audit contract must reject stale screenshot file mtimes");
expectIncludes(strictAuditContract, "runtime QA with misaligned briefing frames", "Strict audit contract must reject misaligned continuous briefing frames");
expectIncludes(strictAuditContract, "runtime QA with incomplete page-continuity coverage", "Strict audit contract must reject incomplete page-continuity coverage");
expectIncludes(strictAuditContract, "runtime QA with incomplete reduced-motion page-continuity coverage", "Strict audit contract must reject incomplete reduced-motion page-continuity coverage");
expectIncludes(strictAuditContract, "runtime QA with incomplete ScrollTrigger reduced-motion source evidence", "Strict audit contract must reject incomplete ScrollTrigger reduced-motion source evidence");
expectIncludes(strictAuditContract, "runtime QA with incomplete top navigation current-state evidence", "Strict audit contract must reject incomplete scroll-synced top navigation evidence");
expectIncludes(strictAuditContract, "runtime QA with incomplete GSAP reduced-motion source evidence", "Strict audit contract must reject incomplete GSAP reduced-motion source evidence");
expectIncludes(strictAuditContract, "runtime QA with incomplete desktop dossier reachability evidence", "Strict audit contract must reject incomplete desktop dossier reachability evidence");
expectIncludes(strictAuditContract, "manifest without focused GSAP race gate", "Strict audit contract must reject missing focused GSAP race gate evidence");
expectIncludes(strictAuditContract, "manifest with focused GSAP race gate after runtime QA", "Strict audit contract must reject focused GSAP race gate evidence that runs after full runtime QA");
expectIncludes(strictAuditContract, "interactive target report outside command window", "Strict audit contract must reject stale interactive target reports");
expectIncludes(strictAuditContract, "focused GSAP race report outside command window", "Strict audit contract must reject stale focused GSAP race reports");
expectIncludes(strictAuditContract, "runtime QA report outside command window", "Strict audit contract must reject stale runtime QA reports");
expectIncludes(strictAuditContract, "manifest without focused GSAP race report", "Strict audit contract must reject missing focused GSAP race report evidence");
expectIncludes(strictAuditContract, "focused GSAP race report with incomplete samples", "Strict audit contract must reject incomplete focused GSAP race sample evidence");
expectIncludes(strictAuditContract, "focused GSAP race report with missing Evidence row pass", "Strict audit contract must reject focused race evidence without Evidence row coverage");
expectIncludes(strictAuditContract, "focused GSAP race report without footer target coverage", "Strict audit contract must reject focused race evidence with missing whole-page target labels");
expectIncludes(runtimeQa, "function checkStudioStateMutationMotionBudget", "Runtime QA must verify Studio search, project, stack, and tab mutation motion frame budget");
expectIncludes(runtimeQa, "studioStateMutationMotionBudget", "Runtime QA must write structured Studio state mutation motion evidence");
expectIncludes(runtimeQa, "Studio state mutation motion budget failed", "Runtime QA must fail slow or leaky Studio state mutation animation");
expectIncludes(runtimeQa, "stateMutationRefreshCount", "Runtime QA must record post-state-mutation ScrollTrigger refresh evidence");
expectIncludes(runtimeQa, "ledgerClickOk", "Runtime QA must prove Evidence ledger rows can select the dossier");
expectIncludes(runtimeQa, "activeEvidenceMatchesDossier", "Runtime QA must prove the active Evidence ledger row matches the right-side dossier");
expectIncludes(runtimeQa, "temporal graph", "Runtime QA must exercise the normalized query dependency path");
expectIncludes(runtimeQa, "emptyVisibleDuringNoMatch", "Runtime QA must prove the empty search branch during state mutation animation");
expectIncludes(runtimeQa, "definitely-no-memory-system-match", "Runtime QA must exercise the no-results search branch");
expectIncludes(runtimeQa, "function checkInteractiveMicroMotion", "Runtime QA must verify interactive GSAP hover/focus micro motion");
expectIncludes(runtimeQa, "interactiveMicroMotion", "Runtime QA must write structured interactive micro motion evidence");
expectIncludes(runtimeQa, "interactive micro motion failed", "Runtime QA must fail leaky or missing interactive micro motion");
expectIncludes(runtimeQa, "function checkKeyboardTargetSurface", "Runtime QA must verify the shared interactive target keyboard focus surface");
expectIncludes(runtimeQa, "keyboardTargetSurface", "Runtime QA must write structured keyboard target surface evidence");
expectIncludes(runtimeQa, "keyboard target surface failed", "Runtime QA must fail keyboard-inaccessible shared interactive targets");
expectIncludes(runtimeQa, "settledResidue", "Runtime QA must prove interactive micro motion clears inline residue");
expectIncludes(runtimeQa, "semanticActiveLabelPresent", "Runtime QA must prove active GSAP tweens expose semantic interactive labels");
expectIncludes(runtimeQa, "activeTargetLabels", "Runtime QA interactive micro motion evidence must include active GSAP target labels");
expectIncludes(runtimeQa, "document.activeElement.blur()", "Runtime QA must blur the previous control before sampling focus micro motion");
expectIncludes(runtimeQa, "}, 220);", "Runtime QA must wait after blur before sampling the next micro motion target");
expectIncludes(runtimeQa, 'from "./interactive-motion-targets.mjs"', "Runtime QA must use the shared interactive micro-motion target contract");
expectIncludes(gsapRaceCheck, "prepareStudioRacePath", "Focused GSAP race check must reproduce the Studio state path before sampling");
expectIncludes(gsapRaceCheck, "interactive-race-state", "Focused GSAP race check must fail active/rest tween races explicitly");
expectIncludes(gsapRaceCheck, "motion-breakpoint-901", "Focused GSAP race check must cover the 901px compact breakpoint");
expectIncludes(gsapRaceCheck, "motion-breakpoint-900", "Focused GSAP race check must cover the 900px compact breakpoint");
expectIncludes(gsapRaceCheck, "motion-breakpoint-721", "Focused GSAP race check must cover the 721px pointer boundary");
expectIncludes(gsapRaceCheck, 'from "./interactive-motion-targets.mjs"', "Focused GSAP race check must use the shared interactive micro-motion target contract");
expectIncludes(gsapRaceCheck, "realHoverSamples", "Focused GSAP race check must persist real pointer hover evidence");
expectIncludes(gsapRaceCheck, 'runBrowse(["hover", target.selector]', "Focused GSAP race check must use real browser hover commands for hit-tested targets");
expectIncludes(gsapRaceCheck, "elementFromPoint", "Focused GSAP race check must verify hover target center hit-testing");
expectIncludes(runStrict, "check:gsap-race", "Strict audit must run the focused GSAP race check before full runtime QA");
expectIncludes(runStrict, "check:interactive-motion-targets", "Strict audit must replay the interactive target contract as an explicit evidence step");
expectIncludes(runStrict, "interactiveMotionTargetReport", "Strict audit must embed structured interactive target report evidence");
expectIncludes(runStrict, "readInteractiveMotionTargetReport", "Strict audit must normalize the interactive target report into the manifest");
expectIncludes(runStrict, "INTERACTIVE_MOTION_TARGET_REPORT_PATH", "Strict audit must request a written interactive target report");
expectIncludes(runStrict, "interactive motion target report missing motion selector", "Strict audit must validate the target report's runtime selector coverage");
expectIncludes(runStrict, "source file missing sha256 evidence", "Strict audit must validate target report source-file hashes");
expectIncludes(runStrict, "interactive motion target contract must run before focused GSAP race gate", "Strict audit must require target contract evidence before focused race evidence");
expectIncludes(runStrict, 'from "./interactive-motion-targets.mjs"', "Strict audit must derive focused GSAP target expectations from the shared target contract");
expectIncludes(runStrict, "realHoverPassCount", "Strict audit must validate focused real hover GSAP evidence");
expectIncludes(strictAuditContract, 'from "./interactive-motion-targets.mjs"', "Strict audit contract tests must derive focused GSAP target expectations from the shared target contract");
expectIncludes(strictAuditContract, "manifest without interactive target contract gate", "Strict audit contract must reject missing interactive target contract evidence");
expectIncludes(strictAuditContract, "manifest with interactive target contract after focused race", "Strict audit contract must reject target contract evidence that runs after focused race");
expectIncludes(strictAuditContract, "manifest without interactive target contract report", "Strict audit contract must reject missing interactive target report evidence");
expectIncludes(strictAuditContract, "focused GSAP race report with incomplete real hover samples", "Strict audit contract must reject incomplete real hover GSAP evidence");
expectIncludes(strictAuditContract, "interactive target report without footer motion selector", "Strict audit contract must reject incomplete interactive target selector evidence");
expectIncludes(strictAuditContract, "interactive target report with hard-coded hook selector list", "Strict audit contract must reject hook selector duplication evidence");
expectIncludes(strictAuditContract, "interactive target report without source hash", "Strict audit contract must reject target report evidence without source hashes");
expectIncludes(interactiveTargets, "../src/data/interactiveMotionTargets.json", "Script-side interactive target contract must read the runtime target data file");
expectIncludes(readFileSync("scripts/check-interactive-motion-targets.mjs", "utf8"), "allowedSetupSources", "Interactive motion target contract must audit setup functions");
expectIncludes(readFileSync("scripts/check-interactive-motion-targets.mjs", "utf8"), "runtime motion selectors drifted", "Interactive motion target contract must fail selector drift");
expectIncludes(readFileSync("scripts/check-interactive-motion-targets.mjs", "utf8"), "INTERACTIVE_MOTION_TARGET_REPORT_PATH", "Interactive motion target contract must support structured report output");
expectIncludes(readFileSync("scripts/check-interactive-motion-targets.mjs", "utf8"), "expressionSha256", "Interactive motion target report must identify the injected browser expression");
expectIncludes(readFileSync("scripts/check-interactive-motion-targets.mjs", "utf8"), "sourceEvidence", "Interactive motion target report must include source-file hash evidence");
expectIncludes(interactiveTargets, "interactiveMicroMotionTargetsExpression", "Shared interactive target contract must provide a browser-injection expression");
expectIncludes(interactiveTargets, "expectedGsapRaceTargets", "Shared interactive target contract must provide the strict-audit label list");
expectIncludes(interactiveTargetModule, "interactiveMicroMotionSelector", "Runtime target data module must publish the selector used by the GSAP hook");
expectIncludes(interactiveTargetModule, "motionSelectors", "Runtime target data module must support broad motion selectors for dynamic Studio rows");
expectIncludes(motion, 'from "./data/interactiveMotionTargets"', "GSAP hook must import the shared runtime interactive target selector");
expectIncludes(interactiveTargetData, "hero-research-action", "Shared interactive target data must cover hero interactive micro motion");
expectIncludes(interactiveTargetData, "toprail-action", "Shared interactive target data must cover top rail interactive micro motion");
expectIncludes(interactiveTargetData, "surface-action", "Shared interactive target data must cover surface interactive micro motion");
expectIncludes(interactiveTargetData, "research-action", "Shared interactive target data must cover research interactive micro motion");
expectIncludes(interactiveTargetData, "platform-action", "Shared interactive target data must cover platform interactive micro motion");
expectIncludes(interactiveTargetData, "footer-action", "Shared interactive target data must cover footer interactive micro motion");
expectIncludes(interactiveTargetData, "map-node", "Shared interactive target data must cover map-node interactive micro motion");
expectIncludes(interactiveTargetData, "matrix-system-button", "Shared interactive target data must cover matrix interactive micro motion");
expectIncludes(interactiveTargetData, "stack-selector-button", "Shared interactive target data must cover stack selector interactive micro motion");
expectIncludes(interactiveTargetData, "evidence-row", "Shared interactive target data must cover Evidence ledger row interactive micro motion");
expectIncludes(interactiveTargetData, '"motionSelectors": [".evidence-row"]', "Shared target data must bind all Evidence ledger rows while QA samples the active row");
expectIncludes(interactiveTargetData, '"motionSelectors": [".map-node"]', "Shared target data must bind all map nodes while QA can sample the current node");
expectIncludes(motion, 'root.addEventListener("focus", toInteractiveState, true)', "GSAP micro motion must use delegated capture focus handling for dynamically rendered Studio targets");
expectIncludes(motion, "event.currentTarget !== root", "Delegated GSAP focus handling must not animate the application root");
expectIncludes(motion, "closest<HTMLElement>(interactiveMicroMotionSelector)", "GSAP micro motion must resolve delegated targets from the shared interactive selector");
expectMinCount(motion, "gsap.killTweensOf(target)", 2, "GSAP micro motion must kill existing target tweens before both active and rest states");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "emptyPanelRoleDuringNoMatch", "Strict audit must validate no-results tabpanel state during Studio mutation");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "interactiveMicroMotionPassCount", "Strict audit must validate interactive micro motion samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 176 passing interactive micro motion samples", "Strict audit must require normal and reduced-motion whole-page micro motion evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "interactiveMicroMotionSemanticLabelPassCount", "Strict audit must validate semantic interactive micro motion labels");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "keyboardTargetSurfacePassCount", "Strict audit must validate keyboard target surface samples");
expectIncludes(strictAuditContract, "runtime QA with incomplete semantic interactive labels", "Strict audit contract must reject missing semantic interactive label evidence");
expectIncludes(strictAuditContract, "runtime QA with incomplete keyboard target surface evidence", "Strict audit contract must reject missing keyboard target surface evidence");
expectIncludes(strictAuditContract, "incomplete real media reduced-motion CSS hover evidence", "Strict audit contract must reject missing reduced-motion CSS hover evidence");
expectIncludes(runtimeQa, "longFrameCount", "Runtime QA motion frame budget must track long frames");
expectIncludes(runtimeQa, "motionPlayback", "Runtime QA must write structured orbit playback evidence");
expectIncludes(runtimeQa, "visibleInspectorPlaying", "Runtime QA must prove orbit visible playback through the live GSAP inspector");
expectIncludes(runtimeQa, "offscreenInspectorPaused", "Runtime QA must prove orbit off-screen pause through the live GSAP inspector");
expectIncludes(runtimeQa, "resumedInspectorPlaying", "Runtime QA must prove orbit resume through the live GSAP inspector");
expectIncludes(motion, "orbitPlayback: inspectOrbitPlayback()", "GSAP live inspector must expose orbit playback lifecycle state");
expectIncludes(runtimeQa, '".workbench-head > *"', "Runtime QA must check Studio heading animation residue");
expectIncludes(runtimeQa, '".studio-controls"', "Runtime QA must check Studio controls animation residue");
expectIncludes(runtimeQa, "scrollTriggerRail", "Runtime QA must write structured ScrollTrigger rail evidence");
expectIncludes(runtimeQa, "function checkBriefingRailSequence", "Runtime QA must verify the full briefing rail sequence");
expectIncludes(runtimeQa, "function checkBriefingRailSweep", "Runtime QA must sweep the briefing rail sequence for duplicate active states");
expectIncludes(runtimeQa, "scrollTriggerRailSweep", "Runtime QA must write structured ScrollTrigger rail sweep evidence");
expectIncludes(runtimeQa, "function checkScrollTriggerInventory", "Runtime QA must verify ScrollTrigger inventory lifecycle");
expectIncludes(runtimeQa, "scrollTriggerInventory", "Runtime QA must write structured ScrollTrigger inventory evidence");
expectIncludes(runtimeQa, "ScrollTrigger inventory is invalid", "Runtime QA must fail bad ScrollTrigger inventory");
expectIncludes(runtimeQa, "memorybench-reading-progress", "Runtime QA inventory must prove only reading progress uses scrub");
expectIncludes(runtimeQa, "pinSpacerCount", "Runtime QA inventory must reject pin-spacer residue");
expectIncludes(runtimeQa, "function checkGsapAnimationInventory", "Runtime QA must verify GSAP animation inventory lifecycle");
expectIncludes(runtimeQa, "gsapAnimationInventory", "Runtime QA must write structured GSAP animation inventory evidence");
expectIncludes(runtimeQa, "GSAP animation inventory is invalid", "Runtime QA must fail bad GSAP animation inventory");
expectIncludes(runtimeQa, "expectedTimelineLabels", "Runtime QA must verify GSAP intro timeline labels by viewport");
expectIncludes(runtimeQa, "expectedReducedMotionSource", "Runtime QA must verify whether normal or URL-override reduced-motion paths produced the debug state");
expectIncludes(runtimeQa, 'expectedMode === "normal" ? "none" : "override"', "Runtime QA must expect URL override as the strict reduced-motion runtime source");
expectIncludes(runtimeQa, '["navigation", "heroCopy", "contentReveal", "heroVisual"]', "Runtime QA must expect the desktop hero visual timeline label");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "introTimelineLabels", "Strict audit must validate runtime GSAP intro timeline label evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "reducedMotionSource", "Strict audit must validate runtime reduced-motion source evidence");
expectIncludes(runtimeQa, "nonOrbitRepeatCount", "Runtime QA must reject non-orbit repeating tween residue");
expectIncludes(runtimeQa, "function checkReadingProgress", "Runtime QA must verify ScrollTrigger reading progress");
expectIncludes(runtimeQa, "readingProgress", "Runtime QA must write structured reading progress evidence");
expectIncludes(runtimeQa, "readingProgressReducedMotion", "Runtime QA must write structured reduced-motion reading progress cleanup evidence");
expectIncludes(runtimeQa, "function checkConsoleClean", "Runtime QA must fail on any browser console message");
expectIncludes(runtimeQa, "consoleClean", "Runtime QA must write structured console cleanliness evidence");
expectIncludes(runtimeQa, "expectedRail", "Runtime QA rail samples must record the expected rail label");
expectIncludes(runtimeQa, 'targetRailCurrent', "Runtime QA rail samples must verify aria-current on the active rail");
expectIncludes(runtimeQa, 'currentRailCount', "Runtime QA must ensure only one semantic current rail is active");
expectIncludes(runtimeQa, "mismatchCount", "Runtime QA rail sweep must detect active/current mismatches");
expectIncludes(runtimeQa, "ScrollTrigger did not activate the briefing rail for", "Runtime QA must verify ScrollTrigger rail activation across the page");
expectIncludes(runtimeQa, "heroVisualContract", "Runtime QA must write structured hero visual breakpoint evidence");
expectIncludes(runtimeQa, "hero visual contract expected display none below desktop breakpoint", "Runtime QA must fail if compact breakpoints retain a visible hero visual layer");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "officialBrowserProbe", "Strict audit must include the latest direct official Browser IAB probe");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "official-iab-available-current-thread", "Strict audit must accept a repaired official Browser IAB probe");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "official-iab-unavailable-current-thread", "Strict audit must still validate the current unavailable official Browser IAB probe state");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "Browser is not available: iab", "Strict audit must preserve the exact current official Browser IAB error when unavailable");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "iabBrowserId", "Strict audit must record the official Browser id when IAB becomes available");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "availabilitySmoke", "Strict audit must validate official Browser navigation smoke evidence when IAB becomes available");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "smoke-page navigation", "Strict audit must fail a repaired official Browser that cannot navigate the local page");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "When AI agents", "Strict audit must require MemoryBench hero evidence from the official Browser smoke");
expectIncludes(readFileSync("scripts/check-codex-browser-runtime.mjs", "utf8"), "codexBrowserSocketFreshness", "Browser runtime diagnostic must record Codex Browser socket freshness");
expectIncludes(readFileSync("scripts/check-codex-browser-runtime.mjs", "utf8"), "stale-codex-browser-sockets-iab-unverified", "Browser runtime diagnostic must classify all-stale Codex Browser sockets separately");
expectIncludes(readFileSync("scripts/check-codex-browser-runtime.mjs", "utf8"), "fallbackTargetSmoke", "Browser runtime diagnostic must prove the fallback browser loaded the MemoryBench page");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "stale-codex-browser-sockets-iab-unverified", "Strict audit must accept the precise stale Codex Browser socket diagnostic state");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "missing socket freshness evidence", "Strict audit must require Browser socket freshness evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "fallback MemoryBench smoke evidence", "Strict audit must require fallback browser page identity smoke evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "MemoryBench document title", "Strict audit must require fallback browser document-title smoke evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "must not be used when every Codex Browser socket is stale", "Strict audit must reject over-optimistic Browser classifications for all-stale sockets");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "probeOfficialBrowserIab", "Official Browser IAB probe must have a reusable Node REPL helper");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "probeSource", "Official Browser IAB probe must persist helper provenance");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "probeRunId", "Official Browser IAB probe must bind each evidence file to a persisted run id");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "timedOperation", "Official Browser IAB probe must time-box Browser runtime operations");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "operationTimingsMs", "Official Browser IAB probe must persist per-operation timing evidence");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "smokeOfficialBrowser", "Official Browser IAB probe must include a local-page navigation smoke helper");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "browser.tabs.new", "Official Browser IAB probe must use the Browser tabs API for the smoke check");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "scripts/probe-official-browser-iab.mjs", "Strict audit must require official Browser probe helper provenance");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "codex-browser-node-repl", "Strict audit must require Browser Node REPL runtime provenance");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "must run inside the Codex Browser Node REPL runtime", "Official Browser IAB probe must not pretend to work from ordinary shell execution");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "ordinary shell execution cannot access agent.browsers.get('iab')", "Official Browser IAB probe must explain direct shell execution is non-authoritative");
expectIncludes(browserProbeContract, "direct official Browser probe CLI execution must fail", "Browser probe contract must reject silent direct CLI execution");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "getIabError", "Official Browser IAB probe must persist exact get('iab') errors");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), 'replace(".", "-")', "Official Browser IAB probe filenames must preserve milliseconds");
expectIncludes(readFileSync("scripts/probe-official-browser-iab.mjs", "utf8"), "randomUUID", "Official Browser IAB probe filenames must include a UUID for burst collision safety");
expectIncludes(browserProbeContract, "official-iab-available-current-thread", "Browser probe contract must cover a repaired official IAB state");
expectIncludes(browserProbeContract, "official-iab-unavailable-current-thread", "Browser probe contract must cover the current unavailable official IAB state");
expectIncludes(browserProbeContract, "contract-iab-browser", "Browser probe contract must verify iabBrowserId persistence");
expectIncludes(browserProbeContract, "availabilitySmoke", "Browser probe contract must cover available-state navigation smoke evidence");
expectIncludes(browserProbeContract, "When AI agents remember", "Browser probe contract must prove smoke-page hero evidence is persisted");
expectIncludes(browserProbeContract, "broken-smoke", "Browser probe contract must cover available-but-unusable IAB smoke evidence");
expectIncludes(browserProbeContract, "closeCalled", "Browser probe contract must prove smoke tabs are closed after failed validation");
expectIncludes(browserProbeContract, "must reject ordinary shell execution without nodeRepl", "Browser probe contract must reject non-Node-REPL execution");
expectIncludes(browserProbeContract, "burst evidence collisions", "Browser probe contract must guard against burst evidence filename collisions");
expectIncludes(browserProbeContract, "list-timeout probe", "Browser probe contract must prove Browser list timeouts write evidence instead of hanging");
expectIncludes(browserProbeContract, "get-timeout probe", "Browser probe contract must prove Browser get('iab') timeouts write evidence instead of hanging");
expectIncludes(pkg.scripts?.verify ?? "", "pnpm check:codex-browser-probe", "Verify must include the official Browser probe contract check");
expectIncludes(pkg.scripts?.verify ?? "", "pnpm check:strict-audit-contract", "Verify must include strict audit manifest contract checks");
expectIncludes(strictAuditContract, "validateEvidenceManifest", "Strict audit contract must exercise the real manifest validator");
expectIncludes(strictAuditContract, "repaired available official Browser state", "Strict audit contract must cover the repaired official Browser path");
expectIncludes(strictAuditContract, "available official Browser without smoke success", "Strict audit contract must reject available IAB without usable smoke");
expectIncludes(strictAuditContract, "available official Browser with non-local smoke URL", "Strict audit contract must reject smoke evidence outside the owned preview");
expectIncludes(strictAuditContract, "available official Browser with duplicate main landmarks", "Strict audit contract must reject broken main landmark smoke evidence");
expectIncludes(strictAuditContract, "unavailable official Browser with loose error", "Strict audit contract must preserve the current exact unavailable Browser error");
expectIncludes(strictAuditContract, "stale-socket diagnosis", "Strict audit contract must cover stale Browser socket classification");
expectIncludes(strictAuditContract, "Browser diagnostic without fallback MemoryBench smoke", "Strict audit contract must reject missing fallback Browser page identity smoke evidence");
expectIncludes(strictAuditContract, "wrong fallback MemoryBench document title", "Strict audit contract must reject fallback Browser smoke for the wrong document title");
expectIncludes(strictAuditContract, "fresh Browser diagnostic with all stale sockets", "Strict audit contract must reject fresh Browser classification when all sockets are stale");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "createdAtMs", "Strict audit must select the latest official Browser probe by embedded createdAt");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "probeAgeSeconds", "Strict audit must record direct official Browser probe freshness");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "probeRunId", "Strict audit must require Browser probe run id evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "operationTimingsMs", "Strict audit must require Browser probe operation timing evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "official Browser probe preflight", "Strict audit must fail stale official Browser probes before long runtime QA starts");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "maxOfficialBrowserProbeAgeSeconds", "Strict audit must fail stale official Browser probes");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "official-browser-unavailable", "Strict audit success summary must still disclose when official Browser IAB is unavailable");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "maxOfficialBrowserProbePreflightAgeSeconds", "Strict audit preflight must require enough probe freshness buffer for long runtime QA");
expectIncludes(readFileSync("scripts/check-strict-audit-contract.mjs", "utf8"), "exceeds 120s", "Strict audit contract must test the tighter Browser probe preflight freshness buffer");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "scrollTriggerRailPassCount", "Strict audit must validate ScrollTrigger rail samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 40 ScrollTrigger rail samples", "Strict audit must require all section rail samples across all viewports");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "topNavigationCurrentPassCount", "Strict audit must validate scroll-synced top navigation current-state samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 40 passing top navigation current-state samples", "Strict audit must require top navigation current-state evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "targetRailCurrent", "Strict audit must validate semantic aria-current rail state");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 ScrollTrigger rail sweep samples", "Strict audit must require rail exclusivity sweep evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 reduced-motion ScrollTrigger rail cleanup samples", "Strict audit must require reduced-motion rail cleanup evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "scrollTriggerInventoryPassCount", "Strict audit must validate ScrollTrigger inventory lifecycle samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing ScrollTrigger inventory lifecycle samples", "Strict audit must require normal and reduced-motion ScrollTrigger inventory evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "scrollTriggerReducedMotionSourcePassCount", "Strict audit must validate ScrollTrigger reduced-motion source samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing ScrollTrigger reduced-motion source samples", "Strict audit must require complete ScrollTrigger reduced-motion source evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "gsapAnimationInventoryPassCount", "Strict audit must validate GSAP animation inventory lifecycle samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing GSAP animation inventory lifecycle samples", "Strict audit must require normal and reduced-motion GSAP animation inventory evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "gsapReducedMotionSourcePassCount", "Strict audit must validate GSAP reduced-motion source samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing GSAP reduced-motion source samples", "Strict audit must require complete GSAP reduced-motion source evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 passing reading progress samples", "Strict audit must require reading progress evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 8 passing reduced-motion reading progress cleanup samples", "Strict audit must require reduced-motion reading progress cleanup evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 16 passing console cleanliness samples", "Strict audit must require clean normal and reduced-motion console evidence");
expectIncludes(runtimeQa, "function resetToTopForScreenshot", "Runtime QA must reset hash/scroll before top-of-page screenshots");
expectIncludes(runtimeQa, "When AI agents remember", "Runtime QA top screenshots must prove the actual hero H1");
expectIncludes(runtimeQa, "top screenshot is too close to the studio section", "Runtime QA must fail if top screenshots capture the studio instead of the hero");
expectIncludes(runtimeQa, "hero copy and visual are too tight", "Runtime QA must fail if the hero copy crowds the hero visual");
expectIncludes(runtimeQa, "hero primary actions with enough breathing room", "Runtime QA must prove top screenshots include hero actions");
expectIncludes(runtimeQa, "hero category lane", "Runtime QA must prove tablet/desktop top screenshots include the category lane");
expectIncludes(runtimeQa, "maxAllowedMobileLaneHeight", "Runtime QA must cap the compact mobile hero category lane height");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "heroMobileLanePassCount", "Strict audit must validate compact mobile hero category lane coverage");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 4 passing mobile hero category lane samples", "Strict audit must require mobile hero category lane samples across normal and reduced motion");
expectIncludes(readFileSync("scripts/check-strict-audit-contract.mjs", "utf8"), "oversized mobile hero category lane", "Strict audit contract must reject oversized mobile hero category lanes");
expectIncludes(runtimeQa, "function checkOrbitPausePlayback", "Runtime QA must verify desktop orbit pause and resume in a real browser");
expectIncludes(runtimeQa, "orbit playback did not pause off-screen", "Runtime QA must fail if off-screen orbit animation keeps running");
expectIncludes(runtimeQa, "orbit playback did not resume on hero return", "Runtime QA must fail if orbit playback does not resume when the hero returns");
expectIncludes(runtimeQa, "function checkResponsiveMotionLifecycle", "Runtime QA must verify dynamic GSAP matchMedia lifecycle across the 1360px breakpoint");
expectIncludes(runtimeQa, "responsiveMotionLifecycle", "Runtime QA report must persist responsive GSAP matchMedia lifecycle evidence");
expectIncludes(runtimeQa, "desktop-after-resize", "Runtime QA must prove desktop orbit motion rebuilds after crossing back over 1360px");
expectIncludes(runtimeQa, "tablet-after-resize", "Runtime QA must prove orbit motion is fully reverted below 1360px");
expectIncludes(runtimeQa, "function runDynamicReducedMotionLifecycleQa", "Runtime QA must verify live reduced-motion media changes in the same page lifecycle");
expectIncludes(runtimeQa, "desktop-live-media-toggle", "Runtime QA must persist live reduced-motion toggle evidence");
expectIncludes(runtimeQa, "reduced-after-toggle", "Runtime QA must prove live reduced-motion cleanup after a media preference change");
expectIncludes(runtimeQa, "normal-after-restore", "Runtime QA must prove GSAP motion rebuilds after reduced motion is restored");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "dynamicReducedMotionLifecyclePassCount", "Strict audit must validate live reduced-motion lifecycle evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 1 passing dynamic reduced-motion lifecycle sample", "Strict audit must require live reduced-motion toggle coverage");
expectIncludes(readFileSync("scripts/check-strict-audit-contract.mjs", "utf8"), "incomplete dynamic reduced-motion lifecycle coverage", "Strict audit contract must reject missing live reduced-motion lifecycle evidence");
expectIncludes(readFileSync("src/main.tsx", "utf8"), "__memoryBenchRuntime", "Runtime entry must expose controlled mount/unmount hooks for GSAP cleanup QA");
expectIncludes(runtimeQa, "function checkMountLifecycle", "Runtime QA must verify real React unmount/remount GSAP cleanup");
expectIncludes(runtimeQa, "desktop-unmount-remount", "Runtime QA must persist desktop unmount/remount lifecycle evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "mountLifecyclePassCount", "Strict audit must validate GSAP mount lifecycle evidence");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 1 passing GSAP unmount cleanup sample", "Strict audit must require unmount cleanup evidence");
expectIncludes(readFileSync("scripts/check-strict-audit-contract.mjs", "utf8"), "incomplete GSAP remount rebuild evidence", "Strict audit contract must reject missing remount rebuild evidence");
expectIncludes(runtimeQa, "beforeResidue", "Runtime interactive micro-motion QA must fail normal targets that start with intro animation residue");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "beforeResidue === false", "Strict audit must require normal interactive targets to start without GSAP intro residue");
expectIncludes(readFileSync("src/useMemoryBenchMotion.ts", "utf8"), "clearIntroResidue", "Motion hook must explicitly clean intro residue after the GSAP intro timeline completes");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "responsiveMotionLifecyclePassCount", "Strict audit must validate responsive GSAP lifecycle samples");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "expected 3 passing responsive GSAP matchMedia lifecycle samples", "Strict audit must require all responsive GSAP lifecycle samples to pass");
expectIncludes(readFileSync("scripts/check-strict-audit-contract.mjs", "utf8"), "incomplete desktop responsive GSAP lifecycle coverage", "Strict audit contract must reject missing responsive desktop lifecycle evidence");
expectIncludes(readFileSync("scripts/check-strict-audit-contract.mjs", "utf8"), "incomplete compact responsive GSAP lifecycle coverage", "Strict audit contract must reject missing responsive compact lifecycle evidence");
expectIncludes(runtimeQa, "early footer reveal target", "Runtime QA must prove footer reveal targets enter the GSAP reveal state");
expectIncludes(runtimeQa, "function checkMatrixUsability", "Runtime QA must validate matrix scanning usability");
expectIncludes(runtimeQa, "matrix first column is not sticky", "Runtime QA must fail if the matrix first column is not sticky");
expectIncludes(runtimeQa, 'runBrowse(["press", "PageDown"]', "Runtime QA must prove the desktop dossier scroll region responds to real keyboard PageDown");
expectIncludes(runtimeQa, "selected system dossier", "Runtime QA must validate the dossier scroll region accessible label");
expectIncludes(readFileSync("src/App.tsx", "utf8"), "tabIndex={0} aria-label={t.panels.dossierLabel}", "Desktop dossier scroll region must be keyboard focusable and labelled");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "dossierKeyboardScrolled", "Strict audit must require keyboard-reachable dossier internal scrolling");
expectIncludes(readFileSync("scripts/run-strict-audit.mjs", "utf8"), "dossierKeyboardFocusRetained", "Strict audit must prove focus remains on the dossier scroll region after keyboard scroll");
expectIncludes(runtimeQa, "function checkAnchorNavigation", "Runtime QA must validate anchor navigation");
expectIncludes(runtimeQa, "function checkLanguageConsistency", "Runtime QA must validate publication-language consistency");
expectIncludes(runtimeQa, 'document.body.setAttribute("tabindex", "-1")', "Runtime keyboard QA must reset browser focus before first-tab checks");
expectIncludes(runtimeQa, "visible interface mixes CJK characters", "Runtime QA must fail if visible UI mixes CJK copy into the English publication voice");
expectIncludes(runtimeQa, '["research", "published", "platform", "benchmarks", "subscribe"]', "Runtime QA must cover all primary anchor targets");
expectIncludes(runtimeQa, "lands under sticky navigation", "Runtime QA must fail when anchors land under sticky navigation");
expectIncludes(runtimeQa, "function checkPrimaryNavigation", "Runtime QA must validate real primary navigation clicks");
expectIncludes(runtimeQa, 'a[href="#evidence"]', "Runtime QA must click the Evidence navigation link");
expectIncludes(runtimeQa, "Evidence navigation did not activate the Evidence ledger tab", "Runtime QA must fail if Evidence navigation does not switch studio mode");
expectIncludes(runtimeQa, "Evidence deep link did not hydrate the Evidence ledger", "Runtime QA must fail if #evidence deep links hydrate the wrong Studio mode");
expectIncludes(runtimeQa, "Footer evidence action did not continue to the Evidence ledger", "Runtime QA must fail if the footer proof CTA returns to a stale Studio mode");
expectIncludes(runtimeQa, "skip link did not navigate to #main-content", "Runtime QA must validate skip-link activation");

if (!pkg.dependencies?.gsap) {
  failures.push("package.json must depend on gsap");
}

if (!pkg.dependencies?.["@gsap/react"]) {
  failures.push("package.json must depend on @gsap/react");
}

const willChangeMatches = [...styles.matchAll(/will-change\s*:/g)];
if (willChangeMatches.length !== 0) {
  failures.push(`CSS should not keep persistent will-change rules; found ${willChangeMatches.length}`);
}

if (failures.length > 0) {
  console.error(`Motion audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Motion audit ok: GSAP setup, reduced motion, cleanup, and continuity frame checked");
