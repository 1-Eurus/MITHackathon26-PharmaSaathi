# PharmaSaathi (TypeScript)

A healthcare medicine-supply early-warning dashboard prototype for a regional network of health facilities (Noida & Greater Noida, India). The dashboard itself is a deterministic, seeded simulation. **Scan Invoice** is the one live-data feature: extraction is free and runs entirely in your browser (no API key, no account, no cost), and confirmed invoices are persisted to a local SQLite database via a small Node backend, so they survive a page reload.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` starts both the Vite frontend (`http://localhost:5173`) and the invoice-intake backend (`http://localhost:8787`, proxied under `/api`) together via `concurrently`. Nothing to configure — no API key, no external database to stand up; the backend creates its SQLite file on first run.

- `npm run dev` — both dev servers with hot reload
- `npm run dev:client` — just the Vite frontend
- `npm run dev:server` — just the invoice-intake backend
- `npm run build` — type-checks with `tsc` and produces an optimized static build in `dist/` (frontend only — see below)
- `npm run preview` — serves the `dist/` build locally, to check it before deploying

`dist/` after `npm run build` is a plain static site — drop it on any static host (Netlify, Vercel, GitHub Pages, nginx, `python3 -m http.server`, etc). The dashboard and invoice *extraction* need no backend; only invoice *persistence* (surviving a reload, and the five downstream tables below) needs `server/index.ts` running somewhere.

The whole repo — frontend and backend — is TypeScript. The backend runs its `.ts` files directly via Node's built-in TypeScript support (Node 22.18+ / 24+, no compile step, no `ts-node`/`tsx`); `npm run build` type-checks both with separate `tsconfig.json`s (root for the browser code, `server/tsconfig.json` for the Node code) before building.

## Scan Invoice (free, local invoice intake + persistence)

Click **Scan Invoice** in the header to upload a delivery invoice (image or PDF) or paste its text:

- **Pasted text / text-layer PDFs** go through a local heuristic parser (`src/extract/parseInvoiceText.ts`) that understands both labeled lines (`Medicine, Qty: N, Batch X, Exp: D`) and column-aligned tables.
- **Images and scanned PDFs** are read first with [tesseract.js](https://github.com/naptha/tesseract.js) (OCR, runs in your browser) via `src/extract/readFileText.ts`, then the resulting text goes through the same parser. Tesseract downloads its language model from a CDN the first time you use it, then caches it.

Extracted line items (medicine, quantity, batch number, expiry date, receipt time, facility) land in an editable preview table. Anything the parser wasn't confident about — a missing field, an inferred date, a medicine/facility name it couldn't match to the catalog — is highlighted amber rather than silently guessed, and unmatched names get a dropdown so you can pick the right one.

Being a local parser rather than an AI model, it's genuinely less forgiving of messy or unusual invoice layouts than a vision LLM would be — that trade-off is what keeps this feature free and key-free.

**On confirm, two things happen, independently:**

1. **This session, immediately** — each line is written into the same simulated state every other panel already reads (`SERIES` in `src/simulate.ts`, via `applyInvoiceReceipt()`), so stock levels, the expiry watch, facility trust, and the regional-signals/redistribution logic all update right away with no separate code path.
2. **Durably, via the backend** — the same line is `POST`ed to `server/index.ts`, which inserts it into SQLite (`invoice_receipts`) and derives rows in five downstream tables — one per module below. On your next page load, `replayPersistedReceipts()` fetches every past receipt and re-applies it through the *same* `applyInvoiceReceipt()`, so a reload doesn't lose history. If the backend isn't reachable, both persistence and replay quietly no-op — the session-only behavior above still works.

### The five downstream tables (`server/schema.sql`, populated by `server/derive.ts`)

| Table | Module | Rule |
|---|---|---|
| `expiry_watch_alerts` | Expiry Watch | flags a batch when its stated expiry is within 30 / 60 / 90 real days of now |
| `supplier_trust_events` | Facility & Supplier Trust | a running per-facility score (starts at 80, +1 per logged delivery, capped at 99) — deliberately simple, independent of the frontend's own richer live trust formula |
| `seasonal_volume_agg` | Seasonal Demand | received quantity per medicine per month, flagged when it swings >40% from the trailing 3-month average |
| `regional_signal_events` | Emerging Regional Signals | trailing-7-day received volume per hub+VEN-category vs. the prior 23 days' daily average — flags a spike over 1.5x |
| `redistribution_recommendations` | Redistribution Opportunities | a short-expiry (≤30 days) or oversized (>3x that medicine's average receipt) batch paired with whichever other facility has received the least of it in the last 60 days |

These are intentionally simple, clearly-documented heuristics over the receipt log — not a re-implementation of the frontend's richer live simulation (which has a full 90-day stock series this receipts-only database doesn't have). Read via `GET /api/expiry-watch`, `/api/supplier-trust`, `/api/seasonal-signals`, `/api/regional-signals`, `/api/redistribution` (not yet surfaced in the UI — the dashboard's own live panels are still the primary view; these are there to inspect/build on).

## Project structure

```
index.html              Vite entry HTML (markup + element ids the render layer targets)
vite.config.ts          dev-only proxy: /api/* -> the backend on :8787
src/
  style.css             all styling (design tokens, light/dark theme, components)
  types.ts              shared domain types (Facility, Medicine, Hub, Signal, ...)
  rng.ts                seeded PRNG (mulberry32) - makes the simulation reproducible
  data.ts                domain data: hubs, facility types, facilities, medicines,
                         suppliers, seasonal outlook, VEN buffers, facilityCarries()
  layout.ts              positions facilities around their supply hub for the map
  simulate.ts             the simulation engine: 90-day stock series, trust index,
                          signal detection, redistribution matching, expiry watch,
                          and applyInvoiceReceipt() for confirmed invoice lines
  state.ts                UI state (selected facility/medicine, filters, scrub day, ...)
  dom.ts                  tiny typed `$(id)` helper over document.getElementById
  api.ts                  fetch client for the backend (fetch/persist receipts;
                         degrades to a no-op if it isn't running)
  invoice.ts              Scan Invoice modal: dropzone/paste, editable preview
                         table, confirm -> applyInvoiceReceipt + persistReceipt,
                         replayPersistedReceipts() on startup
  extract/
    readFileText.ts       image -> OCR text (tesseract.js); PDF -> embedded text,
                         or OCR of page 1 if it's a scanned/image-only PDF
    parseInvoiceText.ts   heuristic text -> structured line items, with
                         per-field confidence
  render/
    index.ts              renderAll() - calls every render function in order
    topbar.ts              stat strip, alert banner, timeline scrubber
    medicines.ts           VEN filter + medicine pill row (with search)
    facilityList.ts        facility list panel (with search, "not stocked" rows)
    network.ts              the interactive supply-network map: real Leaflet/
                            OpenStreetMap tiles, hub/facility markers, pan/zoom
    detail.ts               selected facility detail panel + stock history chart
    panels.ts                signals, redistribution, seasonal outlook, expiry
                             watch, trust table, nearby suppliers
  main.ts                   bootstraps the simulation, replays persisted invoices,
                            wires every control, calls renderAll() once at startup
server/
  tsconfig.json            separate TS config for the Node backend (no DOM
                          lib, NodeNext resolution) - checked by npm run build
  schema.sql              the SQL schema - invoice_receipts + the 5 tables above,
                          plus facilities/medicines reference tables
  catalog.ts               facility/medicine seed data, mirrors src/data.ts by hand
  db.ts                    opens server/data/pharmasaathi.db (node:sqlite,
                          gitignored), applies schema.sql, seeds the catalog
  derive.ts                the 5 downstream-table rules, run once per receipt
  index.ts                 HTTP server: POST/GET /api/invoices, plus one GET
                          route per downstream table - run directly by Node,
                          no build step (see "Run it" above)
```

The module boundaries mirror the sections of the original single-file version; `main.ts` is the only file that touches DOM event wiring for global controls (scrubber, search inputs, play button), and `render/network.ts` owns the map's own pan/zoom listeners since those are specific to that one panel.

## Notes

- **Real map, no API key.** The Supply Network panel is a Leaflet map on free OpenStreetMap tiles (a CSS filter gives them the app's dark look) rather than a paid provider like Mapbox or Google Maps — no map-tile API key ships to the browser. See `render/network.ts`.
- **No paid API anywhere.** Invoice extraction (OCR + parsing) runs entirely client-side, same as the rest of the dashboard's simulation. Only *persistence* uses a backend, and it's a plain Node process + SQLite file on your own machine — nothing paid, nothing external.
- Not wired to invoice data: the **Seasonal demand outlook** *panel* (the hardcoded editorial copy in the main dashboard) doesn't read from `seasonal_volume_agg` — that would mean inventing a second, competing seasonal-trend story. The backend's seasonal table is a separate, real, receipt-driven view (see the table above), not a replacement for the dashboard panel's own narrative.
- Fonts (Public Sans, IBM Plex Mono) load from Google Fonts; tesseract.js's OCR language model loads from a CDN on first use. Without network access, both fall back gracefully (system fonts; a clear "couldn't read this" message) and everything else still works.
#   M I T H a c k a t h o n 2 6 - P h a r m a S a a t h i  
 