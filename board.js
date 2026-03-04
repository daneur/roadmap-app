import { horizonLabel, getLaneValue, buildDepIndex, blockingMisalignment } from "./model.js";

export function renderBoard(state, containerEl) {
  containerEl.innerHTML = "";

  const groupBy = state.groupBy || "platform";
  const horizons = ["now", "next", "later"];

  const { blocksOut, blocksIn } = buildDepIndex(state);
  const cardById = new Map(state.cards.map(c => [c.id, c]));

  const laneSet = new Set(state.cards.map(c => getLaneValue(c, groupBy)));
  if (laneSet.size === 0) laneSet.add("Unspecified");
  const lanes = Array.from(laneSet).sort((a,b) => a.localeCompare(b));

  for (const lane of lanes) {
    const laneWrap = document.createElement("div");
    laneWrap.className = "swimlane";

    const header = document.createElement("div");
    header.className = "swimlaneHeader";

    const title = document.createElement("div");
    title.className = "swimlaneTitle";
    title.textContent = lane;

    header.appendChild(title);
    laneWrap.appendChild(header);

    const board = document.createElement("div");
    board.className = "board";

    for (const h of horizons) {
      board.appendChild(renderColumn(state, groupBy, lane, h, blocksOut, blocksIn, cardById));
    }

    laneWrap.appendChild(board);
    containerEl.appendChild(laneWrap);
  }
}

function renderColumn(state, groupBy, lane, horizon, blocksOut, blocksIn, cardById) {
  const col = document.createElement("div");
  col.className = "column";
  col.dataset.horizon = horizon;
  col.dataset.lane = lane;
  col.dataset.groupby = groupBy;

  const h = document.createElement("h3");
  h.textContent = horizonLabel(horizon);
  col.appendChild(h);

  const cardsHere = state.cards
    .filter(c => c.horizon === horizon && getLaneValue(c, groupBy) === lane)
    .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));

  for (const card of cardsHere) {
    col.appendChild(renderCard(card, state, blocksOut, blocksIn, cardById));
  }

  return col;
}

function renderCard(card, state, blocksOut, blocksIn, cardById) {
  const el = document.createElement("div");
  el.className = "card";
  el.draggable = true;
  el.dataset.cardId = card.id;

  if (state.ui?.selectedCardId === card.id) {
  el.classList.add("selected");

  if (state.ui?.linkMode && state.ui?.linkSourceId === card.id) {
    el.classList.add("linkSource");
  }

  // click behaviour (used for link mode)
  el.addEventListener("click", (e) => {
    // avoid clicks on action buttons
    const btn = e.target.closest?.("button");
    if (btn) return;
    window.appActions.onCardClicked(card.id);
  });

  const left = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = card.title;
  left.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <span>Platform: ${card.platform || "—"}</span>
    <span>Theme: ${card.theme || "—"}</span>
    <span>Team: ${card.team || "—"}</span>
  `;
  left.appendChild(meta);

  // Dependency badges
  const out = blocksOut.get(card.id) ?? [];
  const inn = blocksIn.get(card.id) ?? [];

  // Determine worst warning based on "blocks" only
  let worst = null; // null | "risk" | "severe"
  for (const d of out) {
    if (d.kind !== "blocks") continue;
    const blocked = cardById.get(d.toId);
    if (!blocked) continue;
    const w = blockingMisalignment(card.horizon, blocked.horizon);
    if (w === "severe") worst = "severe";
    else if (w === "risk" && worst !== "severe") worst = "risk";
  }

  const badges = document.createElement("div");
  badges.className = "badges";

  const b1 = document.createElement("span");
  b1.className = "badge";
  b1.textContent = `Blocks: ${out.length}`;
  badges.appendChild(b1);

  const b2 = document.createElement("span");
  b2.className = "badge";
  b2.textContent = `Blocked by: ${inn.length}`;
  badges.appendChild(b2);

  if (worst) {
    const bw = document.createElement("span");
    bw.className = `badge ${worst === "severe" ? "badgeSevere" : "badgeRisk"}`;
    bw.textContent = worst === "severe" ? "Dependency misaligned 🔴" : "Dependency at risk 🟠";
    badges.appendChild(bw);
  }

  left.appendChild(badges);

  const actions = document.createElement("div");
  actions.className = "actions";

  const linkBtn = document.createElement("button");
  linkBtn.textContent = "Link";
  linkBtn.onclick = () => window.appActions.startLinkFrom(card.id);

  const manageBtn = document.createElement("button");
  manageBtn.textContent = "Deps";
  manageBtn.onclick = () => window.appActions.manageDeps(card.id);

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.onclick = () => window.appActions.editCard(card.id);

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.onclick = () => window.appActions.deleteCard(card.id);

  actions.appendChild(linkBtn);
  actions.appendChild(manageBtn);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  el.appendChild(left);
  el.appendChild(actions);

  return el;
}