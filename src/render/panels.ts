import { $ } from "../dom";
import { FACILITIES, HUBS, MEDICINES, SUPPLIERS, SEASONAL, facilityCarries } from "../data";
import { computeExpiryWatch } from "../simulate";
import { selectedFacility } from "../state";
import { capHeightToMatch } from "./layoutSync";
import type { Signal, RedistributionRow, DemandSignal } from "../types";

export function renderSignals(signals: Signal[]): void {
  if (!signals.length) {
    $("signalsBody").innerHTML = `<div class="empty-state">No correlated declines detected as of this date &mdash; facilities are drawing down independently.</div>`;
    return;
  }
  $("signalsBody").innerHTML = signals
    .map((sig) => {
      const scoreClass = sig.score >= 55 ? "" : "serious";
      const stockingCount = FACILITIES.filter((f) => f.hub === sig.hub.id && facilityCarries(f, sig.med)).length;
      return `<div class="sig-card">
      <div class="sig-top"><p class="sig-title">${sig.med.name} &middot; ${sig.hub.district}</p><p class="sig-score ${scoreClass}">${sig.score}</p></div>
      <p class="sig-text"><b>${sig.affected.length} of ${stockingCount}</b> facilities served by ${sig.hub.name} that stock ${sig.med.name} are showing correlated declines, with replenishment lagging ~${sig.avgDelay.toFixed(1)} days on average. <span style="color:var(--ink-muted)">(${sig.confidence})</span></p>
      <div class="taglist">${sig.affected.map((a) => `<span class="tag2">${a.f.name}</span>`).join("")}</div>
    </div>`;
    })
    .join("");
}

export function renderDemandSignals(signals: DemandSignal[], proactiveRows: RedistributionRow[]): void {
  if (!signals.length) {
    $("demandSignalsBody").innerHTML = `<div class="empty-state">No demand spikes detected as of this date &mdash; consumption is tracking normally across every hub.</div>`;
    return;
  }
  $("demandSignalsBody").innerHTML = signals
    .map((sig) => {
      const scoreClass = sig.score >= 55 ? "" : "serious";
      const stockingCount = FACILITIES.filter((f) => f.hub === sig.hub.id && facilityCarries(f, sig.med)).length;
      const suggestions = sig.affected
        .map((a) => {
          const row = proactiveRows.find((r) => r._targetId === a.f.id && r._med === sig.med.id);
          if (!row) return "";
          return `<p class="sig-suggest"><b>Suggested:</b> move ${row.units} ${row.unit} of ${row.med} from <b>${row.from}</b> to <b>${row.to}</b> (${row.dist}km${row.coldReq ? row.coldOk ? ", cold-chain OK" : ", cold-chain gap" : ""}) &mdash; buys time before ${a.f.name.split(",")[0]}'s ${sig.med.name} line actually runs short.</p>`;
        })
        .filter(Boolean)
        .join("");
      return `<div class="sig-card">
      <div class="sig-top"><p class="sig-title">${sig.med.name} &middot; ${sig.hub.district}</p><p class="sig-score ${scoreClass}">${sig.score}</p></div>
      <p class="sig-text"><b>${sig.affected.length} of ${stockingCount}</b> facilities served by ${sig.hub.name} that stock ${sig.med.name} are using it <b>~${sig.avgPctAboveNormal.toFixed(0)}% above normal</b> over the last 7 days, while replenishment is still arriving on schedule &mdash; stock hasn't dropped into a shortage yet, but consumption is outpacing the plan.</p>
      <div class="taglist">${sig.affected.map((a) => `<span class="tag2">${a.f.name} &middot; ${a.now.daysOfSupply.toFixed(1)}d supply</span>`).join("")}</div>
      ${suggestions}
    </div>`;
    })
    .join("");
}

export function renderRedistribution(rows: RedistributionRow[]): void {
  if (!rows.length) {
    $("redisBody").innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--ink-muted); padding:20px;">No at-risk facilities need redistribution right now.</td></tr>`;
    return;
  }
  const iCheck = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const iCross = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  $("redisBody").innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${r.med}</td>
      <td>${r.from}</td>
      <td>${r.to}</td>
      <td class="num">${r.units} ${r.unit}</td>
      <td class="num">${r.dist} km</td>
      <td>${r.coldReq ? (r.coldOk ? `<span class="cc-yes">${iCheck} capable</span>` : `<span class="cc-no">${iCross} gap</span>`) : `<span style="color:var(--ink-muted)">n/a</span>`}</td>
      <td class="num">${r.expiry}d</td>
      <td><span class="chip ${r.urgency}">${r.urgency}</span></td>
    </tr>
  `
    )
    .join("");
}

export function renderSeasonal(): void {
  $("seasonalStrip").innerHTML = SEASONAL.map((s) => {
    const med = MEDICINES.find((m) => m.id === s.med)!;
    const up = s.changePct >= 0;
    const arrow = up ? "&#8593;" : "&#8595;";
    return `<div class="season-card">
      <div class="season-top">
        <span class="season-name"><span class="ven-badge ven-${med.ven}" style="margin-right:5px;">${med.ven}</span>${med.name}</span>
      </div>
      <div class="season-change ${up ? "up" : "down"}">${arrow} ${Math.abs(s.changePct)}%</div>
      <p class="season-driver">${s.driver}</p>
    </div>`;
  }).join("");
}

export function renderExpiry(day: number): void {
  const rows = computeExpiryWatch(day);
  if (!rows.length) {
    $("expiryBody").innerHTML = `<div class="empty-state">No batches expiring in the next 30 days.</div>`;
    return;
  }
  $("expiryBody").innerHTML = rows
    .map((r) => {
      const hub = HUBS.find((h) => h.id === r.f.hub)!;
      const soon = r.remaining <= 10;
      return `<div class="list-row">
      <span class="hubdot" style="background:${hub.color}"></span>
      <div class="lr-main">
        <p class="lr-title">${r.med.name} <span class="ven-badge ven-${r.med.ven}" style="margin-left:4px;">${r.med.ven}</span></p>
        <p class="lr-sub">${r.f.name} &middot; ${hub.district} &middot; ${Math.round(r.stock)} ${r.med.unit} on the shelf</p>
      </div>
      <div class="lr-metric">
        <div class="m-val" style="color:${soon ? "var(--critical)" : "var(--warning)"}">${Math.max(0, Math.round(r.remaining))}d</div>
        <div class="m-lbl">to expiry</div>
      </div>
    </div>`;
    })
    .join("");
}

/** the Expiry watch list shouldn't run on far past the Facility & supplier
 *  trust table beside it - see capHeightToMatch for how/why. */
export function syncExpiryHeight(): void {
  capHeightToMatch(document.getElementById("expiryBody"), document.getElementById("trustPanel"));
}

export function renderTrust(): void {
  const rows = [...FACILITIES].sort((a, b) => a.trust.score - b.trust.score).slice(0, 9);
  $("trustBody").innerHTML = rows
    .map((f) => {
      const hub = HUBS.find((h) => h.id === f.hub)!;
      const tierClass = f.trust.tier === "High trust" ? "high" : f.trust.tier === "Monitor" ? "mon" : "low";
      const barColor = f.trust.score >= 85 ? "var(--good)" : f.trust.score >= 68 ? "var(--warning)" : "var(--critical)";
      return `<tr>
      <td>${f.name}</td>
      <td>${hub.district}</td>
      <td class="num">${f.trust.reportingRate}%</td>
      <td><span class="trust-bar"><span style="width:${f.trust.score}%; background:${barColor};"></span></span><span class="num">${f.trust.score}</span></td>
      <td><span class="trust-tier ${tierClass}">${f.trust.tier}</span></td>
    </tr>`;
    })
    .join("");
}

export function renderSuppliers(): void {
  const f = FACILITIES.find((x) => x.id === selectedFacility)!;
  const hub = HUBS.find((h) => h.id === f.hub)!;
  $("suppliersNote").textContent = `External sources for ${hub.name} (${f.name}'s hub), for when internal redistribution can't cover the gap`;
  const rows = [...SUPPLIERS].sort((a, b) => Number(a.hub === hub.id ? -1 : 0) - Number(b.hub === hub.id ? -1 : 0));
  $("suppliersBody").innerHTML = rows
    .map((s) => {
      const near = s.hub === hub.id;
      return `<tr style="${near ? "background:var(--accent-soft)" : ""}">
      <td>${s.name}${near ? ' <span class="tag2" style="margin-left:4px;">nearest</span>' : ""}</td>
      <td>${s.type}</td>
      <td class="num">${s.leadTimeDays}d</td>
      <td class="num">${s.reliability}%</td>
      <td style="color:var(--ink-muted); font-size:11.5px;">${s.note}</td>
    </tr>`;
    })
    .join("");
}
