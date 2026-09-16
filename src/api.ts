/* ============================================================
   Thin client for the invoice-intake backend (server/index.ts).
   Every call degrades gracefully if the backend isn't running (e.g. you
   only ran `npm run dev:client`) - the app still works session-only, it
   just won't persist invoice history across a reload.
   ============================================================ */

export interface PersistedReceipt {
  id: number;
  facility_id: string;
  medicine_id: string;
  quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  received_at: string;
  logged_at: string;
}

export interface NewReceipt {
  facilityId: string;
  medicineId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string | null;
  receivedAt: string;
}

export async function fetchPersistedReceipts(): Promise<PersistedReceipt[]> {
  try {
    const res = await fetch("/api/invoices");
    if (!res.ok) return [];
    return (await res.json()) as PersistedReceipt[];
  } catch {
    return [];
  }
}

export async function persistReceipt(rec: NewReceipt): Promise<boolean> {
  try {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rec),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ExpiryWatchRow {
  id: number;
  facility_name: string;
  medicine_name: string;
  expiry_date: string;
  days_remaining: number;
  bucket: "30" | "60" | "90";
  created_at: string;
}
export interface SupplierTrustRow {
  facility_id: string;
  facility_name: string;
  running_score: number;
  created_at: string;
}
export interface SeasonalSignalRow {
  id: number;
  medicine_name: string;
  year_month: string;
  total_qty: number;
  prior_avg_qty: number | null;
  pct_change: number | null;
  imbalance_flag: 0 | 1;
  updated_at: string;
}
export interface RegionalSignalRow {
  id: number;
  hub_id: string;
  ven: "V" | "E" | "N";
  window_start: string;
  window_end: string;
  total_qty: number;
  baseline_qty: number;
  spike_ratio: number;
  created_at: string;
}
export interface RedistributionRow {
  id: number;
  medicine_name: string;
  from_facility_name: string;
  to_facility_name: string;
  reason: "short_expiry" | "overstock";
  units: number;
  expiry_date: string | null;
  status: string;
  created_at: string;
}

async function fetchTable<T>(path: string): Promise<{ rows: T[]; reachable: boolean }> {
  try {
    const res = await fetch(path);
    if (!res.ok) return { rows: [], reachable: true };
    return { rows: (await res.json()) as T[], reachable: true };
  } catch {
    return { rows: [], reachable: false };
  }
}

export const fetchExpiryWatch = () => fetchTable<ExpiryWatchRow>("/api/expiry-watch");
export const fetchSupplierTrust = () => fetchTable<SupplierTrustRow>("/api/supplier-trust");
export const fetchSeasonalSignals = () => fetchTable<SeasonalSignalRow>("/api/seasonal-signals");
export const fetchRegionalSignals = () => fetchTable<RegionalSignalRow>("/api/regional-signals");
export const fetchRedistribution = () => fetchTable<RedistributionRow>("/api/redistribution");
export const fetchInvoiceReceipts = () => fetchTable<PersistedReceipt>("/api/invoices");
