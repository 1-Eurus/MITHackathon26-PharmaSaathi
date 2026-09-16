import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { db } from "./db.ts";
import { deriveAll, type ReceiptRow } from "./derive.ts";

const PORT = process.env.INVOICE_SERVER_PORT || 8787;

interface NewReceiptBody {
  facilityId: string;
  medicineId: string;
  quantity: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  receivedAt: string;
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<Partial<NewReceiptBody>> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function createReceipt(rec: NewReceiptBody): ReceiptRow {
  const loggedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO invoice_receipts (facility_id, medicine_id, quantity, batch_number, expiry_date, received_at, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(rec.facilityId, rec.medicineId, rec.quantity, rec.batchNumber ?? null, rec.expiryDate ?? null, rec.receivedAt, loggedAt);
  const receipt = db.prepare(`SELECT * FROM invoice_receipts WHERE id = ?`).get(result.lastInsertRowid) as unknown as ReceiptRow;
  deriveAll(db, receipt);
  return receipt;
}

const routes: Record<string, RouteHandler> = {
  "POST /api/invoices": async (req, res) => {
    const body = await readJsonBody(req);
    if (!body.facilityId || !body.medicineId || !(Number(body.quantity) > 0) || !body.receivedAt) {
      send(res, 400, { error: "facilityId, medicineId, quantity (> 0) and receivedAt are required" });
      return;
    }
    const facility = db.prepare(`SELECT id FROM facilities WHERE id = ?`).get(body.facilityId);
    const medicine = db.prepare(`SELECT id FROM medicines WHERE id = ?`).get(body.medicineId);
    if (!facility || !medicine) {
      send(res, 400, { error: "unknown facilityId or medicineId" });
      return;
    }
    const receipt = createReceipt(body as NewReceiptBody);
    send(res, 201, receipt);
  },

  "GET /api/invoices": (_req, res) => {
    send(res, 200, db.prepare(`SELECT * FROM invoice_receipts ORDER BY id ASC`).all());
  },

  "GET /api/expiry-watch": (_req, res) => {
    send(
      res,
      200,
      db
        .prepare(
          `SELECT a.*, f.name AS facility_name, m.name AS medicine_name FROM expiry_watch_alerts a
           JOIN facilities f ON f.id = a.facility_id JOIN medicines m ON m.id = a.medicine_id
           ORDER BY a.days_remaining ASC`
        )
        .all()
    );
  },

  "GET /api/supplier-trust": (_req, res) => {
    send(
      res,
      200,
      db
        .prepare(
          `SELECT e.facility_id, f.name AS facility_name, e.running_score, e.created_at
           FROM supplier_trust_events e
           JOIN facilities f ON f.id = e.facility_id
           WHERE e.id IN (SELECT MAX(id) FROM supplier_trust_events GROUP BY facility_id)
           ORDER BY e.running_score ASC`
        )
        .all()
    );
  },

  "GET /api/seasonal-signals": (_req, res) => {
    send(
      res,
      200,
      db
        .prepare(
          `SELECT s.*, m.name AS medicine_name FROM seasonal_volume_agg s
           JOIN medicines m ON m.id = s.medicine_id
           ORDER BY s.year_month DESC, s.imbalance_flag DESC`
        )
        .all()
    );
  },

  "GET /api/regional-signals": (_req, res) => {
    send(res, 200, db.prepare(`SELECT * FROM regional_signal_events ORDER BY created_at DESC`).all());
  },

  "GET /api/redistribution": (_req, res) => {
    send(
      res,
      200,
      db
        .prepare(
          `SELECT r.*, m.name AS medicine_name, ff.name AS from_facility_name, tf.name AS to_facility_name
           FROM redistribution_recommendations r
           JOIN medicines m ON m.id = r.medicine_id
           JOIN facilities ff ON ff.id = r.from_facility_id
           JOIN facilities tf ON tf.id = r.to_facility_id
           WHERE r.status = 'suggested'
           ORDER BY r.created_at DESC`
        )
        .all()
    );
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const key = `${req.method} ${url.pathname}`;
  const handler = routes[key];
  if (!handler) {
    send(res, 404, { error: "not found" });
    return;
  }
  try {
    await handler(req, res);
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`invoice-intake backend (SQLite-persisted) listening on http://localhost:${PORT}`);
});
