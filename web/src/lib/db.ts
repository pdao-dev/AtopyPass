import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.SQLITE_PATH ?? "./data/atopypass.db";

// Ensure the data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Run migrations (idempotent)
const schema = fs.readFileSync(
  path.join(process.cwd(), "db", "schema.sql"),
  "utf-8",
);
db.exec(schema);

export default db;
