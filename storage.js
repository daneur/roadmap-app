import { STORAGE_KEY, makeDefaultState, migrateFromV1IfNeeded } from "./model.js";

const OLD_KEY = "roadmap_swimlanes_v1";

function normalizeState(data) {
  if (!data || typeof data !== "object") return null;
  if (!Array.isArray(data.cards)) return null;
  if (!Array.isArray(data.snapshots)) data.snapshots = [];
  if (!Array.isArray(data.deps)) data.deps = [];
  if (!data.groupBy) data.groupBy = "platform";
  data.version = 2;
  return data;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = normalizeState(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {}

  try {
    const rawV1 = localStorage.getItem(OLD_KEY);
    if (rawV1) {
      const v1 = JSON.parse(rawV1);
      const migrated = migrateFromV1IfNeeded(v1);
      const normalized = normalizeState(migrated);
      if (normalized) {
        saveState(normalized);
        return normalized;
      }
    }
  } catch {}

  const fresh = makeDefaultState();
  saveState(fresh);
  return fresh;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roadmap-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file, onLoaded) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ""));
      onLoaded(normalizeState(data));
    } catch {
      onLoaded(null);
    }
  };
  reader.readAsText(file);
}