/**
 * Persists color theme: light | dark | system (match prefers-color-scheme).
 * No dependencies; runs once on DOMContentLoaded.
 */
const STORAGE_KEY = "artemshar.space-theme";

/** @returns {"light" | "dark"} */
function readStored() {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark") return v;
  return "light";
}

/** @param {"light" | "dark"} mode */
function apply(mode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
}

/** @param {"light" | "dark"} mode */
function cycle(mode) {
  const order = ["light", "dark"];
  const i = order.indexOf(mode);
  return order[(i + 1) % order.length];
}

function labelFor(mode) {
  if (mode === "light") return "Light theme";
  if (mode === "dark") return "Dark theme";
  return "System theme";
}

function init() {
  let mode = readStored();
  apply(mode);

  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;

  const sun = btn.querySelector("[data-icon='sun']");
  const moon = btn.querySelector("[data-icon='moon']");

  function syncIcon() {
    if (sun) sun.hidden = mode !== "light";
    if (moon) moon.hidden = mode !== "dark";
    btn.setAttribute("aria-label", `Theme: ${labelFor(mode)}. Click to switch.`);
    btn.setAttribute("title", labelFor(mode));
  }

  syncIcon();

  btn.addEventListener("click", () => {
    mode = cycle(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    apply(mode);
    syncIcon();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
