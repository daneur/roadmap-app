import { STORAGE_KEY, makeDefaultState, migrateFromV1IfNeeded } from "./model.js";

const OLD_KEY = "roadmap_swimlanes_v1";

export function loadState() {
  // v2 first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  // try migrating v1
  try {
    const rawV1 = localStorage.getItem(OLD_KEY);
    if (rawV1) {
      const v1 = JSON.parse(rawV1);
      const migrated = migrateFromV1IfNeeded(v1);
      if (migrated) {
        saveState(migrated);
        return migrated;
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
      onLoaded(data);
    } catch (e) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}