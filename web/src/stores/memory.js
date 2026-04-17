import { writable } from "svelte/store";

export const memoryFiles = writable([]);
export const selectedFile = writable(null);
export const fileContent = writable("");

export async function loadFiles(project) {
  if (!project) return;
  const res = await fetch(`/memory?project=${encodeURIComponent(project)}`);
  if (res.ok) {
    const data = await res.json();
    memoryFiles.set(data.files || []);
  }
}

export async function loadContent(path) {
  const res = await fetch(`/memory/content?path=${encodeURIComponent(path)}`);
  if (res.ok) {
    const data = await res.json();
    fileContent.set(data.content);
  }
}
