import { writable } from "svelte/store";

export const realtime = writable({
  totalTokens: 0,
  totalCost: 0,
  activeAgents: 0,
  totalTools: 0,
  totalSkills: 0,
  errorCount: 0,
  recentErrors: [],
});

let intervalId = null;

export function startRealtimePolling(intervalMs = 5000) {
  fetchRealtime();
  intervalId = setInterval(fetchRealtime, intervalMs);
}

export function stopRealtimePolling() {
  if (intervalId) clearInterval(intervalId);
}

async function fetchRealtime() {
  try {
    const res = await fetch("/stats/realtime");
    if (res.ok) realtime.set(await res.json());
  } catch (e) {
    // Silently fail — stale values remain
  }
}
