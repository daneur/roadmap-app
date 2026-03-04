import { blockingMisalignment } from "./model.js";

/**
 * Draws dependency arrows as SVG paths over the board.
 * Assumes each card DOM node has: .card[data-card-id="..."]
 */
export function drawDependencyGraph({ state, svgEl, containerEl }) {
  if (!svgEl || !containerEl) return;

  if (state.ui?.showDeps === false) {
  svgEl.innerHTML = "";
  return;
}
  // Resize SVG to container
  const crect = containerEl.getBoundingClientRect();
  svgEl.setAttribute("viewBox", `0 0 ${crect.width} ${crect.height}`);
  svgEl.innerHTML = "";

  // Markers (arrow heads)
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

  const marker = (id) => {
    const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    m.setAttribute("id", id);
    m.setAttribute("markerWidth", "10");
    m.setAttribute("markerHeight", "10");
    m.setAttribute("refX", "8");
    m.setAttribute("refY", "5");
    m.setAttribute("orient", "auto");
    m.setAttribute("markerUnits", "strokeWidth");

    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    p.setAttribute("fill", "currentColor");
    m.appendChild(p);
    return m;
  };

  defs.appendChild(marker("arrow-normal"));
  defs.appendChild(marker("arrow-risk"));
  defs.appendChild(marker("arrow-severe"));
  svgEl.appendChild(defs);

  const cardEls = new Map(
    Array.from(containerEl.querySelectorAll(".card")).map((el) => [el.dataset.cardId, el])
  );

  const cardById = new Map(state.cards.map((c) => [c.id, c]));

  // Helper: get anchor points (right-middle to left-middle)
  function anchorPoints(fromEl, toEl) {
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();

    // Convert from viewport coords to container-local coords
    const fromX = (a.right - crect.left);
    const fromY = (a.top + a.height / 2 - crect.top);

    const toX = (b.left - crect.left);
    const toY = (b.top + b.height / 2 - crect.top);

    return { fromX, fromY, toX, toY };
  }

  function makePath({ fromX, fromY, toX, toY }) {
    // Curved cubic bezier; push control points outward
    const dx = Math.max(40, Math.min(220, Math.abs(toX - fromX) * 0.5));
    const c1x = fromX + dx;
    const c1y = fromY;
    const c2x = toX - dx;
    const c2y = toY;
    return `M ${fromX} ${fromY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`;
  }

  // Draw edges
  for (const d of (state.deps ?? [])) {
    if (d.kind !== "blocks") continue;

    const fromEl = cardEls.get(d.fromId);
    const toEl = cardEls.get(d.toId);
    const fromCard = cardById.get(d.fromId);
    const toCard = cardById.get(d.toId);

    if (!fromEl || !toEl || !fromCard || !toCard) continue;

    const mis = blockingMisalignment(fromCard.horizon, toCard.horizon); // null | risk | severe

    const pts = anchorPoints(fromEl, toEl);
    const pathStr = makePath(pts);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathStr);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "2.2");
    path.setAttribute("opacity", "0.9");

    // Use currentColor so marker inherits
    if (mis === "severe") {
      path.setAttribute("stroke", "#c0392b");
      path.style.color = "#c0392b";
      path.setAttribute("marker-end", "url(#arrow-severe)");
    } else if (mis === "risk") {
      path.setAttribute("stroke", "#d09a00");
      path.style.color = "#d09a00";
      path.setAttribute("marker-end", "url(#arrow-risk)");
    } else {
      path.setAttribute("stroke", "rgba(0,0,0,0.35)");
      path.style.color = "rgba(0,0,0,0.35)";
      path.setAttribute("marker-end", "url(#arrow-normal)");
    }

    svgEl.appendChild(path);
  }
}