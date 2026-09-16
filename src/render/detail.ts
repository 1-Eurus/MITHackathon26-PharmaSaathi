import { $ } from "../dom";
import { FACILITIES, HUBS, MEDICINES, TYPE, facilityCarries, dateForDay, fmtDate, fmtDateFull } from "../data";
import { SERIES, stateOf } from "../simulate";
import { focusMed, scrubDay, selectedFacility } from "../state";
import type { Facility, Medicine } from "../types";

export function renderDetail(): void {
  const f = FACILITIES.find((x) => x.id === selectedFacility)!;
  const hub = HUBS.find((h) => h.id === f.hub)!;
  const med = MEDICINES.find((m) => m.id === focusMed)!;
  const t = TYPE[f.type];
  $("detSub").textContent = `${hub.district} · ${f.type} · ${hub.name}`;

  if (!facilityCarries(f, med)) {
    $("detName").innerHTML = `${f.name} <span class="chip" style="margin-left:6px; background:var(--surface-2); color:var(--ink-muted); border:1px solid var(--line);">not stocked</span>`;
    $("detKv").innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${f.type} facilities don't stock ${med.name} &mdash; it's carried from ${TYPE[f.type].tier < 3 ? "CHC level and above" : "the district hospital / medical college tier"} in this hub. Pick a larger facility, or a different medicine, to see live figures.</div>`;
    $("chartWrap").style.display = "none";
    return;
  }
  $("chartWrap").style.display = "";
  const s = stateOf(f.id, focusMed, scrubDay);
  $("detName").innerHTML = `${f.name} <span class="chip ${s.status}" style="margin-left:6px;">${s.status}</span>`;

  const snowIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11"/></svg>';
  const coldNote = med.cold
    ? t.cold === "none"
      ? `<div class="coldflag" style="color:var(--critical)">${snowIcon} No cold-chain storage on site</div>`
      : t.cold === "limited"
      ? `<div class="coldflag">${snowIcon} Limited cold-chain (ILR) capacity</div>`
      : `<div class="coldflag">${snowIcon} Full cold-chain capacity</div>`
    : "";

  $("detKv").innerHTML = `
    <div><p class="kv-label">Current stock</p><p class="kv-value num">${Math.round(s.stock)} ${med.unit}</p></div>
    <div><p class="kv-label">Days of supply</p><p class="kv-value num">${s.daysOfSupply.toFixed(1)}d</p></div>
    <div><p class="kv-label">Avg. daily use</p><p class="kv-value small num">${s.use.toFixed(1)} ${med.unit}/day</p></div>
    <div><p class="kv-label">Replenishment</p><p class="kv-value small num">${s.delay < 3 ? "On schedule" : "+" + s.delay.toFixed(1) + "d delay"}</p>${coldNote}</div>
  `;

  renderChart(f, med);
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function renderChart(f: Facility, med: Medicine): void {
  const s = SERIES[f.id + "|" + med.id];
  const W = 560, H = 190, padL = 6, padR = 6, padT = 10, padB = 22;
  const windowStart = Math.max(0, scrubDay - 45);
  const days: number[] = [];
  for (let d = windowStart; d <= scrubDay; d++) days.push(d);
  const maxStock = Math.max(s.capacity * 1.05, ...days.map((d) => s.stockArr[d]));
  const x = (d: number) => padL + (W - padL - padR) * ((d - windowStart) / Math.max(1, scrubDay - windowStart));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / maxStock);

  const pts: [number, number][] = days.map((d) => [x(d), y(s.stockArr[d])]);
  const path = smoothPath(pts);
  const area = path + ` L ${x(scrubDay).toFixed(1)} ${y(0).toFixed(1)} L ${x(windowStart).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const reorderY = y(s.reorderRef).toFixed(1);
  const replDots = s.replenishDays
    .filter((d) => d >= windowStart && d <= scrubDay)
    .map((d) => `<circle cx="${x(d).toFixed(1)}" cy="${y(s.stockArr[d]).toFixed(1)}" r="3.4" fill="var(--good)" stroke="var(--surface)" stroke-width="1"/>`)
    .join("");

  // gridlines (weekly)
  let grid = "";
  for (let d = windowStart; d <= scrubDay; d += 7) {
    grid += `<line x1="${x(d).toFixed(1)}" y1="${padT}" x2="${x(d).toFixed(1)}" y2="${H - padB}" stroke="var(--line)" stroke-width="1"/>`;
    grid += `<text x="${x(d).toFixed(1)}" y="${H - 6}" font-size="9" fill="var(--ink-muted)" text-anchor="middle">${fmtDate(dateForDay(d))}</text>`;
  }

  const endX = x(scrubDay).toFixed(1), endY = y(s.stockArr[scrubDay]).toFixed(1);
  $("chartSvg").innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
      </linearGradient>
      <filter id="lineGlow" x="-20%" y="-40%" width="140%" height="180%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="var(--accent)" flood-opacity="0.35"/>
      </filter>
    </defs>
    ${grid}
    <line x1="${padL}" y1="${reorderY}" x2="${W - padR}" y2="${reorderY}" stroke="var(--ink-muted)" stroke-width="1.2" stroke-dasharray="3 3"/>
    <text x="${W - padR}" y="${Number(reorderY) - 4}" font-size="9" fill="var(--ink-muted)" text-anchor="end">Reorder point</text>
    <path d="${area}" fill="url(#areaFill)" stroke="none"/>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.1" stroke-linecap="round" filter="url(#lineGlow)"/>
    ${replDots}
    <circle cx="${endX}" cy="${endY}" r="7" fill="var(--accent)" opacity="0.16"/>
    <circle cx="${endX}" cy="${endY}" r="3.4" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.4"/>
    <line id="crosshair" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--ink-muted)" stroke-width="1" opacity="0"/>
    <rect id="chartHitArea" x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}" fill="transparent"/>
  `;

  const svgEl = $("chartSvg"), tip = $("chartTip");
  const hit = $<SVGRectElement>("chartHitArea"), crosshair = $<SVGLineElement>("crosshair");
  function onMove(evt: MouseEvent): void {
    const rect = svgEl.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const frac = (px - padL) / (W - padL - padR);
    const d = Math.round(windowStart + frac * (scrubDay - windowStart));
    if (d < windowStart || d > scrubDay) return;
    const cx = x(d);
    crosshair.setAttribute("x1", String(cx));
    crosshair.setAttribute("x2", String(cx));
    crosshair.setAttribute("opacity", "1");
    const val = s.stockArr[d];
    tip.style.opacity = "1";
    tip.style.left = (cx / W) * 100 + "%";
    tip.style.top = (y(val) / H) * 100 + "%";
    tip.innerHTML = `<b>${fmtDateFull(dateForDay(d))}</b><br>${Math.round(val)} ${med.unit} on hand`;
  }
  hit.addEventListener("mousemove", onMove);
  hit.addEventListener("mouseleave", () => {
    tip.style.opacity = "0";
    crosshair.setAttribute("opacity", "0");
  });
}
