import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import CCPlaybook from "../src/views/CCPlaybook.svelte";

vi.mock("../src/stores/setup.js", () => {
  const { writable } = require("svelte/store");
  return {
    detectResult: writable({
      claudeInstalled: true,
      claudeVersion: "0.5.0",
      globalSettingsExists: true,
      globalSettingsPath: "/home/user/.claude/settings.json",
      projectSettingsExists: true,
      projectSettingsPath: "/project/.claude/settings.local.json",
      hooksConfigured: { global: true, project: true },
      ready: true,
    }),
    isReady: writable(true),
    isChecking: writable(false),
    checkSetup: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    installHooks: vi.fn(),
  };
});

vi.mock("../src/stores/stats.js", () => {
  const { writable } = require("svelte/store");
  return {
    stats: writable({ totalTurns: 42, totalInputTokens: 10000, totalOutputTokens: 5000, totalCost: 0.15, toolCounts: { Bash: 100, Read: 50 }, skillCounts: { "superpowers:brainstorming": 4, "superpowers:simplify": 2 }, agentCounts: {}, dailyTokens: {}, modelBreakdown: {}, memoryStats: { files: 23, size: 9700, lastAccess: new Date().toISOString() } }),
    eventRate: writable({ buckets: [], active: 2, totalEvents: 100, hours: 2 }),
  };
});

vi.mock("../src/stores/realtime.js", () => {
  const { writable } = require("svelte/store");
  return {
    realtime: writable({ totalTokens: 8000, totalCost: 0.08, activeAgents: 2, totalTools: 15, totalSkills: 3, errorCount: 0, recentErrors: [] }),
  };
});

vi.mock("../src/stores/events.js", () => {
  const { writable } = require("svelte/store");
  return {
    events: writable([
      { type: "agent_start", data: { name: "explore", type: "general-purpose" }, session_id: "abc" },
      { type: "agent_start", data: { name: "plan", type: "plan" }, session_id: "abc" },
      { type: "agent_end", data: { status: "completed" }, session_id: "abc" },
      { type: "turn_end", data: { tools_used: ["Bash", "Read"] }, session_id: "abc" },
    ]),
    connected: writable(true),
  };
});

describe("CCPlaybook", () => {
  it("renders all 6 section cards", () => {
    render(CCPlaybook);
    expect(screen.getByText(/Environment Status/i)).toBeTruthy();
    expect(screen.getByText(/Active Patterns/i)).toBeTruthy();
    expect(screen.getByText(/Your Workflow Stats/i)).toBeTruthy();
    expect(screen.getByText(/Your Tool & Skill Usage/i)).toBeTruthy();
    expect(screen.getByText(/Your Config Files/i)).toBeTruthy();
    expect(screen.getByText(/Recent Issues Detected/i)).toBeTruthy();
  });

  it("cards are collapsed by default", () => {
    const { container } = render(CCPlaybook);
    const bodies = container.querySelectorAll(".pb-card-body");
    bodies.forEach(body => {
      expect(body).toHaveClass("collapsed");
    });
  });

  it("expands card on click", async () => {
    const { container } = render(CCPlaybook);
    const header = container.querySelector(".pb-card-header");
    await fireEvent.click(header);
    const body = container.querySelector(".pb-card-body");
    expect(body).not.toHaveClass("collapsed");
  });

  it("shows live data in Environment Status", () => {
    render(CCPlaybook);
    expect(screen.getAllByText(/Claude CLI/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Global Settings/i).length).toBeGreaterThan(0);
  });

  it("shows detected patterns", () => {
    const { container } = render(CCPlaybook);
    expect(container.querySelector(".pb-pattern-item.active")).toBeTruthy();
  });
});
