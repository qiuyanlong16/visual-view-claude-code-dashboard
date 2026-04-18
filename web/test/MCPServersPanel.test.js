import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MCPServersPanel from "../src/components/MCPServersPanel.svelte";

describe("MCPServersPanel", () => {
  it("renders empty state when no data", () => {
    render(MCPServersPanel, { props: { mcpCounts: {}, maxCount: 1 } });
    expect(screen.getByText(/no mcp servers/i)).toBeInTheDocument();
  });

  it("renders server list sorted by call count", () => {
    render(MCPServersPanel, {
      props: {
        mcpCounts: { "context7": 12, "github": 8, "filesystem": 3 },
        maxCount: 12,
      },
    });
    expect(screen.getByText("context7")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
  });

  it("renders progress bars for each server", () => {
    const { container } = render(MCPServersPanel, {
      props: {
        mcpCounts: { "context7": 12, "github": 8, "filesystem": 3 },
        maxCount: 12,
      },
    });
    const bars = container.querySelectorAll(".mcp-bar-fill");
    expect(bars.length).toBe(3);
  });

  it("shows call count numbers", () => {
    const { container } = render(MCPServersPanel, {
      props: {
        mcpCounts: { "context7": 12, "github": 8 },
        maxCount: 12,
      },
    });
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("8");
  });
});
