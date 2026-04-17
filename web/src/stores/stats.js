import { writable } from "svelte/store";

export const stats = writable({
  totalTurns: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
  modelBreakdown: {},
  skillCounts: {},
  pluginCounts: {},
  mcpCounts: {},
  toolCounts: {},
  agentCounts: {},
  dailyTokens: {},
  memoryStats: { files: 0, size: 0, lastAccess: null },
});

export const eventRate = writable({ buckets: [], active: 0, totalEvents: 0 });

export async function fetchStats() {
  const res = await fetch("/stats");
  if (res.ok) stats.set(await res.json());
}

export async function fetchEventRate() {
  const res = await fetch("/stats/events-rate");
  if (res.ok) eventRate.set(await res.json());
}
