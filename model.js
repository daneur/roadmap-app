export const STORAGE_KEY = "roadmap_state_v2";

export function genId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

export function horizonLabel(h) {
  if (h === "now") return "Now";
  if (h === "next") return "Next";
  return "Later";
}

export const GROUP_BY = /** @type {const} */ ({
  platform: "platform",
  theme: "theme",
  team: "team",
  none: "none",
});

export function makeDefaultState() {
  return {
    version: 2,
    groupBy: "platform",
    cards: [
      {
        id: genId(),
        title: "Stabilise incident response",
        horizon: "now",
        platform: "D365",
        theme: "Operational resilience",
        team: "DevOps",
        order: 0
      },
      {
        id: genId(),
        title: "Improve release confidence",
        horizon: "next",
        platform: "D365",
        theme: "Operational resilience",
        team: "DevOps",
        order: 1
      }
    ],
    deps: [
      // { id, fromId, toId, kind: "blocks" }
    ],
    snapshots: []
  };
}

// v1 migration (lanes/cards) → v2 cards; deps absent
export function migrateFromV1IfNeeded(v1) {
  if (!v1 || !Array.isArray(v1.cards) || !Array.isArray(v1.lanes)) return null;

  const laneById = new Map(v1.lanes.map(l => [l.id, l.name]));

  const cards = v1.cards.map((c, idx) => {
    const laneName = laneById.get(c.laneId) || "";
    const m = laneName.match(/^\s*(Platform|Theme|Team)\s*:\s*(.+)\s*$/i);
    const base = {
      id: c.id || genId(),
      title: c.title || "Untitled",
      horizon: c.horizon || "now",
      platform: null,
      theme: null,
      team: null,
      order: idx
    };
    if (m) {
      const kind = m[1].toLowerCase();
      const val = m[2].trim();
      if (kind === "platform") base.platform = val;
      if (kind === "theme") base.theme = val;
      if (kind === "team") base.team = val;
    } else {
      if (laneName.trim()) base.platform = laneName.trim();
    }
    return base;
  });

  return {
    version: 2,
    groupBy: "platform",
    cards,
    deps: [],
    snapshots: []
  };
}

export function getLaneValue(card, groupBy) {
  if (groupBy === "none") return "All";
  const v = (card[groupBy] ?? "").trim();
  return v.length ? v : "Unspecified";
}

// --- Dependencies helpers ---

export function buildDepIndex(state) {
  const blocksOut = new Map(); // fromId -> [{toId, id, kind}]
  const blocksIn = new Map();  // toId -> [{fromId, id, kind}]

  for (const d of (state.deps ?? [])) {
    if (!blocksOut.has(d.fromId)) blocksOut.set(d.fromId, []);
    if (!blocksIn.has(d.toId)) blocksIn.set(d.toId, []);
    blocksOut.get(d.fromId).push(d);
    blocksIn.get(d.toId).push(d);
  }

  return { blocksOut, blocksIn };
}

// Horizon “lateness” ranking for warnings
export function horizonRank(h) {
  if (h === "now") return 0;
  if (h === "next") return 1;
  return 2; // later
}

// Warning rule: if A blocks B and A is in a later horizon than B
export function blockingMisalignment(blockerH, blockedH) {
  const a = horizonRank(blockerH);
  const b = horizonRank(blockedH);
  if (a <= b) return null;

  // blocker later than blocked
  if (blockerH === "later" && blockedH === "now") return "severe";
  if (blockerH === "next" && blockedH === "now") return "risk";
  if (blockerH === "later" && blockedH === "next") return "risk";
  return "risk";
}