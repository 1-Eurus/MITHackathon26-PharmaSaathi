import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FACILITIES, MEDICINES } from "./catalog.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "data");
mkdirSync(dataDir, { recursive: true });

export const db: DatabaseSync = new DatabaseSync(path.join(dataDir, "pharmasaathi.db"));

db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));

// seed the reference tables (idempotent - INSERT OR IGNORE keys off the PK)
const insertFacility = db.prepare("INSERT OR IGNORE INTO facilities (id, name, hub_id) VALUES (?, ?, ?)");
FACILITIES.forEach((f) => insertFacility.run(f.id, f.name, f.hub));

const insertMedicine = db.prepare("INSERT OR IGNORE INTO medicines (id, name, ven, category) VALUES (?, ?, ?, ?)");
MEDICINES.forEach((m) => insertMedicine.run(m.id, m.name, m.ven, m.category));
