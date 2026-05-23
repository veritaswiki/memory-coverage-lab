import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("MemoryBench OpenDesign rebuild", () => {
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
    expect(container.querySelectorAll("#research")).toHaveLength(1);
    expect(container.querySelector("#memory-categories")).toBeInTheDocument();
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
    expect(screen.queryByLabelText("AI memory boundary map")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("selected system dossier")).not.toBeInTheDocument();
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
  });

  it("opens the evidence ledger from the top navigation", async () => {
    const user = userEvent.setup();

    render(<App />);

    const evidenceLink = screen.getByRole("link", { name: "Evidence" });
    expect(evidenceLink).toHaveAttribute("href", "#evidence");

    await user.click(evidenceLink);

    expect(screen.getByRole("tab", { name: /Evidence ledger/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("evidence ledger")).toBeInTheDocument();
  });
});
