import { writable } from "svelte/store";

export const sessions = writable([]);

export async function fetchSessions() {
  const res = await fetch("/sessions");
  if (res.ok) sessions.set(await res.json());
}

export async function fetchSession(id) {
  const res = await fetch(`/sessions/${id}`);
  if (res.ok) return await res.json();
  return null;
}
