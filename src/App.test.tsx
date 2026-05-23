import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Memory Coverage Lab", () => {
  it("renders the default coverage map and selected project panel", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /When AI agents remember/ })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Plan Review QA Ship Learn workflow"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Mem0" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("记忆覆盖圆图")).toBeInTheDocument();
  });

  it("switches views and keeps the stack planner interactive", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: /Stack planner/ }));
    expect(screen.getByRole("heading", { name: "组合路线覆盖计算" })).toBeInTheDocument();
    expect(screen.getAllByText("组合覆盖").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Toggle Mem0 in stack" }));
    expect(screen.getAllByText(/Mem0/).length).toBeGreaterThan(0);
  });

  it("filters projects from the search input", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("搜索项目、层级或能力"), "Vector");

    expect(screen.getAllByText("Vector DB").length).toBeGreaterThan(0);
    expect(screen.queryByText("Supermemory")).not.toBeInTheDocument();
  });

  it("shows an empty search state without stale benchmark panels", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("搜索项目、层级或能力"), "no-such-memory-system");

    expect(screen.getByText("No matching dossier")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "没有找到匹配的系统或证据线索" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("tracked system count")).toHaveTextContent("0");
    expect(screen.queryByLabelText("记忆覆盖圆图")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("项目详情")).not.toBeInTheDocument();
  });

  it("shows the stack planner empty state when all selected projects are removed", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: /Stack planner/ }));

    for (const project of ["Mem0", "Zep", "LlamaIndex", "Vector DB"]) {
      await user.click(screen.getByRole("button", { name: `Toggle ${project} in stack` }));
    }

    expect(screen.getByText("待选择")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "当前没有选择项目" }),
    ).toBeInTheDocument();
    expect(screen.getByText("先选择项目，才能生成优先补齐列表。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "十六项能力" })).not.toBeInTheDocument();
  });

  it("limits the stack planner universe to filtered projects", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: /Stack planner/ }));
    await user.type(screen.getByLabelText("搜索项目、层级或能力"), "Supermemory");

    expect(screen.getByLabelText("tracked system count")).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: "Toggle Supermemory in stack" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Toggle Mem0 in stack" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("待选择")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "当前没有选择项目" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle Supermemory in stack" }));

    expect(screen.queryByText("待选择")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "当前没有选择项目" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "十六项能力" })).toBeInTheDocument();
  });

  it("keeps primary public links and the five-step evidence loop discoverable", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /See public research/ })).toHaveAttribute(
      "href",
      "#research",
    );
    expect(screen.getByRole("link", { name: "Explore benchmark data" })).toHaveAttribute(
      "href",
      "#benchmarks",
    );

    for (const stage of ["Plan", "Review", "QA", "Ship", "Learn"]) {
      expect(screen.getAllByText(stage).length).toBeGreaterThan(0);
    }

    expect(screen.getAllByRole("link", { name: "GitHub" }).length).toBeGreaterThan(0);
  });
});
