import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

type MotionDebugForTest = {
  mode: "normal" | "reduced";
  reducedMotionSource: "none" | "media" | "override";
  introTimelineLabels: string[];
  briefingSignature: string;
  activeBriefingRailLabel: string | null;
  briefingSections: Array<{
    index: number;
    sectionId: string;
    railLabel: string;
    railName: string;
    isActive: boolean;
  }>;
  triggerIds: string[];
  animations: {
    activeCount: number;
    repeatCount: number;
  };
};

function motionDebugForTest() {
  return (window as unknown as { __memoryBenchMotion?: MotionDebugForTest }).__memoryBenchMotion;
}

describe("MemoryBench OpenDesign rebuild", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
    document.documentElement.removeAttribute("data-motion-reduce");
    document.documentElement.removeAttribute("data-locale");
    window.localStorage.clear();
    delete window.__memoryBenchMotion;
    delete window.__memoryBenchMotionInspect;
  });

  it("renders the amplifying-style editorial surface before the benchmark studio", () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole("heading", { name: /When AI agents remember/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See public research/ })).toHaveAttribute(
      "href",
      "#research",
    );
    expect(screen.getByRole("heading", { name: "Read the research. Run the benchmark." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Public research" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /intelligence and optimization platform/i })).toBeInTheDocument();
    expect(
      container.querySelector('[data-opendesign-source="opendesign/mockups/memorybench-ai-studio"]'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(container.querySelector("main#main-content")).toHaveAttribute("tabindex", "-1");
    expect(container.querySelector("main .hero-studio")).toBeInTheDocument();
    expect(container.querySelector("main .page-continuum")).toBeInTheDocument();
    expect(container.querySelector("main .studio-workbench")).toBeInTheDocument();
    expect(container.querySelector("main .page-continuum > footer.site-footer")).toBeInTheDocument();
    expect(container.querySelectorAll(".section-frame.briefing-frame")).toHaveLength(5);
    expect(container.querySelectorAll(".continuity-lane article")).toHaveLength(5);
    expect(screen.getByLabelText("MemoryBench evidence flow")).toBeInTheDocument();
    expect(screen.getByText("One evidence chain")).toBeInTheDocument();
    expect(container.querySelector('[aria-label="studio sequence"]')).toBeInTheDocument();
    expect(container.querySelector(".top-rail .reading-progress span")).toBeInTheDocument();
    expect(container.querySelector("#subscribe.site-footer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow the evidence trail." })).toBeInTheDocument();
    expect(screen.getByText("Evidence loop")).toBeInTheDocument();
    for (const label of ["Define", "Publish", "Operate", "Verify", "Continue"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const staleLabel of ["Scope locked", "Docs challenged", "Hard cases live", "Scorecards public", "Changes tracked"]) {
      expect(screen.queryByText(staleLabel)).not.toBeInTheDocument();
    }
    expect(container.querySelectorAll("#research")).toHaveLength(1);
    expect(container.querySelector("#memory-categories")).toBeInTheDocument();
  });

  it("switches the publication shell between English and Chinese", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(document.documentElement.lang).toBe("en");
    await user.click(screen.getByRole("button", { name: /Switch language: Chinese/ }));

    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toBe("MemoryBench — AI 记忆产品情报");
    expect(screen.getByRole("heading", { name: /当 AI 智能体开始记忆/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查看公开研究/ })).toHaveAttribute("href", "#research");
    expect(screen.getByRole("tab", { name: "研究地图" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByPlaceholderText("搜索系统、层级、证据、风险")).toBeInTheDocument();
    expect(window.localStorage.getItem("memorybench-locale")).toBe("zh");
  });

  it("hydrates language and search state from SEO query parameters", () => {
    window.history.pushState({}, "", "/?lang=zh&q=Mem0");

    render(<App />);

    expect(document.documentElement.lang).toBe("zh-CN");
    expect(screen.getByLabelText("搜索系统、层级、证据和风险")).toHaveValue("Mem0");
    expect(screen.getByText("可见系统")).toBeInTheDocument();
  });

  it("starts in the research map with a selected dossier and evidence workflow", () => {
    render(<App />);

    expect(screen.getByLabelText("AI memory boundary map")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: /Research map/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Selectable AI memory coverage circle map" })).toBeInTheDocument();
    expect(screen.getByLabelText("selected system dossier")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Mem0 dossier/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByLabelText("Plan Review QA Ship Learn workflow"),
    ).toBeInTheDocument();
  });

  it("filters the studio without leaving stale project dossiers", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(
      screen.getByLabelText("Search systems, layers, evidence, and risks"),
      "Supermemory",
    );

    expect(screen.getByText("Visible systems")).toBeInTheDocument();
    expect(screen.getAllByText("Supermemory").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Open Mem0 dossier/ })).not.toBeInTheDocument();
  });

  it("shows a clean empty scope when no evidence matches", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(
      screen.getByLabelText("Search systems, layers, evidence, and risks"),
      "no-such-memory-system",
    );

    expect(screen.getByText("No matching dossier")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No system or evidence line matches this filter." })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: /Research map/ })).toHaveAttribute(
      "id",
      "studio-panel",
    );
    expect(screen.getByRole("tab", { name: /Research map/ })).toHaveAttribute(
      "aria-controls",
      "studio-panel",
    );
    expect(screen.queryByLabelText("AI memory boundary map")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("selected system dossier")).not.toBeInTheDocument();
  });

  it("supports roving keyboard navigation across studio tabs", async () => {
    const user = userEvent.setup();

    render(<App />);

    const mapTab = screen.getByRole("tab", { name: /Research map/ });
    mapTab.focus();
    expect(mapTab).toHaveFocus();
    expect(mapTab).toHaveAttribute("tabindex", "0");

    await user.keyboard("{ArrowRight}");

    const matrixTab = screen.getByRole("tab", { name: /Capability matrix/ });
    await waitFor(() => expect(matrixTab).toHaveFocus());
    expect(matrixTab).toHaveAttribute("aria-selected", "true");
    expect(mapTab).toHaveAttribute("tabindex", "-1");
    expect(screen.getByLabelText("capability matrix")).toBeInTheDocument();

    await user.keyboard("{End}");

    const evidenceTab = screen.getByRole("tab", { name: /Evidence ledger/ });
    await waitFor(() => expect(evidenceTab).toHaveFocus());
    expect(evidenceTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();
  });

  it("switches to the capability matrix", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Capability matrix/ }));

    expect(screen.getByLabelText("capability matrix")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mem0" })).toBeInTheDocument();
  });

  it("keeps stack selection interactive and exposes selected state", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Stack design/ }));

    const mem0Toggle = screen.getByRole("button", { name: "Toggle Mem0 in stack" });
    expect(mem0Toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(mem0Toggle);

    expect(screen.getByRole("button", { name: "Toggle Mem0 in stack" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("Compose a memory stack by category boundary")).toBeInTheDocument();
  });

  it("switches to the evidence ledger", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("tab", { name: /Evidence ledger/ }));

    expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public surface, risk, case, and signal ledger" })).toBeInTheDocument();
    expect(screen.getByText(/SDK\/API surface/)).toBeInTheDocument();

    const mem0LedgerRow = screen.getByRole("button", { name: "Select Mem0 dossier" });
    expect(mem0LedgerRow).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: "Select Zep / Graphiti dossier" }));

    expect(screen.getByRole("button", { name: "Select Zep / Graphiti dossier" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      within(screen.getByLabelText("selected system dossier")).getByRole("heading", {
        name: "Zep / Graphiti",
      }),
    ).toBeInTheDocument();
  });

  it("opens the evidence ledger from the top navigation", async () => {
    const user = userEvent.setup();

    const { container } = render(<App />);

    const evidenceLink = screen.getByRole("link", { name: "Evidence" });
    expect(evidenceLink).toHaveAttribute("href", "#evidence");

    await user.click(evidenceLink);

    expect(window.location.hash).toBe("#evidence");
    expect(evidenceLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("tab", { name: /Evidence ledger/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();

    const topRail = container.querySelector(".top-rail");
    expect(topRail).toBeInTheDocument();

    await user.click(within(topRail as HTMLElement).getByRole("link", { name: "Open studio" }));

    expect(window.location.hash).toBe("#benchmarks");
    expect(within(topRail as HTMLElement).getByRole("link", { name: "Studio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("tab", { name: /Research map/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("AI memory boundary map")).toBeInTheDocument();
  });

  it("hydrates evidence deep links directly into the evidence ledger", () => {
    const originalUrl = window.location.href;

    try {
      window.history.pushState({}, "", "/#evidence");

      render(<App />);

      expect(screen.getByRole("tab", { name: /Evidence ledger/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();
    } finally {
      window.history.pushState({}, "", originalUrl);
    }
  });

  it("routes research study links directly into the evidence ledger", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getAllByRole("link", { name: "View study" })[0]!);

    expect(screen.getByRole("tab", { name: /Evidence ledger/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();
  });

  it("uses the footer primary action to continue the evidence trail", async () => {
    const user = userEvent.setup();

    render(<App />);

    const footerActions = screen.getByLabelText("MemoryBench footer links");
    const evidenceLedgerLink = within(footerActions).getByRole("link", {
      name: "Evidence ledger",
    });
    expect(evidenceLedgerLink).toHaveAttribute("href", "#evidence");

    await user.click(evidenceLedgerLink);

    expect(screen.getByRole("tab", { name: /Evidence ledger/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();
  });


  it("keeps the full surface visible when reduced motion is preferred", async () => {
    const originalMatchMedia = window.matchMedia;

    try {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("prefers-reduced-motion: reduce"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      delete window.__memoryBenchMotion;
      delete window.__memoryBenchMotionInspect;

      const { container } = render(<App />);

      expect(screen.getByRole("heading", { name: /When AI agents remember/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Read the research. Run the benchmark." })).toBeInTheDocument();
      expect(screen.getByLabelText("AI memory boundary map")).toBeInTheDocument();

      for (const selector of [
        ".top-rail",
        ".hero-copy h1 span",
        ".continuity-lane article",
        ".surface-grid article",
        ".research-list article",
        ".platform-steps article",
        ".metric-ribbon article",
        ".footer-proof-grid article",
        ".footer-actions a",
      ]) {
        const nodes = [...container.querySelectorAll<HTMLElement>(selector)];
        expect(nodes.length).toBeGreaterThan(0);
        expect(nodes.every((node) => node.style.opacity !== "0")).toBe(true);
        expect(nodes.every((node) => node.style.visibility !== "hidden")).toBe(true);
        expect(nodes.every((node) => node.style.willChange === "")).toBe(true);
      }

      await waitFor(() => {
        expect(motionDebugForTest()?.mode).toBe("reduced");
      });
      expect(motionDebugForTest()?.reducedMotionSource).toBe("media");
      expect(motionDebugForTest()?.briefingSignature).toBe(
        "01:research:research sequence|02:published:published sequence|03:platform:platform sequence|04:benchmarks:studio sequence|05:subscribe:method handoff sequence",
      );
      expect(motionDebugForTest()?.briefingSections).toHaveLength(5);
      expect(motionDebugForTest()?.activeBriefingRailLabel).toBeNull();
      expect(motionDebugForTest()?.introTimelineLabels).toEqual([]);
      expect(motionDebugForTest()?.triggerIds).toEqual([]);
      expect(motionDebugForTest()?.animations.activeCount).toBe(0);
      expect(motionDebugForTest()?.animations.repeatCount).toBe(0);
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("honors the deterministic reduced-motion URL override", async () => {
    const originalUrl = window.location.href;
    const originalMatchMedia = window.matchMedia;

    try {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("min-width: 0px"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      window.history.pushState({}, "", "/?motion=reduce");
      delete window.__memoryBenchMotion;
      delete window.__memoryBenchMotionInspect;
      const { container } = render(<App />);

      expect(container.querySelector(".opendesign-app")).toHaveAttribute(
        "data-motion-reduce",
        "true",
      );
      expect(document.documentElement).toHaveAttribute("data-motion-reduce", "true");
      expect(screen.getByRole("heading", { name: /When AI agents remember/ })).toBeInTheDocument();

      await waitFor(() => {
        expect(motionDebugForTest()?.reducedMotionSource).toBe("override");
      });
      expect(motionDebugForTest()?.mode).toBe("reduced");
    } finally {
      window.history.pushState({}, "", originalUrl);
      document.documentElement.removeAttribute("data-motion-reduce");
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("keeps the deterministic reduced-motion URL override authoritative when media also reduces motion", async () => {
    const originalUrl = window.location.href;
    const originalMatchMedia = window.matchMedia;

    try {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches:
            query.includes("min-width: 0px") ||
            query.includes("prefers-reduced-motion: reduce"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      window.history.pushState({}, "", "/?motion=reduce");
      delete window.__memoryBenchMotion;
      delete window.__memoryBenchMotionInspect;

      render(<App />);

      await waitFor(() => {
        expect(motionDebugForTest()?.reducedMotionSource).toBe("override");
      });
      expect(motionDebugForTest()?.mode).toBe("reduced");
    } finally {
      window.history.pushState({}, "", originalUrl);
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("disconnects desktop orbit playback listeners on unmount", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalIntersectionObserver = window.IntersectionObserver;
    const addListenerSpy = vi.spyOn(document, "addEventListener");
    const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    const observe = vi.fn();
    const disconnect = vi.fn();

    try {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches:
            query.includes("min-width: 1360px") ||
            query.includes("prefers-reduced-motion: no-preference"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: class {
          observe = observe;
          disconnect = disconnect;
        },
      });

      const { unmount } = render(<App />);

      await waitFor(() => expect(observe).toHaveBeenCalled());
      expect(addListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

      unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
      expect(disconnect).toHaveBeenCalled();
    } finally {
      addListenerSpy.mockRestore();
      removeListenerSpy.mockRestore();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver,
      });
    }
  });
});
