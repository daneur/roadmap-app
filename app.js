import { drawDependencyGraph } from "./depGraph.js";
import { genId } from "./model.js";
import { loadState, saveState, exportJSON, importJSON } from "./storage.js";
import { renderBoard } from "./board.js";
import { wireDnD } from "./dnd.js";

let state = loadState();
if (!state.ui) state.ui = {};
if (state.ui.showDeps === undefined) state.ui.showDeps = true; // default ON
if (state.ui.selectedCardId === undefined) state.ui.selectedCardId = null;

// UI state container (kept inside state so it persists safely across renders; not exported to snapshots)
if (!state.ui) state.ui = { linkMode: false, linkSourceId: null };

const els = {
  lanesContainer: document.getElementById("lanesContainer"),
  linkModeBanner: document.getElementById("linkModeBanner"),
  boardWrap: document.getElementById("boardWrap"),
  depSvg: document.getElementById("depSvg"), 
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
  sidePanel: document.getElementById("sidePanel"),
  showDepsToggle: document.getElementById("showDepsToggle"),
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
function renderSidePanel() {
  const panel = els.sidePanel;
  const selectedId = state.ui?.selectedCardId;

  if (!selectedId) {
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = "";
    return;
  }

  const card = state.cards.find(c => c.id === selectedId);
  if (!card) {
    state.ui.selectedCardId = null;
    setState(state);
    return;
  }

  const outgoing = (state.deps ?? []).filter(d => d.fromId === selectedId && d.kind === "blocks");
  const incoming = (state.deps ?? []).filter(d => d.toId === selectedId && d.kind === "blocks");

  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");

  // Build UI
  panel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "panelHeader";

  const left = document.createElement("div");
  const title = document.createElement("div");
  title.className = "panelTitle";
  title.textContent = card.title;

  const sub = document.createElement("div");
  sub.className = "panelSub";
  sub.textContent = `Horizon: ${card.horizon} • Platform: ${card.platform ?? "—"} • Theme: ${card.theme ?? "—"} • Team: ${card.team ?? "—"}`;

  left.appendChild(title);
  left.appendChild(sub);

  const closeBtn = document.createElement("button");
  closeBtn.className = "smallBtn";
  closeBtn.textContent = "Close";
  closeBtn.onclick = () => {
    state.ui.selectedCardId = null;
    setState(state);
  };

  header.appendChild(left);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Add dependency section
  const addSection = document.createElement("div");
  addSection.className = "panelSection";

  const addLabel = document.createElement("div");
  addLabel.className = "panelTitle";
  addLabel.textContent = "Add dependency (this blocks…)";

  const select = document.createElement("select");
  select.className = "select";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "(choose a target)";
  select.appendChild(opt0);

  const candidates = state.cards
    .filter(c => c.id !== selectedId)
    .sort((a, b) => a.title.localeCompare(b.title));

  for (const c of candidates) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    select.appendChild(opt);
  }

  const addBtn = document.createElement("button");
  addBtn.className = "smallBtn";
  addBtn.style.marginTop = "8px";
  addBtn.textContent = "Add blocks →";
  addBtn.onclick = () => {
    const toId = select.value;
    if (!toId) return;

    const exists = (state.deps ?? []).some(d => d.fromId === selectedId && d.toId === toId && d.kind === "blocks");
    if (!exists) {
      state.deps.push({ id: genId(), fromId: selectedId, toId, kind: "blocks" });
      setState(state);
    }
  };

  addSection.appendChild(addLabel);
  addSection.appendChild(select);
  addSection.appendChild(addBtn);
  panel.appendChild(addSection);

  // Outgoing list
  const outSection = document.createElement("div");
  outSection.className = "panelSection";

  const outTitle = document.createElement("div");
  outTitle.className = "panelTitle";
  outTitle.textContent = `Blocks (${outgoing.length})`;

  outSection.appendChild(outTitle);

  if (outgoing.length === 0) {
    const p = document.createElement("div");
    p.className = "panelSub";
    p.textContent = "(none)";
    outSection.appendChild(p);
  } else {
    for (const d of outgoing) {
      const t = state.cards.find(c => c.id === d.toId);
      const row = document.createElement("div");
      row.className = "depRow";

      const info = document.createElement("div");
      const t1 = document.createElement("div");
      t1.className = "depRowTitle";
      t1.textContent = t?.title ?? "(missing)";

      const t2 = document.createElement("div");
      t2.className = "depRowMeta";
      t2.textContent = `id: ${d.id}`;

      info.appendChild(t1);
      info.appendChild(t2);

      const rm = document.createElement("button");
      rm.className = "smallBtn";
      rm.textContent = "Remove";
      rm.onclick = () => {
        state.deps = state.deps.filter(x => x.id !== d.id);
        setState(state);
      };

      row.appendChild(info);
      row.appendChild(rm);
      outSection.appendChild(row);
    }
  }

  panel.appendChild(outSection);

  // Incoming list
  const inSection = document.createElement("div");
  inSection.className = "panelSection";

  const inTitle = document.createElement("div");
  inTitle.className = "panelTitle";
  inTitle.textContent = `Blocked by (${incoming.length})`;

  inSection.appendChild(inTitle);

  if (incoming.length === 0) {
    const p = document.createElement("div");
    p.className = "panelSub";
    p.textContent = "(none)";
    inSection.appendChild(p);
  } else {
    for (const d of incoming) {
      const s = state.cards.find(c => c.id === d.fromId);
      const row = document.createElement("div");
      row.className = "depRow";

      const info = document.createElement("div");
      const t1 = document.createElement("div");
      t1.className = "depRowTitle";
      t1.textContent = s?.title ?? "(missing)";

      const t2 = document.createElement("div");
      t2.className = "depRowMeta";
      t2.textContent = `id: ${d.id}`;

      info.appendChild(t1);
      info.appendChild(t2);

      const rm = document.createElement("button");
      rm.className = "smallBtn";
      rm.textContent = "Remove";
      rm.onclick = () => {
        state.deps = state.deps.filter(x => x.id !== d.id);
        setState(state);
      };

      row.appendChild(info);
      row.appendChild(rm);
      inSection.appendChild(row);
    }
  }

  panel.appendChild(inSection);
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
  els.showDepsToggle.checked = state.ui.showDeps !== false;

  renderSnapshotDropdown();
  renderLinkBanner();
  renderBoard(state, els.lanesContainer);

  renderSidePanel();

  // draw arrows after DOM cards exist
  drawDependencyGraph({ state, svgEl: els.depSvg, containerEl: els.boardWrap });
}

// Expose actions for board.js
window.appActions = {
  onCardClicked(cardId) {
  // If in link mode, clicking target creates dependency
  if (state.ui?.linkMode && state.ui?.linkSourceId) {
    const fromId = state.ui.linkSourceId;
    const toId = cardId;
    if (fromId === toId) return;

    const exists = (state.deps ?? []).some(d => d.fromId === fromId && d.toId === toId && d.kind === "blocks");
    if (!exists) {
      state.deps.push({ id: genId(), fromId, toId, kind: "blocks" });
    }

    state.ui.linkMode = false;
    state.ui.linkSourceId = null;

    // Also select the target so panel opens on it (nice flow)
    state.ui.selectedCardId = toId;
    setState(state);
    return;
  }

  // Normal click: select card → open side panel
  state.ui.selectedCardId = cardId;
  setState(state);
},

      // exit link mode
      state.ui.linkMode = false;
      state.ui.linkSourceId = null;
      setState(state);
    }
  },

  startLinkFrom(cardId) {
  state.ui.linkMode = true;
  state.ui.linkSourceId = cardId;
  state.ui.selectedCardId = cardId;
  setState(state);
},


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

    if (state.ui?.selectedCardId === cardId) state.ui.selectedCardId = null;
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

els.showDepsToggle.addEventListener("change", () => {
  state.ui.showDeps = els.showDepsToggle.checked;
  setState(state);
});

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
function redrawDeps() {
  drawDependencyGraph({ state, svgEl: els.depSvg, containerEl: els.boardWrap });
}

window.addEventListener("resize", () => redrawDeps(), { passive: true });
window.addEventListener("scroll", () => redrawDeps(), { passive: true });

// If you scroll inside the page and the board moves, this keeps arrows aligned.