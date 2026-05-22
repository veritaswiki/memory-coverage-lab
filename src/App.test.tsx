import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Memory Coverage Lab", () => {
  it("renders the default coverage map and selected project panel", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /When AI agents remember/ })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Mem0" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("记忆覆盖圆图")).toBeInTheDocument();
  });

  it("switches views and keeps the stack planner interactive", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: /Stack planner/ }));
    expect(screen.getByRole("heading", { name: "组合路线覆盖计算" })).toBeInTheDocument();
    expect(screen.getAllByText("组合覆盖").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Mem0/ }));
    expect(screen.getAllByText(/Mem0/).length).toBeGreaterThan(0);
  });

  it("filters projects from the search input", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText("搜索项目、层级或能力"), "Vector");

    expect(screen.getAllByText("Vector DB").length).toBeGreaterThan(0);
    expect(screen.queryByText("Supermemory")).not.toBeInTheDocument();
  });
});
