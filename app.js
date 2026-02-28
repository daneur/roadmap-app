import { genId } from "./model.js";
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import { renderBoard } from "./board.js";
import { wireDnD } from "./dnd.js";

let state = loadState();

const els = {
  lanesContainer: document.getElementById("lanesContainer"),
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

function render() {
  // groupBy select
  els.groupBySelect.value = state.groupBy || "platform";

  // snapshot dropdown
  renderSnapshotDropdown();

  // render current board (or snapshot overlay later)
  renderBoard(state, els.lanesContainer);
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

// Expose actions for board.js to call
window.appActions = {
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
    state.cards = state.cards.filter(c => c.id !== cardId);
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

  // Put card at end of horizon bucket (order within horizon/group is handled by DnD; for add, just append)
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
  if (!confirm("Clear ALL cards and snapshots?")) return;
  setState({ ...state, cards: [], snapshots: [] });
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
      cards: structuredClone(state.cards)
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
    // basic safety
    if (!data || !Array.isArray(data.cards)) {
      alert("That JSON doesn't look like a roadmap export.");
      return;
    }
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