import type { RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { interactiveMicroMotionSelector, interactiveMotionTargets } from "./data/interactiveMotionTargets";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type MemoryBenchMotionOptions = {
  mode: string;
  normalizedQuery: string;
  selectedProjectSlug: string;
  stackKey: string;
};

type MemoryBenchMotionDebugMode = "normal" | "reduced";
type MemoryBenchReducedMotionSource = "none" | "media" | "override";

type MemoryBenchAnimationInventory = {
  animationCount: number;
  activeCount: number;
  repeatCount: number;
  activeRepeatCount: number;
  pausedRepeatCount: number;
  orbitRepeatCount: number;
  nonOrbitRepeatCount: number;
  activeTargetLabels: string[];
  repeatTargetLabels: string[];
};

type MemoryBenchOrbitPlaybackDebug = {
  available: boolean;
  observerAttached: boolean;
  heroInView: boolean | null;
  documentHidden: boolean;
  shouldPlay: boolean;
  tweenCount: number;
  activeTweenCount: number;
  pausedTweenCount: number;
};

type MemoryBenchBriefingSection = {
  index: number;
  sectionId: string;
  railLabel: string;
  railName: string;
  isActive: boolean;
};

type MemoryBenchMotionDebug = {
  mode: MemoryBenchMotionDebugMode;
  reducedMotionSource: MemoryBenchReducedMotionSource;
  introTimelineLabels: string[];
  briefingSignature: string;
  activeBriefingRailLabel: string | null;
  briefingSections: MemoryBenchBriefingSection[];
  topNavigationCurrent: string | null;
  triggerIds: string[];
  railTriggerIds: string[];
  readingProgressTriggerIds: string[];
  markerCount: number;
  pinSpacerCount: number;
  pinnedCount: number;
  scrubbedIds: string[];
  duplicateIds: string[];
  refreshCount: number;
  stateMutationRefreshCount: number;
  animations: MemoryBenchAnimationInventory;
  orbitPlayback: MemoryBenchOrbitPlaybackDebug;
};

declare global {
  interface Window {
    __memoryBenchMotion?: MemoryBenchMotionDebug;
    __memoryBenchMotionInspect?: () => MemoryBenchMotionDebug;
  }
}

function hasReducedMotionOverride() {
  return new URLSearchParams(window.location.search).get("motion") === "reduce";
}

let currentBriefingRail: Element | null = null;
let currentMotionDebugMode: MemoryBenchMotionDebugMode = "reduced";
let currentReducedMotionSource: MemoryBenchReducedMotionSource = "none";
let currentIntroTimelineLabels: string[] = [];
let currentStudioMode = "map";
let currentRefreshCount = 0;
let currentStateMutationRefreshCount = 0;
let currentOrbitTweens: gsap.core.Tween[] = [];
let currentOrbitHeroInView: boolean | null = null;
let currentOrbitObserverAttached = false;

function getMemoryBenchTriggers() {
  return ScrollTrigger.getAll().filter((trigger) => trigger.vars.id?.startsWith("memorybench-"));
}

function duplicateValues(values: string[]) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function animationTargetLabel(target: unknown) {
  if (!(target instanceof Element)) {
    return "non-element";
  }

  const exactInteractiveTarget = interactiveMotionTargets.find((item) => target.closest(item.selector));
  if (exactInteractiveTarget) {
    return `interactive:${exactInteractiveTarget.label}`;
  }

  const motionInteractiveTarget = interactiveMotionTargets.find((item) => {
    const selectors = item.motionSelectors && item.motionSelectors.length > 0
      ? item.motionSelectors
      : [item.selector];

    return selectors.some((selector) => target.closest(selector));
  });
  if (motionInteractiveTarget) {
    return `interactive:${motionInteractiveTarget.label}`;
  }

  const className = Array.from(target.classList).slice(0, 3).join(".");
  return className ? `${target.tagName.toLowerCase()}.${className}` : target.tagName.toLowerCase();
}

function animationTargets(animation: gsap.core.Animation) {
  return "targets" in animation && typeof animation.targets === "function" ? animation.targets() : [];
}

function inspectAnimationInventory(): MemoryBenchAnimationInventory {
  const animations = gsap.globalTimeline.getChildren(true, true, true);
  const activeAnimations = animations.filter((animation) => animation.isActive());
  const repeatAnimations = animations.filter((animation) => animation.repeat() === -1);
  const activeRepeatAnimations = repeatAnimations.filter((animation) => animation.isActive());
  const pausedRepeatAnimations = repeatAnimations.filter((animation) => animation.paused());
  const repeatTargetLabels = repeatAnimations.flatMap((animation) =>
    animationTargets(animation).map((target: unknown) => animationTargetLabel(target)),
  );

  return {
    animationCount: animations.length,
    activeCount: activeAnimations.length,
    repeatCount: repeatAnimations.length,
    activeRepeatCount: activeRepeatAnimations.length,
    pausedRepeatCount: pausedRepeatAnimations.length,
    orbitRepeatCount: repeatTargetLabels.filter((label) => label.includes(".orbit-")).length,
    nonOrbitRepeatCount: repeatTargetLabels.filter((label) => !label.includes(".orbit-")).length,
    activeTargetLabels: activeAnimations.flatMap((animation) =>
      animationTargets(animation).map((target: unknown) => animationTargetLabel(target)),
    ),
    repeatTargetLabels,
  };
}

function resetOrbitPlaybackDebug() {
  currentOrbitTweens = [];
  currentOrbitHeroInView = null;
  currentOrbitObserverAttached = false;
}

function inspectOrbitPlayback(): MemoryBenchOrbitPlaybackDebug {
  const available = currentOrbitTweens.length > 0;
  const documentHidden = document.hidden;
  const heroInView = currentOrbitHeroInView;
  const shouldPlay = available && heroInView === true && !documentHidden;

  return {
    available,
    observerAttached: currentOrbitObserverAttached,
    heroInView,
    documentHidden,
    shouldPlay,
    tweenCount: currentOrbitTweens.length,
    activeTweenCount: currentOrbitTweens.filter((tween) => tween.isActive()).length,
    pausedTweenCount: currentOrbitTweens.filter((tween) => tween.paused()).length,
  };
}

function inspectBriefingSequence(): MemoryBenchBriefingSection[] {
  return [...document.querySelectorAll<HTMLElement>(".page-continuum .briefing-section")]
    .map((section, index) => {
      const rail = section.querySelector<HTMLElement>(".briefing-rail");

      return {
        index: index + 1,
        sectionId: section.id || "",
        railLabel: rail?.querySelector("span")?.textContent?.trim() || "",
        railName: rail?.getAttribute("aria-label") || "",
        isActive: Boolean(rail?.classList.contains("is-scroll-active")),
      };
    });
}

function buildMotionDebug(mode: MemoryBenchMotionDebugMode): MemoryBenchMotionDebug {
  const triggers = getMemoryBenchTriggers();
  const triggerIds = triggers
    .map((trigger) => trigger.vars.id)
    .filter((id): id is string => Boolean(id));
  const pinSpacerCount = document.querySelectorAll(".pin-spacer").length;
  const currentTopNavigation = document.querySelector<HTMLAnchorElement>('.top-rail nav a[aria-current="page"]');
  const briefingSections = inspectBriefingSequence();
  const activeBriefingRailLabel =
    briefingSections.find((section) => section.isActive)?.railLabel ?? null;

  return {
    mode,
    reducedMotionSource: currentReducedMotionSource,
    introTimelineLabels: currentIntroTimelineLabels,
    briefingSignature: briefingSections
      .map((section) => [section.railLabel, section.sectionId, section.railName].join(":"))
      .join("|"),
    activeBriefingRailLabel,
    briefingSections,
    topNavigationCurrent: currentTopNavigation?.getAttribute("href") ?? null,
    triggerIds,
    railTriggerIds: triggerIds.filter((id) => id.startsWith("memorybench-rail-")),
    readingProgressTriggerIds: triggerIds.filter((id) => id === "memorybench-reading-progress"),
    markerCount: document.querySelectorAll(
      ".gsap-marker-start, .gsap-marker-end, .gsap-marker-scroller-start, .gsap-marker-scroller-end",
    ).length,
    pinSpacerCount,
    pinnedCount: triggers.filter((trigger) => Boolean(trigger.vars.pin)).length + pinSpacerCount,
    scrubbedIds: triggers
      .filter((trigger) => Boolean(trigger.vars.scrub))
      .map((trigger) => trigger.vars.id)
      .filter((id): id is string => Boolean(id)),
    duplicateIds: duplicateValues(triggerIds),
    refreshCount: currentRefreshCount,
    stateMutationRefreshCount: currentStateMutationRefreshCount,
    animations: inspectAnimationInventory(),
    orbitPlayback: inspectOrbitPlayback(),
  };
}

function writeMotionDebug(mode: MemoryBenchMotionDebugMode) {
  currentMotionDebugMode = mode;
  const debug = buildMotionDebug(mode);
  window.__memoryBenchMotion = debug;
  window.__memoryBenchMotionInspect = () => {
    const latest = buildMotionDebug(currentMotionDebugMode);
    window.__memoryBenchMotion = latest;
    return latest;
  };
  return debug;
}

function clearBriefingRailState() {
  document
    .querySelectorAll('.briefing-rail.is-scroll-active, .briefing-rail[aria-current="step"]')
    .forEach((rail) => {
      rail.classList.remove("is-scroll-active");
      rail.removeAttribute("aria-current");
    });
  currentBriefingRail = null;
  syncTopNavigationFromActiveRail();
}

function activateBriefingRail(rail: Element) {
  if (
    currentBriefingRail === rail &&
    rail.classList.contains("is-scroll-active") &&
    rail.getAttribute("aria-current") === "step"
  ) {
    return;
  }

  clearBriefingRailState();
  currentBriefingRail = rail;
  rail.classList.add("is-scroll-active");
  rail.setAttribute("aria-current", "step");
  syncTopNavigationFromActiveRail();
}

function deactivateBriefingRail(rail: Element) {
  if (currentBriefingRail !== rail && !rail.classList.contains("is-scroll-active")) {
    return;
  }

  if (rail.getAttribute("aria-current") === "step") {
    rail.classList.remove("is-scroll-active");
    rail.removeAttribute("aria-current");
  }

  if (currentBriefingRail === rail) {
    currentBriefingRail = null;
    syncTopNavigationFromActiveRail();
  }
}

function navigationKeyForRail(rail: Element | null) {
  const label = rail?.getAttribute("aria-label") ?? "";

  if (
    label === "research sequence" ||
    label === "published sequence" ||
    label === "platform sequence"
  ) {
    return "#research";
  }

  if (label === "studio sequence") {
    return currentStudioMode === "evidence" ? "#evidence" : "#benchmarks";
  }

  if (label === "method handoff sequence") {
    return "#evidence";
  }

  return null;
}

function setTopNavigationCurrent(currentHref: string | null) {
  document.querySelectorAll<HTMLAnchorElement>(".top-rail nav a").forEach((link) => {
    const isCurrent = Boolean(currentHref) && link.getAttribute("href") === currentHref;

    link.classList.toggle("is-current", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function syncTopNavigationFromActiveRail() {
  const activeRail =
    currentBriefingRail ??
    document.querySelector('.briefing-rail[aria-current="step"]') ??
    null;
  setTopNavigationCurrent(navigationKeyForRail(activeRail));
}

function syncBriefingRail(rail: Element, isActive: boolean) {
  if (isActive) {
    activateBriefingRail(rail);
  } else {
    deactivateBriefingRail(rail);
  }
}

function killMemoryBenchRailTriggers() {
  ScrollTrigger.getAll()
    .filter((trigger) => trigger.vars.id?.startsWith("memorybench-rail-"))
    .forEach((trigger) => trigger.kill());
  clearBriefingRailState();
}

function killMemoryBenchProjectTriggers() {
  killMemoryBenchRailTriggers();
  getMemoryBenchTriggers()
    .filter((trigger) => !trigger.vars.id?.startsWith("memorybench-rail-"))
    .forEach((trigger) => trigger.kill());
}

export function useMemoryBenchMotion(
  appRef: RefObject<HTMLDivElement | null>,
  { mode, normalizedQuery, selectedProjectSlug, stackKey }: MemoryBenchMotionOptions,
) {
  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        activeMotionScope: "(min-width: 0px)",
        reduceMotion: "(prefers-reduced-motion: reduce)",
        isDesktop: "(min-width: 1360px)",
      },
      ({ conditions }) => {
        const reduceMotion = conditions?.reduceMotion ?? false;
        const isDesktop = conditions?.isDesktop ?? true;
        const reducedMotionOverride = hasReducedMotionOverride();
        const shouldReduceMotion = reduceMotion || reducedMotionOverride;
        const revealTargets = gsap.utils.toArray<HTMLElement>(
          ".section-intro > *, .continuity-lane article, .surface-grid article, .research-list article, .platform-copy > *, .platform-steps article, .workbench-head > *, .studio-controls, .metric-ribbon article, .footer-proof-grid article, .footer-actions a",
        );

        if (shouldReduceMotion) {
          killMemoryBenchProjectTriggers();
          resetOrbitPlaybackDebug();
          currentReducedMotionSource = reducedMotionOverride ? "override" : "media";
          currentIntroTimelineLabels = [];
          gsap.set(
            ".top-rail, .hero-copy > *, .hero-visual > *, .section-intro > *, .continuity-lane article, .surface-grid article, .research-list article, .platform-copy > *, .platform-steps article, .workbench-head > *, .studio-controls, .metric-ribbon article, .footer-proof-grid article, .footer-actions a, .reading-progress span",
            { clearProps: "all" },
          );
          writeMotionDebug("reduced");
          return;
        }

        gsap.set(revealTargets, {
          autoAlpha: 0,
          y: 28,
          willChange: "transform,opacity",
        });
        gsap.set(
          ".top-rail, .hero-copy .eyebrow, .hero-copy h1 span, .hero-copy p:not(.eyebrow), .hero-actions a, .lane-strip span",
          { willChange: "transform,opacity" },
        );

        const intro = gsap.timeline({
          defaults: { duration: 0.72, ease: "power3.out" },
        });
        let cleanupOrbitPlayback: (() => void) | undefined;

        intro
          .addLabel("navigation", 0)
          .from(".top-rail", { autoAlpha: 0, y: -18, duration: 0.42 }, "navigation")
          .addLabel("heroCopy", 0.12)
          .from(".hero-copy .eyebrow", { autoAlpha: 0, y: 16 }, "heroCopy")
          .from(
            ".hero-copy h1 span",
            {
              y: 24,
              stagger: 0.085,
              duration: 0.82,
            },
            "heroCopy+=0.08",
          )
          .from(".hero-copy p:not(.eyebrow)", { autoAlpha: 0, y: 18 }, "-=0.36")
          .from(".hero-actions a", { autoAlpha: 0, y: 14, stagger: 0.08 }, "-=0.42")
          .from(".lane-strip span", { autoAlpha: 0, y: 10, stagger: 0.035 }, "-=0.42")
          .addLabel("contentReveal", 1.25)
          .to(
            revealTargets,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.62,
              ease: "power2.out",
              stagger: { amount: 0.58 },
              clearProps: "transform,opacity,visibility,willChange",
            },
            "contentReveal",
          );

        if (isDesktop) {
          gsap.set(
            ".hero-visual, .signal-polygon, .criteria-core, .hero-signal, .workflow-strip",
            { willChange: "transform,opacity" },
          );

          intro
            .addLabel("heroVisual", 0.18)
            .from(
              ".hero-visual",
              { autoAlpha: 0, x: 34, scale: 0.985, duration: 0.9 },
              "heroVisual",
            )
            .from(".orbit", { autoAlpha: 0, scale: 0.72, stagger: 0.08 }, "heroVisual+=0.24")
            .from(
              ".signal-polygon, .criteria-core",
              { autoAlpha: 0, scale: 0.86, stagger: 0.1 },
              "heroVisual+=0.38",
            )
            .from(
              ".hero-signal",
              { autoAlpha: 0, x: 26, stagger: 0.075, duration: 0.58 },
              "heroVisual+=0.54",
            )
            .from(".workflow-strip", { autoAlpha: 0, y: 18, duration: 0.56 }, "heroVisual+=0.76");

          const orbitTweens = [
            gsap.to(".orbit-outer", {
              rotation: 360,
              duration: 36,
              ease: "none",
              repeat: -1,
              willChange: "transform",
            }),
            gsap.to(".orbit-mid", {
              rotation: -360,
              duration: 28,
              ease: "none",
              repeat: -1,
              willChange: "transform",
            }),
          ];
          currentOrbitTweens = orbitTweens;

          let heroInView = true;
          const syncOrbitPlayback = () => {
            currentOrbitHeroInView = heroInView;
            const shouldPlay = heroInView && !document.hidden;
            for (const tween of orbitTweens) {
              if (shouldPlay) {
                tween.resume();
              } else {
                tween.pause();
              }
            }
          };
          const hero = appRef.current?.querySelector(".hero-studio");
          const observer =
            hero && "IntersectionObserver" in window
              ? new IntersectionObserver(([entry]) => {
                  heroInView = entry?.isIntersecting ?? true;
                  syncOrbitPlayback();
                }, { threshold: 0.05 })
              : null;

          observer?.observe(hero as Element);
          currentOrbitObserverAttached = Boolean(observer);
          document.addEventListener("visibilitychange", syncOrbitPlayback);
          syncOrbitPlayback();

          cleanupOrbitPlayback = () => {
            document.removeEventListener("visibilitychange", syncOrbitPlayback);
            observer?.disconnect();
            for (const tween of orbitTweens) {
              tween.kill();
            }
            gsap.set(".orbit-outer, .orbit-mid", { clearProps: "willChange" });
            resetOrbitPlaybackDebug();
          };
          gsap.set(".orbit-outer, .orbit-mid", {
            willChange: "transform",
          });
        } else {
          resetOrbitPlaybackDebug();
        }

        const clearIntroResidue = () => {
          gsap.set(
            ".top-rail, .hero-copy .eyebrow, .hero-copy h1 span, .hero-copy p:not(.eyebrow), .hero-actions a, .lane-strip span, .hero-visual, .orbit-inner, .signal-polygon, .criteria-core, .hero-signal, .workflow-strip",
            { clearProps: "transform,opacity,visibility,willChange" },
          );
        };

        currentIntroTimelineLabels = Object.keys(intro.labels);
        currentReducedMotionSource = "none";
        intro.set(
          ".top-rail, .hero-copy .eyebrow, .hero-copy h1 span, .hero-copy p:not(.eyebrow), .hero-actions a, .lane-strip span, .hero-visual, .orbit-inner, .signal-polygon, .criteria-core, .hero-signal, .workflow-strip",
          { clearProps: "transform,opacity,visibility,willChange" },
          ">",
        );
        intro.eventCallback("onComplete", clearIntroResidue);

        const briefingSections = gsap.utils.toArray<HTMLElement>(".briefing-section");
        const progressBar = appRef.current?.querySelector<HTMLElement>(".reading-progress span");
        const pageContinuum = appRef.current?.querySelector<HTMLElement>(".page-continuum");
        killMemoryBenchProjectTriggers();
        const lastBriefingIndex = briefingSections.length - 1;
        const railTriggers = briefingSections.flatMap((section, index) => {
          const rail = section.querySelector(".briefing-rail");
          if (!rail) {
            return [];
          }
          const isLastBriefingSection = index === lastBriefingIndex;

          return ScrollTrigger.create({
            id: `memorybench-rail-${index}`,
            trigger: section,
            start: isLastBriefingSection ? "top bottom" : "top 80%",
            end: isLastBriefingSection ? "bottom top" : "bottom 80%",
            refreshPriority: index,
            onToggle: (self) => {
              syncBriefingRail(rail, self.isActive);
            },
            onRefresh: (self) => syncBriefingRail(rail, self.isActive),
          });
        });
        const progressTween = progressBar && pageContinuum
          ? gsap.fromTo(
              progressBar,
              { scaleX: 0, transformOrigin: "left center", willChange: "transform" },
              {
                scaleX: 1,
                ease: "none",
                scrollTrigger: {
                  id: "memorybench-reading-progress",
                  trigger: pageContinuum,
                  start: "top top",
                  end: "bottom bottom",
                  scrub: true,
                  refreshPriority: lastBriefingIndex + 1,
                },
              },
            )
          : null;
        writeMotionDebug("normal");
        const refreshFrame = requestAnimationFrame(() => {
          currentRefreshCount += 1;
          ScrollTrigger.refresh();
          writeMotionDebug("normal");
        });

        return () => {
          cleanupOrbitPlayback?.();
          cancelAnimationFrame(refreshFrame);
          progressTween?.kill();
          if (progressBar) {
            gsap.set(progressBar, { clearProps: "transform,transformOrigin,willChange" });
          }
          railTriggers.forEach((trigger) => trigger.kill());
          killMemoryBenchProjectTriggers();
          resetOrbitPlaybackDebug();
          currentReducedMotionSource = "none";
          currentIntroTimelineLabels = [];
          writeMotionDebug("reduced");
        };
      },
    );

    return () => mm.revert();
  }, { scope: appRef });

  useGSAP(() => {
    currentStudioMode = mode;
    syncTopNavigationFromActiveRail();

    const mm = gsap.matchMedia();
    let stateMutationRefreshFrame = 0;
    let isStateMutationMotionLive = true;
    const refreshAfterStateMutation = () => {
      if (!isStateMutationMotionLive) {
        return;
      }

      cancelAnimationFrame(stateMutationRefreshFrame);
      stateMutationRefreshFrame = requestAnimationFrame(() => {
        if (!isStateMutationMotionLive) {
          return;
        }

        currentRefreshCount += 1;
        currentStateMutationRefreshCount += 1;
        ScrollTrigger.refresh();
      });
    };

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const panelTargets = gsap.utils.toArray<HTMLElement>(".primary-lab > *, .empty-scope");
      const dossierTargets = gsap.utils.toArray<HTMLElement>(".dossier-panel");
      const meterTargets = gsap.utils.toArray<HTMLElement>(".meter i");

      if (hasReducedMotionOverride()) {
        gsap.set([...panelTargets, ...dossierTargets, ...meterTargets], {
          clearProps: "transform,opacity,visibility,willChange,transformOrigin",
        });
        return;
      }

      gsap.set([...panelTargets, ...dossierTargets, ...meterTargets], {
        willChange: "transform,opacity",
      });

      const tl = gsap.timeline({
        defaults: { duration: 0.38, ease: "power2.out" },
      });

      tl.fromTo(
        panelTargets,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, clearProps: "transform,opacity,visibility,willChange" },
      );

      if (dossierTargets.length > 0) {
        tl.fromTo(
          dossierTargets,
          { autoAlpha: 0.82, y: 10 },
          { autoAlpha: 1, y: 0, clearProps: "transform,opacity,visibility,willChange" },
          "<0.06",
        );
      }

      if (meterTargets.length > 0) {
        tl.fromTo(
          meterTargets,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.52,
            stagger: 0.018,
            clearProps: "transform,transformOrigin,willChange",
          },
          "<0.04",
        );
      }

      tl.set([...panelTargets, ...dossierTargets, ...meterTargets], {
        clearProps: "transform,opacity,visibility,willChange,transformOrigin",
      });

      tl.eventCallback("onComplete", refreshAfterStateMutation);
    });

    return () => {
      isStateMutationMotionLive = false;
      cancelAnimationFrame(stateMutationRefreshFrame);
      mm.revert();
    };
  }, {
    dependencies: [mode, normalizedQuery, selectedProjectSlug, stackKey],
    revertOnUpdate: true,
    scope: appRef,
  });

  useGSAP((_context, contextSafe) => {
    const root = appRef.current;

    if (!root || !contextSafe || hasReducedMotionOverride()) {
      return;
    }

    const mm = gsap.matchMedia();

    mm.add(
      {
        noPreference: "(prefers-reduced-motion: no-preference)",
        pointerMotion: "(min-width: 721px)",
      },
      ({ conditions }) => {
        if (!conditions?.noPreference) {
          return;
        }

        const shouldBindPointerMotion = conditions.pointerMotion === true;
        const getInteractiveTarget = (event: Event) => {
          const target = event.target;

          if (!(target instanceof Element)) {
            return null;
          }

          const interactiveTarget = target.closest<HTMLElement>(interactiveMicroMotionSelector);
          return interactiveTarget && root.contains(interactiveTarget) ? interactiveTarget : null;
        };
        const toInteractiveState = contextSafe((event: Event) => {
          const target = event.currentTarget instanceof HTMLElement && event.currentTarget !== root
            ? event.currentTarget
            : getInteractiveTarget(event);

          if (!(target instanceof HTMLElement)) {
            return;
          }

          gsap.killTweensOf(target);
          gsap.to(target, {
            y: -2,
            scale: 1.015,
            duration: 0.18,
            ease: "power2.out",
            overwrite: true,
            willChange: "transform",
          });
        }) as EventListener;
        const toRestState = contextSafe((event: Event) => {
          const target = event.currentTarget instanceof HTMLElement && event.currentTarget !== root
            ? event.currentTarget
            : getInteractiveTarget(event);

          if (!(target instanceof HTMLElement)) {
            return;
          }

          gsap.killTweensOf(target);
          gsap.to(target, {
            y: 0,
            scale: 1,
            duration: 0.16,
            ease: "power2.out",
            overwrite: true,
            clearProps: "transform,willChange",
          });
        }) as EventListener;

        root.addEventListener("focus", toInteractiveState, true);
        root.addEventListener("blur", toRestState, true);
        if (shouldBindPointerMotion) {
          root.addEventListener("pointerenter", toInteractiveState, true);
          root.addEventListener("pointerleave", toRestState, true);
        }

        return () => {
          root.removeEventListener("focus", toInteractiveState, true);
          root.removeEventListener("blur", toRestState, true);
          if (shouldBindPointerMotion) {
            root.removeEventListener("pointerenter", toInteractiveState, true);
            root.removeEventListener("pointerleave", toRestState, true);
          }
          const interactiveTargets = gsap.utils.toArray<HTMLElement>(
            root.querySelectorAll(interactiveMicroMotionSelector),
          );
          gsap.killTweensOf(interactiveTargets);
          gsap.set(interactiveTargets, { clearProps: "transform,willChange" });
        };
      },
    );

    return () => mm.revert();
  }, { scope: appRef });
}
