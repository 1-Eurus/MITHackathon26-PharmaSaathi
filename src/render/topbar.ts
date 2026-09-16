import { $ } from "../dom";
import { eachCarriedPair, facilityCarries, FACILITIES, MEDICINES, DAYS, dateForDay, fmtDateFull } from "../data";
import { stateOf } from "../simulate";
import { scrubDay } from "../state";
import type { Signal } from "../types";

const ICON = {
  layers: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 16 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
  octagon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2Z"/><path d="M12 8v5"/><circle cx="12" cy="16" r=".6" fill="currentColor" stroke="none"/></svg>',
  triangle: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10.3 3.9 1.9 18a1.6 1.6 0 0 0 1.4 2.4h17.4a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.3" r=".6" fill="currentColor" stroke="none"/></svg>',
  waves: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3"/><path d="M2 18c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3"/><circle cx="12" cy="7" r="1.4" fill="currentColor" stroke="none"/></svg>',
  gauge: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15 16 9"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/></svg>',
};

export function renderStats(signals: Signal[]): void {
  let critical = 0, warning = 0;
  eachCarriedPair((f, m) => {
    const st = stateOf(f.id, m.id, scrubDay).status;
    if (st === "critical") critical++;
    else if (st === "warning") warning++;
  });
  const peakScore = signals.length ? signals[0].score : 0;
  $("statStrip").innerHTML = `
    <div class="stat"><p class="stat-label">${ICON.layers} Medicine</p><p class="stat-value num">${MEDICINES.length}</p><p class="stat-sub">medicines tracked</p></div>
    <div class="stat" data-tone="${critical > 0 ? "critical" : "good"}"><p class="stat-label">${ICON.octagon} Critical stockouts</p><p class="stat-value num ${critical > 0 ? "critical" : "good"}">${critical}</p><p class="stat-sub">days of supply &le; 4</p></div>
    <div class="stat" data-tone="${warning > 0 ? "warning" : "good"}"><p class="stat-label">${ICON.triangle} Warning-level</p><p class="stat-value num ${warning > 0 ? "warning" : "good"}">${warning}</p><p class="stat-sub">days of supply &le; 10</p></div>
    <div class="stat" data-tone="${signals.length > 0 ? "critical" : "good"}"><p class="stat-label">${ICON.waves} Regional signals</p><p class="stat-value num ${signals.length > 0 ? "critical" : "good"}">${signals.length}</p><p class="stat-sub">correlated hub declines</p></div>
    <div class="stat" data-tone="${peakScore >= 55 ? "critical" : peakScore > 0 ? "warning" : "good"}"><p class="stat-label">${ICON.gauge} Peak cascade risk</p><p class="stat-value num ${peakScore >= 55 ? "critical" : peakScore > 0 ? "warning" : "good"}">${peakScore}</p><p class="stat-sub">${signals.length ? signals[0].hub.name : "no hub currently exposed"}</p></div>
  `;
}

export function renderAlert(signals: Signal[]): void {
  const el = $("alertBanner");
  if (!signals.length) {
    el.classList.remove("show");
    return;
  }
  const top = signals[0];
  el.classList.add("show");
  el.classList.toggle("serious", top.score < 55);
  $("alertTitle").textContent = `${top.hub.name} is showing a correlated decline in ${top.med.name}`;
  const names = top.affected.map((a) => a.f.name).join(", ");
  const stockingCount = FACILITIES.filter((f) => f.hub === top.hub.id && facilityCarries(f, top.med)).length;
  $("alertText").innerHTML = `<b>${top.affected.length} of ${stockingCount}</b> facilities served by ${top.hub.name} that stock ${top.med.name} are declining together, with replenishment lagging ~${top.avgDelay.toFixed(1)} days on average &mdash; more consistent with an upstream supply disruption than isolated local demand. <b>${names}.</b>`;
}

export function renderScrubber(): void {
  const pct = ((scrubDay / DAYS) * 100).toFixed(1);
  const range = $<HTMLInputElement>("scrubRange");
  range.style.setProperty("--pct", pct + "%");
  range.value = String(scrubDay);
  $("scrubDateLbl").textContent = fmtDateFull(dateForDay(scrubDay));
  $("scrubDayLbl").textContent = `Day ${scrubDay} of ${DAYS}`;
}
