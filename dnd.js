import { getLaneValue } from "./model.js";

/**
 * Enables:
 * - Move between horizons/lanes (columns)
 * - Reorder within a column by dropping above/below another card
 */
export function wireDnD(stateGetter, setStateAndRender) {
  let dropHint = null; // { overCardId, position: "before"|"after" }

  function clearIndicators() {
    document.querySelectorAll(".card").forEach((el) => {
      el.style.borderTop = "";
      el.style.borderBottom = "";
    });
    document.querySelectorAll(".column").forEach((el) => el.classList.remove("dropTarget"));
    dropHint = null;
  }

  function setCardIndicator(cardEl, position) {
    cardEl.style.borderTop = position === "before" ? "3px solid #999" : "";
    cardEl.style.borderBottom = position === "after" ? "3px solid #999" : "";
  }

  function getBucketKey(card, groupBy) {
    const lane = getLaneValue(card, groupBy);
    return `${card.horizon}::${lane}`;
  }

  function normalizeOrdersInBucket(state, horizon, laneValue, groupBy) {
    const bucketCards = state.cards
      .filter((c) => c.horizon === horizon && getLaneValue(c, groupBy) === laneValue)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    bucketCards.forEach((c, idx) => (c.order = idx));
  }

  function applyMoveAndReorder(state, movingId, destHorizon, destLaneValue, groupBy, overCardId, position) {
    const moving = state.cards.find((c) => c.id === movingId);
    if (!moving) return;

    const sourceHorizon = moving.horizon;
    const sourceLaneValue = getLaneValue(moving, groupBy);

    // Update horizon
    moving.horizon = destHorizon;

    // Update grouping field based on groupBy & destination lane
    if (groupBy !== "none") {
      const val = destLaneValue === "Unspecified" || destLaneValue === "All" ? null : destLaneValue;
      moving[groupBy] = val;
    }

    // Build destination bucket list (excluding moving card)
    const destList = state.cards
      .filter((c) => c.id !== movingId)
      .filter((c) => c.horizon === destHorizon && getLaneValue(c, groupBy) === getLaneValue(moving, groupBy))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Determine insertion index
    let insertIndex = destList.length;

    if (overCardId) {
      const idx = destList.findIndex((c) => c.id === overCardId);
      if (idx !== -1) {
        insertIndex = position === "before" ? idx : idx + 1;
      }
    }

    // Insert moving card into list
    destList.splice(insertIndex, 0, moving);

    // Reassign sequential orders in destination bucket
    destList.forEach((c, i) => (c.order = i));

    // Also normalize source bucket if it changed (keeps order clean)
    const destLaneAfter = getLaneValue(moving, groupBy);
    const sourceChanged =
      sourceHorizon !== destHorizon || sourceLaneValue !== destLaneAfter;

    if (sourceChanged) {
      normalizeOrdersInBucket(state, sourceHorizon, sourceLaneValue, groupBy);
    }
  }

  document.addEventListener("dragstart", (e) => {
    const card = e.target.closest?.(".card");
    if (!card) return;
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", card.dataset.cardId);
    // For Firefox
    e.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragend", (e) => {
    const card = e.target.closest?.(".card");
    if (card) card.classList.remove("dragging");
    clearIndicators();
  });

  document.addEventListener("dragover", (e) => {
    const col = e.target.closest?.(".column");
    if (!col) return;

    e.preventDefault(); // required to allow drop
    col.classList.add("dropTarget");

    const overCard = e.target.closest?.(".card");
    if (!overCard) {
      // hovering column empty space → no card indicator
      clearIndicators();
      col.classList.add("dropTarget");
      return;
    }

    // Show before/after indicator on the card being hovered
    const rect = overCard.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? "before" : "after";

    clearIndicators();
    col.classList.add("dropTarget");
    setCardIndicator(overCard, position);

    dropHint = { overCardId: overCard.dataset.cardId, position };
  });

  document.addEventListener("dragleave", (e) => {
    const col = e.target.closest?.(".column");
    if (!col) return;
    // Don’t clear too aggressively; dragover will reapply.
    col.classList.remove("dropTarget");
  });

  document.addEventListener("drop", (e) => {
    const col = e.target.closest?.(".column");
    if (!col) return;

    e.preventDefault();

    const movingId = e.dataTransfer.getData("text/plain");
    if (!movingId) return;

    const destHorizon = col.dataset.horizon;
    const destLaneValue = col.dataset.lane;
    const groupBy = col.dataset.groupby;

    if (!destHorizon || !destLaneValue || !groupBy) return;

    const state = stateGetter();

    // If dropping on itself indicator, ignore
    const overCardId = dropHint?.overCardId ?? null;
    const position = dropHint?.position ?? "after";

    applyMoveAndReorder(
      state,
      movingId,
      destHorizon,
      destLaneValue,
      groupBy,
      overCardId && overCardId !== movingId ? overCardId : null,
      position
    );

    clearIndicators();
    setStateAndRender(state);
  });
}