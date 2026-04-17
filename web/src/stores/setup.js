import { writable } from "svelte/store";

export const detectResult = writable(null);
export const isReady = writable(false);
export const isChecking = writable(false);

let pollingInterval = null;

async function fetchDetect() {
  const res = await fetch("/setup/detect");
  return res.json();
}

async function fetchInstall(targets) {
  const res = await fetch("/setup/install-hooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targets }),
  });
  return res.json();
}

export async function checkSetup() {
  isChecking.set(true);
  try {
    const result = await fetchDetect();
    detectResult.set(result);
    isReady.set(result.ready);
    return result;
  } finally {
    isChecking.set(false);
  }
}

export async function installHooks(targets) {
  const result = await fetchInstall(targets);
  await checkSetup();
  return result;
}

export function startPolling(ms = 5000) {
  stopPolling();
  pollingInterval = setInterval(() => {
    checkSetup();
  }, ms);
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
