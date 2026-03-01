import { genId } from "./model.js";
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import { renderBoard } from "./board.js";
import { wireDnD } from "./dnd.js";

let state = loadState();

// UI state container (kept inside state so it persists safely across renders; not exported to snapshots)
if (!state.ui) state.ui = { linkMode: false, linkSourceId: null };

const els = {
  lanesContainer: document.getElementById("lanesContainer"),
  linkModeBanner: document.getElementById("linkModeBanner"),
  groupBySelect: document.getElementById("groupBySelect"),
  cardTitleInput: document.getElementById("cardTitleInput"),
  platformInput: document.getElementById("platformInput"),
  themeInput: document.getElementById("themeInput"),
  teamInput: document.getElementById("teamInput"),
  horizonSelect: document.getElementById("horizonSelect"),
  addCardBtn: document.getElementById("addCardBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  snapshotBtn: document.getElementById("snapshotBtn"),
  snapshotSelect: document.getElementById("snapshotSelect"),
};

function setState(next) {
  state = next;
  saveState(state);
  render();
}

function renderLinkBanner() {
  const b = els.linkModeBanner;
  b.innerHTML = "";

  if (!state.ui?.linkMode) return;

  const src = state.cards.find(c => c.id === state.ui.linkSourceId);
  const wrap = document.createElement("div");
  wrap.className = "linkModeBanner";

  const left = document.createElement("div");
  left.innerHTML = `<strong>Link mode:</strong> Click a card to mark it as <em>blocked by</em> “${src?.title ?? "?"}”.`;

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.onclick = () => {
    state.ui.linkMode = false;
    state.ui.linkSourceId = null;
    setState(state);
  };

  right.appendChild(cancel);
  wrap.appendChild(left);
  wrap.appendChild(right);

  b.appendChild(wrap);
}

function renderSnapshotDropdown() {
  const sel = els.snapshotSelect;
  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "(none)";
  sel.appendChild(opt0);

  for (const s of (state.snapshots ?? [])) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (${new Date(s.createdAt).toLocaleString()})`;
    sel.appendChild(opt);
  }
}

function render() {
  els.groupBySelect.value = state.groupBy || "platform";
  renderSnapshotDropdown();
  renderLinkBanner();
  renderBoard(state, els.lanesContainer);
}

// Expose actions for board.js
window.appActions = {
  onCardClicked(cardId) {
    // Link mode: clicking a target creates a dependency
    if (state.ui?.linkMode && state.ui?.linkSourceId) {
      const fromId = state.ui.linkSourceId;
      const toId = cardId;
      if (fromId === toId) return;

      const exists = (state.deps ?? []).some(d => d.fromId === fromId && d.toId === toId && d.kind === "blocks");
      if (!exists) {
        state.deps.push({ id: genId(), fromId, toId, kind: "blocks" });
      }

      // exit link mode
      state.ui.linkMode = false;
      state.ui.linkSourceId = null;
      setState(state);
    }
  },

  startLinkFrom(cardId) {
    state.ui.linkMode = true;
    state.ui.linkSourceId = cardId;
    setState(state);
  },

  manageDeps(cardId) {
    const outgoing = (state.deps ?? []).filter(d => d.fromId === cardId);
    const incoming = (state.deps ?? []).filter(d => d.toId === cardId);

    const card = state.cards.find(c => c.id === cardId);
    const name = card?.title ?? "Card";

    let msg = `Dependencies for:\n"${name}"\n\n`;

    msg += `Blocks:\n`;
    if (outgoing.length === 0) msg += `  (none)\n`;
    for (const d of outgoing) {
      const t = state.cards.find(c => c.id === d.toId)?.title ?? "(missing)";
      msg += `  - ${t} [${d.id}]\n`;
    }

    msg += `\nBlocked by:\n`;
    if (incoming.length === 0) msg += `  (none)\n`;
    for (const d of incoming) {
      const s = state.cards.find(c => c.id === d.fromId)?.title ?? "(missing)";
      msg += `  - ${s} [${d.id}]\n`;
    }

    msg += `\nTo remove a dependency, paste its id here (or Cancel):`;

    const toRemove = prompt(msg, "");
    if (toRemove === null) return;
    const trimmed = toRemove.trim();
    if (!trimmed) return;

    const before = state.deps.length;
    state.deps = state.deps.filter(d => d.id !== trimmed);
    if (state.deps.length === before) {
      alert("No dependency found with that id.");
      return;
    }
    setState(state);
  },

  editCard(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    const updated = prompt("Edit card title:", card.title);
    if (updated === null) return;
    const trimmed = updated.trim();
    if (!trimmed) return;

    card.title = trimmed;
    setState(state);
  },

  deleteCard(cardId) {
    // delete card + clean up dependencies referencing it
    state.cards = state.cards.filter(c => c.id !== cardId);
    state.deps = (state.deps ?? []).filter(d => d.fromId !== cardId && d.toId !== cardId);

    // exit link mode if needed
    if (state.ui?.linkSourceId === cardId) {
      state.ui.linkMode = false;
      state.ui.linkSourceId = null;
    }
    setState(state);
  }
};

function addCard() {
  const title = els.cardTitleInput.value.trim();
  if (!title) return;

  const platform = els.platformInput.value.trim() || null;
  const theme = els.themeInput.value.trim() || null;
  const team = els.teamInput.value.trim() || null;
  const horizon = els.horizonSelect.value;

  const max = state.cards
    .filter(c => c.horizon === horizon)
    .reduce((m, x) => Math.max(m, x.order ?? 0), -1);

  state.cards.push({
    id: genId(),
    title,
    horizon,
    platform,
    theme,
    team,
    order: max + 1
  });

  setState(state);

  els.cardTitleInput.value = "";
  els.cardTitleInput.focus();
}

function clearAll() {
  if (!confirm("Clear ALL cards, deps, and snapshots?")) return;
  state.cards = [];
  state.deps = [];
  state.snapshots = [];
  state.ui = { linkMode: false, linkSourceId: null };
  setState(state);
}

function createSnapshot() {
  const name = prompt("Snapshot name (e.g., Approved roadmap – Feb 2026):", "Snapshot");
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const snap = {
    id: genId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    data: {
      cards: structuredClone(state.cards),
      deps: structuredClone(state.deps ?? [])
    }
  };

  state.snapshots = [snap, ...(state.snapshots ?? [])];
  setState(state);
}

function onGroupByChange() {
  state.groupBy = els.groupBySelect.value;
  setState(state);
}

// Wiring
els.addCardBtn.onclick = addCard;
els.clearAllBtn.onclick = clearAll;
els.exportBtn.onclick = () => exportJSON(state);
els.snapshotBtn.onclick = createSnapshot;
els.groupBySelect.onchange = onGroupByChange;

els.importFile.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  importJSON(file, (data) => {
    if (!data) {
      alert("Invalid JSON file.");
      return;
    }
    // ensure ui container
    if (!data.ui) data.ui = { linkMode: false, linkSourceId: null };
    setState(data);
    els.importFile.value = "";
  });
});

els.cardTitleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCard();
});

// Drag & Drop
wireDnD(() => state, (s) => setState(s));

// Initial render
render();