import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";

const { eventsStore, connectedStore, statsStore, eventRateStore, realtimeStore, sessionsStore } = vi.hoisted(() => {
  const { writable } = require("svelte/store");
  return {
    eventsStore: writable([{ type: "turn_end", timestamp: "2026-04-17T10:00:00", data: {}, session_id: "abc" }]),
    connectedStore: writable(true),
    statsStore: writable({
      totalTurns: 10, totalInputTokens: 5000, totalOutputTokens: 3000, totalCost: 0.05,
      toolCounts: {}, skillCounts: {}, agentCounts: {}, dailyTokens: {}, modelBreakdown: {},
      memoryStats: { files: 5, size: 1000, lastAccess: null },
      pluginCounts: { "plugin:context7": 12, "plugin:github": 8, "plugin:filesystem": 3 },
    }),
    eventRateStore: writable({
      buckets: [
        { time: "10:00", turnCount: 5, agentCount: 2 },
        { time: "10:05", turnCount: 8, agentCount: 3 },
        { time: "10:10", turnCount: 12, agentCount: 1 },
        { time: "10:15", turnCount: 6, agentCount: 4 },
        { time: "10:20", turnCount: 10, agentCount: 2 },
        { time: "10:25", turnCount: 3, agentCount: 0 },
        { time: "10:30", turnCount: 7, agentCount: 3 },
        { time: "10:35", turnCount: 9, agentCount: 1 },
        { time: "10:40", turnCount: 11, agentCount: 2 },
        { time: "10:45", turnCount: 4, agentCount: 5 },
        { time: "10:50", turnCount: 6, agentCount: 1 },
        { time: "10:55", turnCount: 8, agentCount: 3 },
      ],
      active: 2, totalEvents: 100, hours: 2,
    }),
    realtimeStore: writable({ totalTokens: 8000, totalCost: 0.08, activeAgents: 2, totalTools: 15, totalSkills: 3, errorCount: 0, recentErrors: [] }),
    sessionsStore: writable([{ id: "abc", status: "active", events: [{ type: "turn_end" }], createdAt: "2026-04-17T10:00:00", updatedAt: "2026-04-17T10:55:00" }]),
  };
});

vi.mock("/src/stores/events.js", () => ({
  events: eventsStore,
  connected: connectedStore,
}));
vi.mock("/src/stores/stats.js", () => ({
  stats: statsStore,
  eventRate: eventRateStore,
  fetchStats: () => {},
  fetchEventRate: () => {},
}));
vi.mock("/src/stores/realtime.js", () => ({
  realtime: realtimeStore,
}));
vi.mock("/src/stores/sessions.js", () => ({
  sessions: sessionsStore,
}));

import Dashboard from "../src/views/Dashboard.svelte";

describe("Dashboard MCP Servers", () => {
  it("renders MCP Servers panel with data", () => {
    const { container } = render(Dashboard);
    expect(container.querySelector(".d-mcp-servers")).toBeTruthy();
    expect(container.querySelector(".mcp-panel")).toBeTruthy();
    const bars = container.querySelectorAll(".mcp-bar-fill");
    expect(bars.length).toBe(3);
  });

  it("shows MCP server names", () => {
    const { container } = render(Dashboard);
    expect(container.textContent).toContain("context7");
    expect(container.textContent).toContain("github");
  });
});
