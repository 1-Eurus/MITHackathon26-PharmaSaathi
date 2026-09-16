import { $ } from "./dom";
import { FACILITIES, MEDICINES } from "./data";
import { applyInvoiceReceipt } from "./simulate";
import { renderAll } from "./render/index";
import { readFileAsText } from "./extract/readFileText";
import { parseInvoiceText } from "./extract/parseInvoiceText";
import { fetchPersistedReceipts, persistReceipt } from "./api";
import type { InvoiceExtractionResult, InvoiceLineItem, ReviewedInvoiceLine } from "./types";

/* ============================================================
   INVOICE INTAKE - upload/paste an invoice, extract structured line items
   with a free, local, no-AI pipeline (OCR/PDF-text -> heuristic parser, see
   src/extract/), let the user review/correct them, then write each
   confirmed line into the same simulated state every other panel reads
   (see applyInvoiceReceipt in simulate.ts).
   ============================================================ */

let pickedFile: File | null = null;
let rows: ReviewedInvoiceLine[] = [];

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** best-effort match against the app's real catalog - the backend is
 *  prompted to return exact catalog names when confident, so this mostly
 *  just normalizes case/whitespace; anything that still doesn't match is
 *  left unresolved for the user to pick from the dropdown themselves */
function matchMedicineId(name: string): string | null {
  const q = name.trim().toLowerCase();
  const exact = MEDICINES.find((m) => m.name.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = MEDICINES.find((m) => m.name.toLowerCase().includes(q) || q.includes(m.name.toLowerCase()));
  return partial ? partial.id : null;
}
function matchFacilityId(name: string): string | null {
  const q = name.trim().toLowerCase();
  const exact = FACILITIES.find((f) => f.name.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = FACILITIES.find((f) => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase()));
  return partial ? partial.id : null;
}

function toReviewedLine(item: InvoiceLineItem): ReviewedInvoiceLine {
  const medicineId = matchMedicineId(item.medicineName.value);
  const facilityId = matchFacilityId(item.facilityName.value);
  return {
    medicineId,
    medicineName: medicineId ? MEDICINES.find((m) => m.id === medicineId)!.name : item.medicineName.value,
    quantity: item.quantity.value,
    batchNumber: item.batchNumber.value ?? "",
    expiryDate: item.expiryDate.value,
    receivedAt: item.receivedAt.value ?? toDatetimeLocal(new Date()),
    facilityId,
    facilityName: facilityId ? FACILITIES.find((f) => f.id === facilityId)!.name : item.facilityName.value,
  };
}

function fieldClass(confidence: "high" | "low" | undefined, resolved = true): string {
  return confidence === "low" || !resolved ? "invoice-field low-conf" : "invoice-field";
}

interface RowConfidence {
  medicine?: "high" | "low";
  facility?: "high" | "low";
  quantity?: "high" | "low";
  batch?: "high" | "low";
  expiry?: "high" | "low";
  receivedAt?: "high" | "low";
}

function rowTemplate(r: ReviewedInvoiceLine, i: number, c: RowConfidence = {}): string {
  return `<tr data-row="${i}">
    <td><select class="${fieldClass(c.medicine, !!r.medicineId)}" data-field="medicineId">${medicineOptions(r.medicineId)}</select></td>
    <td><select class="${fieldClass(c.facility, !!r.facilityId)}" data-field="facilityId">${facilityOptions(r.facilityId)}</select></td>
    <td><input class="${fieldClass(c.quantity)}" data-field="quantity" type="number" min="0" step="1" value="${r.quantity ?? ""}" placeholder="?"></td>
    <td><input class="${fieldClass(c.batch)}" data-field="batchNumber" type="text" value="${r.batchNumber}" placeholder="(none)"></td>
    <td><input class="${fieldClass(c.expiry)}" data-field="expiryDate" type="date" value="${r.expiryDate ?? ""}"></td>
    <td><input class="${fieldClass(c.receivedAt)}" data-field="receivedAt" type="datetime-local" value="${r.receivedAt}"></td>
    <td><button type="button" class="invoice-row-remove" data-remove="${i}" aria-label="Remove row">&times;</button></td>
  </tr>`;
}

function paintPreviewTable(confidences: RowConfidence[] = []): void {
  if (!rows.length) {
    $("invoicePreviewWrap").hidden = true;
    $("invoiceConfirmBtn").setAttribute("disabled", "true");
    return;
  }
  $("invoicePreviewWrap").hidden = false;
  $("invoiceConfirmBtn").removeAttribute("disabled");
  $("invoicePreviewBody").innerHTML = rows.map((r, i) => rowTemplate(r, i, confidences[i])).join("");
  $("invoicePreviewBody").querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      rows.splice(Number(btn.dataset.remove), 1);
      paintPreviewTable(); // rows already edited/confirmed once, so no confidence flags survive a removal-triggered repaint
    });
  });
}

function medicineOptions(selectedId: string | null): string {
  return (
    `<option value="" ${selectedId ? "" : "selected"} disabled>Select medicine&hellip;</option>` +
    MEDICINES.map((m) => `<option value="${m.id}" ${m.id === selectedId ? "selected" : ""}>${m.name}</option>`).join("")
  );
}
function facilityOptions(selectedId: string | null): string {
  return (
    `<option value="" ${selectedId ? "" : "selected"} disabled>Select facility&hellip;</option>` +
    FACILITIES.map((f) => `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${f.name}</option>`).join("")
  );
}

function renderPreview(result: InvoiceExtractionResult): void {
  rows = result.items.map(toReviewedLine);
  const confidences: RowConfidence[] = result.items.map((i) => ({
    medicine: i.medicineName.confidence,
    quantity: i.quantity.confidence,
    batch: i.batchNumber.confidence,
    expiry: i.expiryDate.confidence,
    receivedAt: i.receivedAt.confidence,
    facility: i.facilityName.confidence,
  }));
  $("invoiceWarning").innerHTML = result.warning ? `<div class="invoice-warning">${result.warning}</div>` : "";
  paintPreviewTable(confidences);
}

function readRowsFromTable(): ReviewedInvoiceLine[] {
  const trs = Array.from($("invoicePreviewBody").querySelectorAll<HTMLTableRowElement>("tr[data-row]"));
  return trs.map((tr) => {
    const get = (field: string) => tr.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${field}"]`)!.value;
    const medicineId = get("medicineId") || null;
    const facilityId = get("facilityId") || null;
    const qtyRaw = get("quantity");
    return {
      medicineId,
      medicineName: medicineId ? MEDICINES.find((m) => m.id === medicineId)!.name : "",
      quantity: qtyRaw === "" ? null : Number(qtyRaw),
      batchNumber: get("batchNumber"),
      expiryDate: get("expiryDate") || null,
      receivedAt: get("receivedAt"),
      facilityId,
      facilityName: facilityId ? FACILITIES.find((f) => f.id === facilityId)!.name : "",
    };
  });
}

async function submitExtraction(): Promise<void> {
  const text = $<HTMLTextAreaElement>("invoiceTextInput").value.trim();
  if (!pickedFile && !text) {
    $("invoiceWarning").innerHTML = `<div class="invoice-warning">Drop a file or paste invoice text first.</div>`;
    return;
  }
  $("invoiceExtractBtn").setAttribute("disabled", "true");
  $("invoiceSpinner").hidden = false;
  $("invoiceWarning").innerHTML = "";
  $("invoicePreviewWrap").hidden = true;

  try {
    const rawText = pickedFile
      ? await readFileAsText(pickedFile, (msg) => ($("invoiceSpinner").textContent = msg))
      : text;
    renderPreview(parseInvoiceText(rawText));
  } catch (err) {
    $("invoiceWarning").innerHTML = `<div class="invoice-warning">${err instanceof Error ? err.message : "Extraction failed."}</div>`;
  } finally {
    $("invoiceExtractBtn").removeAttribute("disabled");
    $("invoiceSpinner").hidden = true;
    $("invoiceSpinner").textContent = "Extracting…";
  }
}

function setPickedFile(file: File | null): void {
  pickedFile = file;
  $("invoiceDropzoneLabel").textContent = file ? file.name : "Drop an invoice image or PDF here, or click to choose a file";
  if (file) $<HTMLTextAreaElement>("invoiceTextInput").value = "";
}

function confirmInvoice(): void {
  const finalRows = readRowsFromTable();
  const failed: ReviewedInvoiceLine[] = [];
  const errors: string[] = [];
  let succeeded = 0;

  finalRows.forEach((r) => {
    if (!r.medicineId || !r.facilityId) {
      failed.push(r);
      errors.push(`Row ${failed.length}: pick a medicine and facility before confirming.`);
      return;
    }
    if (r.quantity === null || r.quantity <= 0) {
      failed.push(r);
      errors.push(`Row ${failed.length}: enter a quantity greater than 0.`);
      return;
    }
    const receivedIso = r.receivedAt ? new Date(r.receivedAt).toISOString() : new Date().toISOString();
    const result = applyInvoiceReceipt({
      facilityId: r.facilityId,
      medicineId: r.medicineId,
      quantity: r.quantity,
      batchNumber: r.batchNumber,
      expiryDate: r.expiryDate,
      receivedAt: receivedIso,
    });
    if (!result.ok) {
      failed.push(r);
      errors.push(`Row ${failed.length}: ${result.reason}`);
    } else {
      succeeded++;
      // fire-and-forget: persist to the backend (if running) so this
      // receipt survives a reload and feeds expiry/trust/seasonal/regional/
      // redistribution history there too. The client-side apply above
      // already reflects it in this session regardless of whether the
      // backend is reachable.
      persistReceipt({
        facilityId: r.facilityId,
        medicineId: r.medicineId,
        quantity: r.quantity,
        batchNumber: r.batchNumber,
        expiryDate: r.expiryDate,
        receivedAt: receivedIso,
      });
    }
  });

  if (errors.length) {
    // keep the modal open with only the still-unresolved rows (renumbered to
    // match what's now on screen), so the user can fix and re-confirm rather
    // than lose track of what failed
    rows = failed;
    paintPreviewTable();
    $("invoiceWarning").innerHTML = `<div class="invoice-warning">${errors.join("<br>")}</div>`;
    if (succeeded) renderAll(); // reflect what did succeed right away
    return;
  }

  renderAll();
  closeInvoiceModal();
  showSavedToast(succeeded);
}

function showSavedToast(count: number): void {
  const el = $("invoiceToast");
  el.textContent = `${count} ${count === 1 ? "line" : "lines"} saved to inventory, expiry watch and facility trust.`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

/** replay every receipt the backend has persisted from a previous session,
 *  through the same applyInvoiceReceipt() a live confirm uses, so a page
 *  reload doesn't lose invoice history. Call once at startup, before the
 *  first renderAll(). No-ops quietly if the backend isn't running. */
export async function replayPersistedReceipts(): Promise<void> {
  const receipts = await fetchPersistedReceipts();
  receipts.forEach((r) => {
    applyInvoiceReceipt({
      facilityId: r.facility_id,
      medicineId: r.medicine_id,
      quantity: r.quantity,
      batchNumber: r.batch_number ?? "",
      expiryDate: r.expiry_date,
      receivedAt: r.received_at,
    });
  });
}

export function openInvoiceModal(): void {
  pickedFile = null;
  rows = [];
  $<HTMLTextAreaElement>("invoiceTextInput").value = "";
  $("invoiceDropzoneLabel").textContent = "Drop an invoice image or PDF here, or click to choose a file";
  $("invoiceWarning").innerHTML = "";
  $("invoicePreviewWrap").hidden = true;
  $("invoiceModal").classList.add("show");
}

export function closeInvoiceModal(): void {
  $("invoiceModal").classList.remove("show");
}

export function wireInvoiceModal(): void {
  $("scanInvoiceBtn").addEventListener("click", openInvoiceModal);
  $("invoiceModalClose").addEventListener("click", closeInvoiceModal);
  $("invoiceModal").addEventListener("click", (e) => {
    if (e.target === $("invoiceModal")) closeInvoiceModal();
  });

  const dropzone = $("invoiceDropzone");
  const fileInput = $<HTMLInputElement>("invoiceFileInput");
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) setPickedFile(file);
  });
  fileInput.addEventListener("change", () => setPickedFile(fileInput.files?.[0] ?? null));

  $<HTMLTextAreaElement>("invoiceTextInput").addEventListener("input", () => {
    if ($<HTMLTextAreaElement>("invoiceTextInput").value.trim()) setPickedFile(null);
  });

  $("invoiceExtractBtn").addEventListener("click", submitExtraction);
  $("invoiceConfirmBtn").addEventListener("click", confirmInvoice);
}
