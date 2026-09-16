/* ============================================================
   Domain types for PharmaSaathi
   ============================================================ */

export type Ven = "V" | "E" | "N";

export type FacilityTypeName =
  | "Medical College & Hospital"
  | "District Hospital"
  | "CHC"
  | "PHC"
  | "Sub-Center";

export type ColdChainLevel = "full" | "limited" | "none";

export interface FacilityTypeInfo {
  /** daily-use multiplier relative to a baseline facility */
  mult: number;
  cold: ColdChainLevel;
  /** reserve-stock buffer multiplier */
  buffer: number;
  /** facility scale, 1 (Sub-Center) - 5 (Medical College); see Medicine.minTier */
  tier: number;
}

export interface Hub {
  id: string;
  name: string;
  district: string;
  /** a CSS custom property reference, e.g. "var(--hub-1)" */
  color: string;
  lat: number;
  lng: number;
}

export interface TrustInfo {
  score: number;
  reportingRate: number;
  tier: "High trust" | "Monitor" | "Needs review";
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityTypeName;
  hub: string;
  /** set by the layout step (see layout.ts) */
  lat: number;
  lng: number;
  anchor: boolean;
  /** set once at load time (see simulate.ts) */
  trust: TrustInfo;
}

export interface Medicine {
  id: string;
  name: string;
  unit: string;
  cold: boolean;
  /** baseline daily-use units for a reference facility */
  base: number;
  /** typical reorder cycle length in days */
  cycle: number;
  category: string;
  ven: Ven;
  /** lowest facility tier (see FacilityTypeInfo.tier) that stocks this line */
  minTier: number;
}

export interface Supplier {
  hub: string;
  name: string;
  type: string;
  leadTimeDays: number;
  reliability: number;
  note: string;
}

export interface SeasonalEntry {
  med: string;
  changePct: number;
  driver: string;
}

export interface Disruption {
  hub: string;
  medicine: string;
  startDay: number;
  maxExtraDelay: number;
  rampDays: number;
}

/** scripted rise in consumption (not delivery delay) for one hub+medicine -
 *  distinct from Disruption above, which is a supply-side (delay) scenario.
 *  This is a demand-side scenario: usage climbs while replenishment still
 *  arrives on schedule, so it shows up as rising use before stock erodes. */
export interface DemandSpikeScenario {
  hub: string;
  medicine: string;
  startDay: number;
  rampDays: number;
  /** extra usage multiplier at full ramp, e.g. 0.6 = +60% above normal daily use */
  maxUsageMultiplier: number;
}

/** one facility x medicine pair's simulated 90-day series */
export interface SeriesEntry {
  stockArr: number[];
  delayArr: number[];
  useArr: number[];
  replenishDays: number[];
  capacity: number;
  dailyUseBase: number;
  baseDelay: number;
  reorderRef: number;
  coldChain: boolean;
  expiryAtToday: number;
  normalDOS: number;
}

export type Status = "good" | "warning" | "watch" | "critical";

export interface FacilityState {
  stock: number;
  use: number;
  daysOfSupply: number;
  delay: number;
  status: Status;
  capacity: number;
}

export interface SignalAffected {
  f: Facility;
  now: FacilityState;
  decline: number;
}

export interface Signal {
  hub: Hub;
  med: Medicine;
  affected: SignalAffected[];
  score: number;
  confidence: "High confidence" | "Medium confidence";
  avgDelay: number;
}

export interface RedistributionRow {
  med: string;
  from: string;
  to: string;
  units: number;
  unit: string;
  dist: number;
  coldOk: boolean;
  coldReq: boolean;
  expiry: number;
  urgency: Status;
  _donorId: string;
  _targetId: string;
  _med: string;
  _used: true;
}

export interface DemandSpikeAffected {
  f: Facility;
  now: FacilityState;
  /** how far the trailing-7-day average use is running above this pair's normal daily use, in percent */
  pctAboveNormal: number;
}

export interface DemandSignal {
  hub: Hub;
  med: Medicine;
  affected: DemandSpikeAffected[];
  avgPctAboveNormal: number;
  score: number;
}

export interface ExpiryRow {
  f: Facility;
  med: Medicine;
  remaining: number;
  stock: number;
}

/* ============================================================
   Invoice intake (AI-assisted extraction) - see src/invoice.ts
   ============================================================ */

export type ExtractConfidence = "high" | "low";

export interface ExtractedField<T> {
  value: T;
  confidence: ExtractConfidence;
}

/** one medicine line as returned by the extraction backend, before the user
 *  has reviewed/corrected it in the preview table */
export interface InvoiceLineItem {
  medicineName: ExtractedField<string>;
  quantity: ExtractedField<number | null>;
  batchNumber: ExtractedField<string | null>;
  expiryDate: ExtractedField<string | null>; // "YYYY-MM-DD"
  receivedAt: ExtractedField<string | null>; // "YYYY-MM-DDTHH:mm"
  facilityName: ExtractedField<string>;
}

export interface InvoiceExtractionResult {
  items: InvoiceLineItem[];
  warning?: string | null;
}

/** an invoice line after the user has reviewed it in the preview table and
 *  resolved medicineName/facilityName to real catalog ids */
export interface ReviewedInvoiceLine {
  medicineId: string | null;
  medicineName: string;
  quantity: number | null;
  batchNumber: string;
  expiryDate: string | null;
  receivedAt: string;
  facilityId: string | null;
  facilityName: string;
}

/** audit trail of confirmed invoice receipts - not read by any existing
 *  scoring/forecasting logic, kept only for traceability */
export interface InvoiceReceiptLog {
  facilityId: string;
  medicineId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string | null;
  receivedAt: string;
  loggedAt: string;
}
