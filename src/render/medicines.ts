import { $ } from "../dom";
import {
  focusMed,
  medSearch,
  venFilter,
  medicinesExpanded,
  medicinesMatchingFilters,
  setFocusMed,
  setVenFilter,
  setMedicinesExpanded,
} from "../state";
import type { Medicine, Ven } from "../types";
import { renderAll } from "./index";

const PILL_LIMIT = 5;

export function renderVenFilter(): void {
  const opts: Array<["all" | Ven, string]> = [["all", "All"], ["V", "Vital"], ["E", "Essential"], ["N", "Non-essential"]];
  $("venFilter").innerHTML = opts
    .map(([id, label]) => `<button class="ven-btn ${venFilter === id ? "active" : ""}" data-ven="${id}">${label}</button>`)
    .join("");
  $("venFilter").querySelectorAll<HTMLButtonElement>(".ven-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setVenFilter(btn.dataset.ven as "all" | Ven);
      const visible = medicinesMatchingFilters();
      if (!visible.some((m) => m.id === focusMed) && visible.length) setFocusMed(visible[0].id);
      renderAll();
    });
  });
}

function pillHtml(m: Medicine): string {
  const active = m.id === focusMed ? "active" : "";
  return `<button class="pill ${active}" data-med="${m.id}"><span class="ven-badge ven-${m.ven}">${m.ven}</span>${m.name}${m.cold ? '<span class="tag">Cold chain</span>' : ""}</button>`;
}

export function renderPills(): void {
  const visible = medicinesMatchingFilters();
  if (!visible.length) {
    $("pillRow").innerHTML = `<div class="empty-state">No medicines match "${medSearch}".</div>`;
    return;
  }

  let shown = medicinesExpanded ? visible : visible.slice(0, PILL_LIMIT);
  // keep the currently focused medicine visible even collapsed, so picking one
  // from search/filter never makes its own pill disappear
  if (!medicinesExpanded && !shown.some((m) => m.id === focusMed)) {
    const active = visible.find((m) => m.id === focusMed);
    if (active) shown = [...shown, active];
  }
  const hiddenCount = visible.length - shown.length;

  $("pillRow").innerHTML =
    shown.map(pillHtml).join("") +
    (!medicinesExpanded && hiddenCount > 0 ? `<button class="pill pill-more" id="pillMoreBtn">+${hiddenCount} more</button>` : "") +
    (medicinesExpanded && visible.length > PILL_LIMIT ? `<button class="pill pill-more" id="pillLessBtn">Show less</button>` : "");

  $("pillRow").querySelectorAll<HTMLButtonElement>(".pill:not(.pill-more)").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFocusMed(btn.dataset.med!);
      renderAll();
    });
  });
  document.getElementById("pillMoreBtn")?.addEventListener("click", () => {
    setMedicinesExpanded(true);
    renderPills();
  });
  document.getElementById("pillLessBtn")?.addEventListener("click", () => {
    setMedicinesExpanded(false);
    renderPills();
  });
}
