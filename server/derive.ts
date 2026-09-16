// Derived-table logic, run once per confirmed invoice receipt. Each function
// is a small, explicit, documented rule - not a re-implementation of the
// frontend's live simulation (src/simulate.ts), which has richer inputs
// (a full 90-day stock series) this receipts-only database doesn't have.
// These are this database's OWN, simpler read on the same event.

import type { DatabaseSync } from "node:sqlite";

const DAY_MS = 86400000;
const isoDate = (d: Date): string => d.toISOString();
const yearMonthOf = (isoStr: string): string => isoStr.slice(0, 7);

/** the shape of a row read back from invoice_receipts (see schema.sql) */
export interface ReceiptRow {
  id: number;
  facility_id: string;
  medicine_id: string;
  quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  received_at: string;
  logged_at: string;
}

/** 3. Expiry watch: flag a receipt's batch if it expires within 90 real days. */
export function deriveExpiryWatch(db: DatabaseSync, receipt: ReceiptRow): void {
  if (!receipt.expiry_date) return;
  const daysRemaining = Math.round((new Date(receipt.expiry_date).getTime() - Date.now()) / DAY_MS);
  if (daysRemaining > 90) return;
  const bucket = daysRemaining <= 30 ? "30" : daysRemaining <= 60 ? "60" : "90";
  db.prepare(
    `INSERT INTO expiry_watch_alerts (receipt_id, facility_id, medicine_id, expiry_date, days_remaining, bucket, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(receipt.id, receipt.facility_id, receipt.medicine_id, receipt.expiry_date, daysRemaining, bucket, isoDate(new Date()));
}

/** 4. Facility & supplier trust: a logged delivery nudges a running score.
 *  Simple, monotonic model (starts at 80, +1 per logged delivery, capped at
 *  99) - a deliberately modest proxy for "this facility keeps reporting
 *  intake", independent of the frontend's own richer trust formula. */
export function deriveTrustEvent(db: DatabaseSync, receipt: ReceiptRow): void {
  const prev = db
    .prepare(`SELECT running_score FROM supplier_trust_events WHERE facility_id = ? ORDER BY id DESC LIMIT 1`)
    .get(receipt.facility_id) as { running_score: number } | undefined;
  const prevScore = prev ? prev.running_score : 80;
  const delta = 1;
  const runningScore = Math.min(99, prevScore + delta);
  db.prepare(
    `INSERT INTO supplier_trust_events (facility_id, receipt_id, delta, running_score, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(receipt.facility_id, receipt.id, delta, runningScore, isoDate(new Date()));
}

/** 5. Seasonal demand: aggregate received quantity per medicine per month,
 *  and flag when this month's volume swings >40% from the trailing 3-month
 *  average - a real (if simple) cross-reference against recent history,
 *  since this app has no other source of "historical seasonal consumption"
 *  for confirmed invoices to compare against. */
export function deriveSeasonalAgg(db: DatabaseSync, receipt: ReceiptRow): void {
  const yearMonth = yearMonthOf(receipt.received_at);
  const existing = db
    .prepare(`SELECT total_qty FROM seasonal_volume_agg WHERE medicine_id = ? AND year_month = ?`)
    .get(receipt.medicine_id, yearMonth) as { total_qty: number } | undefined;
  const totalQty = (existing?.total_qty ?? 0) + receipt.quantity;

  const priorRows = db
    .prepare(
      `SELECT total_qty FROM seasonal_volume_agg WHERE medicine_id = ? AND year_month < ? ORDER BY year_month DESC LIMIT 3`
    )
    .all(receipt.medicine_id, yearMonth) as { total_qty: number }[];
  const priorAvg = priorRows.length ? priorRows.reduce((a, r) => a + r.total_qty, 0) / priorRows.length : null;
  const pctChange = priorAvg ? ((totalQty - priorAvg) / priorAvg) * 100 : null;
  const imbalance = pctChange !== null && Math.abs(pctChange) > 40 ? 1 : 0;

  db.prepare(
    `INSERT INTO seasonal_volume_agg (medicine_id, year_month, total_qty, prior_avg_qty, pct_change, imbalance_flag, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(medicine_id, year_month) DO UPDATE SET
       total_qty = excluded.total_qty, prior_avg_qty = excluded.prior_avg_qty,
       pct_change = excluded.pct_change, imbalance_flag = excluded.imbalance_flag, updated_at = excluded.updated_at`
  ).run(receipt.medicine_id, yearMonth, totalQty, priorAvg, pctChange, imbalance, isoDate(new Date()));
}

/** 6. Emerging regional signals: compare the trailing-7-day received volume
 *  for a hub + VEN category against its trailing-30-day daily average. A
 *  ratio over 1.5x is logged as a spike - the receipt-volume analogue of
 *  the frontend's stock-decline signal (which this database can't compute,
 *  since it only sees intake, not live stock). */
export function deriveRegionalSignal(db: DatabaseSync, receipt: ReceiptRow): void {
  const facility = db.prepare(`SELECT hub_id FROM facilities WHERE id = ?`).get(receipt.facility_id) as
    | { hub_id: string }
    | undefined;
  const medicine = db.prepare(`SELECT ven FROM medicines WHERE id = ?`).get(receipt.medicine_id) as
    | { ven: string }
    | undefined;
  if (!facility || !medicine) return;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * DAY_MS);
  const baselineStart = new Date(now.getTime() - 30 * DAY_MS);

  const sumBetween = (since: Date, until: Date): number =>
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(r.quantity),0) AS total FROM invoice_receipts r
         JOIN facilities f ON f.id = r.facility_id
         JOIN medicines m ON m.id = r.medicine_id
         WHERE f.hub_id = ? AND m.ven = ? AND r.received_at >= ? AND r.received_at < ?`
        )
        .get(facility.hub_id, medicine.ven, isoDate(since), isoDate(until)) as { total: number }
    ).total;

  // non-overlapping windows: the last 7 days vs. the 23 days before that,
  // so a single receipt can't inflate its own baseline
  const totalQty = sumBetween(windowStart, now);
  const baselineTotal23d = sumBetween(baselineStart, windowStart);
  const baselineQty = (baselineTotal23d / 23) * 7; // that period's daily average, scaled to a 7-day window

  if (baselineQty <= 0 || totalQty <= 0) return; // not enough history to call anything a "spike" yet
  const spikeRatio = totalQty / baselineQty;
  if (spikeRatio <= 1.5) return;

  db.prepare(
    `INSERT INTO regional_signal_events (hub_id, ven, window_start, window_end, total_qty, baseline_qty, spike_ratio, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(facility.hub_id, medicine.ven, isoDate(windowStart), isoDate(now), totalQty, baselineQty, spikeRatio, isoDate(now));
}

/** 7. Redistribution opportunities: a short-expiry or unusually large batch
 *  at one facility, paired with whichever other facility has received the
 *  least of that medicine recently - a receipt-log proxy for "surplus
 *  meets shortage", since this database doesn't have live stock levels
 *  (that lives in the frontend's simulation) to match the frontend's own
 *  computeRedistribution() against. */
export function deriveRedistribution(db: DatabaseSync, receipt: ReceiptRow): void {
  const daysToExpiry = receipt.expiry_date
    ? Math.round((new Date(receipt.expiry_date).getTime() - Date.now()) / DAY_MS)
    : null;
  const isShortExpiry = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0;

  const avgRow = db.prepare(`SELECT AVG(quantity) AS avgQty FROM invoice_receipts WHERE medicine_id = ?`).get(receipt.medicine_id) as
    | { avgQty: number | null }
    | undefined;
  const isOverstock = !!avgRow?.avgQty && receipt.quantity > avgRow.avgQty * 3;

  if (!isShortExpiry && !isOverstock) return;

  const sixtyDaysAgo = isoDate(new Date(Date.now() - 60 * DAY_MS));
  const candidate = db
    .prepare(
      `SELECT f.id, COALESCE(SUM(r.quantity), 0) AS recent
       FROM facilities f
       LEFT JOIN invoice_receipts r ON r.facility_id = f.id AND r.medicine_id = ? AND r.received_at >= ?
       WHERE f.id != ?
       GROUP BY f.id
       ORDER BY recent ASC
       LIMIT 1`
    )
    .get(receipt.medicine_id, sixtyDaysAgo, receipt.facility_id) as { id: string; recent: number } | undefined;
  if (!candidate) return;

  const units = Math.max(1, Math.round(receipt.quantity * 0.3));
  db.prepare(
    `INSERT INTO redistribution_recommendations
       (medicine_id, from_facility_id, to_facility_id, reason, units, expiry_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    receipt.medicine_id,
    receipt.facility_id,
    candidate.id,
    isShortExpiry ? "short_expiry" : "overstock",
    units,
    receipt.expiry_date,
    isoDate(new Date())
  );
}

export function deriveAll(db: DatabaseSync, receipt: ReceiptRow): void {
  deriveExpiryWatch(db, receipt);
  deriveTrustEvent(db, receipt);
  deriveSeasonalAgg(db, receipt);
  deriveRegionalSignal(db, receipt);
  deriveRedistribution(db, receipt);
}
