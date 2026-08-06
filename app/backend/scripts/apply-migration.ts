// Applies supabase/migrations/*.sql over a direct Postgres connection.
// Usage: set DATABASE_URL in app/backend/.env (or env), then: npm run migrate
import "dotenv/config";
import { Client } from "pg";
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "..", "supabase", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set (postgresql://... from Supabase → Connect).");
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    console.log("applying", f);
    await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf-8"));
  }
  const r = await client.query("select name from products order by name");
  console.log("products seeded:", r.rows.map((x) => x.name).join(", "));
  await client.end();
  console.log("done");
}

main().catch((e) => {
  console.error("migration failed:", e.message);
  process.exit(1);
});
