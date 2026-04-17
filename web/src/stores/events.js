import { writable, derived } from "svelte/store";

export const events = writable([]);
export const connected = writable(false);
export const filter = writable({ type: "", session: "", project: "" });

export const filteredEvents = derived([events, filter], ([$events, $filter]) => {
  return $events.filter((e) => {
    if ($filter.type && e.type !== $filter.type) return false;
    if ($filter.session && e.session_id !== $filter.session) return false;
    if ($filter.project && e.project !== $filter.project) return false;
    return true;
  });
});

export function connectSSE() {
  const evtSource = new EventSource("/events/sse");

  evtSource.onopen = () => connected.set(true);
  evtSource.onerror = () => connected.set(false);

  evtSource.addEventListener("open", (e) => {
    try {
      const data = JSON.parse(e.data);
      events.update((list) => [...list, data]);
    } catch { /* skip non-JSON SSE messages */ }
  });

  evtSource.addEventListener("message", (e) => {
    try {
      const data = JSON.parse(e.data);
      events.update((list) => [...list, data]);
    } catch { /* skip non-JSON SSE messages */ }
  });

  for (const type of ["session_start", "session_end", "turn_end", "agent_start", "agent_end"]) {
    evtSource.addEventListener(type, (e) => {
      try {
        const data = JSON.parse(e.data);
        events.update((list) => [...list, data]);
      } catch { /* skip non-JSON SSE messages */ }
    });
  }

  return evtSource;
}

export async function fetchHistory() {
  const res = await fetch("/events/history");
  if (res.ok) {
    const history = await res.json();
    events.set(history);
  }
}
