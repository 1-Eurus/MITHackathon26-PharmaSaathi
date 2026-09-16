import { MEDICINES, FACILITIES } from "../data";
import type { InvoiceExtractionResult, InvoiceLineItem, ExtractedField } from "../types";

/* ============================================================
   Free, local, no-AI invoice text parser. Handles two common shapes:
     1. labeled lines:   "Amoxicillin 250mg, Qty: 600, Batch AMX-77Q, Exp: Nov 2027"
     2. tabular lines:   "Amoxicillin 250mg    600    AMX-77Q    Nov 2027"
   (column-aligned with 2+ spaces or tabs between fields)
   It's a heuristic, not an AI reader - genuinely ambiguous or missing
   fields come back with confidence "low" rather than a silent guess,
   same contract the (removed) AI backend used, so the rest of the
   invoice-intake pipeline (preview table, applyInvoiceReceipt, ...)
   needs no changes.
   ============================================================ */

const HEADER_WORDS = /^(item|medicine|description|qty|quantity|batch|expiry|exp\.?|date|units?)\b/i;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function field<T>(value: T, confidence: "high" | "low"): ExtractedField<T> {
  return { value, confidence };
}
function confOf(confident: boolean): "high" | "low" {
  return confident ? "high" : "low";
}

/** best-effort date parser covering the formats invoices/expiry stamps commonly use.
 *  Returns an ISO "YYYY-MM-DD" plus whether the day-of-month was actually stated
 *  (vs inferred, e.g. "Nov 2027" -> last day of that month, low confidence).
 *
 *  `requireWholeMatch`: the regexes below search anywhere in the string by
 *  default (useful when `raw` is already a captured label group like "Exp:
 *  2027-11-30 units"). Pass true when `raw` is a candidate you're testing
 *  wholesale (e.g. "500 AMX-2201 2027-11-30") - otherwise a date buried
 *  after other tokens would wrongly "match" and swallow them too. */
function parseFlexibleDate(raw: string, requireWholeMatch = false): { iso: string; confident: boolean } | null {
  const s = raw.trim();
  const ok = (m: RegExpExecArray | null) => !!m && (!requireWholeMatch || (m.index === 0 && m[0].length === s.length));

  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); // 2027-03-15
  if (ok(m)) return isoFrom(+m![1], +m![2], +m![3], true);

  m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s); // 15/03/2027 (assume DD/MM/YYYY)
  if (ok(m)) return isoFrom(+m![3], +m![2], +m![1], +m![1] <= 12 && +m![2] <= 12 ? false : true);

  m = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/.exec(s); // 15 Nov 2027 / 15 November 2027
  if (ok(m) && MONTHS[m![2].slice(0, 3).toLowerCase()]) return isoFrom(+m![3], MONTHS[m![2].slice(0, 3).toLowerCase()], +m![1], true);

  m = /([A-Za-z]{3,9})\s+(\d{4})/.exec(s); // Nov 2027 - no day stated
  if (ok(m) && MONTHS[m![1].slice(0, 3).toLowerCase()]) {
    const month = MONTHS[m![1].slice(0, 3).toLowerCase()];
    const lastDay = new Date(+m![2], month, 0).getDate();
    return isoFrom(+m![2], month, lastDay, false);
  }
  return null;
}
function isoFrom(y: number, mo: number, d: number, confident: boolean): { iso: string; confident: boolean } | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { iso: `${y}-${pad(mo)}-${pad(d)}`, confident };
}

function matchCatalog<T extends { name: string }>(catalog: T[], raw: string): { match: T | null; confidence: "high" | "low" } {
  const q = raw.trim().toLowerCase();
  if (!q) return { match: null, confidence: "low" };
  const exact = catalog.find((c) => c.name.toLowerCase() === q);
  if (exact) return { match: exact, confidence: "high" };
  const partial = catalog.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
  return partial ? { match: partial, confidence: "low" } : { match: null, confidence: "low" };
}

function findFacility(text: string): ExtractedField<string> {
  const known = FACILITIES.find((f) => text.toLowerCase().includes(f.name.toLowerCase()));
  if (known) return field(known.name, "high");
  const labeled = /(?:from|supplier|facility|hospital|delivered to)\s*:?\s*(.+)/i.exec(text);
  if (labeled) return field(labeled[1].split("\n")[0].trim(), "low");
  return field("", "low");
}

function findReceivedAt(text: string): ExtractedField<string | null> {
  const labeled = /(?:date received|received|date)\s*:?\s*([^\n]+)/i.exec(text);
  if (labeled) {
    const parsed = parseFlexibleDate(labeled[1]);
    if (parsed) {
      const time = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(labeled[1]);
      const hh = time ? formatHour(+time[1], time[3]) : "00";
      const mm = time ? time[2] : "00";
      return field(`${parsed.iso}T${hh}:${mm}`, parsed.confident && !!time ? "high" : "low");
    }
  }
  return field(null, "low");
}
function formatHour(h: number, ampm?: string): string {
  if (ampm?.toUpperCase() === "PM" && h < 12) h += 12;
  if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
  return String(h).padStart(2, "0");
}

/** try the "Name, Qty: N, Batch X, Exp: D" labeled style */
function parseLabeledLine(line: string): Omit<InvoiceLineItem, "facilityName" | "receivedAt"> | null {
  const qtyM = /qty\.?:?\s*(\d+(?:\.\d+)?)/i.exec(line);
  if (!qtyM) return null;
  const batchM = /batch\s*#?:?\s*([\w-]+)/i.exec(line);
  const expM = /exp(?:iry)?\.?:?\s*([^\n,;]+)/i.exec(line);
  const namePart = line.slice(0, qtyM.index).trim().replace(/[,;:-]+$/, "").trim();
  const { match, confidence } = matchCatalog(MEDICINES, namePart);
  const expParsed = expM ? parseFlexibleDate(expM[1]) : null;
  return {
    medicineName: field(match ? match.name : namePart, match ? confidence : "low"),
    quantity: field(Math.round(+qtyM[1]), "high"),
    batchNumber: field(batchM ? batchM[1] : null, batchM ? "high" : "low"),
    expiryDate: field(expParsed ? expParsed.iso : null, expParsed ? confOf(expParsed.confident) : "low"),
  };
}

function looksLikeBatch(tok: string): boolean {
  return /\d/.test(tok) && !/^\d+(\.\d+)?$/.test(tok); // has a digit, but isn't a bare number
}

/** fall back to a tabular row with no reliable column spacing to go on -
 *  OCR text in particular collapses any original multi-space gaps down to
 *  single spaces, so this can't split by column position. Instead it scans
 *  tokens from the right: expiry, then batch, then quantity are normally
 *  the trailing fields in that order, and whatever's left at the front is
 *  the medicine name (itself often multiple words, e.g. "Snake Anti-Venom"). */
function parseTabularLine(line: string): Omit<InvoiceLineItem, "facilityName" | "receivedAt"> | null {
  let tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  if (HEADER_WORDS.test(tokens[0])) return null;

  let expiryDate: ExtractedField<string | null> = field(null, "low");
  for (const take of [3, 2, 1]) {
    if (tokens.length <= take) continue;
    const candidate = tokens.slice(-take).join(" ");
    const dt = parseFlexibleDate(candidate, true);
    if (dt) {
      expiryDate = field(dt.iso, confOf(dt.confident));
      tokens = tokens.slice(0, -take);
      break;
    }
  }

  let batchNumber: ExtractedField<string | null> = field(null, "low");
  const last = tokens[tokens.length - 1];
  if (last && last !== "-" && looksLikeBatch(last)) {
    batchNumber = field(last, "high");
    tokens = tokens.slice(0, -1);
  }

  let quantity: ExtractedField<number | null> = field(null, "low");
  const nowLast = tokens[tokens.length - 1];
  if (nowLast && /^\d+(\.\d+)?$/.test(nowLast)) {
    quantity = field(Math.round(+nowLast), "high");
    tokens = tokens.slice(0, -1);
  }

  if (quantity.value === null && batchNumber.value === null && expiryDate.value === null) return null;
  const namePart = tokens.join(" ").replace(/[,;:-]+$/, "").trim();
  if (!namePart) return null;
  const { match, confidence } = matchCatalog(MEDICINES, namePart);
  return {
    medicineName: field(match ? match.name : namePart, match ? confidence : "low"),
    quantity,
    batchNumber,
    expiryDate,
  };
}

export function parseInvoiceText(text: string): InvoiceExtractionResult {
  const facilityName = findFacility(text);
  const receivedAt = findReceivedAt(text);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !HEADER_WORDS.test(l));

  const items: InvoiceLineItem[] = [];
  for (const line of lines) {
    const parsed = parseLabeledLine(line) ?? parseTabularLine(line);
    if (!parsed) continue;
    items.push({ ...parsed, facilityName, receivedAt });
  }

  return {
    items,
    warning: items.length
      ? null
      : "Couldn't find any recognizable line items. This local parser understands rows like \"Medicine, Qty: N, Batch X, Exp: D\" or column-aligned tables — try reformatting, or check the OCR read the text correctly.",
  };
}
