import { horizonLabel, getLaneValue } from "./model.js";

export function renderBoard(state, containerEl) {
  containerEl.innerHTML = "";

  const groupBy = state.groupBy || "platform";
  const horizons = ["now", "next", "later"];

  // Build lanes dynamically from current cards
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
      board.appendChild(renderColumn(state, groupBy, lane, h));
    }

    laneWrap.appendChild(board);
    containerEl.appendChild(laneWrap);
  }
}

function renderColumn(state, groupBy, lane, horizon) {
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
    col.appendChild(renderCard(card));
  }

  return col;
}

function renderCard(card) {
  const el = document.createElement("div");
  el.className = "card";
  el.draggable = true;
  el.dataset.cardId = card.id;

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

  const actions = document.createElement("div");
  actions.className = "actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.onclick = () => window.appActions.editCard(card.id);

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.onclick = () => window.appActions.deleteCard(card.id);

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  el.appendChild(left);
  el.appendChild(actions);

  return el;
}