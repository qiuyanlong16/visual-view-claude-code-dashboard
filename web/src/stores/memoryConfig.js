import { writable } from "svelte/store";

export const globalMemory = writable({ memoryFiles: [], agentFiles: [] });
export const projectData = writable({});
export const configProjects = writable([]);

export async function loadConfig() {
  const res = await fetch("/memory/config");
  if (res.ok) {
    const data = await res.json();
    configProjects.set(data.projects || []);
  }
}

export async function loadGlobal() {
  const res = await fetch("/memory/global");
  if (res.ok) {
    globalMemory.set(await res.json());
  }
}

export async function loadProjectsData() {
  const res = await fetch("/memory/projects/data");
  if (res.ok) {
    const data = await res.json();
    projectData.set(data.projects || {});
  }
}

export async function loadAll() {
  await Promise.all([loadConfig(), loadGlobal(), loadProjectsData()]);
}

export async function addProject(path) {
  const res = await fetch("/memory/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", path }),
  });
  if (res.ok) {
    await loadAll();
  }
}

export async function removeProject(path) {
  const res = await fetch("/memory/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove", path }),
  });
  if (res.ok) {
    await loadAll();
  }
}
