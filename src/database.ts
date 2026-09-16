import { $ } from "./dom";
import { FACILITIES, MEDICINES } from "./data";
import {
  fetchInvoiceReceipts,
  fetchExpiryWatch,
  fetchSupplierTrust,
  fetchSeasonalSignals,
  fetchRegionalSignals,
  fetchRedistribution,
  type PersistedReceipt,
  type ExpiryWatchRow,
  type SupplierTrustRow,
  type SeasonalSignalRow,
  type RegionalSignalRow,
  type RedistributionRow,
} from "./api";

/* ============================================================
   VIEW DATABASE - a read-only look at what's actually stored in
   server/data/pharmasaathi.db: invoice_receipts plus the 5 tables
   derived from it (see server/derive.ts). Pure display, no writes -
   confirming an invoice is still done through Scan Invoice.
   ============================================================ */

type TabId = "invoices" | "expiry" | "trust" | "seasonal" | "regional" | "redistribution";

const TABS: { id: TabId; label: string }[] = [
  { id: "invoices", label: "Invoice receipts" },
  { id: "expiry", label: "Expiry watch" },
  { id: "trust", label: "Supplier trust" },
  { id: "seasonal", label: "Seasonal demand" },
  { id: "regional", label: "Regional signals" },
  { id: "redistribution", label: "Redistribution" },
];

let activeTab: TabId = "invoices";

function facilityName(id: string): string {
  return FACILITIES.find((f) => f.id === id)?.name ?? id;
}
function medicineName(id: string): string {
  return MEDICINES.find((m) => m.id === id)?.name ?? id;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "&mdash;";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function notReachableHtml(): string {
  return `<div class="empty-state">Can't reach the backend. Start it with <code>npm run dev</code> (it runs both the app and the database server) to see stored data.</div>`;
}
function emptyHtml(label: string): string {
  return `<div class="empty-state">No ${label} yet &mdash; confirm an invoice via Scan Invoice to populate this.</div>`;
}
function table(head: string[], rows: string[][]): string {
  return `<div class="table-scroll"><table>
    <thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

async function renderInvoices(): Promise<string> {
  const { rows, reachable } = await fetchInvoiceReceipts();
  if (!reachable) return notReachableHtml();
  if (!rows.length) return emptyHtml("invoice receipts");
  return table(
    ["ID", "Facility", "Medicine", "Qty", "Batch", "Expiry", "Received", "Logged"],
    rows.map((r: PersistedReceipt) => [
      String(r.id),
      facilityName(r.facility_id),
      medicineName(r.medicine_id),
      `<span class="num">${r.quantity}</span>`,
      r.batch_number ?? "&mdash;",
      r.expiry_date ?? "&mdash;",
      fmtDate(r.received_at),
      fmtDate(r.logged_at),
    ])
  );
}

async function renderExpiry(): Promise<string> {
  const { rows, reachable } = await fetchExpiryWatch();
  if (!reachable) return notReachableHtml();
  if (!rows.length) return emptyHtml("expiry alerts");
  return table(
    ["Facility", "Medicine", "Expiry date", "Days remaining", "Bucket", "Flagged"],
    rows.map((r: ExpiryWatchRow) => [
      r.facility_name,
      r.medicine_name,
      r.expiry_date,
      `<span class="num">${r.days_remaining}</span>`,
      `<span class="chip ${r.bucket === "30" ? "critical" : r.bucket === "60" ? "warning" : "watch"}">&le;${r.bucket}d</span>`,
      fmtDate(r.created_at),
    ])
  );
}

async function renderTrust(): Promise<string> {
  const { rows, reachable } = await fetchSupplierTrust();
  if (!reachable) return notReachableHtml();
  if (!rows.length) return emptyHtml("logged deliveries");
  return table(
    ["Facility", "Running trust score", "Last updated"],
    rows.map((r: SupplierTrustRow) => [r.facility_name, `<span class="num">${r.running_score}</span>`, fmtDate(r.created_at)])
  );
}

async function renderSeasonal(): Promise<string> {
  const { rows, reachable } = await fetchSeasonalSignals();
  if (!reachable) return notReachableHtml();
  if (!rows.length) return emptyHtml("seasonal aggregates");
  return table(
    ["Medicine", "Month", "Total qty received", "Prior 3-mo avg", "% change", "Imbalance?"],
    rows.map((r: SeasonalSignalRow) => [
      r.medicine_name,
      r.year_month,
      `<span class="num">${r.total_qty}</span>`,
      r.prior_avg_qty === null ? "&mdash;" : `<span class="num">${r.prior_avg_qty.toFixed(1)}</span>`,
      r.pct_change === null ? "&mdash;" : `<span class="num">${r.pct_change > 0 ? "+" : ""}${r.pct_change.toFixed(0)}%</span>`,
      r.imbalance_flag ? `<span class="chip warning">Flagged</span>` : "&mdash;",
    ])
  );
}

async function renderRegional(): Promise<string> {
  const { rows, reachable } = await fetchRegionalSignals();
  if (!reachable) return notReachableHtml();
  if (!rows.length) return emptyHtml("regional spike events");
  return table(
    ["Hub", "VEN", "Trailing 7-day qty", "Baseline (7-day equiv)", "Spike ratio", "Detected"],
    rows.map((r: RegionalSignalRow) => [
      r.hub_id,
      r.ven,
      `<span class="num">${r.total_qty}</span>`,
      `<span class="num">${r.baseline_qty.toFixed(1)}</span>`,
      `<span class="num">${r.spike_ratio.toFixed(2)}&times;</span>`,
      fmtDate(r.created_at),
    ])
  );
}

async function renderRedistribution(): Promise<string> {
  const { rows, reachable } = await fetchRedistribution();
  if (!reachable) return notReachableHtml();
  if (!rows.length) return emptyHtml("redistribution suggestions");
  return table(
    ["Medicine", "From", "To", "Units", "Reason", "Expiry", "Suggested"],
    rows.map((r: RedistributionRow) => [
      r.medicine_name,
      r.from_facility_name,
      r.to_facility_name,
      `<span class="num">${r.units}</span>`,
      r.reason === "short_expiry" ? "Short expiry" : "Overstock",
      r.expiry_date ?? "&mdash;",
      fmtDate(r.created_at),
    ])
  );
}

const RENDERERS: Record<TabId, () => Promise<string>> = {
  invoices: renderInvoices,
  expiry: renderExpiry,
  trust: renderTrust,
  seasonal: renderSeasonal,
  regional: renderRegional,
  redistribution: renderRedistribution,
};

async function loadTab(tab: TabId): Promise<void> {
  activeTab = tab;
  $("dbTabsRow").querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  $("dbTableWrap").innerHTML = `<div class="empty-state">Loading&hellip;</div>`;
  $("dbTableWrap").innerHTML = await RENDERERS[tab]();
}

export function openDatabaseModal(): void {
  $("dbModal").classList.add("show");
  loadTab(activeTab);
}
export function closeDatabaseModal(): void {
  $("dbModal").classList.remove("show");
}

export function wireDatabaseModal(): void {
  $("viewDbBtn").addEventListener("click", openDatabaseModal);
  $("dbModalClose").addEventListener("click", closeDatabaseModal);
  $("dbModal").addEventListener("click", (e) => {
    if (e.target === $("dbModal")) closeDatabaseModal();
  });
  $("dbRefreshBtn").addEventListener("click", () => loadTab(activeTab));

  $("dbTabsRow").innerHTML = TABS.map(
    (t) => `<button type="button" class="db-tab${t.id === activeTab ? " active" : ""}" data-tab="${t.id}">${t.label}</button>`
  ).join("");
  $("dbTabsRow").querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => loadTab(btn.dataset.tab as TabId));
  });
}
