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
      }
    ],
    snapshots: [] // {id, name, createdAt, data:{cards}}
  };
}

// Migrate your old v1 state (lanes + cards with laneId) into v2 cards with platform/theme/team inferred.
export function migrateFromV1IfNeeded(v1) {
  // v1 = { lanes: [{id,name}], cards: [{id,title,laneId,horizon}] }
  if (!v1 || !Array.isArray(v1.cards) || !Array.isArray(v1.lanes)) return null;

  const laneById = new Map(v1.lanes.map(l => [l.id, l.name]));

  const cards = v1.cards.map((c, idx) => {
    const laneName = laneById.get(c.laneId) || "";
    // Try to parse "Platform: D365" style
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
      // If lane isn’t structured, treat it as platform by default (good enough for migration)
      if (laneName.trim()) base.platform = laneName.trim();
    }
    return base;
  });

  return {
    version: 2,
    groupBy: "platform",
    cards,
    snapshots: []
  };
}

export function getLaneValue(card, groupBy) {
  if (groupBy === "none") return "All";
  const v = (card[groupBy] ?? "").trim();
  return v.length ? v : "Unspecified";
}