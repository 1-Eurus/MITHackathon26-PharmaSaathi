import { rand, rng } from "./rng";
import {
  FACILITIES,
  MEDICINES,
  TYPE,
  HUBS,
  DAYS,
  TODAY,
  DISRUPTION,
  DEMAND_SPIKE,
  VEN_BUFFER_DAYS,
  facilityCarries,
  eachCarriedPair,
} from "./data";
import type {
  SeriesEntry,
  FacilityState,
  Signal,
  RedistributionRow,
  ExpiryRow,
  Facility,
  Medicine,
  TrustInfo,
  InvoiceReceiptLog,
  DemandSignal,
  DemandSpikeAffected,
} from "./types";

/** great-circle distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** key `${facId}|${medId}` -> simulated 90-day series, one entry per stocked pair */
export const SERIES: Record<string, SeriesEntry> = {};

/* ============================================================
   SIMULATE 90-DAY SERIES for every medicine actually stocked at each facility
   (not every facility x medicine combination - see minTier in data.ts)
   ============================================================ */
export function buildSeries(): void {
  FACILITIES.forEach((fac) => {
    const t = TYPE[fac.type];
    MEDICINES.forEach((med) => {
      if (!facilityCarries(fac, med)) return;
      const key = fac.id + "|" + med.id;
      const dailyUseBase = (med.base * t.mult) / 4.5;
      const capacity = dailyUseBase * med.cycle * t.buffer;
      const baseDelay = rand(0.6, 2.2);
      // Facilities reorder against a PLANNED buffer sized for normal lead time plus
      // a VEN-weighted safety margin - not against whatever the delay turns out to
      // be. That's what makes a disruption (delay growing well past plan) actually
      // bite into stock, and why a Vital line gets a bigger cushion than a Non-
      // essential one.
      const plannedBufferDays = baseDelay + VEN_BUFFER_DAYS[med.ven];
      const reorderPoint = dailyUseBase * plannedBufferDays;
      let stock = capacity * rand(0.75, 0.98);
      let pending: { arriveDay: number; qty: number } | null = null;
      const stockArr: number[] = new Array(DAYS + 1);
      const delayArr: number[] = new Array(DAYS + 1);
      const useArr: number[] = new Array(DAYS + 1);
      const replenishDays: number[] = [];
      const isDisrupted = fac.hub === DISRUPTION.hub && med.id === DISRUPTION.medicine;
      const isDemandSpiking = fac.hub === DEMAND_SPIKE.hub && med.id === DEMAND_SPIKE.medicine;

      for (let d = 0; d <= DAYS; d++) {
        const noise = rand(-0.1, 0.1);
        let demandMult = 1;
        if (isDemandSpiking && d >= DEMAND_SPIKE.startDay) {
          const ramp = Math.min(1, (d - DEMAND_SPIKE.startDay) / DEMAND_SPIKE.rampDays);
          demandMult = 1 + ramp * DEMAND_SPIKE.maxUsageMultiplier;
        }
        const use = Math.max(0.15, dailyUseBase * demandMult * (1 + noise));
        useArr[d] = use;

        if (d > 0) stock = Math.max(0, stock - useArr[d - 1]);

        // actual delivery lead time for an order placed on/after this day -
        // this is what actually stretches out during the disruption
        let delayNow = baseDelay;
        if (isDisrupted && d >= DISRUPTION.startDay) {
          const ramp = Math.min(1, (d - DISRUPTION.startDay) / DISRUPTION.rampDays);
          delayNow = baseDelay + ramp * DISRUPTION.maxExtraDelay;
        }
        delayArr[d] = delayNow;

        if (!pending && stock <= reorderPoint) {
          pending = { arriveDay: d + Math.round(delayNow), qty: capacity - stock };
        }
        if (pending && d >= pending.arriveDay) {
          stock += Math.max(pending.qty, dailyUseBase * 2);
          replenishDays.push(d);
          pending = null;
        }
        stockArr[d] = stock;
      }
      // one near-term batch expiry is seeded in for a minority of pairs so the
      // 30-day expiry watch has something real to show; the rest sit comfortably
      // out past that window
      const expiryAtToday = rng() < 0.16 ? Math.round(rand(2, 28)) : Math.round(rand(35, 280));
      // a stable "normal" days-of-supply baseline (days 8-30, before any scripted
      // disruption reaches this pair) - signals compare against this fixed point
      // rather than a rolling window, so a signal stays lit for as long as the
      // disruption does instead of only during the transient decline
      let normalSum = 0;
      for (let d = 8; d <= 30; d++) normalSum += stockArr[d] / useArr[d];
      const normalDOS = normalSum / 23;
      SERIES[key] = {
        stockArr, delayArr, useArr, replenishDays, capacity, dailyUseBase, baseDelay,
        reorderRef: reorderPoint, coldChain: med.cold, expiryAtToday, normalDOS,
      };
    });
  });
}

function avgDelayFor(f: Facility): number {
  const delays = MEDICINES.filter((m) => facilityCarries(f, m)).map((m) => SERIES[f.id + "|" + m.id].baseDelay);
  return delays.reduce((a, b) => a + b, 0) / delays.length;
}

/** pure trust-score formula, factored out so a confirmed invoice receipt can
 *  re-run it for just the one affected facility (see applyInvoiceReceipt)
 *  without re-rolling every other facility's reportingRate the way calling
 *  buildTrust() again would */
function computeTrust(avgDelay: number, reportingRate: number): TrustInfo {
  const score = Math.round(Math.min(99, Math.max(42, 100 - avgDelay * 7 - (100 - reportingRate) * 0.45)));
  const tier = score >= 85 ? "High trust" : score >= 68 ? "Monitor" : "Needs review";
  return { score, reportingRate, tier };
}

/* facility trust / reliability index - blends how long its lead times normally
   run against a simulated reporting-consistency figure, both fixed at load time */
export function buildTrust(): void {
  FACILITIES.forEach((f) => {
    const reportingRate = Math.round(rand(79, 99));
    f.trust = computeTrust(avgDelayFor(f), reportingRate);
  });
}

export function expiryRemaining(facId: string, medId: string, day: number): number {
  const s = SERIES[facId + "|" + medId];
  return s.expiryAtToday + (DAYS - day);
}

export function computeExpiryWatch(day: number): ExpiryRow[] {
  const rows: ExpiryRow[] = [];
  eachCarriedPair((f, m) => {
    const remaining = expiryRemaining(f.id, m.id, day);
    if (remaining <= 30 && remaining >= -3) {
      const s = stateOf(f.id, m.id, day);
      if (s.stock > 0.5) rows.push({ f, med: m, remaining, stock: s.stock });
    }
  });
  return rows.sort((a, b) => a.remaining - b.remaining).slice(0, 8);
}

export function stateOf(facId: string, medId: string, day: number): FacilityState {
  const s = SERIES[facId + "|" + medId];
  const stock = s.stockArr[day];
  const use = s.useArr[day] || s.dailyUseBase;
  const daysOfSupply = stock / use;
  const delay = s.delayArr[day];
  let status: FacilityState["status"] = "good";
  if (daysOfSupply <= 4) status = "critical";
  else if (daysOfSupply <= 10) status = "warning";
  else if (daysOfSupply <= 15) status = "watch";
  return { stock, use, daysOfSupply, delay, status, capacity: s.capacity };
}

/* ============================================================
   DERIVED STATE for a given scrub day
   ============================================================ */
export function computeSignals(day: number): Signal[] {
  const signals: Signal[] = [];
  HUBS.forEach((hub) => {
    const members = FACILITIES.filter((f) => f.hub === hub.id);
    if (members.length < 2) return;
    MEDICINES.forEach((med) => {
      const carriers = members.filter((f) => facilityCarries(f, med));
      if (carriers.length < 2) return; // needs at least 2 facilities stocking it to call a pattern "correlated"
      const affected: Signal["affected"] = [];
      carriers.forEach((f) => {
        const now = stateOf(f.id, med.id, day);
        const normalDOS = SERIES[f.id + "|" + med.id].normalDOS;
        const decline = normalDOS - now.daysOfSupply;
        if (decline > 3 && now.delay >= 3.2) affected.push({ f, now, decline });
      });
      if (affected.length >= 2) {
        const avgDelay = affected.reduce((a, x) => a + x.now.delay, 0) / affected.length;
        const frac = affected.length / carriers.length;
        const severity = Math.min(1, avgDelay / 11);
        const score = Math.round(100 * frac * (0.4 + 0.6 * severity));
        const confidence = score >= 55 ? "High confidence" : "Medium confidence";
        signals.push({ hub, med, affected, score, confidence, avgDelay });
      }
    });
  });
  return signals.sort((a, b) => b.score - a.score);
}

export function computeRedistribution(day: number, _signals: Signal[]): RedistributionRow[] {
  const rows: RedistributionRow[] = [];
  MEDICINES.forEach((med) => {
    const states = FACILITIES.filter((f) => facilityCarries(f, med)).map((f) => ({ f, s: stateOf(f.id, med.id, day) }));
    const atRisk = states.filter((x) => x.s.status === "warning" || x.s.status === "critical").sort((a, b) => a.s.daysOfSupply - b.s.daysOfSupply);
    const surplus = states.filter((x) => x.s.daysOfSupply > 16).sort((a, b) => b.s.daysOfSupply - a.s.daysOfSupply);
    atRisk.forEach((target) => {
      const donor = surplus.find((x) => x.f.id !== target.f.id && !rows.some((r) => r._donorId === x.f.id && r._med === med.id && r._used));
      if (!donor) return;
      const dist = Math.round(haversineKm(donor.f.lat, donor.f.lng, target.f.lat, target.f.lng));
      const donorCap = TYPE[donor.f.type].cold, targetCap = TYPE[target.f.type].cold;
      const coldOk = !med.cold || (donorCap !== "none" && targetCap !== "none");
      const units = Math.max(2, Math.round((donor.s.stock - donor.s.use * 16) * 0.4));
      const expiry = Math.max(1, Math.round(expiryRemaining(donor.f.id, med.id, day)));
      rows.push({
        med: med.name, from: donor.f.name, to: target.f.name, units, unit: med.unit,
        dist, coldOk, coldReq: med.cold, expiry, urgency: target.s.status,
        _donorId: donor.f.id, _targetId: target.f.id, _med: med.id, _used: true,
      });
    });
  });
  rows.sort((a, b) => Number(b.urgency === "critical") - Number(a.urgency === "critical") || a.dist - b.dist);
  return rows.slice(0, 8);
}

/* ============================================================
   DEMAND SPIKE EARLY WARNING - a leading indicator, distinct from
   computeSignals() above. That function catches a supply-side decline
   already under way (replenishment lagging, stock visibly dropping).
   This one watches consumption itself: when a hub's recent daily use for
   a medicine is running well above that pair's own normal baseline
   across multiple facilities, it's flagged while stock is *still healthy*
   - the point is to catch it before it becomes the kind of decline
   computeSignals() would detect.
   ============================================================ */

const DEMAND_SPIKE_WINDOW_DAYS = 7;
const DEMAND_SPIKE_THRESHOLD_PCT = 25; // trailing-week use this far above normal counts as "spiking"

function avgUseOverWindow(s: SeriesEntry, day: number, windowDays: number): number {
  let sum = 0, n = 0;
  for (let d = Math.max(0, day - windowDays + 1); d <= day; d++) {
    sum += s.useArr[d];
    n++;
  }
  return sum / n;
}

export function computeDemandSignals(day: number): DemandSignal[] {
  const signals: DemandSignal[] = [];
  HUBS.forEach((hub) => {
    const members = FACILITIES.filter((f) => f.hub === hub.id);
    if (members.length < 2) return;
    MEDICINES.forEach((med) => {
      const carriers = members.filter((f) => facilityCarries(f, med));
      if (carriers.length < 2) return;
      const affected: DemandSpikeAffected[] = [];
      carriers.forEach((f) => {
        const s = SERIES[f.id + "|" + med.id];
        const recentAvgUse = avgUseOverWindow(s, day, DEMAND_SPIKE_WINDOW_DAYS);
        const pctAboveNormal = ((recentAvgUse - s.dailyUseBase) / s.dailyUseBase) * 100;
        if (pctAboveNormal < DEMAND_SPIKE_THRESHOLD_PCT) return;
        const now = stateOf(f.id, med.id, day);
        // the whole point is to flag this ahead of a real shortage - once a
        // facility has actually dropped into warning/critical, that's now
        // computeSignals()'s story to tell, not this one's
        if (now.status === "good" || now.status === "watch") affected.push({ f, now, pctAboveNormal });
      });
      if (affected.length >= 2) {
        const avgPctAboveNormal = affected.reduce((a, x) => a + x.pctAboveNormal, 0) / affected.length;
        const score = Math.round(Math.min(100, avgPctAboveNormal * 1.1));
        signals.push({ hub, med, affected, avgPctAboveNormal, score });
      }
    });
  });
  return signals.sort((a, b) => b.score - a.score);
}

/** proactive redistribution for facilities flagged by computeDemandSignals -
 *  same donor-matching shape as computeRedistribution above (surplus facility,
 *  cold-chain check, distance), just sourced from rising demand instead of an
 *  already-low stock status, and tagged "watch" since these facilities aren't
 *  at-risk yet. */
export function computeProactiveRedistribution(day: number, demandSignals: DemandSignal[]): RedistributionRow[] {
  const rows: RedistributionRow[] = [];
  const targets: { med: Medicine; f: Facility; s: FacilityState }[] = demandSignals.flatMap((sig) =>
    sig.affected.map((a) => ({ med: sig.med, f: a.f, s: a.now }))
  );
  targets.forEach((target) => {
    const states = FACILITIES.filter((f) => facilityCarries(f, target.med)).map((f) => ({ f, s: stateOf(f.id, target.med.id, day) }));
    const surplus = states
      .filter((x) => x.f.id !== target.f.id && x.s.daysOfSupply > 16)
      .sort((a, b) => b.s.daysOfSupply - a.s.daysOfSupply);
    const donor = surplus.find((x) => !rows.some((r) => r._donorId === x.f.id && r._med === target.med.id && r._used));
    if (!donor) return;
    const dist = Math.round(haversineKm(donor.f.lat, donor.f.lng, target.f.lat, target.f.lng));
    const donorCap = TYPE[donor.f.type].cold, targetCap = TYPE[target.f.type].cold;
    const coldOk = !target.med.cold || (donorCap !== "none" && targetCap !== "none");
    const units = Math.max(2, Math.round((donor.s.stock - donor.s.use * 16) * 0.3));
    const expiry = Math.max(1, Math.round(expiryRemaining(donor.f.id, target.med.id, day)));
    rows.push({
      med: target.med.name, from: donor.f.name, to: target.f.name, units, unit: target.med.unit,
      dist, coldOk, coldReq: target.med.cold, expiry, urgency: "watch",
      _donorId: donor.f.id, _targetId: target.f.id, _med: target.med.id, _used: true,
    });
  });
  rows.sort((a, b) => a.dist - b.dist);
  return rows.slice(0, 6);
}

/* ============================================================
   INVOICE INTAKE - see src/invoice.ts for the extraction/review UI.
   A confirmed invoice line is written into the same SERIES/trust state
   every other panel already reads, so signals, redistribution and the
   expiry watch pick it up on the next renderAll() with no changes of
   their own. Not wired into the seasonal-demand panel: that panel is
   hardcoded editorial copy today, not a real aggregation, so there is
   nothing live to feed.
   ============================================================ */

/** audit trail of confirmed invoice receipts. Not read by any scoring or
 *  forecasting logic - kept only so a delivery can be traced back later. */
export const RECEIPTS: InvoiceReceiptLog[] = [];

export interface ApplyReceiptInput {
  facilityId: string;
  medicineId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string | null; // "YYYY-MM-DD"
  receivedAt: string; // ISO datetime
}

export type ApplyReceiptResult = { ok: true } | { ok: false; reason: string };

export function applyInvoiceReceipt(rec: ApplyReceiptInput): ApplyReceiptResult {
  const key = rec.facilityId + "|" + rec.medicineId;
  const s = SERIES[key];
  if (!s) {
    const fac = FACILITIES.find((f) => f.id === rec.facilityId);
    const med = MEDICINES.find((m) => m.id === rec.medicineId);
    return { ok: false, reason: `${fac?.name ?? rec.facilityId} does not stock ${med?.name ?? rec.medicineId} at its formulary tier.` };
  }

  // the simulated 90-day history (days 0-89) is fixed; only "today" (day
  // DAYS) is live operator input, so a confirmed delivery lands there
  // regardless of whatever receipt date/time the invoice itself states
  s.stockArr[DAYS] += rec.quantity;

  if (rec.expiryDate) {
    const remaining = Math.round((new Date(rec.expiryDate).getTime() - TODAY.getTime()) / 86400000);
    // soonest-expiring known batch wins - matches what computeExpiryWatch already assumes
    s.expiryAtToday = Math.min(s.expiryAtToday, remaining);
  }

  const fac = FACILITIES.find((f) => f.id === rec.facilityId)!;
  const bumpedReportingRate = Math.min(99, fac.trust.reportingRate + 2);
  fac.trust = computeTrust(avgDelayFor(fac), bumpedReportingRate);

  RECEIPTS.push({ ...rec, loggedAt: new Date().toISOString() });
  return { ok: true };
}
