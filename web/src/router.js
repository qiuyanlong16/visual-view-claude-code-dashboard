import { writable } from "svelte/store";

const routes = ["dashboard", "live", "memory", "tools", "cost", "overview", "playbook"];

export const currentRoute = writable("dashboard");

function parseHash() {
  const hash = window.location.hash.replace("#/", "");
  return routes.includes(hash) ? hash : "dashboard";
}

export function navigate(route) {
  window.location.hash = "/" + route;
  currentRoute.set(route);
}

export function initRouter() {
  currentRoute.set(parseHash());
  window.addEventListener("hashchange", () => {
    currentRoute.set(parseHash());
  });
}
